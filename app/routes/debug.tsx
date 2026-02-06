import type { Route } from "./+types/debug";
import { useState } from "react";
import { useFetcher } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { newsCache, heroImages } from "../db/schema";
import { desc } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { generateHeroImage, regenerateHeroImageWithPrompt } from "../../workers/hero-image";

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

	const heroEntries = await db
		.select()
		.from(heroImages)
		.orderBy(desc(heroImages.createdAt))
		.limit(5);

	return { entries, heroEntries };
}

// --- Action: Step 1 キャッシュを再取得 / ヒーロー画像再生成 ---
export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "regenerate-hero") {
		try {
			await generateHeroImage(context.cloudflare.env);
			return { ok: true, intent: "hero", message: "ヒーローイメージを再生成しました" };
		} catch (e) {
			console.error("Hero image regeneration error:", e);
			return {
				error: `ヒーロー画像生成エラー: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}

	if (intent === "regenerate-hero-with-prompt") {
		const customPrompt = formData.get("prompt") as string;
		const targetDate = formData.get("date") as string;
		if (!customPrompt || !targetDate) {
			return { error: "プロンプトと日付は必須です" };
		}
		try {
			await regenerateHeroImageWithPrompt(context.cloudflare.env, customPrompt, targetDate);
			return { ok: true, intent: "hero", message: `${targetDate} のヒーローイメージをカスタムプロンプトで再生成しました` };
		} catch (e) {
			console.error("Hero image regeneration with prompt error:", e);
			return {
				error: `ヒーロー画像再生成エラー: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}

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
	const newsFetcher = useFetcher<typeof action>();
	const heroFetcher = useFetcher<typeof action>();
	const isRefreshingNews =
		newsFetcher.state === "submitting" || newsFetcher.state === "loading";
	const isRegeneratingHero =
		heroFetcher.state === "submitting" || heroFetcher.state === "loading";

	// どちらかの fetcher からの結果を表示
	const activeFetcherData = heroFetcher.data ?? newsFetcher.data;

	return (
		<div className="min-h-screen bg-black text-white font-sans">
			{/* Header */}
			<header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800">
				<div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						<span className="text-lg">🔍</span>
						<h1 className="text-lg font-bold">デバッグ</h1>
					</div>
					<div className="flex items-center gap-3">
						<newsFetcher.Form method="post">
							<button
								type="submit"
								disabled={isRefreshingNews}
								className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-amber-400/10 border border-amber-400/30"
							>
								<svg
									className={`w-4 h-4 ${isRefreshingNews ? "animate-spin" : ""}`}
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
								{isRefreshingNews
									? "取得中..."
									: "ニュースキャッシュ再取得"}
							</button>
						</newsFetcher.Form>
						<a
							href="/"
							className="text-sm text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded-full hover:bg-blue-400/10"
						>
							ホームに戻る
						</a>
					</div>
				</div>
			</header>

			<main className="max-w-3xl mx-auto px-4 py-6">
				{/* Action result feedback */}
				{activeFetcherData && "error" in activeFetcherData && (
					<div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
						{activeFetcherData.error}
					</div>
				)}
				{activeFetcherData && "ok" in activeFetcherData && (
					<div className="mb-4 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
						{"message" in activeFetcherData
							? activeFetcherData.message
							: `キャッシュを更新しました（${"length" in activeFetcherData ? activeFetcherData.length : 0}文字）`}
					</div>
				)}

				{/* Hero Image Section */}
				<section className="mb-8">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-bold text-fuchsia-400">
							ヒーローイメージ
						</h2>
						<heroFetcher.Form method="post">
							<input type="hidden" name="intent" value="regenerate-hero" />
							<button
								type="submit"
								disabled={isRegeneratingHero}
								className="flex items-center gap-2 text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-fuchsia-400/10 border border-fuchsia-400/30"
							>
								<svg
									className={`w-4 h-4 ${isRegeneratingHero ? "animate-spin" : ""}`}
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
								{isRegeneratingHero
									? "生成中..."
									: "ヒーローイメージを再生成"}
							</button>
						</heroFetcher.Form>
					</div>

					{loaderData.heroEntries.length === 0 ? (
						<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
							<p className="text-sm">
								ヒーローイメージがまだ生成されていません
							</p>
						</div>
					) : (
						<div className="space-y-4">
							{loaderData.heroEntries.map((entry, index) => (
								<HeroImageCard
									key={entry.id}
									entry={entry}
									isLatest={index === 0}
									isSubmitting={isRegeneratingHero}
								/>
							))}
						</div>
					)}
				</section>

				{/* News Cache Section */}
				<section>
					<h2 className="text-lg font-bold text-amber-400 mb-4">
						ニュースキャッシュ
					</h2>
					{loaderData.entries.length === 0 ? (
						<div className="p-12 text-center text-gray-500">
							<div className="text-4xl mb-4">📭</div>
							<p className="text-lg mb-2">
								ニュースキャッシュがありません
							</p>
							<p className="text-sm">
								上の「ニュースキャッシュ再取得」ボタンでニュースを取得できます
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
				</section>
			</main>
		</div>
	);
}

function HeroImageCard({
	entry,
	isLatest,
	isSubmitting,
}: {
	entry: {
		id: number;
		date: string;
		prompt: string;
		source: string;
		diaryContent: string | null;
	};
	isLatest: boolean;
	isSubmitting: boolean;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editedPrompt, setEditedPrompt] = useState(entry.prompt);
	const promptFetcher = useFetcher<typeof action>();
	const isRegenerating =
		promptFetcher.state === "submitting" || promptFetcher.state === "loading";

	return (
		<article className="border border-gray-800 rounded-lg overflow-hidden">
			<div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/50 border-b border-gray-800">
				<div className="flex items-center gap-3 text-sm">
					<span className="text-fuchsia-400 font-medium">
						{entry.date}
					</span>
					<span className="text-gray-600">|</span>
					<span
						className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${entry.source === "diary" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}
					>
						{entry.source === "diary" ? "日記" : "天気"}
					</span>
					{isLatest && (
						<span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-500/20 text-green-400">
							最新
						</span>
					)}
				</div>
			</div>
			<div className="p-4">
				<img
					src={`/hero-image/${entry.date}?t=${Date.now()}`}
					alt={`Hero image for ${entry.date}`}
					className="w-full rounded-lg aspect-video object-cover mb-3"
				/>

				{/* Prompt feedback */}
				{promptFetcher.data && "error" in promptFetcher.data && (
					<div className="mb-3 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
						{promptFetcher.data.error}
					</div>
				)}
				{promptFetcher.data && "ok" in promptFetcher.data && (
					<div className="mb-3 px-3 py-2 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
						{"message" in promptFetcher.data
							? promptFetcher.data.message
							: "再生成しました"}
					</div>
				)}

				<details className="text-sm" open={isEditing}>
					<summary className="text-gray-400 cursor-pointer hover:text-gray-300">
						プロンプトを表示 / 編集
					</summary>

					{isEditing ? (
						<div className="mt-2">
							<textarea
								value={editedPrompt}
								onChange={(e) => setEditedPrompt(e.target.value)}
								rows={6}
								className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-xs text-gray-300 font-sans focus:border-fuchsia-500/50 focus:outline-none resize-y"
							/>
							<div className="flex items-center gap-2 mt-2">
								<promptFetcher.Form method="post" className="flex-1">
									<input
										type="hidden"
										name="intent"
										value="regenerate-hero-with-prompt"
									/>
									<input
										type="hidden"
										name="date"
										value={entry.date}
									/>
									<input
										type="hidden"
										name="prompt"
										value={editedPrompt}
									/>
									<button
										type="submit"
										disabled={
											isRegenerating ||
											isSubmitting ||
											editedPrompt.trim().length === 0
										}
										className="w-full flex items-center justify-center gap-2 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors disabled:opacity-50 px-3 py-2 rounded bg-fuchsia-400/10 border border-fuchsia-400/30 hover:bg-fuchsia-400/20"
									>
										<svg
											className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`}
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
										{isRegenerating
											? "再生成中..."
											: "このプロンプトで再生成"}
									</button>
								</promptFetcher.Form>
								<button
									type="button"
									onClick={() => {
										setIsEditing(false);
										setEditedPrompt(entry.prompt);
									}}
									className="text-xs text-gray-500 hover:text-gray-400 px-3 py-2 rounded border border-gray-700 hover:bg-gray-800"
								>
									キャンセル
								</button>
							</div>
						</div>
					) : (
						<div className="mt-2">
							<pre className="whitespace-pre-wrap break-words text-xs text-gray-500 font-sans bg-gray-900/50 p-3 rounded">
								{entry.prompt}
							</pre>
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="mt-2 text-xs text-fuchsia-400/70 hover:text-fuchsia-400 transition-colors"
							>
								プロンプトを編集して再生成
							</button>
						</div>
					)}

					{entry.diaryContent && (
						<>
							<p className="mt-2 text-gray-400 text-xs">
								日記内容:
							</p>
							<pre className="mt-1 whitespace-pre-wrap break-words text-xs text-gray-500 font-sans bg-gray-900/50 p-3 rounded">
								{entry.diaryContent}
							</pre>
						</>
					)}
				</details>
			</div>
		</article>
	);
}
