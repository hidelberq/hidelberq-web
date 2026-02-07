import { scrapeAllSites } from "./scraper/run";

/**
 * Cron から呼ばれるニューススクレイピング関数
 * 全登録サイトをスクレイピングして記事を DB に保存する
 */
export async function scrapeNews(env: Env): Promise<string | null> {
	console.log("News scrape cron: Starting...");

	try {
		const { results, cleaned } = await scrapeAllSites(env);

		let totalInserted = 0;
		for (const [siteId, result] of Object.entries(results)) {
			console.log(
				`News scrape cron: ${siteId} - ${result.inserted}/${result.total} articles`,
			);
			totalInserted += result.inserted;
		}

		if (cleaned > 0) {
			console.log(`News scrape cron: Cleaned ${cleaned} old articles`);
		}

		console.log("News scrape cron: Done");

		if (totalInserted > 0) {
			return `ニュース記事を${totalInserted}件取得`;
		}
		return null;
	} catch (e) {
		console.error("News scrape cron error:", e);
		return null;
	}
}
