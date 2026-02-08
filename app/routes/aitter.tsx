import type {Route} from "./+types/aitter";
import {useRevalidator} from "react-router";
import {drizzle} from "drizzle-orm/d1";
import {tweets} from "../db/schema";
import {desc, eq, sql} from "drizzle-orm";

// --- Configuration ---
const DISPLAY_COUNT = 20; // タイムラインに表示するツイート数
const NEW_PER_LOAD = 3; // リロードごとに新たに表示するツイート数（1日4回生成×12件=48件/日に対応）

// --- Meta ---
export function meta(): Route.MetaDescriptors {
	return [
		{ title: "タイムライン" },
		{ name: "description", content: "AIが生成するSNSタイムライン" },
	];
}

// --- Loader (読み取り専用: ツイート生成は Cron で実行) ---
export async function loader({ context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);

	// 1. 未表示ツイートの一部を「表示済み」に切り替える（新着感を演出）
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

	// 2. 表示済みツイートからランダムに選出（訪問ごとに異なるタイムラインを表示）
	const randomTimeline = await db
		.select()
		.from(tweets)
		.where(eq(tweets.displayed, true))
		.orderBy(sql`RANDOM()`)
		.limit(DISPLAY_COUNT);

	// 3. 時系列でソート（新しい順）して自然なタイムライン表示に
	const timeline = [...randomTimeline].sort((a, b) => {
		const aTime = a.createdAt?.getTime() ?? 0;
		const bTime = b.createdAt?.getTime() ?? 0;
		return bTime - aTime;
	});

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
