import { GoogleGenAI } from "@google/genai";
import { drizzle } from "drizzle-orm/d1";
import { tweets, newsCache, scrapedArticles } from "../app/db/schema";
import { desc, eq, sql, inArray } from "drizzle-orm";

// --- Configuration ---
const BATCH_SIZE = 12;
const UNSHOWN_THRESHOLD = 8;

// --- Types ---
interface GeneratedTweet {
	content: string;
	authorName: string;
	authorHandle: string;
	authorEmoji: string;
	category: string;
	sourceUrl: string;
}

/**
 * Step 1: ニュースコンテキストを取得（キャッシュがあればそれを使う）
 */
async function fetchNewsContext(
	ai: GoogleGenAI,
	db: ReturnType<typeof drizzle>,
): Promise<string> {
	const todayKey = getTodayJST();

	// キャッシュ確認
	const [cached] = await db
		.select({ content: newsCache.content })
		.from(newsCache)
		.where(eq(newsCache.fetchedDate, todayKey))
		.orderBy(desc(newsCache.createdAt))
		.limit(1);

	if (cached) {
		console.log("Step 1: Using cached news context from DB");
		return cached.content;
	}

	console.log("Step 1: Fetching latest news via Google Search grounding...");

	const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(
		"ja-JP",
		{
			year: "numeric",
			month: "long",
			day: "numeric",
			weekday: "long",
		},
	);

	const searchPrompt = `今日は${yesterday}です。
以下のカテゴリごとに、今日の日本と世界の最新ニュース・話題を1〜2件ずつ箇条書きで教えてください。
各ニュースには元のニュース記事のURLも必ず含めてください。

カテゴリ:
- テクノロジー（AI、Web開発、ガジェット、スタートアップ）
- 政治（国内外の政治動向、選挙、政策）
- バズ（SNSで話題の投稿、面白ネタ）
- 芸能（芸能人、ドラマ、映画、音楽）
- 社会（社会問題、事件・事故、経済）
- 科学（科学技術、宇宙、医療、環境）
- 浦安（浦安市のニュース、ディズニーリゾート）
- 東京（東京のイベント、再開発、グルメ）
- 西条・愛媛（西条市の話題、石鎚山、だんじり）
- ライフ（日常の話題、トレンド）
- 開発（プログラミング、エンジニアリング）`;

	const searchResponse = await ai.models.generateContent({
		model: "gemini-2.5-flash",
		contents: searchPrompt,
		config: {
			tools: [{ googleSearch: {} }],
		},
	});

	let newsContext = "";
	try {
		newsContext = searchResponse.text ?? "";
	} catch {
		const parts = searchResponse.candidates?.[0]?.content?.parts;
		if (parts) {
			newsContext = parts
				.filter((p: { text?: string }) => typeof p.text === "string")
				.map((p: { text?: string }) => p.text)
				.join("");
		}
	}

	// キャッシュに保存
	if (newsContext.length > 0) {
		await db
			.insert(newsCache)
			.values({ content: newsContext, fetchedDate: todayKey })
			.execute();
		console.log("Step 1: Saved news context to cache");
	}

	console.log(`Step 1 done: news context length = ${newsContext.length}`);
	return newsContext;
}

/** スクレイピング記事の型 */
interface ScrapedArticleInfo {
	articleUrl: string;
	articleTitle: string;
	category: string | null;
	siteName: string;
}

/**
 * Step 2: ニュースコンテキストを基にツイートを生成
 */
