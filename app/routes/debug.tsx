import type { Route } from "./+types/debug";
import { useFetcher } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { newsCache } from "../db/schema";
import { desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";

// --- Meta ---
export function meta(): Route.MetaDescriptors {
	return [
		{ title: "デバッグ: AI生成結果" },
		{ name: "robots", content: "noindex" },
	];
}

// --- Loader ---
export async function loader({ context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);

	const entries = await db
		.select()
		.from(newsCache)
		.orderBy(desc(newsCache.createdAt))
		.limit(10);

	return { entries };
}

// --- Action: Step 1 キャッシュを再取得 ---
export async function action({ context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const apiKey = context.cloudflare.env.GEMINI_API_KEY as string;

	if (!apiKey) {
		return { error: "GEMINI_API_KEY が設定されていません" };
	}

	const ai = new GoogleGenAI({ apiKey });

	const yesterday = new Date(Date.now() - 86400000).toLocaleDateString(
		"ja-JP",
		{
			year: "numeric",
			month: "long",
			day: "numeric",
			weekday: "long",
		},
	);

	const todayKey = new Date().toISOString().slice(0, 10);

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

	try {
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

		if (newsContext.length === 0) {
			return { error: "Gemini からの応答が空でした" };
		}

		// 旧キャッシュは削除せず新規挿入
		await db
			.insert(newsCache)
			.values({ content: newsContext, fetchedDate: todayKey })
			.execute();

		return { ok: true, length: newsContext.length };
	} catch (e) {
		console.error("Debug: news cache refresh error:", e);
		return {
			error: `Gemini API エラー: ${e instanceof Error ? e.message : String(e)}`,
		};
	}
}

// --- Component ---
export default function Debug({ loaderData }: Route.ComponentProps) {
	const fetcher = useFetcher<typeof action>();
	const isRefreshing =
		fetcher.state === "submitting" || fetcher.state === "loading";

	return (
		<div className="min-h-screen bg-black text-white font-sans">
			{/* Header */}
			<header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800">
				<div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="text-lg">🔍</span>
						<h1 className="text-lg font-bold">
							デバッグ: Step 1 AI生成結果
						</h1>
					</div>
					<div className="flex items-center gap-3">
						<fetcher.Form method="post">
							<button
								type="submit"
								disabled={isRefreshing}
								className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-amber-400/10 border border-amber-400/30"
							>
								<svg
									className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
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
								{isRefreshing
									? "取得中..."
									: "Step 1 キャッシュを再取得"}
							</button>
						</fetcher.Form>
						<a
							href="/"
							className="text-sm text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded-full hover:bg-blue-400/10"
						>
							タイムラインに戻る
						</a>
					</div>
				</div>
			</header>

			<main className="max-w-3xl mx-auto px-4 py-6">
				{/* Action result feedback */}
				{fetcher.data && "error" in fetcher.data && (
					<div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
						{fetcher.data.error}
					</div>
				)}
				{fetcher.data && "ok" in fetcher.data && (
					<div className="mb-4 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
						キャッシュを更新しました（{fetcher.data.length}文字）
					</div>
				)}

				{loaderData.entries.length === 0 ? (
					<div className="p-12 text-center text-gray-500">
						<div className="text-4xl mb-4">📭</div>
						<p className="text-lg mb-2">
							ニュースキャッシュがありません
						</p>
						<p className="text-sm">
							上の「Step 1
							キャッシュを再取得」ボタンでニュースを取得できます
						</p>
					</div>
				) : (
					<div className="space-y-6">
						{loaderData.entries.map((entry, index) => (
							<article
								key={entry.id}
								className="border border-gray-800 rounded-lg overflow-hidden"
							>
								{/* Entry header */}
								<div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/50 border-b border-gray-800">
									<div className="flex items-center gap-3 text-sm">
										<span className="font-mono text-gray-400">
											ID: {entry.id}
										</span>
										<span className="text-gray-600">|</span>
										<span className="text-blue-400 font-medium">
											{entry.fetchedDate}
										</span>
										{index === 0 && (
											<span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-500/20 text-green-400">
												最新
											</span>
										)}
									</div>
									{entry.createdAt && (
										<span className="text-xs text-gray-500">
											{entry.createdAt.toLocaleString(
												"ja-JP",
											)}
										</span>
									)}
								</div>

								{/* Content length indicator */}
								<div className="px-4 py-1.5 bg-gray-900/30 border-b border-gray-800 text-xs text-gray-500">
									文字数: {entry.content.length}
								</div>

								{/* Raw content */}
								<div className="px-4 py-3">
									<pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300 font-sans">
										{entry.content}
									</pre>
								</div>
							</article>
						))}
					</div>
				)}
			</main>
		</div>
	);
}
