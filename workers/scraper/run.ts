import { drizzle } from "drizzle-orm/d1";
import { scrapedArticles } from "../../app/db/schema";
import { lt } from "drizzle-orm";
import type { ScrapeSiteConfig, ScrapedArticle } from "./types";
import { allSites } from "./sites";
import { parseGenericPage, parseGenericLinks } from "./sites/generic";

const USER_AGENT =
	"Mozilla/5.0 (compatible; NWUnionBot/1.0; +https://hidelberq.com)";

/** 1日の秒数 */
const CLEANUP_DAYS = 7;

/**
 * 指定URLのHTMLを取得
 */
async function fetchHtml(url: string): Promise<string> {
	const res = await fetch(url, {
		headers: {
			"User-Agent": USER_AGENT,
			Accept: "text/html,application/xhtml+xml",
			"Accept-Language": "ja,en;q=0.5",
		},
	});

	if (!res.ok) {
		throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
	}

	return res.text();
}

/**
 * 1サイトをスクレイピングして記事を取得・保存
 */
async function scrapeSite(
	db: ReturnType<typeof drizzle>,
	site: ScrapeSiteConfig,
): Promise<{ inserted: number; total: number }> {
	console.log(`Scraping: ${site.name} (${site.url})`);

	const html = await fetchHtml(site.url);
	const articles = site.parseArticles(html);

	console.log(`  Parsed ${articles.length} articles from ${site.name}`);

	const now = new Date();
	let inserted = 0;

	for (const article of articles) {
		try {
			await db
				.insert(scrapedArticles)
				.values({
					siteId: site.id,
					siteName: site.name,
					siteUrl: site.url,
					articleUrl: article.articleUrl,
					articleTitle: article.articleTitle,
					imageUrl: article.imageUrl ?? null,
					description: article.description ?? null,
					category: article.category ?? null,
					scrapedAt: now,
				})
				.onConflictDoNothing({ target: scrapedArticles.articleUrl });
			inserted++;
		} catch (e) {
			// UNIQUE 制約違反等は無視
			console.warn(`  Skip duplicate: ${article.articleTitle}`);
		}
	}

	console.log(`  Inserted ${inserted} new articles`);
	return { inserted, total: articles.length };
}

/**
 * 古い記事を削除
 */
async function cleanupOldArticles(
	db: ReturnType<typeof drizzle>,
): Promise<number> {
	const threshold = new Date(
		Date.now() - CLEANUP_DAYS * 24 * 60 * 60 * 1000,
	);

	const result = await db
		.delete(scrapedArticles)
		.where(lt(scrapedArticles.scrapedAt, threshold))
		.returning({ id: scrapedArticles.id });

	return result.length;
}

/**
 * 全登録サイトをスクレイピング (cron 用)
 */
export async function scrapeAllSites(
	env: Env,
): Promise<{ results: Record<string, { inserted: number; total: number }>; cleaned: number }> {
	const db = drizzle(env.DB);
	const results: Record<string, { inserted: number; total: number }> = {};

	for (const site of allSites) {
		try {
			results[site.id] = await scrapeSite(db, site);
		} catch (e) {
			console.error(`Error scraping ${site.name}:`, e);
			results[site.id] = { inserted: 0, total: 0 };
		}
	}

	// 古い記事のクリーンアップ
	const cleaned = await cleanupOldArticles(db);
	if (cleaned > 0) {
		console.log(`Cleaned up ${cleaned} old articles`);
	}

	return { results, cleaned };
}

/**
 * 任意URLをスクレイピング (デバッグ用)
 * サイト設定があればそれを使い、なければ汎用パーサーを使用
 */
export async function scrapeUrl(
	env: Env,
	url: string,
	siteConfig?: ScrapeSiteConfig,
): Promise<{ articles: ScrapedArticle[]; inserted: number }> {
	const db = drizzle(env.DB);
	const html = await fetchHtml(url);

	let articles: ScrapedArticle[];
	let siteId: string;
	let siteName: string;

	if (siteConfig) {
		articles = siteConfig.parseArticles(html);
		siteId = siteConfig.id;
		siteName = siteConfig.name;
	} else {
		// 汎用パーサー: まずリンク抽出を試し、なければ OGP で単一ページ情報を取得
		articles = parseGenericLinks(html, url);
		if (articles.length === 0) {
			articles = parseGenericPage(html, url);
		}
		siteId = "custom";
		siteName = new URL(url).hostname;
	}

	const now = new Date();
	let inserted = 0;

	for (const article of articles) {
		try {
			await db
				.insert(scrapedArticles)
				.values({
					siteId,
					siteName,
					siteUrl: url,
					articleUrl: article.articleUrl,
					articleTitle: article.articleTitle,
					imageUrl: article.imageUrl ?? null,
					description: article.description ?? null,
					category: article.category ?? null,
					scrapedAt: now,
				})
				.onConflictDoNothing({ target: scrapedArticles.articleUrl });
			inserted++;
		} catch {
			// 重複は無視
		}
	}

	return { articles, inserted };
}
