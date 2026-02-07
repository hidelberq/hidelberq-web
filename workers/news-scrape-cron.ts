import { scrapeAllSites } from "./scraper/run";

/**
 * Cron から呼ばれるニューススクレイピング関数
 * 全登録サイトをスクレイピングして記事を DB に保存する
 */
export async function scrapeNews(env: Env): Promise<void> {
	console.log("News scrape cron: Starting...");

	try {
		const { results, cleaned } = await scrapeAllSites(env);

		for (const [siteId, result] of Object.entries(results)) {
			console.log(
				`News scrape cron: ${siteId} - ${result.inserted}/${result.total} articles`,
			);
		}

		if (cleaned > 0) {
			console.log(`News scrape cron: Cleaned ${cleaned} old articles`);
		}

		console.log("News scrape cron: Done");
	} catch (e) {
		console.error("News scrape cron error:", e);
	}
}
