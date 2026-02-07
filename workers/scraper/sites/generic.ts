import { parse } from "node-html-parser";
import type { ScrapedArticle } from "../types";

/**
 * 汎用パーサー: OGP メタタグからページ情報を抽出する
 * デバッグ用の任意URL指定時に使用
 */
export function parseGenericPage(html: string, url: string): ScrapedArticle[] {
	const root = parse(html);

	const ogTitle =
		root
			.querySelector('meta[property="og:title"]')
			?.getAttribute("content") ??
		root.querySelector("title")?.text ??
		"";

	const ogImage =
		root
			.querySelector('meta[property="og:image"]')
			?.getAttribute("content") ?? undefined;

	const ogDescription =
		root
			.querySelector('meta[property="og:description"]')
			?.getAttribute("content") ??
		root
			.querySelector('meta[name="description"]')
			?.getAttribute("content") ??
		undefined;

	if (!ogTitle.trim()) return [];

	return [
		{
			articleUrl: url,
			articleTitle: ogTitle.trim(),
			imageUrl: ogImage,
			description: ogDescription,
		},
	];
}

/**
 * 汎用リンク抽出パーサー: ページ内のニュース記事リンクを抽出
 * 見出し要素内のリンクや、記事カード的な構造を探す
 */
export function parseGenericLinks(
	html: string,
	baseUrl: string,
): ScrapedArticle[] {
	const root = parse(html);
	const articles: ScrapedArticle[] = [];
	const seen = new Set<string>();
	const origin = new URL(baseUrl).origin;

	// 見出し要素内のリンクを優先的に抽出
	const headingLinks = root.querySelectorAll(
		"h1 a, h2 a, h3 a, h4 a, article a, [class*='title'] a, [class*='headline'] a",
	);

	for (const link of headingLinks) {
		const href = link.getAttribute("href");
		if (!href || href === "#" || href.startsWith("javascript:")) continue;

		const fullUrl = href.startsWith("http")
			? href
			: `${origin}${href.startsWith("/") ? "" : "/"}${href}`;

		if (seen.has(fullUrl)) continue;
		seen.add(fullUrl);

		const title = link.text.trim();
		if (!title || title.length < 5) continue;

		const img =
			link.querySelector("img") ?? link.parentNode?.querySelector("img");
		const imageUrl = img?.getAttribute("src") ?? undefined;

		articles.push({
			articleUrl: fullUrl,
			articleTitle: title,
			imageUrl,
		});
	}

	return articles;
}
