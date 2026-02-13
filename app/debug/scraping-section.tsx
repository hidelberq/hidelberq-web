import { useState } from "react";
import { useFetcher } from "react-router";
import { ActionFeedback } from "./feedback";

export function ScrapingSection({
	siteConfigs,
	availableParsers,
	scraped,
	scrapedCount,
}: {
	siteConfigs: Array<{
		id: number;
		siteId: string;
		name: string;
		url: string;
		parserId: string;
		enabled: boolean;
	}>;
	availableParsers: Array<{ id: string; name: string }>;
	scraped: Array<{
		id: number;
		articleUrl: string;
		articleTitle: string;
		description: string | null;
		imageUrl: string | null;
		siteName: string;
		category: string | null;
		scrapedAt: Date | null;
		usedForTweet: boolean;
	}>;
	scrapedCount: number;
}) {
	const siteFetcher = useFetcher();
	const scrapeFetcher = useFetcher();
	const scrapeUrlFetcher = useFetcher();

	const isSiteAction = siteFetcher.state === "submitting" || siteFetcher.state === "loading";
	const isScraping = scrapeFetcher.state === "submitting" || scrapeFetcher.state === "loading";
	const isScrapingUrl = scrapeUrlFetcher.state === "submitting" || scrapeUrlFetcher.state === "loading";

	const [showAddSite, setShowAddSite] = useState(false);
	const [scrapeUrlInput, setScrapeUrlInput] = useState("");
	const [newSiteId, setNewSiteId] = useState("");
	const [newSiteName, setNewSiteName] = useState("");
	const [newSiteUrl, setNewSiteUrl] = useState("");
	const [newSiteParserId, setNewSiteParserId] = useState(availableParsers[0]?.id ?? "generic-links");

	const latestData = (siteFetcher.data ?? scrapeFetcher.data ?? scrapeUrlFetcher.data) as Record<string, unknown> | undefined;

	return (
		<div className="space-y-8">
			<ActionFeedback data={latestData} />

			{/* サイト設定 */}
			<section>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-base font-bold text-teal-400">
						対象サイト
						<span className="text-sm font-normal text-gray-500 ml-2">
							({siteConfigs.length}件)
						</span>
					</h3>
					<button
						type="button"
						onClick={() => setShowAddSite(!showAddSite)}
						className="flex items-center gap-1 text-sm text-teal-400 hover:text-teal-300 transition-colors px-3 py-1.5 rounded-full hover:bg-teal-400/10 border border-teal-400/30"
					>
						{showAddSite ? "閉じる" : "+ サイト追加"}
					</button>
				</div>

				{showAddSite && (
					<div className="mb-4 p-4 border border-teal-400/20 rounded-lg bg-gray-900/30">
						<siteFetcher.Form
							method="post"
							onSubmit={() => {
								setNewSiteId("");
								setNewSiteName("");
								setNewSiteUrl("");
								setShowAddSite(false);
							}}
						>
							<input type="hidden" name="intent" value="add-site" />
							<div className="grid grid-cols-2 gap-3 mb-3">
								<div>
									<label className="block text-xs text-gray-400 mb-1">サイトID</label>
									<input
										type="text"
										name="siteId"
										value={newSiteId}
										onChange={(e) => setNewSiteId(e.target.value)}
										placeholder="nhk-news"
										className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-teal-500/50 focus:outline-none"
									/>
								</div>
								<div>
									<label className="block text-xs text-gray-400 mb-1">表示名</label>
									<input
										type="text"
										name="name"
										value={newSiteName}
										onChange={(e) => setNewSiteName(e.target.value)}
										placeholder="NHKニュース"
										className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-teal-500/50 focus:outline-none"
									/>
								</div>
								<div>
									<label className="block text-xs text-gray-400 mb-1">URL</label>
									<input
										type="url"
										name="siteUrl"
										value={newSiteUrl}
										onChange={(e) => setNewSiteUrl(e.target.value)}
										placeholder="https://www3.nhk.or.jp/news/"
										className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-teal-500/50 focus:outline-none"
									/>
								</div>
								<div>
									<label className="block text-xs text-gray-400 mb-1">パーサー</label>
									<select
										name="parserId"
										value={newSiteParserId}
										onChange={(e) => setNewSiteParserId(e.target.value)}
										className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-teal-500/50 focus:outline-none"
									>
										{availableParsers.map((p) => (
											<option key={p.id} value={p.id}>
												{p.name} ({p.id})
											</option>
										))}
									</select>
								</div>
							</div>
							<button
								type="submit"
								disabled={isSiteAction || !newSiteId.trim() || !newSiteName.trim() || !newSiteUrl.trim()}
								className="w-full flex items-center justify-center gap-2 text-sm text-teal-400 hover:text-teal-300 transition-colors disabled:opacity-50 px-4 py-2 rounded bg-teal-400/10 border border-teal-400/30 hover:bg-teal-400/20"
							>
								{isSiteAction ? "追加中..." : "サイトを追加"}
							</button>
						</siteFetcher.Form>
					</div>
				)}

				{siteConfigs.length === 0 ? (
					<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
						<p className="text-sm">スクレイピング対象サイトが登録されていません</p>
					</div>
				) : (
					<div className="space-y-2">
						{siteConfigs.map((site) => (
							<div
								key={site.id}
								className={`flex items-center justify-between p-3 border rounded-lg transition-colors ${
									site.enabled
										? "border-gray-800 hover:border-gray-700"
										: "border-gray-800/50 opacity-50"
								}`}
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<span className="text-sm font-medium text-gray-200">{site.name}</span>
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/10 text-teal-400">{site.siteId}</span>
										<span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">{site.parserId}</span>
									</div>
									<a
										href={site.url}
										target="_blank"
										rel="noopener noreferrer"
										className="text-xs text-gray-500 hover:text-gray-400 truncate block mt-0.5"
									>
										{site.url}
									</a>
								</div>
								<div className="flex items-center gap-2 ml-3 shrink-0">
									<siteFetcher.Form method="post">
										<input type="hidden" name="intent" value="toggle-site" />
										<input type="hidden" name="id" value={site.id} />
										<input type="hidden" name="enabled" value={String(!site.enabled)} />
										<button
											type="submit"
											disabled={isSiteAction}
											className={`text-xs px-2 py-1 rounded border transition-colors disabled:opacity-50 ${
												site.enabled
													? "text-green-400 border-green-400/30 hover:bg-green-400/10"
													: "text-gray-500 border-gray-700 hover:bg-gray-800"
											}`}
										>
											{site.enabled ? "ON" : "OFF"}
										</button>
									</siteFetcher.Form>
									<siteFetcher.Form method="post">
										<input type="hidden" name="intent" value="delete-site" />
										<input type="hidden" name="id" value={site.id} />
										<button
											type="submit"
											disabled={isSiteAction}
											className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
										>
											削除
										</button>
									</siteFetcher.Form>
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			{/* スクレイピング実行 + 結果 */}
			<section>
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-base font-bold text-cyan-400">
						記事一覧
						<span className="text-sm font-normal text-gray-500 ml-2">
							({scrapedCount}件)
						</span>
					</h3>
					<scrapeFetcher.Form method="post">
						<input type="hidden" name="intent" value="scrape-all" />
						<button
							type="submit"
							disabled={isScraping}
							className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-cyan-400/10 border border-cyan-400/30"
						>
							<svg
								className={`w-4 h-4 ${isScraping ? "animate-spin" : ""}`}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
								/>
							</svg>
							{isScraping ? "スクレイピング中..." : "全サイトスクレイピング"}
						</button>
					</scrapeFetcher.Form>
				</div>

				{/* URL指定スクレイピング */}
				<div className="mb-4 p-4 border border-gray-800 rounded-lg bg-gray-900/30">
					<p className="text-sm text-gray-400 mb-2">URL を指定してスクレイピング</p>
					<scrapeUrlFetcher.Form method="post" className="flex gap-2">
						<input type="hidden" name="intent" value="scrape-url" />
						<input
							type="url"
							name="url"
							value={scrapeUrlInput}
							onChange={(e) => setScrapeUrlInput(e.target.value)}
							placeholder="https://news.yahoo.co.jp/topics"
							className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-cyan-500/50 focus:outline-none"
						/>
						<button
							type="submit"
							disabled={isScrapingUrl || !scrapeUrlInput.trim()}
							className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 px-4 py-2 rounded bg-cyan-400/10 border border-cyan-400/30 hover:bg-cyan-400/20"
						>
							{isScrapingUrl ? "取得中..." : "取得"}
						</button>
					</scrapeUrlFetcher.Form>
				</div>

				{scraped.length === 0 ? (
					<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
						<p className="text-sm">スクレイピング記事がまだありません</p>
					</div>
				) : (
					<div className="space-y-2">
						{scraped.map((article) => (
							<article
								key={article.id}
								className="flex gap-3 p-3 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
							>
								{article.imageUrl && (
									<img
										src={article.imageUrl}
										alt=""
										className="w-16 h-16 rounded object-cover shrink-0"
									/>
								)}
								<div className="min-w-0 flex-1">
									<a
										href={article.articleUrl}
										target="_blank"
										rel="noopener noreferrer"
										className="text-sm text-gray-200 hover:text-cyan-300 transition-colors line-clamp-2"
									>
										{article.articleTitle}
									</a>
									{article.description && (
										<p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
											{article.description}
										</p>
									)}
									<div className="flex items-center gap-2 mt-1 text-[10px] text-gray-600">
										<span className="px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-400">
											{article.siteName}
										</span>
										{article.category && (
											<span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400">
												{article.category}
											</span>
										)}
										{article.scrapedAt && (
											<span>{article.scrapedAt.toLocaleString("ja-JP")}</span>
										)}
										{article.usedForTweet && (
											<span className="px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
												ツイート済
											</span>
										)}
									</div>
								</div>
							</article>
						))}
					</div>
				)}
			</section>
		</div>
	);
}
