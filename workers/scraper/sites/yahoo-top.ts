import { parse } from "node-html-parser";
import type { ScrapeSiteConfig, ScrapedArticle } from "../types";

/**
 * Yahoo!ニュース トピックス
 * https://news.yahoo.co.jp/topics のトップニュース記事を取得
 */
export const yahooTop: ScrapeSiteConfig = {
	id: "yahoo-top",
	name: "Yahoo!ニュース トピックス",
	url: "https://news.yahoo.co.jp/topics",
	parseArticles(html: string): ScrapedArticle[] {
		const root = parse(html);
		const articles: ScrapedArticle[] = [];
		const seen = new Set<string>();

		// トピックスのリンクを取得
		// Yahoo!ニュース トピックスのリンク構造: /pickup/... や /topics/... の記事リンク
		const links = root.querySelectorAll("a");

		for (const link of links) {
			const href = link.getAttribute("href");
			if (!href) continue;

			// news.yahoo.co.jp の記事リンクのみ対象
			const isArticleLink =
				href.includes("/articles/") ||
				href.includes("/pickup/") ||
				(href.includes("news.yahoo.co.jp") && href.includes("/articles/"));

			if (!isArticleLink) continue;

			// 完全URLに変換
			const fullUrl = href.startsWith("http")
				? href
				: `https://news.yahoo.co.jp${href}`;

			// 重複排除
			if (seen.has(fullUrl)) continue;
			seen.add(fullUrl);

			// タイトルはリンクテキストから取得
			const title = link.text.trim();
			if (!title || title.length < 3) continue;

			// 画像は近くの img から探す
			const img =
				link.querySelector("img") ??
				link.parentNode?.querySelector("img");
			const imageUrl = img?.getAttribute("src") ?? undefined;

			articles.push({
				articleUrl: fullUrl,
				articleTitle: title,
				imageUrl,
			});
		}

		return articles;
	},
};