async function generateTweets(
	ai: GoogleGenAI,
	newsContext: string,
	pastTweets: string[],
	scrapedArticleList: ScrapedArticleInfo[],
): Promise<GeneratedTweet[]> {
	console.log("Step 2: Generating tweets as JSON...");

	const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(
		"ja-JP",
		{
			year: "numeric",
			month: "long",
			day: "numeric",
			weekday: "long",
		},
	);

	const pastTweetsSection =
		pastTweets.length > 0
			? `\n【過去に生成済みのツイート（これらと内容が被らないようにしてください）】\n${pastTweets.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n`
			: "";

	const newsSection =
		newsContext.length > 0
			? `\n【最新ニュース・話題（これらを基にツイートを作成してください）】\n${newsContext}\n`
			: "";

	const scrapedSection =
		scrapedArticleList.length > 0
			? `\n【スクレイピングで取得した最新記事（sourceUrlにはこれらの実際のURLを優先的に使用してください）】\n${scrapedArticleList.map((a) => `- [${a.category || a.siteName}] ${a.articleTitle}\n  URL: ${a.articleUrl}`).join("\n")}\n`
			: "";

	const generatePrompt = `あなたはSNS「X (旧Twitter)」のリアルなタイムラインを生成するAIです。
多様でリアルなツイートを${BATCH_SIZE}件生成してください。

【今日の日付】${yesterday}
${newsSection}${scrapedSection}
【カテゴリ（均等に分配）】
- tech: テクノロジー（AI、Web開発、ガジェット、スタートアップ）
- politics: 政治（国内外の政治動向、選挙、政策、国会。権力に対して批判的・懐疑的な市民目線で、政府や与党の発表を鵜呑みにせず問題点を指摘するトーン）
- buzz: バズ（SNSでバズっている話題、面白ネタ、拡散中の投稿）
- entertainment: 芸能（芸能人、ドラマ、映画、音楽、アイドル）
- society: 社会（社会問題、事件・事故、経済ニュース）
- science: 科学（科学技術、宇宙、医療、環境、研究成果）
- urayasu: 浦安（浦安市のローカルニュース、ディズニーリゾート、地域イベント）
- tokyo: 東京（東京の話題、イベント、再開発、グルメ、交通）
- saijo: 西条（愛媛県西条市のローカル話題、石鎚山、うちぬき、だんじり祭り）
- life: ライフ（日常の気づき、仕事あるある、人間観察、グルメ）
- opinion: オピニオン（社会・文化・働き方に関する鋭い個人的見解）
- dev: 開発（プログラミング・エンジニアリングの日常、技術ネタ）
${pastTweetsSection}
【条件】
- 日本語
- 各ツイート100〜280文字
- リアルなSNS口調（キャラごとに文体を変える。敬語、タメ口、独り言風など）
- 最新ニュースや実際の出来事を反映して書く
- 過去のツイートと同じ話題・内容・表現を避け、常に新鮮なツイートを生成する
- 各ツイートに元ネタとなったニュース記事のURLをsourceUrlとして含める（上記の最新ニュースに含まれるURLをそのまま使用すること。URLが見つからない場合は空文字列にする）
- ハッシュタグは0〜2個（使わないツイートもあり）
- 各ツイートに異なるBOTキャラクター（毎回新しいユニークなキャラを考案）
- リプライ風（「これマジ？」）、感想ツイート、ニュース速報風、日記風など多様なスタイルを混ぜる

以下のJSON配列のみを返してください。配列の要素数は必ず${BATCH_SIZE}件にしてください。`;

	const response = await ai.models.generateContent({
		model: "gemini-2.5-flash",
		contents: generatePrompt,
		config: {
			responseMimeType: "application/json",
			responseSchema: {
				type: "array",
				items: {
					type: "object",
					properties: {
						content: { type: "string" },
						authorName: { type: "string" },
						authorHandle: { type: "string" },
						authorEmoji: { type: "string" },
						category: { type: "string" },
						sourceUrl: { type: "string" },
					},
					required: [
						"content",
						"authorName",
						"authorHandle",
						"authorEmoji",
						"category",
						"sourceUrl",
					],
				},
			},
		},
	});

	const text = response.text ?? "";
	console.log(`Step 2 done: response length = ${text.length}`);

	if (!text.trim()) {
		console.error("Gemini returned empty JSON response");
		return [];
	}

	const parsed = JSON.parse(text) as GeneratedTweet[];
	console.log(`Parsed ${parsed.length} tweets from Gemini response`);

	const filtered = parsed.filter(
		(t) =>
			t.content &&
			t.authorName &&
			t.authorHandle &&
			t.authorEmoji &&
			t.category,
	);

	console.log(
		`After filtering: ${filtered.length} valid tweets (removed ${parsed.length - filtered.length})`,
	);

	return filtered;
}

/**
 * ランダムなエンゲージメント数値を生成
 */
function randomEngagement() {
	return {
		likes: Math.floor(Math.random() * 800) + 1,
		retweets: Math.floor(Math.random() * 150),
		replies: Math.floor(Math.random() * 60),
		views: Math.floor(Math.random() * 80000) + 100,
	};
}

/**
 * 日本時間で「今日」の日付を YYYY-MM-DD で返す
 */
