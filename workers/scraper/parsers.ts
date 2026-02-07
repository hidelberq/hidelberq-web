import type { ScrapedArticle } from "./types";
import { yahooTop } from "./sites/yahoo-top";
import { parseGenericLinks, parseGenericPage } from "./sites/generic";

/** パーサーの定義 */
export interface ParserDef {
	id: string;
	name: string;
	/** HTML とベース URL を受け取り記事リストを返す */
	parse: (html: string, baseUrl: string) => ScrapedArticle[];
}

/** 利用可能なパーサー一覧 */
export const parsers: ParserDef[] = [
	{
		id: "yahoo-top",
		name: "Yahoo!ニュース専用",
		parse: (html) => yahooTop.parseArticles(html),
	},
	{
		id: "generic-links",
		name: "汎用リンク抽出",
		parse: (html, baseUrl) => parseGenericLinks(html, baseUrl),
	},
	{
		id: "generic-page",
		name: "汎用OGPページ",
		parse: (html, baseUrl) => parseGenericPage(html, baseUrl),
	},
];

/** parserId からパーサーを取得 */
export function getParserById(id: string): ParserDef | undefined {
	return parsers.find((p) => p.id === id);
}
