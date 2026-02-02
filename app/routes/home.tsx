import type {Route} from "./+types/home";
import {useRevalidator} from "react-router";
import {drizzle, type DrizzleD1Database} from "drizzle-orm/d1";
import {tweets, newsCache} from "../db/schema";
import {desc, eq, sql} from "drizzle-orm";
import {GoogleGenAI} from "@google/genai";

// --- Configuration ---
const GENERATION_COOLDOWN_MS = 2 * 60 * 1000; // 2分間のクールダウン
const BATCH_SIZE = 12; // 1回のGemini呼び出しで生成するツイート数
const DISPLAY_COUNT = 25; // タイムラインに表示するツイート数
const NEW_PER_LOAD = 5; // リロードごとに新たに表示するツイート数
const UNSHOWN_THRESHOLD = 8; // この数を下回ったらGeminiでバッチ生成

// --- Types ---
interface GeneratedTweet {
	content: string;
	authorName: string;
	authorHandle: string;
	authorEmoji: string;
	category: string;
	sourceUrl: string;
}

// --- Gemini batch generation (2段階: 検索→JSON生成) ---
async function generateTweetBatch(
	apiKey: string,
	pastTweets: string[],
	db: DrizzleD1Database,
): Promise<GeneratedTweet[]> {
	try {
		const ai = new GoogleGenAI({ apiKey });

		const yesterday = new Date(Date.now() - 86400000).toLocaleDateString("ja-JP", {
			year: "numeric",
			month: "long",
			day: "numeric",
			weekday: "long",
		});

		// 今日の日付キー (YYYY-MM-DD)
		const todayKey = new Date().toISOString().slice(0, 10);

		// ステップ1: ニュースキャッシュを確認し、なければGoogle検索で取得
		let newsContext = "";

		const [cached] = await db
			.select({ content: newsCache.content })
			.from(newsCache)
			.where(eq(newsCache.fetchedDate, todayKey))
			.orderBy(desc(newsCache.createdAt))
			.limit(1);

		if (cached) {
			console.log("Step 1: Using cached news context from DB");
			newsContext = cached.content;
		} else {
			console.log("Step 1: Fetching latest news via Google Search grounding...");
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
		}

		console.log(`Step 1 done: news context length = ${newsContext.length}`);
		if (newsContext.length > 0) {
			console.log(
				`News context: ${newsContext}`,
			);
		}

		// ステップ2: ニュースコンテキストを基にJSON形式でツイート生成
		console.log("Step 2: Generating tweets as JSON...");

		const pastTweetsSection =
			pastTweets.length > 0
				? `\n【過去に生成済みのツイート（これらと内容が被らないようにしてください）】\n${pastTweets.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n`
				: "";

		const newsSection =
			newsContext.length > 0
				? `\n【最新ニュース・話題（これらを基にツイートを作成してください）】\n${newsContext}\n`
				: "";

		const generatePrompt = `あなたはSNS「X (旧Twitter)」のリアルなタイムラインを生成するAIです。
多様でリアルなツイートを${BATCH_SIZE}件生成してください。

【今日の日付】${yesterday}
${newsSection}
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
		console.log(
			`Step 2 response (first 300 chars): ${text.substring(0, 300)}`,
		);

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
	} catch (e) {
		console.error("Gemini generation error:", e);
		return [];
	}
}

// --- Fallback tweets (Gemini未設定/失敗時) ---
function getFallbackTweets(): GeneratedTweet[] {
	return [
		{
			content:
				"【速報】大手テック企業がエッジコンピューティング分野に大型投資を発表。クラウドからエッジへのシフトが本格化。開発者にとってはCloudflare Workersのようなプラットフォームの重要性がますます高まりそう。",
			authorName: "テックニュース速報",
			authorHandle: "tech_breaking",
			authorEmoji: "⚡",
			category: "tech",
			sourceUrl: "https://www.google.com/search?q=%E3%82%A8%E3%83%83%E3%82%B8%E3%82%B3%E3%83%B3%E3%83%94%E3%83%A5%E3%83%BC%E3%83%86%E3%82%A3%E3%83%B3%E3%82%B0+%E6%8A%95%E8%B3%87",
		},
		{
			content:
				"与党の新しい経済対策案、減税と給付金の組み合わせか。野党は「規模が不十分」と批判してるけど、財源の議論が一番大事なのでは。国会中継ちゃんと見てる人どれくらいいるんだろう。",
			authorName: "政治ウォッチャー",
			authorHandle: "politics_watch",
			authorEmoji: "🏛️",
			category: "politics",
			sourceUrl: "https://www.google.com/search?q=%E7%B5%8C%E6%B8%88%E5%AF%BE%E7%AD%96+%E6%B8%9B%E7%A8%8E+%E7%B5%A6%E4%BB%98%E9%87%91",
		},
		{
			content:
				"「上司に有給の理由聞かれて『私用です』って答えたら『私用って何？』って聞き返された」ってポスト、10万いいね超えてて笑う。みんな同じ経験してるんだな。 #あるある",
			authorName: "バズ収集家",
			authorHandle: "buzz_collector",
			authorEmoji: "🔥",
			category: "buzz",
			sourceUrl: "https://www.google.com/search?q=%E6%9C%89%E7%B5%A6+%E7%A7%81%E7%94%A8+%E3%83%90%E3%82%BA",
		},
		{
			content:
				"今期ドラマの視聴率ランキング見たけど、配信時代に視聴率で語る意味あるのかな。TVerの再生数込みで評価しないと実態と乖離しすぎてる。推しの出てるドラマが低視聴率扱いされるの納得いかん。",
			authorName: "ドラマ垢",
			authorHandle: "drama_addict",
			authorEmoji: "🎬",
			category: "entertainment",
			sourceUrl: "https://www.google.com/search?q=%E3%83%89%E3%83%A9%E3%83%9E+%E8%A6%96%E8%81%B4%E7%8E%87+TVer",
		},
		{
			content:
				"物価上昇が止まらない。スーパーの卵、1年前の1.5倍になってない？実質賃金のマイナスが続く中、「景気は緩やかに回復」という政府発表との温度差がすごい。",
			authorName: "生活防衛隊",
			authorHandle: "seikatsu_bouei",
			authorEmoji: "📊",
			category: "society",
			sourceUrl: "https://www.google.com/search?q=%E7%89%A9%E4%BE%A1%E4%B8%8A%E6%98%87+%E5%AE%9F%E8%B3%AA%E8%B3%83%E9%87%91",
		},
		{
			content:
				"JAXAの小型月着陸実証機SLIMの成果が論文に。ピンポイント着陸の精度がすごい。日本の宇宙技術、予算少ない中でこの成果出せるの本当にすごいと思う。もっと予算つけてほしい。 #JAXA",
			authorName: "宇宙好きのひと",
			authorHandle: "space_fan_jp",
			authorEmoji: "🚀",
			category: "science",
			sourceUrl: "https://www.google.com/search?q=JAXA+SLIM+%E6%9C%88%E7%9D%80%E9%99%B8",
		},
		{
			content:
				"浦安の市民祭り、今年もすごい人出だった。地元の飲食店の屋台が充実してて最高。新浦安駅前の再開発も進んでるし、住みやすさランキング上位なの納得。 #浦安",
			authorName: "浦安市民",
			authorHandle: "urayasu_life",
			authorEmoji: "🏠",
			category: "urayasu",
			sourceUrl: "https://www.google.com/search?q=%E6%B5%A6%E5%AE%89+%E5%B8%82%E6%B0%91%E7%A5%AD%E3%82%8A",
		},
		{
			content:
				"渋谷の再開発、また新しいビルできるらしい。もう何がどこだかわからなくなってきた。東京駅周辺も変わりすぎて、数年前のGoogle Mapの方が役に立つまである。 #東京",
			authorName: "東京散歩",
			authorHandle: "tokyo_walker",
			authorEmoji: "🗼",
			category: "tokyo",
			sourceUrl: "https://www.google.com/search?q=%E6%B8%8B%E8%B0%B7+%E5%86%8D%E9%96%8B%E7%99%BA",
		},
		{
			content:
				"西条のうちぬきの水、やっぱり最高に美味い。名水百選なの伊達じゃない。東京に戻ると水道水飲めなくなるのが唯一の欠点。石鎚山の恵みに感謝。 #西条市 #うちぬき",
			authorName: "西条っ子",
			authorHandle: "saijo_love",
			authorEmoji: "💧",
			category: "saijo",
			sourceUrl: "https://www.google.com/search?q=%E8%A5%BF%E6%9D%A1+%E3%81%86%E3%81%A1%E3%81%AC%E3%81%8D+%E5%90%8D%E6%B0%B4%E7%99%BE%E9%81%B8",
		},
		{
			content:
				"最近のカフェ、Wi-Fiとコンセント完備なのは嬉しいけど、居心地良すぎて気づいたら5時間経ってる。コーヒー1杯で粘る自分に罪悪感を感じつつ、2杯目を注文する日常。",
			authorName: "カフェ難民",
			authorHandle: "cafe_nomad",
			authorEmoji: "☕",
			category: "life",
			sourceUrl: "https://www.google.com/search?q=%E3%82%AB%E3%83%95%E3%82%A7+Wi-Fi+%E3%83%8E%E3%83%9E%E3%83%89",
		},
		{
			content:
				"AIコーディングアシスタント使い始めて半年。生産性は確実に上がったけど、自分でゼロから考える力が鈍ってきてる気がする。ツールとの距離感、定期的に見直さないとまずいかも。",
			authorName: "考えるエンジニア",
			authorHandle: "thinking_dev",
			authorEmoji: "🤔",
			category: "opinion",
			sourceUrl: "https://www.google.com/search?q=AI+%E3%82%B3%E3%83%BC%E3%83%87%E3%82%A3%E3%83%B3%E3%82%B0+%E3%82%A2%E3%82%B7%E3%82%B9%E3%82%BF%E3%83%B3%E3%83%88",
		},
		{
			content:
				"金曜の夜にデプロイする勇者、今週もお疲れ様でした。本番環境は無事ですか？我々の週末の平和は、あなたのロールバック計画にかかっています。",
			authorName: "インフラの番人",
			authorHandle: "infra_guardian",
			authorEmoji: "🛡️",
			category: "dev",
			sourceUrl: "https://www.google.com/search?q=%E9%87%91%E6%9B%9C+%E3%83%87%E3%83%97%E3%83%AD%E3%82%A4+%E3%83%AD%E3%83%BC%E3%83%AB%E3%83%90%E3%83%83%E3%82%AF",
		},
	];
}

// --- Random engagement numbers ---
function randomEngagement() {
	return {
		likes: Math.floor(Math.random() * 800) + 1,
		retweets: Math.floor(Math.random() * 150),
		replies: Math.floor(Math.random() * 60),
		views: Math.floor(Math.random() * 80000) + 100,
	};
}

// --- Meta ---
export function meta(): Route.MetaDescriptors {
	return [
		{ title: "タイムライン" },
		{ name: "description", content: "AIが生成するSNSタイムライン" },
	];
}

// --- Loader ---
export async function loader({ context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const apiKey = context.cloudflare.env.GEMINI_API_KEY as string;

	// 1. 未表示ツイートの件数を取得
	const [unshownResult] = await db
		.select({ count: sql<number>`count(*)` })
		.from(tweets)
		.where(eq(tweets.displayed, false));
	const unshownCount = unshownResult?.count ?? 0;

	// 2. 未表示ストックが閾値以下なら新規バッチ生成を検討
	if (unshownCount < UNSHOWN_THRESHOLD) {
		// クールダウンチェック: 最新ツイートの作成日時を確認
		const [mostRecent] = await db
			.select({ createdAt: tweets.createdAt })
			.from(tweets)
			.orderBy(desc(tweets.createdAt))
			.limit(1);

		const now = Date.now();
		const lastCreated = mostRecent?.createdAt?.getTime() ?? 0;
		const elapsed = now - lastCreated;

		if (elapsed > GENERATION_COOLDOWN_MS || !mostRecent) {
			// 過去のツイート内容を取得（重複防止用）
			const recentTweets = await db
				.select({ content: tweets.content })
				.from(tweets)
				.orderBy(desc(tweets.createdAt))
				.limit(50);
			const pastTweetContents = recentTweets.map((t) => t.content);

			let generated: GeneratedTweet[] = [];

			if (apiKey) {
				console.log(
					`Generating tweet batch via Gemini... (API key length: ${apiKey.length})`,
				);
				generated = await generateTweetBatch(apiKey, pastTweetContents, db);
				console.log(
					`Gemini returned ${generated.length} tweets`,
				);
			} else {
				console.log(
					"GEMINI_API_KEY is not set or empty, skipping Gemini generation",
				);
			}

			// Gemini失敗時またはAPIキー未設定時はフォールバック
			if (generated.length === 0) {
				console.log("Using fallback tweets.");
				generated = getFallbackTweets();
			}

			// タイムスタンプを等間隔に割り当て（最初のツイートが最新、最後が最古）
			// バッチ内の順番は配列順で安定し、既存ツイートより常に新しくなる
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
			console.log(`Saved ${generated.length} tweets to DB`);
		}
	}

	// 3. 未表示ツイートの一部を「表示済み」に切り替える（新着感を演出）
	const newTweets = await db
		.select()
		.from(tweets)
		.where(eq(tweets.displayed, false))
		.orderBy(desc(tweets.createdAt))
		.limit(NEW_PER_LOAD);

	if (newTweets.length > 0) {
		for (const t of newTweets) {
			await db
				.update(tweets)
				.set({ displayed: true })
				.where(eq(tweets.id, t.id))
				.execute();
		}
	}

	// 4. 表示済みツイートを取得してタイムラインに返す（新しい順）
	const timeline = await db
		.select()
		.from(tweets)
		.where(eq(tweets.displayed, true))
		.orderBy(desc(tweets.createdAt))
		.limit(DISPLAY_COUNT);

	return { tweets: timeline };
}

// --- Relative time helper ---
function relativeTime(date: Date | null): string {
	if (!date) return "";
	const now = Date.now();
	const diff = now - date.getTime();
	const seconds = Math.floor(diff / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (seconds < 60) return `${seconds}秒`;
	if (minutes < 60) return `${minutes}分`;
	if (hours < 24) return `${hours}時間`;
	if (days < 30) return `${days}日`;
	return date.toLocaleDateString("ja-JP", { month: "short", day: "numeric" });
}

// --- Format large numbers ---
function formatNumber(n: number): string {
	if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
	if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
	return n.toString();
}

// --- Extract hostname safely ---
function extractHostname(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return url;
	}
}

// --- Category badge ---
function categoryLabel(category: string): string | null {
	const map: Record<string, string> = {
		tech: "テック",
		politics: "政治",
		buzz: "バズ",
		entertainment: "芸能",
		society: "社会",
		science: "科学",
		urayasu: "浦安",
		tokyo: "東京",
		saijo: "西条",
		life: "ライフ",
		opinion: "オピニオン",
		dev: "開発",
	};
	return map[category] ?? null;
}

function categoryColor(category: string): string {
	const map: Record<string, string> = {
		tech: "bg-blue-500/20 text-blue-400",
		politics: "bg-red-500/20 text-red-400",
		buzz: "bg-pink-500/20 text-pink-400",
		entertainment: "bg-fuchsia-500/20 text-fuchsia-400",
		society: "bg-orange-500/20 text-orange-400",
		science: "bg-emerald-500/20 text-emerald-400",
		urayasu: "bg-sky-500/20 text-sky-400",
		tokyo: "bg-violet-500/20 text-violet-400",
		saijo: "bg-lime-500/20 text-lime-400",
		life: "bg-green-500/20 text-green-400",
		opinion: "bg-amber-500/20 text-amber-400",
		dev: "bg-cyan-500/20 text-cyan-400",
	};
	return map[category] ?? "bg-gray-500/20 text-gray-400";
}

// --- Component ---
export default function Home({ loaderData }: Route.ComponentProps) {
	const revalidator = useRevalidator();

	return (
		<div className="min-h-screen bg-black text-white font-sans">
			{/* Header */}
			<header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800">
				<div className="max-w-xl mx-auto px-4 py-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<svg
							className="w-6 h-6 text-white"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
						</svg>
						<h1 className="text-lg font-bold">タイムライン</h1>
					</div>
					<button
						type="button"
						onClick={() => revalidator.revalidate()}
						disabled={revalidator.state === "loading"}
						className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-blue-400/10"
					>
						<svg
							className={`w-4 h-4 ${revalidator.state === "loading" ? "animate-spin" : ""}`}
							fill="none"
							viewBox="0 0 24 24"
							stroke="currentColor"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						更新
					</button>
				</div>
			</header>

			{/* Timeline */}
			<main className="max-w-xl mx-auto divide-y divide-gray-800">
				{loaderData.tweets.length === 0 ? (
					<div className="p-12 text-center text-gray-500">
						<div className="text-4xl mb-4">📡</div>
						<p className="text-lg mb-2">タイムラインは空です</p>
						<p className="text-sm">
							更新ボタンを押してフィードを読み込みましょう
						</p>
					</div>
				) : (
					loaderData.tweets.map((tweet) => {
						const label = categoryLabel(tweet.category);
						return (
							<article
								key={tweet.id}
								className="px-4 py-3 hover:bg-white/[0.03] transition-colors"
							>
								<div className="flex gap-3">
									{/* Avatar */}
									<div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-lg select-none">
										{tweet.authorEmoji}
									</div>

									{/* Content */}
									<div className="flex-grow min-w-0">
										{/* Author row */}
										<div className="flex items-center gap-1 text-sm flex-wrap">
											<span className="font-bold text-gray-100 truncate">
												{tweet.authorName}
											</span>
											<span className="text-gray-500 truncate">
												@{tweet.authorHandle}
											</span>
											<span className="text-gray-600">·</span>
											<span className="text-gray-500 whitespace-nowrap">
												{relativeTime(tweet.createdAt)}
											</span>
											{label && (
												<span
													className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColor(tweet.category)}`}
												>
													{label}
												</span>
											)}
										</div>

										{/* Tweet body */}
										<p className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap break-words text-gray-100">
											{tweet.content}
										</p>

										{/* Source link */}
										{tweet.sourceUrl && (
											<a
												href={tweet.sourceUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 hover:underline transition-colors"
											>
												<svg
													className="w-3.5 h-3.5"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													strokeWidth={1.5}
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.86-2.04a4.5 4.5 0 00-6.364-6.364L4.5 8.257"
													/>
												</svg>
												{extractHostname(tweet.sourceUrl)}
											</a>
										)}

										{/* Engagement bar */}
										<div className="flex items-center gap-6 mt-2.5 text-gray-500 text-xs">
											{/* Reply */}
											<span className="flex items-center gap-1.5 hover:text-blue-400 transition-colors cursor-default">
												<svg
													className="w-4 h-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													strokeWidth={1.5}
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 1.59.466 3.072 1.264 4.32L3 20.25l3.68-1.263A9.559 9.559 0 0012 20.25z"
													/>
												</svg>
												{formatNumber(tweet.replies)}
											</span>

											{/* Repost */}
											<span className="flex items-center gap-1.5 hover:text-green-400 transition-colors cursor-default">
												<svg
													className="w-4 h-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													strokeWidth={1.5}
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3"
													/>
												</svg>
												{formatNumber(tweet.retweets)}
											</span>

											{/* Like */}
											<span className="flex items-center gap-1.5 hover:text-pink-400 transition-colors cursor-default">
												<svg
													className="w-4 h-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													strokeWidth={1.5}
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
													/>
												</svg>
												{formatNumber(tweet.likes)}
											</span>

											{/* Views */}
											<span className="flex items-center gap-1.5 hover:text-blue-400 transition-colors cursor-default">
												<svg
													className="w-4 h-4"
													fill="none"
													viewBox="0 0 24 24"
													stroke="currentColor"
													strokeWidth={1.5}
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
													/>
												</svg>
												{formatNumber(tweet.views)}
											</span>
										</div>
									</div>
								</div>
							</article>
						);
					})
				)}
			</main>

			{/* Footer */}
			<footer className="max-w-xl mx-auto px-4 py-8 text-center text-gray-600 text-xs">
				<p>
					このタイムラインはAIによって生成されたフィクションです。
					<br />
					実在の人物・団体・出来事とは関係ありません。
				</p>
			</footer>
		</div>
	);
}
