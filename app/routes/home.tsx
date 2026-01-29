import type { Route } from "./+types/home";
import { useRevalidator } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { tweets } from "../db/schema";
import { desc, eq, sql } from "drizzle-orm";
import { GoogleGenerativeAI } from "@google/generative-ai";

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
}

// --- Gemini batch generation ---
async function generateTweetBatch(
	apiKey: string,
): Promise<GeneratedTweet[]> {
	try {
		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

		const today = new Date().toLocaleDateString("ja-JP", {
			year: "numeric",
			month: "long",
			day: "numeric",
			weekday: "long",
		});

		const prompt = `あなたはSNS「X (旧Twitter)」のリアルなタイムラインを生成するAIです。
多様でリアルなツイートを${BATCH_SIZE}件生成してください。

【今日の日付】${today}

【カテゴリ（均等に分配）】
- tech_news: 最新テクノロジーニュース（AI、Web開発、スタートアップ、ガジェット）
- trending: 今話題のトピック（エンタメ、スポーツ、社会現象、バズった出来事）
- opinion: 社会・文化・働き方に関する鋭い個人的見解
- life: 日常の気づき、仕事あるある、人間観察、グルメ
- dev: プログラミング・エンジニアリングの日常、技術ネタ

【条件】
- 日本語
- 各ツイート100〜280文字
- リアルなSNS口調（キャラごとに文体を変える。敬語、タメ口、独り言風など）
- 今日の日付を踏まえ、最新ニュースや季節の話題を想像して書く
- ハッシュタグは0〜2個（使わないツイートもあり）
- 各ツイートに異なるBOTキャラクター（毎回新しいユニークなキャラを考案）
- リプライ風（「これマジ？」）、感想ツイート、ニュース速報風、日記風など多様なスタイルを混ぜる

【出力形式】以下のJSON配列のみを返してください。
[
  {
    "content": "ツイート本文",
    "authorName": "表示名",
    "authorHandle": "handle_name",
    "authorEmoji": "絵文字1つ(アバター代わり)",
    "category": "カテゴリ名"
  }
]

JSON以外のテキストは一切出力しないでください。配列の要素数は必ず${BATCH_SIZE}件にしてください。`.trim();

		const result = await model.generateContent(prompt);
		const response = result.response;
		const text = response.text();

		// JSONパース（マークダウンコードブロック除去）
		const jsonStr = text
			.replace(/```json\n?/g, "")
			.replace(/```\n?/g, "")
			.trim();
		const parsed = JSON.parse(jsonStr) as GeneratedTweet[];

		return parsed.filter(
			(t) =>
				t.content &&
				t.authorName &&
				t.authorHandle &&
				t.authorEmoji &&
				t.category,
		);
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
				"TypeScriptの型システム、触れば触るほど奥が深い。Conditional Typesとinferの組み合わせでやりたいことが表現できた時の快感よ。型レベルプログラミングは知的パズルだ。 #TypeScript",
			authorName: "型パズラー",
			authorHandle: "type_puzzler",
			authorEmoji: "🧩",
			category: "dev",
		},
		{
			content:
				"AIコーディングアシスタント使い始めて半年。生産性は確実に上がったけど、自分でゼロから考える力が鈍ってきてる気がする。ツールとの距離感、定期的に見直さないとまずいかも。",
			authorName: "考えるエンジニア",
			authorHandle: "thinking_dev",
			authorEmoji: "🤔",
			category: "opinion",
		},
		{
			content:
				"【速報】大手テック企業がエッジコンピューティング分野に大型投資を発表。クラウドからエッジへのシフトが本格化。開発者にとってはCloudflare Workersのようなプラットフォームの重要性がますます高まりそう。",
			authorName: "テックニュース速報",
			authorHandle: "tech_breaking",
			authorEmoji: "⚡",
			category: "tech_news",
		},
		{
			content:
				"金曜の夜にデプロイする勇者、今週もお疲れ様でした。本番環境は無事ですか？我々の週末の平和は、あなたのロールバック計画にかかっています。",
			authorName: "インフラの番人",
			authorHandle: "infra_guardian",
			authorEmoji: "🛡️",
			category: "dev",
		},
		{
			content:
				"最近のカフェ、Wi-Fiとコンセント完備なのは嬉しいけど、居心地良すぎて気づいたら5時間経ってる。コーヒー1杯で粘る自分に罪悪感を感じつつ、2杯目を注文する日常。",
			authorName: "カフェ難民",
			authorHandle: "cafe_nomad",
			authorEmoji: "☕",
			category: "life",
		},
		{
			content:
				"今年の新語・流行語、ノミネート見たけど半分くらい知らない言葉だった。SNSのタイムラインだけで世の中を理解した気になってたけど、全然フィルターバブルの中だったわ。",
			authorName: "社会観察日記",
			authorHandle: "social_watcher",
			authorEmoji: "👁️",
			category: "trending",
		},
		{
			content:
				"リモートワーク3年目にして悟ったこと。「通勤時間がなくなった分」は仕事に吸収されるのではなく、睡眠に吸収される。人間の本能は正直。",
			authorName: "リモワの真実",
			authorHandle: "remote_truth",
			authorEmoji: "🏠",
			category: "life",
		},
		{
			content:
				"Rustの学習曲線がキツいって言われるけど、所有権システム理解した後のコード書いてる時の安心感は異常。コンパイラが通ったらほぼバグなしという体験、他の言語では味わえない。 #Rust",
			authorName: "Rustacean見習い",
			authorHandle: "rust_learner",
			authorEmoji: "🦀",
			category: "dev",
		},
		{
			content:
				"地方のスーパーで売ってた地元の日本酒が衝撃的に美味かった。東京では絶対手に入らないやつ。こういう出会いがあるから出張も悪くない。",
			authorName: "出張グルメ部",
			authorHandle: "business_gourmet",
			authorEmoji: "🍶",
			category: "life",
		},
		{
			content:
				"Web開発のトレンド、毎年「今年こそサーバーサイドの復権」って言われ続けてるけど、今年はガチだと思う。RSCもhtmxもSSRも、結局サーバーで処理する方が合理的なケースは多い。",
			authorName: "フロントエンド考古学",
			authorHandle: "frontend_arch",
			authorEmoji: "🏛️",
			category: "tech_news",
		},
		{
			content:
				"会議が多い日に限ってコードが書きたくなるの、あれ何なんだろう。逆に丸一日コーディングデーだと昼過ぎには集中力切れてる。人間の脳は天邪鬼すぎる。",
			authorName: "矛盾するエンジニア",
			authorHandle: "paradox_eng",
			authorEmoji: "🔄",
			category: "opinion",
		},
		{
			content:
				"深夜2時のコンビニ、なぜか異様に落ち着く。蛍光灯の白い光と、微かに聞こえるBGMと、他に客がいない空間。現代の禅寺はコンビニかもしれない。",
			authorName: "深夜徘徊部",
			authorHandle: "midnight_walk",
			authorEmoji: "🌙",
			category: "life",
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
	const apiKey = context.cloudflare.env.GEMINI_API_KEY;

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
			let generated: GeneratedTweet[] = [];

			if (apiKey) {
				console.log("Generating tweet batch via Gemini...");
				generated = await generateTweetBatch(apiKey);
			}

			// Gemini失敗時またはAPIキー未設定時はフォールバック
			if (generated.length === 0) {
				console.log("Using fallback tweets.");
				generated = getFallbackTweets();
			}

			// タイムスタンプを過去数時間にランダム分散させてリアルに見せる
			const baseTime = now;
			for (let i = 0; i < generated.length; i++) {
				const tweet = generated[i];
				const engagement = randomEngagement();
				const offsetMs = Math.floor(Math.random() * 3 * 60 * 60 * 1000); // 過去3時間以内
				const createdAt = new Date(baseTime - offsetMs);

				await db
					.insert(tweets)
					.values({
						content: tweet.content,
						authorName: tweet.authorName,
						authorHandle: tweet.authorHandle,
						authorEmoji: tweet.authorEmoji,
						category: tweet.category,
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

	// 4. 表示済みツイートを取得してタイムラインに返す
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

// --- Category badge ---
function categoryLabel(category: string): string | null {
	const map: Record<string, string> = {
		tech_news: "テック",
		trending: "トレンド",
		opinion: "オピニオン",
		life: "ライフ",
		dev: "開発",
	};
	return map[category] ?? null;
}

function categoryColor(category: string): string {
	const map: Record<string, string> = {
		tech_news: "bg-blue-500/20 text-blue-400",
		trending: "bg-purple-500/20 text-purple-400",
		opinion: "bg-amber-500/20 text-amber-400",
		life: "bg-green-500/20 text-green-400",
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
