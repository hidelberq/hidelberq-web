import type { Route } from "./+types/debug";
import { useState } from "react";
import { drizzle } from "drizzle-orm/d1";
import { newsCache, heroImages, scrapedArticles, tweets, scrapeSites, activityLog, bookGroups, bookGroupMembers, books, bookMemberStatuses, personalBooks, bookPrerequisites, hiphopTracks } from "../db/schema";
import { and, desc, eq, sql } from "drizzle-orm";
import { GoogleGenAI } from "@google/genai";
import { generateHeroImage, regenerateHeroImageWithPrompt } from "../../workers/hero-image";
import { generateHiphopTrack, generateHiphopTrackWithPrompt, fetchDiary } from "../../workers/hiphop-cron";
import { forceGenerateAitterTweets } from "../../workers/aitter-cron";
import { scrapeAllSites, scrapeUrl } from "../../workers/scraper/run";
import { parsers } from "../../workers/scraper/parsers";
import { ActivitySection } from "../debug/activity-section";
import { BookSection } from "../debug/book-section";
import { ScrapingSection } from "../debug/scraping-section";
import { TweetSection } from "../debug/tweet-section";
import { HeroSection } from "../debug/hero-section";
import { NewsCacheSection } from "../debug/news-cache-section";
import { MusicSection } from "../debug/music-section";

// --- タブ定義 ---
const TABS = [
	{ id: "activity", label: "アクティビティ", color: "text-emerald-400 border-emerald-400" },
	{ id: "books", label: "積読管理", color: "text-orange-400 border-orange-400" },
	{ id: "scraping", label: "スクレイピング", color: "text-cyan-400 border-cyan-400" },
	{ id: "tweets", label: "ツイート", color: "text-violet-400 border-violet-400" },
	{ id: "hero", label: "ヒーロー", color: "text-fuchsia-400 border-fuchsia-400" },
	{ id: "music", label: "Hiphop", color: "text-pink-400 border-pink-400" },
	{ id: "news", label: "ニュース", color: "text-amber-400 border-amber-400" },
] as const;

type TabId = (typeof TABS)[number]["id"];

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

	// Hiphopトラック関連
	const trackEntries = await db
		.select()
		.from(hiphopTracks)
		.orderBy(desc(hiphopTracks.date))
		.limit(20);

	const [trackCount] = await db
		.select({ count: sql<number>`count(*)` })
		.from(hiphopTracks);

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
		trackData: {
			entries: trackEntries.map((t) => ({
				id: t.id,
				date: t.date,
				type: t.type,
				title: t.title,
				style: t.style,
				duration: t.duration,
				source: t.source,
				prompt: t.prompt,
				diaryContent: t.diaryContent,
				sunoTaskId: t.sunoTaskId,
			})),
			count: trackCount?.count ?? 0,
		},
	};
}

