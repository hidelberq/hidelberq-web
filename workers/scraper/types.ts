/** スクレイピング対象サイトの設定 */
export interface ScrapeSiteConfig {
	/** サイト識別子 (例: "yahoo-top") */
	id: string;
	/** 表示名 (例: "Yahoo!ニュース トピックス") */
	name: string;
	/** スクレイピング対象 URL */
	url: string;
	/** HTML を受け取り記事リストを返すパーサー */
	parseArticles: (html: string) => ScrapedArticle[];
}

/** パーサーが返す記事データ */
export interface ScrapedArticle {
	articleUrl: string;
	articleTitle: string;
	imageUrl?: string;
	description?: string;
	category?: string;
}
