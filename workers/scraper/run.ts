import { drizzle } from "drizzle-orm/d1";
import { scrapedArticles, scrapeSites } from "../../app/db/schema";
import { eq, lt } from "drizzle-orm";
import type { ScrapedArticle } from "./types";
import { getParserById } from "./parsers";
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

/** DB サイト設定の型 */
interface DbSiteConfig {
	siteId: string;
	name: string;
	url: string;
	parserId: string;
}

/**
 * 1サイトをスクレイピングして記事を取得・保存
 */
async function scrapeSite(
	db: ReturnType<typeof drizzle>,
	site: DbSiteConfig,
): Promise<{ inserted: number; total: number }> {
	console.log(`Scraping: ${site.name} (${site.url})`);

	const parser = getParserById(site.parserId);
	if (!parser) {
		console.error(`  Unknown parser: ${site.parserId}`);
		return { inserted: 0, total: 0 };
	}

	const html = await fetchHtml(site.url);
	const articles = parser.parse(html, site.url);

	console.log(`  Parsed ${articles.length} articles from ${site.name}`);

	const now = new Date();
	let inserted = 0;

	for (const article of articles) {
		try {
			const result = await db
				.insert(scrapedArticles)
				.values({
					siteId: site.siteId,
					siteName: site.name,
					siteUrl: site.url,
					articleUrl: article.articleUrl,
					articleTitle: article.articleTitle,
					imageUrl: article.imageUrl ?? null,
					description: article.description ?? null,
					category: article.category ?? null,
					scrapedAt: now,
				})
				.onConflictDoNothing({ target: scrapedArticles.articleUrl })
				.returning({ id: scrapedArticles.id });
			if (result.length > 0) {
				inserted++;
			}
		} catch (e) {
			// UNIQUE 制約違反等は無視
			console.warn(`  Skip duplicate: ${article.articleTitle}`);
		}
	}

	console.log(`  Inserted ${inserted} new articles (${articles.length - inserted} duplicates skipped)`);
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
 * DB の scrape_sites テーブルから有効なサイトを取得して実行
 */
export async function scrapeAllSites(
	env: Env,
): Promise<{ results: Record<string, { inserted: number; total: number }>; cleaned: number }> {
	const db = drizzle(env.DB);
	const results: Record<string, { inserted: number; total: number }> = {};

	// DB から有効なサイト設定を取得
	const sites = await db
		.select()
		.from(scrapeSites)
		.where(eq(scrapeSites.enabled, true));

	console.log(`Found ${sites.length} enabled scrape sites`);

	for (const site of sites) {
		try {
			results[site.siteId] = await scrapeSite(db, site);
		} catch (e) {
			console.error(`Error scraping ${site.name}:`, e);
			results[site.siteId] = { inserted: 0, total: 0 };
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
 * DB にマッチするサイト設定があればそのパーサーを使い、なければ汎用パーサーを使用
 */
export async function scrapeUrl(
	env: Env,
	url: string,
	parserId?: string,
): Promise<{ articles: ScrapedArticle[]; inserted: number }> {
	const db = drizzle(env.DB);
	const html = await fetchHtml(url);

	let articles: ScrapedArticle[];
	let siteId: string;
	let siteName: string;

	// parserId が指定されていればそのパーサーを使う
	const parser = parserId ? getParserById(parserId) : undefined;

	if (parser) {
		articles = parser.parse(html, url);
		siteId = parserId!;
		siteName = parser.name;
	} else {
		// DB にマッチするサイト設定を探す
		const sites = await db.select().from(scrapeSites);
		const matchedSite = sites.find((s) => url.startsWith(new URL(s.url).origin));

		if (matchedSite) {
			const matchedParser = getParserById(matchedSite.parserId);
			if (matchedParser) {
				articles = matchedParser.parse(html, url);
				siteId = matchedSite.siteId;
				siteName = matchedSite.name;
			} else {
				articles = parseGenericLinks(html, url);
				if (articles.length === 0) {
					articles = parseGenericPage(html, url);
				}
				siteId = "custom";
				siteName = new URL(url).hostname;
			}
		} else {
			// 汎用パーサー: まずリンク抽出を試し、なければ OGP で単一ページ情報を取得
			articles = parseGenericLinks(html, url);
			if (articles.length === 0) {
				articles = parseGenericPage(html, url);
			}
			siteId = "custom";
			siteName = new URL(url).hostname;
		}
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
