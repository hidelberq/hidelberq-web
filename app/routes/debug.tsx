import type { Route } from "./+types/debug";
import { useState } from "react";
import { useFetcher } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { newsCache, heroImages, scrapedArticles, tweets, scrapeSites, activityLog, bookGroups, bookGroupMembers, books, bookMemberStatuses, personalBooks, bookPrerequisites } from "../db/schema";
import { desc, eq, and, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { generateHeroImage, regenerateHeroImageWithPrompt } from "../../workers/hero-image";
import { forceGenerateAitterTweets } from "../../workers/aitter-cron";
import { scrapeAllSites, scrapeUrl } from "../../workers/scraper/run";
import { parsers } from "../../workers/scraper/parsers";

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

	const scraped = await db
		.select()
		.from(scrapedArticles)
		.orderBy(desc(scrapedArticles.scrapedAt))
		.limit(30);

	const [scrapedCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(scrapedArticles);

	const recentTweets = await db
		.select()
		.from(tweets)
		.orderBy(desc(tweets.createdAt))
		.limit(20);

	const [tweetCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(tweets);

	const [unshownCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(tweets)
		.where(eq(tweets.displayed, false));

	const siteConfigs = await db
		.select()
		.from(scrapeSites)
		.orderBy(scrapeSites.id);

	const activityEntries = await db
		.select()
		.from(activityLog)
		.orderBy(desc(activityLog.createdAt))
		.limit(50);

	const [activityCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(activityLog);

	// 積読リスト関連
	const allGroups = await db
		.select()
		.from(bookGroups)
		.orderBy(desc(bookGroups.createdAt));

	const allMembers = await db
		.select()
		.from(bookGroupMembers)
		.orderBy(desc(bookGroupMembers.joinedAt));

	const allBooks = await db
		.select()
		.from(books)
		.orderBy(desc(books.createdAt))
		.limit(50);

	const [bookCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(books);

	const allBookStatuses = await db
		.select()
		.from(bookMemberStatuses)
		.orderBy(desc(bookMemberStatuses.updatedAt))
		.limit(50);

	// 個人積読リスト
	const allPersonalBooks = await db
		.select()
		.from(personalBooks)
		.orderBy(desc(personalBooks.createdAt))
		.limit(50);

	const [personalBookCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(personalBooks);

	const allPrerequisites = await db
		.select()
		.from(bookPrerequisites)
		.orderBy(desc(bookPrerequisites.createdAt));

	return {
		entries,
		heroEntries,
		scraped,
		scrapedCount: scrapedCount?.count ?? 0,
		recentTweets,
		tweetCount: tweetCount?.count ?? 0,
		unshownCount: unshownCount?.count ?? 0,
		siteConfigs,
		availableParsers: parsers.map((p) => ({ id: p.id, name: p.name })),
		activityEntries,
		activityCount: activityCount?.count ?? 0,
		bookData: {
			groups: allGroups,
			members: allMembers,
			books: allBooks,
			bookCount: bookCount?.count ?? 0,
			statuses: allBookStatuses,
			personalBooks: allPersonalBooks,
			personalBookCount: personalBookCount?.count ?? 0,
			prerequisites: allPrerequisites,
		},
	};
}

// --- Action: Step 1 キャッシュを再取得 / ヒーロー画像再生成 / スクレイピング ---
export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent");

	// --- アクティビティログ追加 ---
	if (intent === "add-activity") {
		const type = (formData.get("type") as string)?.trim();
		const message = (formData.get("message") as string)?.trim();
		const metadata = (formData.get("metadata") as string)?.trim() || null;
		if (!type || !message) {
			return { error: "タイプとメッセージは必須です" };
		}
		const db = drizzle(context.cloudflare.env.DB);
		await db.insert(activityLog).values({ type, message, metadata });
		return { ok: true, intent: "activity", message: "アクティビティを追加しました" };
	}

	// --- アクティビティログ削除 ---
	if (intent === "delete-activity") {
		const id = Number(formData.get("id"));
		if (!id) return { error: "IDが不正です" };
		const db = drizzle(context.cloudflare.env.DB);
		await db.delete(activityLog).where(eq(activityLog.id, id));
		return { ok: true, intent: "activity", message: "アクティビティを削除しました" };
	}

	// --- アクティビティログ全削除 ---
	if (intent === "clear-all-activities") {
		const db = drizzle(context.cloudflare.env.DB);
		await db.delete(activityLog);
		return { ok: true, intent: "activity", message: "全アクティビティを削除しました" };
	}

	// --- 積読リスト: グループ削除 ---
	if (intent === "delete-book-group") {
		const id = Number(formData.get("id"));
		if (!id) return { error: "IDが不正です" };
		const db = drizzle(context.cloudflare.env.DB);
		// グループに紐づく本のステータスを削除
		const groupBooks = await db.select({ id: books.id }).from(books).where(eq(books.groupId, id));
		for (const book of groupBooks) {
			await db.delete(bookMemberStatuses).where(eq(bookMemberStatuses.bookId, book.id));
		}
		// グループに紐づく本を削除
		await db.delete(books).where(eq(books.groupId, id));
		// グループのメンバーを削除
		await db.delete(bookGroupMembers).where(eq(bookGroupMembers.groupId, id));
		// グループ自体を削除
		await db.delete(bookGroups).where(eq(bookGroups.id, id));
		return { ok: true, intent: "book-manage", message: "グループとその全データを削除しました" };
	}

	// --- 積読リスト: メンバー削除 ---
	if (intent === "delete-book-member") {
		const id = Number(formData.get("id"));
		const memberId = formData.get("memberId") as string;
		if (!id || !memberId) return { error: "IDが不正です" };
		const db = drizzle(context.cloudflare.env.DB);
		// メンバーのステータスを削除
		await db.delete(bookMemberStatuses).where(eq(bookMemberStatuses.memberId, memberId));
		// メンバーを削除
		await db.delete(bookGroupMembers).where(eq(bookGroupMembers.id, id));
		return { ok: true, intent: "book-manage", message: "メンバーを削除しました" };
	}

	// --- 積読リスト: 本を削除 ---
	if (intent === "delete-book") {
		const id = Number(formData.get("id"));
		if (!id) return { error: "IDが不正です" };
		const db = drizzle(context.cloudflare.env.DB);
		await db.delete(bookMemberStatuses).where(eq(bookMemberStatuses.bookId, id));
		await db.delete(books).where(eq(books.id, id));
		return { ok: true, intent: "book-manage", message: "本を削除しました" };
	}

	// --- 積読リスト: ステータス削除 ---
	if (intent === "delete-book-status") {
		const id = Number(formData.get("id"));
		if (!id) return { error: "IDが不正です" };
		const db = drizzle(context.cloudflare.env.DB);
		await db.delete(bookMemberStatuses).where(eq(bookMemberStatuses.id, id));
		return { ok: true, intent: "book-manage", message: "ステータスを削除しました" };
	}

	// --- 個人積読リスト: 本を削除 ---
	if (intent === "delete-personal-book") {
		const id = Number(formData.get("id"));
		if (!id) return { error: "IDが不正です" };
		const db = drizzle(context.cloudflare.env.DB);
		await db.delete(bookPrerequisites).where(
			sql`${bookPrerequisites.personalBookId} = ${id} OR ${bookPrerequisites.prerequisitePersonalBookId} = ${id}`,
		);
		await db.delete(personalBooks).where(eq(personalBooks.id, id));
		return { ok: true, intent: "book-manage", message: "個人本を削除しました" };
	}

	// --- 個人積読リスト: 全削除 ---
	if (intent === "clear-all-personal-books") {
		const db = drizzle(context.cloudflare.env.DB);
		await db.delete(bookPrerequisites);
		await db.delete(personalBooks);
		return { ok: true, intent: "book-manage", message: "個人積読リストの全データを削除しました" };
	}

	// --- 前提本: 削除 ---
	if (intent === "delete-prerequisite") {
		const id = Number(formData.get("id"));
		if (!id) return { error: "IDが不正です" };
		const db = drizzle(context.cloudflare.env.DB);
		await db.delete(bookPrerequisites).where(eq(bookPrerequisites.id, id));
		return { ok: true, intent: "book-manage", message: "前提本の関連を削除しました" };
	}

	// --- 積読 2.0: 全データクリア ---
	if (intent === "clear-all-book-data") {
		const db = drizzle(context.cloudflare.env.DB);
		await db.delete(bookPrerequisites);
		await db.delete(personalBooks);
		await db.delete(bookMemberStatuses);
		await db.delete(books);
		await db.delete(bookGroupMembers);
		await db.delete(bookGroups);
		return { ok: true, intent: "book-manage", message: "積読 2.0 の全データを削除しました" };
	}

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

	// --- サイト追加 ---
	if (intent === "add-site") {
		const siteId = (formData.get("siteId") as string)?.trim();
		const name = (formData.get("name") as string)?.trim();
		const url = (formData.get("siteUrl") as string)?.trim();
		const parserId = (formData.get("parserId") as string)?.trim();
		if (!siteId || !name || !url || !parserId) {
			return { error: "すべてのフィールドを入力してください" };
		}
		try {
			new URL(url);
		} catch {
			return { error: "有効なURLを入力してください" };
		}
		const db = drizzle(context.cloudflare.env.DB);
		try {
			await db.insert(scrapeSites).values({ siteId, name, url, parserId });
			return { ok: true, intent: "site-config", message: `サイト「${name}」を追加しました` };
		} catch (e) {
			return { error: `サイト追加エラー: ${e instanceof Error ? e.message : String(e)}` };
		}
	}

	// --- サイト削除 ---
	if (intent === "delete-site") {
		const id = Number(formData.get("id"));
		if (!id) return { error: "IDが不正です" };
		const db = drizzle(context.cloudflare.env.DB);
		await db.delete(scrapeSites).where(eq(scrapeSites.id, id));
		return { ok: true, intent: "site-config", message: "サイトを削除しました" };
	}

	// --- サイト有効/無効切り替え ---
	if (intent === "toggle-site") {
		const id = Number(formData.get("id"));
		const enabled = formData.get("enabled") === "true";
		if (!id) return { error: "IDが不正です" };
		const db = drizzle(context.cloudflare.env.DB);
		await db.update(scrapeSites).set({ enabled }).where(eq(scrapeSites.id, id));
		return { ok: true, intent: "site-config", message: `サイトを${enabled ? "有効" : "無効"}にしました` };
	}

	// --- スクレイピング: 全サイト実行 ---
	if (intent === "scrape-all") {
		try {
			const { results, cleaned } = await scrapeAllSites(context.cloudflare.env);
			const summary = Object.entries(results)
				.map(([id, r]) => `${id}: ${r.inserted}/${r.total}件`)
				.join(", ");
			return {
				ok: true,
				intent: "scrape",
				message: `スクレイピング完了 (${summary})${cleaned > 0 ? ` / ${cleaned}件の古い記事を削除` : ""}`,
			};
		} catch (e) {
			console.error("Scrape all error:", e);
			return {
				error: `スクレイピングエラー: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}

	// --- スクレイピング: URL指定 ---
	if (intent === "scrape-url") {
		const url = formData.get("url") as string;
		if (!url) {
			return { error: "URLを入力してください" };
		}
		try {
			new URL(url); // バリデーション
		} catch {
			return { error: "有効なURLを入力してください" };
		}
		try {
			const { articles, inserted } = await scrapeUrl(
				context.cloudflare.env,
				url,
			);
			return {
				ok: true,
				intent: "scrape",
				message: `${url} から ${articles.length}件取得、${inserted}件保存しました`,
			};
		} catch (e) {
			console.error("Scrape URL error:", e);
			return {
				error: `スクレイピングエラー: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}

	// --- ツイート生成 (Step 2) ---
	if (intent === "generate-tweets") {
		try {
			const count = await forceGenerateAitterTweets(context.cloudflare.env);
			return {
				ok: true,
				intent: "tweets",
				message: count > 0
					? `${count}件のツイートを生成・保存しました`
					: "ツイートが生成されませんでした（ニュースキャッシュを確認してください）",
			};
		} catch (e) {
			console.error("Generate tweets error:", e);
			return {
				error: `ツイート生成エラー: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}

	// --- ニュースキャッシュ再取得 (既存) ---
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
	const scrapeFetcher = useFetcher<typeof action>();
	const scrapeUrlFetcher = useFetcher<typeof action>();
	const tweetFetcher = useFetcher<typeof action>();
	const siteFetcher = useFetcher<typeof action>();
	const activityFetcher = useFetcher<typeof action>();
	const bookFetcher = useFetcher<typeof action>();
	const isRefreshingNews =
		newsFetcher.state === "submitting" || newsFetcher.state === "loading";
	const isRegeneratingHero =
		heroFetcher.state === "submitting" || heroFetcher.state === "loading";
	const isScraping =
		scrapeFetcher.state === "submitting" || scrapeFetcher.state === "loading";
	const isScrapingUrl =
		scrapeUrlFetcher.state === "submitting" || scrapeUrlFetcher.state === "loading";
	const isGeneratingTweets =
		tweetFetcher.state === "submitting" || tweetFetcher.state === "loading";
	const isSiteAction =
		siteFetcher.state === "submitting" || siteFetcher.state === "loading";
	const isActivityAction =
		activityFetcher.state === "submitting" || activityFetcher.state === "loading";
	const isBookAction =
		bookFetcher.state === "submitting" || bookFetcher.state === "loading";

	// fetcher からの結果を表示
	const activeFetcherData =
		bookFetcher.data ?? activityFetcher.data ?? siteFetcher.data ?? tweetFetcher.data ?? scrapeFetcher.data ?? scrapeUrlFetcher.data ?? heroFetcher.data ?? newsFetcher.data;

	const [scrapeUrlInput, setScrapeUrlInput] = useState("");
	const [showAddSite, setShowAddSite] = useState(false);
	const [showAddActivity, setShowAddActivity] = useState(false);
	const [newActivityType, setNewActivityType] = useState("deploy");
	const [newActivityMessage, setNewActivityMessage] = useState("");
	const [newActivityMetadata, setNewActivityMetadata] = useState("");
	const [newSiteId, setNewSiteId] = useState("");
	const [newSiteName, setNewSiteName] = useState("");
	const [newSiteUrl, setNewSiteUrl] = useState("");
	const [newSiteParserId, setNewSiteParserId] = useState(loaderData.availableParsers[0]?.id ?? "generic-links");

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

				{/* Book List Management Section */}
				<BookManagementSection
					bookData={loaderData.bookData}
					bookFetcher={bookFetcher}
					isBookAction={isBookAction}
				/>

				{/* Activity Log Section */}
				<section className="mb-8">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-bold text-emerald-400">
							アクティビティログ
							<span className="text-sm font-normal text-gray-500 ml-2">
								({loaderData.activityCount}件)
							</span>
						</h2>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => setShowAddActivity(!showAddActivity)}
								className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-full hover:bg-emerald-400/10 border border-emerald-400/30"
							>
								{showAddActivity ? "閉じる" : "+ 追加"}
							</button>
							<activityFetcher.Form method="post">
								<input type="hidden" name="intent" value="clear-all-activities" />
								<button
									type="submit"
									disabled={isActivityAction || loaderData.activityCount === 0}
									className="flex items-center gap-1 text-sm text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-red-400/10 border border-red-400/20"
									onClick={(e) => {
										if (!confirm("全てのアクティビティログを削除しますか？")) {
											e.preventDefault();
										}
									}}
								>
									全削除
								</button>
							</activityFetcher.Form>
						</div>
					</div>

					{/* アクティビティ追加フォーム */}
					{showAddActivity && (
						<div className="mb-4 p-4 border border-emerald-400/20 rounded-lg bg-gray-900/30">
							<activityFetcher.Form
								method="post"
								onSubmit={() => {
									setNewActivityMessage("");
									setNewActivityMetadata("");
									setShowAddActivity(false);
								}}
							>
								<input type="hidden" name="intent" value="add-activity" />
								<div className="grid grid-cols-2 gap-3 mb-3">
									<div>
										<label className="block text-xs text-gray-400 mb-1">タイプ</label>
										<select
											name="type"
											value={newActivityType}
											onChange={(e) => setNewActivityType(e.target.value)}
											className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-emerald-500/50 focus:outline-none"
										>
											<option value="deploy">deploy</option>
											<option value="cron_aitter">cron_aitter</option>
											<option value="cron_hero_image">cron_hero_image</option>
											<option value="cron_news_scrape">cron_news_scrape</option>
										</select>
									</div>
									<div>
										<label className="block text-xs text-gray-400 mb-1">メタデータ (JSON, 任意)</label>
										<input
											type="text"
											name="metadata"
											value={newActivityMetadata}
											onChange={(e) => setNewActivityMetadata(e.target.value)}
											placeholder='{"hash": "abc1234"}'
											className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none"
										/>
									</div>
								</div>
								<div className="mb-3">
									<label className="block text-xs text-gray-400 mb-1">メッセージ</label>
									<input
										type="text"
										name="message"
										value={newActivityMessage}
										onChange={(e) => setNewActivityMessage(e.target.value)}
										placeholder="feat: アクティビティフィードを追加"
										className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none"
									/>
								</div>
								<button
									type="submit"
									disabled={isActivityAction || !newActivityMessage.trim()}
									className="w-full flex items-center justify-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 px-4 py-2 rounded bg-emerald-400/10 border border-emerald-400/30 hover:bg-emerald-400/20"
								>
									{isActivityAction ? "追加中..." : "アクティビティを追加"}
								</button>
							</activityFetcher.Form>
						</div>
					)}

					{/* アクティビティ一覧 */}
					{loaderData.activityEntries.length === 0 ? (
						<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
							<p className="text-sm">アクティビティログがありません</p>
						</div>
					) : (
						<div className="space-y-2">
							{loaderData.activityEntries.map((entry) => (
								<div
									key={entry.id}
									className="flex items-start justify-between gap-3 p-3 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
								>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2 mb-1">
											<span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
												entry.type === "deploy"
													? "bg-blue-500/10 text-blue-400"
													: entry.type === "cron_aitter"
														? "bg-violet-500/10 text-violet-400"
														: entry.type === "cron_hero_image"
															? "bg-fuchsia-500/10 text-fuchsia-400"
															: entry.type === "cron_news_scrape"
																? "bg-cyan-500/10 text-cyan-400"
																: "bg-gray-800 text-gray-400"
											}`}>
												{entry.type}
											</span>
											<span className="text-[10px] font-mono text-gray-600">
												ID: {entry.id}
											</span>
											{entry.createdAt && (
												<span className="text-[10px] text-gray-600">
													{entry.createdAt.toLocaleString("ja-JP")}
												</span>
											)}
										</div>
										<p className="text-sm text-gray-300">{entry.message}</p>
										{entry.metadata && (
											<p className="text-xs text-gray-600 mt-0.5 font-mono">
												{entry.metadata}
											</p>
										)}
									</div>
									<activityFetcher.Form method="post" className="shrink-0">
										<input type="hidden" name="intent" value="delete-activity" />
										<input type="hidden" name="id" value={entry.id} />
										<button
											type="submit"
											disabled={isActivityAction}
											className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
										>
											削除
										</button>
									</activityFetcher.Form>
								</div>
							))}
						</div>
					)}
				</section>

				{/* Scrape Site Config Section */}
				<section className="mb-8">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-bold text-teal-400">
							スクレイピング対象サイト
							<span className="text-sm font-normal text-gray-500 ml-2">
								({loaderData.siteConfigs.length}件)
							</span>
						</h2>
						<button
							type="button"
							onClick={() => setShowAddSite(!showAddSite)}
							className="flex items-center gap-1 text-sm text-teal-400 hover:text-teal-300 transition-colors px-3 py-1.5 rounded-full hover:bg-teal-400/10 border border-teal-400/30"
						>
							{showAddSite ? "閉じる" : "+ サイト追加"}
						</button>
					</div>

					{/* サイト追加フォーム */}
					{showAddSite && (
						<div className="mb-4 p-4 border border-teal-400/20 rounded-lg bg-gray-900/30">
							<siteFetcher.Form
								method="post"
								onSubmit={() => {
									setNewSiteId("");
									setNewSiteName("");
									setNewSiteUrl("");
									setShowAddSite(false);
								}}
							>
								<input type="hidden" name="intent" value="add-site" />
								<div className="grid grid-cols-2 gap-3 mb-3">
									<div>
										<label className="block text-xs text-gray-400 mb-1">サイトID</label>
										<input
											type="text"
											name="siteId"
											value={newSiteId}
											onChange={(e) => setNewSiteId(e.target.value)}
											placeholder="nhk-news"
											className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-teal-500/50 focus:outline-none"
										/>
									</div>
									<div>
										<label className="block text-xs text-gray-400 mb-1">表示名</label>
										<input
											type="text"
											name="name"
											value={newSiteName}
											onChange={(e) => setNewSiteName(e.target.value)}
											placeholder="NHKニュース"
											className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-teal-500/50 focus:outline-none"
										/>
									</div>
									<div>
										<label className="block text-xs text-gray-400 mb-1">URL</label>
										<input
											type="url"
											name="siteUrl"
											value={newSiteUrl}
											onChange={(e) => setNewSiteUrl(e.target.value)}
											placeholder="https://www3.nhk.or.jp/news/"
											className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-teal-500/50 focus:outline-none"
										/>
									</div>
									<div>
										<label className="block text-xs text-gray-400 mb-1">パーサー</label>
										<select
											name="parserId"
											value={newSiteParserId}
											onChange={(e) => setNewSiteParserId(e.target.value)}
											className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-teal-500/50 focus:outline-none"
										>
											{loaderData.availableParsers.map((p) => (
												<option key={p.id} value={p.id}>
													{p.name} ({p.id})
												</option>
											))}
										</select>
									</div>
								</div>
								<button
									type="submit"
									disabled={isSiteAction || !newSiteId.trim() || !newSiteName.trim() || !newSiteUrl.trim()}
									className="w-full flex items-center justify-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition-colors disabled:opacity-50 px-4 py-2 rounded bg-teal-400/10 border border-teal-400/30 hover:bg-teal-400/20"
								>
									{isSiteAction ? "追加中..." : "サイトを追加"}
								</button>
							</siteFetcher.Form>
						</div>
					)}

					{/* サイト一覧 */}
					{loaderData.siteConfigs.length === 0 ? (
						<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
							<p className="text-sm">スクレイピング対象サイトが登録されていません</p>
						</div>
					) : (
						<div className="space-y-2">
							{loaderData.siteConfigs.map((site) => (
								<div
									key={site.id}
									className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
										site.enabled
											? "border-gray-800 hover:border-gray-700"
											: "border-gray-800/50 opacity-50"
									}`}
								>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<span className="text-sm font-medium text-gray-200">
												{site.name}
											</span>
											<span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400">
												{site.siteId}
											</span>
											<span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
												{site.parserId}
											</span>
										</div>
										<a
											href={site.url}
											target="_blank"
											rel="noopener noreferrer"
											className="text-xs text-gray-500 hover:text-gray-400 truncate block mt-0.5"
										>
											{site.url}
										</a>
									</div>
									<div className="flex items-center gap-2 ml-3 shrink-0">
										<siteFetcher.Form method="post">
											<input type="hidden" name="intent" value="toggle-site" />
											<input type="hidden" name="id" value={site.id} />
											<input type="hidden" name="enabled" value={String(!site.enabled)} />
											<button
												type="submit"
												disabled={isSiteAction}
												className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
													site.enabled
														? "text-green-400 border-green-400/30 hover:bg-green-400/10"
														: "text-gray-500 border-gray-700 hover:bg-gray-800"
												}`}
											>
												{site.enabled ? "ON" : "OFF"}
											</button>
										</siteFetcher.Form>
										<siteFetcher.Form method="post">
											<input type="hidden" name="intent" value="delete-site" />
											<input type="hidden" name="id" value={site.id} />
											<button
												type="submit"
												disabled={isSiteAction}
												className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
											>
												削除
											</button>
										</siteFetcher.Form>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				{/* News Scraping Section */}
				<section className="mb-8">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-bold text-cyan-400">
							ニューススクレイピング
							<span className="text-sm font-normal text-gray-500 ml-2">
								({loaderData.scrapedCount}件)
							</span>
						</h2>
						<scrapeFetcher.Form method="post">
							<input type="hidden" name="intent" value="scrape-all" />
							<button
								type="submit"
								disabled={isScraping}
								className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-cyan-400/10 border border-cyan-400/30"
							>
								<svg
									className={`w-4 h-4 ${isScraping ? "animate-spin" : ""}`}
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
								{isScraping ? "スクレイピング中..." : "全サイトスクレイピング"}
							</button>
						</scrapeFetcher.Form>
					</div>

					{/* URL指定スクレイピング */}
					<div className="mb-4 p-4 border border-gray-800 rounded-lg bg-gray-900/30">
						<p className="text-sm text-gray-400 mb-2">
							URL を指定してスクレイピング
						</p>
						<scrapeUrlFetcher.Form method="post" className="flex gap-2">
							<input type="hidden" name="intent" value="scrape-url" />
							<input
								type="url"
								name="url"
								value={scrapeUrlInput}
								onChange={(e) => setScrapeUrlInput(e.target.value)}
								placeholder="https://news.yahoo.co.jp/topics"
								className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none"
							/>
							<button
								type="submit"
								disabled={isScrapingUrl || !scrapeUrlInput.trim()}
								className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 px-4 py-2 rounded bg-cyan-400/10 border border-cyan-400/30 hover:bg-cyan-400/20"
							>
								{isScrapingUrl ? "取得中..." : "取得"}
							</button>
						</scrapeUrlFetcher.Form>
					</div>

					{/* スクレイピング結果一覧 */}
					{loaderData.scraped.length === 0 ? (
						<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
							<p className="text-sm">
								スクレイピング記事がまだありません
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{loaderData.scraped.map((article) => (
								<article
									key={article.id}
									className="flex gap-3 p-3 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
								>
									{article.imageUrl && (
										<img
											src={article.imageUrl}
											alt=""
											className="w-16 h-16 rounded object-cover shrink-0"
										/>
									)}
									<div className="min-w-0 flex-1">
										<a
											href={article.articleUrl}
											target="_blank"
											rel="noopener noreferrer"
											className="text-sm text-gray-200 hover:text-cyan-300 transition-colors line-clamp-2"
										>
											{article.articleTitle}
										</a>
										{article.description && (
											<p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
												{article.description}
											</p>
										)}
										<div className="flex items-center gap-2 mt-1 text-[10px] text-gray-600">
											<span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
												{article.siteName}
											</span>
											{article.category && (
												<span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
													{article.category}
												</span>
											)}
											{article.scrapedAt && (
												<span>
													{article.scrapedAt.toLocaleString("ja-JP")}
												</span>
											)}
											{article.usedForTweet && (
												<span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
													ツイート済
												</span>
											)}
										</div>
									</div>
								</article>
							))}
						</div>
					)}
				</section>

				{/* AIteer Tweet Generation Section */}
				<section className="mb-8">
					<div className="flex items-center justify-between mb-4">
						<h2 className="text-lg font-bold text-violet-400">
							AIteer ツイート生成
							<span className="text-sm font-normal text-gray-500 ml-2">
								(全{loaderData.tweetCount}件 / 未表示{loaderData.unshownCount}件)
							</span>
						</h2>
						<tweetFetcher.Form method="post">
							<input type="hidden" name="intent" value="generate-tweets" />
							<button
								type="submit"
								disabled={isGeneratingTweets}
								className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-violet-400/10 border border-violet-400/30"
							>
								<svg
									className={`w-4 h-4 ${isGeneratingTweets ? "animate-spin" : ""}`}
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
								{isGeneratingTweets ? "生成中..." : "Step 2: ツイート生成"}
							</button>
						</tweetFetcher.Form>
					</div>

					{loaderData.recentTweets.length === 0 ? (
						<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
							<p className="text-sm">
								生成済みツイートがまだありません
							</p>
						</div>
					) : (
						<div className="space-y-2">
							{loaderData.recentTweets.map((tweet) => (
								<article
									key={tweet.id}
									className="p-3 border border-gray-800 rounded-lg"
								>
									<div className="flex items-start gap-2">
										<span className="text-lg shrink-0">{tweet.authorEmoji}</span>
										<div className="min-w-0 flex-1">
											<div className="flex items-center gap-2 text-sm">
												<span className="font-bold text-gray-200">
													{tweet.authorName}
												</span>
												<span className="text-gray-500">
													@{tweet.authorHandle}
												</span>
											</div>
											<p className="text-sm text-gray-300 mt-1">
												{tweet.content}
											</p>
											<div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
												<span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">
													{tweet.category}
												</span>
												{tweet.sourceUrl && (
													<a
														href={tweet.sourceUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="text-blue-400/60 hover:text-blue-400 truncate max-w-[200px]"
													>
														{tweet.sourceUrl}
													</a>
												)}
												<span className={tweet.displayed ? "text-gray-600" : "text-yellow-400"}>
													{tweet.displayed ? "表示済" : "未表示"}
												</span>
												{tweet.createdAt && (
													<span>
														{tweet.createdAt.toLocaleString("ja-JP")}
													</span>
												)}
											</div>
										</div>
									</div>
								</article>
							))}
						</div>
					)}
				</section>

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

const STATUS_LABELS: Record<string, string> = {
	wishlist: "ほしい",
	tsundoku: "積読中",
	reading: "読書中",
	completed: "読了",
	abandoned: "挫折",
};

function BookManagementSection({
	bookData,
	bookFetcher,
	isBookAction,
}: {
	bookData: {
		groups: Array<{
			id: number;
			groupCode: string;
			name: string;
			description: string | null;
			createdByMemberId: string;
			createdAt: Date | null;
		}>;
		members: Array<{
			id: number;
			groupId: number;
			memberId: string;
			displayName: string;
			joinedAt: Date | null;
		}>;
		books: Array<{
			id: number;
			groupId: number;
			title: string;
			author: string;
			genre: string | null;
			addedByName: string;
			addedByMemberId: string;
			createdAt: Date | null;
		}>;
		bookCount: number;
		statuses: Array<{
			id: number;
			bookId: number;
			memberId: string;
			memberName: string;
			status: string;
			difficulty: number | null;
			importance: number | null;
			recommendation: number | null;
			memo: string | null;
			updatedAt: Date | null;
		}>;
		personalBooks: Array<{
			id: number;
			memberId: string;
			memberName: string;
			title: string;
			author: string;
			isbn: string | null;
			genre: string | null;
			status: string;
			visibility: string;
			difficulty: number | null;
			importance: number | null;
			recommendation: number | null;
			memo: string | null;
			tags: string | null;
			createdAt: Date | null;
		}>;
		personalBookCount: number;
		prerequisites: Array<{
			id: number;
			personalBookId: number;
			prerequisitePersonalBookId: number;
			createdAt: Date | null;
		}>;
	};
	bookFetcher: ReturnType<typeof useFetcher<typeof action>>;
	isBookAction: boolean;
}) {
	const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
	const [showPersonalBooks, setShowPersonalBooks] = useState(false);
	const [showPrerequisites, setShowPrerequisites] = useState(false);

	const { groups, members, books: bookList, bookCount, statuses, personalBooks: personalBookList, personalBookCount, prerequisites } = bookData;

	const getMembersForGroup = (groupId: number) =>
		members.filter((m) => m.groupId === groupId);

	const getBooksForGroup = (groupId: number) =>
		bookList.filter((b) => b.groupId === groupId);

	const getStatusesForBook = (bookId: number) =>
		statuses.filter((s) => s.bookId === bookId);

	return (
		<section className="mb-8">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-bold text-orange-400">
					積読 2.0 管理
					<span className="text-sm font-normal text-gray-500 ml-2">
						({groups.length}グループ / {bookCount}冊 / 個人{personalBookCount}冊)
					</span>
				</h2>
				<bookFetcher.Form method="post">
					<input type="hidden" name="intent" value="clear-all-book-data" />
					<button
						type="submit"
						disabled={isBookAction || (groups.length === 0 && personalBookCount === 0)}
						className="flex items-center gap-1 text-sm text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-red-400/10 border border-red-400/20"
						onClick={(e) => {
							if (!confirm("積読 2.0 の全データ（グループ・メンバー・本・ステータス・個人リスト・前提本）を削除しますか？")) {
								e.preventDefault();
							}
						}}
					>
						全データ削除
					</button>
				</bookFetcher.Form>
			</div>

			{/* 個人積読リスト */}
			<div className="mb-4">
				<div className="flex items-center justify-between mb-2">
					<button
						type="button"
						onClick={() => setShowPersonalBooks(!showPersonalBooks)}
						className="flex items-center gap-2 text-sm font-bold text-purple-400"
					>
						<span>{showPersonalBooks ? "▼" : "▶"}</span>
						個人積読リスト ({personalBookCount}冊)
					</button>
					<bookFetcher.Form method="post">
						<input type="hidden" name="intent" value="clear-all-personal-books" />
						<button
							type="submit"
							disabled={isBookAction || personalBookCount === 0}
							className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
							onClick={(e) => {
								if (!confirm("個人積読リストの全データ（前提本含む）を削除しますか？")) {
									e.preventDefault();
								}
							}}
						>
							個人リスト全削除
						</button>
					</bookFetcher.Form>
				</div>
				{showPersonalBooks && (
					<div className="space-y-2">
						{personalBookList.length === 0 ? (
							<p className="text-xs text-gray-600 pl-4">個人本なし</p>
						) : (
							personalBookList.map((pb) => (
								<div
									key={pb.id}
									className="flex items-start justify-between p-3 rounded bg-gray-900/30 border border-gray-800/50"
								>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2 mb-0.5 flex-wrap">
											<span className="text-sm font-medium text-gray-200">
												{pb.title}
											</span>
											<span className="text-[10px] text-gray-600">ID: {pb.id}</span>
											<span className={`text-[10px] px-1 py-0.5 rounded ${
												pb.status === "completed" ? "bg-green-500/10 text-green-400" :
												pb.status === "reading" ? "bg-blue-500/10 text-blue-400" :
												pb.status === "tsundoku" ? "bg-purple-500/10 text-purple-400" :
												pb.status === "abandoned" ? "bg-red-500/10 text-red-400" :
												"bg-gray-800 text-gray-400"
											}`}>
												{STATUS_LABELS[pb.status] ?? pb.status}
											</span>
											<span className={`text-[10px] px-1 py-0.5 rounded ${
												pb.visibility === "private" ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
											}`}>
												{pb.visibility === "private" ? "非公開" : "公開"}
											</span>
										</div>
										<div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
											<span>{pb.author}</span>
											{pb.genre && (
												<span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px]">
													{pb.genre}
												</span>
											)}
											<span className="text-gray-600">
												by {pb.memberName}
											</span>
											<span className="text-[10px] text-gray-600 font-mono">
												{pb.memberId.slice(0, 8)}...
											</span>
										</div>
										<div className="flex items-center gap-2 text-[10px] text-gray-600 mt-1 flex-wrap">
											{pb.difficulty !== null && <span>難:{pb.difficulty}</span>}
											{pb.importance !== null && <span>重:{pb.importance}</span>}
											{pb.recommendation !== null && <span className="text-yellow-400/60">薦:{pb.recommendation}</span>}
											{pb.tags && <span>タグ:{pb.tags}</span>}
											{pb.memo && <span className="truncate max-w-[200px]" title={pb.memo}>メモ:{pb.memo}</span>}
										</div>
									</div>
									<bookFetcher.Form method="post" className="shrink-0 ml-2">
										<input type="hidden" name="intent" value="delete-personal-book" />
										<input type="hidden" name="id" value={pb.id} />
										<button
											type="submit"
											disabled={isBookAction}
											className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
										>
											削除
										</button>
									</bookFetcher.Form>
								</div>
							))
						)}
					</div>
				)}
			</div>

			{/* 前提本 */}
			{prerequisites.length > 0 && (
				<div className="mb-4">
					<button
						type="button"
						onClick={() => setShowPrerequisites(!showPrerequisites)}
						className="flex items-center gap-2 text-sm font-bold text-purple-400 mb-2"
					>
						<span>{showPrerequisites ? "▼" : "▶"}</span>
						前提本の関連 ({prerequisites.length}件)
					</button>
					{showPrerequisites && (
						<div className="space-y-1.5">
							{prerequisites.map((pr) => {
								const bookA = personalBookList.find((b) => b.id === pr.personalBookId);
								const bookB = personalBookList.find((b) => b.id === pr.prerequisitePersonalBookId);
								return (
									<div
										key={pr.id}
										className="flex items-center justify-between p-2 rounded bg-gray-900/30 border border-gray-800/50"
									>
										<div className="flex items-center gap-2 text-xs text-gray-300 min-w-0">
											<span className="text-[10px] text-gray-600">ID: {pr.id}</span>
											<span className="truncate">{bookA?.title ?? `#${pr.personalBookId}`}</span>
											<span className="text-gray-600">←</span>
											<span className="truncate">{bookB?.title ?? `#${pr.prerequisitePersonalBookId}`}</span>
										</div>
										<bookFetcher.Form method="post" className="shrink-0 ml-2">
											<input type="hidden" name="intent" value="delete-prerequisite" />
											<input type="hidden" name="id" value={pr.id} />
											<button
												type="submit"
												disabled={isBookAction}
												className="text-[10px] text-red-400/60 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
											>
												x
											</button>
										</bookFetcher.Form>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}

			{/* グループ */}
			{groups.length === 0 ? (
				<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
					<p className="text-sm">グループがありません</p>
				</div>
			) : (
				<div className="space-y-3">
					{groups.map((group) => {
						const groupMembers = getMembersForGroup(group.id);
						const groupBooks = getBooksForGroup(group.id);
						const isExpanded = expandedGroup === group.id;

						return (
							<div
								key={group.id}
								className="border border-gray-800 rounded-lg overflow-hidden"
							>
								{/* グループヘッダー */}
								<div className="flex items-center justify-between px-4 py-3 bg-gray-900/50">
									<button
										type="button"
										onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
										className="flex items-center gap-3 text-left flex-1 min-w-0"
									>
										<span className="text-sm text-gray-400">
											{isExpanded ? "▼" : "▶"}
										</span>
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium text-gray-200">
													{group.name}
												</span>
												<span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-mono">
													{group.groupCode}
												</span>
											</div>
											<div className="flex items-center gap-2 text-[10px] text-gray-600 mt-0.5">
												<span>ID: {group.id}</span>
												<span>メンバー: {groupMembers.length}</span>
												<span>本: {groupBooks.length}</span>
												{group.createdAt && (
													<span>{group.createdAt.toLocaleString("ja-JP")}</span>
												)}
											</div>
										</div>
									</button>
									<bookFetcher.Form method="post" className="shrink-0 ml-2">
										<input type="hidden" name="intent" value="delete-book-group" />
										<input type="hidden" name="id" value={group.id} />
										<button
											type="submit"
											disabled={isBookAction}
											className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
											onClick={(e) => {
												if (!confirm(`グループ「${group.name}」と紐づく全データを削除しますか？`)) {
													e.preventDefault();
												}
											}}
										>
											削除
										</button>
									</bookFetcher.Form>
								</div>

								{/* 展開コンテンツ */}
								{isExpanded && (
									<div className="border-t border-gray-800">
										{/* メンバー */}
										<div className="px-4 py-3 border-b border-gray-800/50">
											<h4 className="text-xs font-bold text-orange-400/70 uppercase tracking-wider mb-2">
												メンバー ({groupMembers.length})
											</h4>
											{groupMembers.length === 0 ? (
												<p className="text-xs text-gray-600">メンバーなし</p>
											) : (
												<div className="space-y-1.5">
													{groupMembers.map((member) => (
														<div
															key={member.id}
															className="flex items-center justify-between p-2 rounded bg-gray-900/30"
														>
															<div className="flex items-center gap-2 text-sm min-w-0">
																<span className="text-gray-200 font-medium">
																	{member.displayName}
																</span>
																<span className="text-[10px] text-gray-600 font-mono truncate">
																	{member.memberId.slice(0, 8)}...
																</span>
																<span className="text-[10px] text-gray-600">
																	ID: {member.id}
																</span>
																{member.joinedAt && (
																	<span className="text-[10px] text-gray-600">
																		{member.joinedAt.toLocaleString("ja-JP")}
																	</span>
																)}
															</div>
															<bookFetcher.Form method="post" className="shrink-0">
																<input type="hidden" name="intent" value="delete-book-member" />
																<input type="hidden" name="id" value={member.id} />
																<input type="hidden" name="memberId" value={member.memberId} />
																<button
																	type="submit"
																	disabled={isBookAction}
																	className="text-[10px] text-red-400/60 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
																>
																	削除
																</button>
															</bookFetcher.Form>
														</div>
													))}
												</div>
											)}
										</div>

										{/* 本 */}
										<div className="px-4 py-3">
											<h4 className="text-xs font-bold text-orange-400/70 uppercase tracking-wider mb-2">
												本 ({groupBooks.length})
											</h4>
											{groupBooks.length === 0 ? (
												<p className="text-xs text-gray-600">本なし</p>
											) : (
												<div className="space-y-2">
													{groupBooks.map((book) => {
														const bookStatuses = getStatusesForBook(book.id);
														return (
															<div
																key={book.id}
																className="p-3 rounded bg-gray-900/30 border border-gray-800/50"
															>
																<div className="flex items-start justify-between gap-2">
																	<div className="min-w-0 flex-1">
																		<div className="flex items-center gap-2 mb-0.5">
																			<span className="text-sm font-medium text-gray-200">
																				{book.title}
																			</span>
																			<span className="text-[10px] text-gray-600">
																				ID: {book.id}
																			</span>
																		</div>
																		<div className="flex items-center gap-2 text-xs text-gray-500">
																			<span>{book.author}</span>
																			{book.genre && (
																				<span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px]">
																					{book.genre}
																				</span>
																			)}
																			<span className="text-gray-600">
																				by {book.addedByName}
																			</span>
																		</div>

																		{/* ステータス一覧 */}
																		{bookStatuses.length > 0 && (
																			<div className="mt-2 space-y-1">
																				{bookStatuses.map((s) => (
																					<div
																						key={s.id}
																						className="flex items-center justify-between text-[10px] p-1.5 rounded bg-gray-900/50"
																					>
																						<div className="flex items-center gap-2">
																							<span className="text-gray-300">
																								{s.memberName}
																							</span>
																							<span className={`px-1 py-0.5 rounded ${
																								s.status === "completed" ? "bg-green-500/10 text-green-400" :
																								s.status === "reading" ? "bg-blue-500/10 text-blue-400" :
																								s.status === "tsundoku" ? "bg-purple-500/10 text-purple-400" :
																								"bg-gray-800 text-gray-400"
																							}`}>
																								{STATUS_LABELS[s.status] ?? s.status}
																							</span>
																							{s.difficulty !== null && (
																								<span className="text-gray-500">
																									難:{s.difficulty}
																								</span>
																							)}
																							{s.importance !== null && (
																								<span className="text-gray-500">
																									重:{s.importance}
																								</span>
																							)}
																							{s.recommendation !== null && (
																								<span className="text-yellow-400/60">
																									薦:{s.recommendation}
																								</span>
																							)}
																							{s.memo && (
																								<span className="text-gray-600 truncate max-w-[150px]" title={s.memo}>
																									{s.memo}
																								</span>
																							)}
																						</div>
																						<bookFetcher.Form method="post" className="shrink-0">
																							<input type="hidden" name="intent" value="delete-book-status" />
																							<input type="hidden" name="id" value={s.id} />
																							<button
																								type="submit"
																								disabled={isBookAction}
																								className="text-red-400/60 hover:text-red-400 px-1 py-0.5 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
																							>
																								x
																							</button>
																						</bookFetcher.Form>
																					</div>
																				))}
																			</div>
																		)}
																	</div>
																	<bookFetcher.Form method="post" className="shrink-0">
																		<input type="hidden" name="intent" value="delete-book" />
																		<input type="hidden" name="id" value={book.id} />
																		<button
																			type="submit"
																			disabled={isBookAction}
																			className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
																		>
																			削除
																		</button>
																	</bookFetcher.Form>
																</div>
															</div>
														);
													})}
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