function getTodayJST(): string {
	const now = new Date();
	const jstMs = now.getTime() + 9 * 60 * 60 * 1000;
	const today = new Date(jstMs);
	const y = today.getUTCFullYear();
	const m = String(today.getUTCMonth() + 1).padStart(2, "0");
	const d = String(today.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/**
 * ツイート生成の内部ロジック（閾値チェックなし）
 * Cron とデバッグ画面の両方から使用
 */
async function runTweetGeneration(env: Env): Promise<number> {
	const db = drizzle(env.DB);
	const apiKey = env.GEMINI_API_KEY;

	if (!apiKey) {
		throw new Error("GEMINI_API_KEY is not set");
	}

	const ai = new GoogleGenAI({ apiKey });

	// Step 1: ニュースコンテキスト取得
	const newsContext = await fetchNewsContext(ai, db);

	// 過去のツイート内容を取得（重複防止用）
	const recentTweets = await db
		.select({ content: tweets.content })
		.from(tweets)
		.orderBy(desc(tweets.createdAt))
		.limit(50);
	const pastTweetContents = recentTweets.map((t) => t.content);

	// スクレイピング記事を取得（未使用のものを優先）
	const recentArticles = await db
		.select({
			id: scrapedArticles.id,
			articleUrl: scrapedArticles.articleUrl,
			articleTitle: scrapedArticles.articleTitle,
			category: scrapedArticles.category,
			siteName: scrapedArticles.siteName,
		})
		.from(scrapedArticles)
		.where(eq(scrapedArticles.usedForTweet, false))
		.orderBy(desc(scrapedArticles.scrapedAt))
		.limit(30);

	console.log(`Found ${recentArticles.length} unused scraped articles`);

	// Step 2: ツイート生成
	const generated = await generateTweets(
		ai,
		newsContext,
		pastTweetContents,
		recentArticles,
	);

	if (generated.length === 0) {
		return 0;
	}

	// DB に保存
	const now = Date.now();
	const intervalMs = 60 * 1000; // 1分間隔
	for (let i = 0; i < generated.length; i++) {
		const tweet = generated[i];
		const engagement = randomEngagement();
		const createdAt = new Date(now - i * intervalMs);

		await db
			.insert(tweets)
			.values({
				content: tweet.content,
				authorName: tweet.authorName,
				authorHandle: tweet.authorHandle,
				authorEmoji: tweet.authorEmoji,
				category: tweet.category,
				sourceUrl: tweet.sourceUrl || "",
				...engagement,
				displayed: false,
				createdAt,
			})
			.execute();
	}

	// 使用したスクレイピング記事を usedForTweet = true に更新
	if (recentArticles.length > 0) {
		const usedArticleIds = recentArticles.map((a) => a.id);
		await db
			.update(scrapedArticles)
			.set({ usedForTweet: true })
			.where(inArray(scrapedArticles.id, usedArticleIds))
			.execute();
		console.log(`Marked ${usedArticleIds.length} articles as used`);
	}

	return generated.length;
}

/**
 * Cron から呼ばれるメインのツイート生成関数
 * 未表示ツイートが閾値以下の場合のみ生成する
 */
export async function generateAitterTweets(env: Env): Promise<void> {
	const db = drizzle(env.DB);

	if (!env.GEMINI_API_KEY) {
		console.log("GEMINI_API_KEY is not set, skipping AIteer cron");
		return;
	}

	// 未表示ツイートの件数を確認
	const [unshownResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(tweets)
		.where(eq(tweets.displayed, false));
	const unshownCount = unshownResult?.count ?? 0;

	console.log(`AIteer cron: ${unshownCount} unshown tweets (threshold: ${UNSHOWN_THRESHOLD})`);

	if (unshownCount >= UNSHOWN_THRESHOLD) {
		console.log("AIteer cron: Enough unshown tweets, skipping generation");
		return;
	}

	try {
		const count = await runTweetGeneration(env);
		console.log(`AIteer cron: Saved ${count} tweets to DB`);
	} catch (e) {
		console.error("AIteer cron error:", e);
	}
}

/**
 * デバッグ画面から呼ばれるツイート生成関数（閾値チェックなし、強制実行）
 */
export async function forceGenerateAitterTweets(env: Env): Promise<number> {
	return runTweetGeneration(env);
}
