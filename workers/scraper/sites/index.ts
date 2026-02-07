import type { ScrapeSiteConfig } from "../types";
import { yahooTop } from "./yahoo-top";

/** 定期スクレイピング対象の全サイト設定 */
export const allSites: ScrapeSiteConfig[] = [yahooTop];

/** サイトIDからサイト設定を取得 */
export function getSiteById(id: string): ScrapeSiteConfig | undefined {
	return allSites.find((s) => s.id === id);
}