// --- Action ---
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
		const groupBooks = await db.select({ id: books.id }).from(books).where(eq(books.groupId, id));
		for (const book of groupBooks) {
			await db.delete(bookMemberStatuses).where(eq(bookMemberStatuses.bookId, book.id));
		}
		await db.delete(books).where(eq(books.groupId, id));
		await db.delete(bookGroupMembers).where(eq(bookGroupMembers.groupId, id));
		await db.delete(bookGroups).where(eq(bookGroups.id, id));
		return { ok: true, intent: "book-manage", message: "グループとその全データを削除しました" };
	}

	// --- 積読リスト: メンバー削除 ---
	if (intent === "delete-book-member") {
		const id = Number(formData.get("id"));
		const memberId = formData.get("memberId") as string;
		if (!id || !memberId) return { error: "IDが不正です" };
		const db = drizzle(context.cloudflare.env.DB);
		await db.delete(bookMemberStatuses).where(eq(bookMemberStatuses.memberId, memberId));
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

	// --- Hiphopトラック生成 ---
	if (intent === "generate-hiphop") {
		try {
			const result = await generateHiphopTrack(context.cloudflare.env);
			return {
				ok: true,
				intent: "music",
				message: result ?? "Hiphopトラックの生成をスキップしました（APIキー未設定）",
			};
		} catch (e) {
			console.error("Hiphop track generation error:", e);
			return {
				error: `Hiphopトラック生成エラー: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}

	// --- 日記取得テスト ---
	if (intent === "test-diary-fetch") {
		const date = formData.get("date") as string;
		if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return { error: "日付のフォーマットが不正です (YYYY-MM-DD)" };
		}
		const workflowyApiKey = context.cloudflare.env.WORKFLOWY_API_KEY;
		if (!workflowyApiKey) {
			return { error: "WORKFLOWY_API_KEY が設定されていません" };
		}
		try {
			const diary = await fetchDiary(workflowyApiKey, date);
			if (diary) {
				return {
					ok: true,
					intent: "music",
					message: `${date} の日記を取得しました`,
					diaryResult: diary,
				};
			}
			return {
				ok: true,
				intent: "music",
				message: `${date} の日記は見つかりませんでした（天気にフォールバックされます）`,
				diaryResult: null,
			};
		} catch (e) {
			return {
				error: `日記取得エラー: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}

	// --- カスタムプロンプトでHiphopトラック生成 ---
	if (intent === "generate-hiphop-with-prompt") {
		const date = formData.get("date") as string;
		const style = formData.get("style") as string;
		const title = formData.get("title") as string;
		const diaryContent = (formData.get("diaryContent") as string) || null;

		if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return { error: "日付のフォーマットが不正です (YYYY-MM-DD)" };
		}
		if (!style?.trim()) {
			return { error: "スタイルは必須です" };
		}
		if (!title?.trim()) {
			return { error: "タイトルは必須です" };
		}
		try {
			const result = await generateHiphopTrackWithPrompt(
				context.cloudflare.env,
				style.trim(),
				title.trim(),
				date,
				diaryContent,
			);
			return { ok: true, intent: "music", message: result };
		} catch (e) {
			console.error("Hiphop track custom generation error:", e);
			return {
				error: `カスタム生成エラー: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}

	// --- ラップトラックアップロード ---
	if (intent === "upload-rap-track") {
		const date = formData.get("date") as string;
		const title = formData.get("title") as string | null;
		const audioRaw = formData.get("audio");
		const audioFile = audioRaw instanceof File ? audioRaw : null;

		console.log("[upload-rap-track] 開始:", {
			date,
			title,
			hasFile: !!audioFile,
			fileName: audioFile?.name,
			fileSize: audioFile?.size,
			fileType: audioFile?.type,
		});

		if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return { error: "日付のフォーマットが不正です (YYYY-MM-DD)" };
		}
		if (!audioFile || audioFile.size === 0) {
			return { error: "音声ファイルを選択してください" };
		}

		try {
			const audioData = await audioFile.arrayBuffer();

			// モバイルブラウザは空やnon-standardなMIMEタイプを送ることがある
			// 拡張子ベースの判定を優先し、MIMEタイプはフォールバックとして使用
			const fileName = audioFile.name.toLowerCase();
			const isM4a =
				fileName.endsWith(".m4a") ||
				fileName.endsWith(".m4p") ||
				fileName.endsWith(".aac") ||
				audioFile.type === "audio/mp4" ||
				audioFile.type === "audio/x-m4a" ||
				audioFile.type === "audio/aac" ||
				audioFile.type === "audio/m4a";
			const ext = isM4a ? "m4a" : "mp3";
			const audioContentType = isM4a ? "audio/mp4" : "audio/mpeg";
			const r2Key = `hiphop/${date}/rap.${ext}`;

			// 既存の別形式ファイルがあれば削除
			const oldKey = isM4a
				? `hiphop/${date}/rap.mp3`
				: `hiphop/${date}/rap.m4a`;
			await context.cloudflare.env.MUSIC_BUCKET.delete(oldKey);

			await context.cloudflare.env.MUSIC_BUCKET.put(r2Key, audioData, {
				httpMetadata: {
					contentType: audioContentType,
					cacheControl: "public, max-age=86400",
				},
			});

			const db = drizzle(context.cloudflare.env.DB);
			const existing = await db
				.select()
				.from(hiphopTracks)
				.where(and(eq(hiphopTracks.date, date), eq(hiphopTracks.type, "rap")))
				.limit(1);

			if (existing.length > 0) {
				await db
					.update(hiphopTracks)
					.set({
						r2Key,
						...(title ? { title } : {}),
					})
					.where(and(eq(hiphopTracks.date, date), eq(hiphopTracks.type, "rap")));
			} else {
				await db.insert(hiphopTracks).values({
					date,
					type: "rap",
					r2Key,
					title: title || `${date} Rap`,
					source: "manual",
				});
			}

			return {
				ok: true,
				intent: "music",
				message: `${date} のラップトラックをアップロードしました`,
			};
		} catch (e) {
			console.error("[upload-rap-track] エラー:", e);
			return {
				error: `アップロードエラー: ${e instanceof Error ? e.message : String(e)}`,
			};
		}
	}

	// --- Hiphopトラック タイトル編集 ---
	if (intent === "update-track-title") {
		const id = Number(formData.get("id"));
		const title = (formData.get("title") as string)?.trim();
		if (!id) return { error: "IDが不正です" };
		if (!title) return { error: "タイトルを入力してください" };

		const db = drizzle(context.cloudflare.env.DB);
		await db.update(hiphopTracks).set({ title }).where(eq(hiphopTracks.id, id));
		return { ok: true, intent: "music", message: "タイトルを更新しました" };
	}

	// --- Hiphopトラック削除 ---
	if (intent === "delete-hiphop-track") {
		const id = Number(formData.get("id"));
		const date = formData.get("date") as string;
		const type = formData.get("type") as string;
		if (!id) return { error: "IDが不正です" };

		const db = drizzle(context.cloudflare.env.DB);
		// R2から音声ファイルを削除
		if (date && type) {
			try {
				await context.cloudflare.env.MUSIC_BUCKET.delete(`hiphop/${date}/${type}.mp3`);
				await context.cloudflare.env.MUSIC_BUCKET.delete(`hiphop/${date}/${type}.m4a`);
			} catch {
				// R2削除エラーは無視
			}
		}
		await db.delete(hiphopTracks).where(eq(hiphopTracks.id, id));
		return { ok: true, intent: "music", message: "トラックを削除しました" };
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
			new URL(url);
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

	// --- ツイート生成 ---
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

	// --- ニュースキャッシュ再取得 ---
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
	const [activeTab, setActiveTab] = useState<TabId>("activity");

	return (
		<div className="min-h-screen bg-black text-white font-sans">
			{/* Header */}
			<header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800">
				<div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
					<h1 className="text-lg font-bold">デバッグ</h1>
					<a
						href="/"
						className="text-sm text-blue-400 hover:text-blue-300 transition-colors px-3 py-1.5 rounded-full hover:bg-blue-400/10"
					>
						ホームに戻る
					</a>
				</div>
				{/* タブナビゲーション */}
				<div className="max-w-3xl mx-auto px-4">
					<nav className="flex gap-1 overflow-x-auto scrollbar-none -mb-px">
						{TABS.map((tab) => (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								className={`whitespace-nowrap px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
									activeTab === tab.id
										? tab.color
										: "text-gray-500 border-transparent hover:text-gray-400 hover:border-gray-700"
								}`}
							>
								{tab.label}
							</button>
						))}
					</nav>
				</div>
			</header>

			<main className="max-w-3xl mx-auto px-4 py-6">
				{activeTab === "activity" && (
					<ActivitySection
						activityEntries={loaderData.activityEntries}
						activityCount={loaderData.activityCount}
					/>
				)}

				{activeTab === "books" && (
					<BookSection bookData={loaderData.bookData} />
				)}

				{activeTab === "scraping" && (
					<ScrapingSection
						siteConfigs={loaderData.siteConfigs}
						availableParsers={loaderData.availableParsers}
						scraped={loaderData.scraped}
						scrapedCount={loaderData.scrapedCount}
					/>
				)}

				{activeTab === "tweets" && (
					<TweetSection
						recentTweets={loaderData.recentTweets}
						tweetCount={loaderData.tweetCount}
						unshownCount={loaderData.unshownCount}
					/>
				)}

				{activeTab === "hero" && (
					<HeroSection heroEntries={loaderData.heroEntries} />
				)}

				{activeTab === "music" && (
					<MusicSection
						trackEntries={loaderData.trackData.entries}
						trackCount={loaderData.trackData.count}
					/>
				)}

				{activeTab === "news" && (
					<NewsCacheSection entries={loaderData.entries} />
				)}
			</main>
		</div>
	);
}
