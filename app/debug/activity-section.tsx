import { useState } from "react";
import { useFetcher } from "react-router";
import { ActionFeedback } from "./feedback";

export function ActivitySection({
	activityEntries,
	activityCount,
}: {
	activityEntries: Array<{
		id: number;
		type: string;
		message: string;
		metadata: string | null;
		createdAt: Date | null;
	}>;
	activityCount: number;
}) {
	const fetcher = useFetcher();
	const isLoading = fetcher.state === "submitting" || fetcher.state === "loading";
	const [showAddForm, setShowAddForm] = useState(false);
	const [activityType, setActivityType] = useState("deploy");
	const [message, setMessage] = useState("");
	const [metadata, setMetadata] = useState("");

	return (
		<section>
			<ActionFeedback data={fetcher.data as Record<string, unknown> | undefined} />

			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-bold text-emerald-400">
					アクティビティログ
					<span className="text-sm font-normal text-gray-500 ml-2">
						({activityCount}件)
					</span>
				</h2>
				<div className="flex items-center gap-2">
					<button
						type="button"
						onClick={() => setShowAddForm(!showAddForm)}
						className="flex items-center gap-1 text-sm text-emerald-400 hover:text-emerald-300 transition-colors px-3 py-1.5 rounded-full hover:bg-emerald-400/10 border border-emerald-400/30"
					>
						{showAddForm ? "閉じる" : "+ 追加"}
					</button>
					<fetcher.Form method="post">
						<input type="hidden" name="intent" value="clear-all-activities" />
						<button
							type="submit"
							disabled={isLoading || activityCount === 0}
							className="flex items-center gap-1 text-sm text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-red-400/10 border border-red-400/20"
							onClick={(e) => {
								if (!confirm("全てのアクティビティログを削除しますか？")) {
									e.preventDefault();
								}
							}}
						>
							全削除
						</button>
					</fetcher.Form>
				</div>
			</div>

			{showAddForm && (
				<div className="mb-4 p-4 border border-emerald-400/20 rounded-lg bg-gray-900/30">
					<fetcher.Form
						method="post"
						onSubmit={() => {
							setMessage("");
							setMetadata("");
							setShowAddForm(false);
						}}
					>
						<input type="hidden" name="intent" value="add-activity" />
						<div className="grid grid-cols-2 gap-3 mb-3">
							<div>
								<label className="block text-xs text-gray-400 mb-1">タイプ</label>
								<select
									name="type"
									value={activityType}
									onChange={(e) => setActivityType(e.target.value)}
									className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-emerald-500/50 focus:outline-none"
								>
									<option value="deploy">deploy</option>
									<option value="cron_aitter">cron_aitter</option>
									<option value="cron_hero_image">cron_hero_image</option>
									<option value="cron_news_scrape">cron_news_scrape</option>
								</select>
							</div>
							<div>
								<label className="block text-xs text-gray-400 mb-1">メタデータ (JSON, 任意)</label>
								<input
									type="text"
									name="metadata"
									value={metadata}
									onChange={(e) => setMetadata(e.target.value)}
									placeholder='{"hash": "abc1234"}'
									className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none"
								/>
							</div>
						</div>
						<div className="mb-3">
							<label className="block text-xs text-gray-400 mb-1">メッセージ</label>
							<input
								type="text"
								name="message"
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								placeholder="feat: アクティビティフィードを追加"
								className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 placeholder-gray-600 focus:border-emerald-500/50 focus:outline-none"
							/>
						</div>
						<button
							type="submit"
							disabled={isLoading || !message.trim()}
							className="w-full flex items-center justify-center gap-2 text-sm text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50 px-4 py-2 rounded bg-emerald-400/10 border border-emerald-400/30 hover:bg-emerald-400/20"
						>
							{isLoading ? "追加中..." : "アクティビティを追加"}
						</button>
					</fetcher.Form>
				</div>
			)}

			{activityEntries.length === 0 ? (
				<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
					<p className="text-sm">アクティビティログがありません</p>
				</div>
			) : (
				<div className="space-y-2">
					{activityEntries.map((entry) => (
						<div
							key={entry.id}
							className="flex items-start justify-between gap-3 p-3 border border-gray-800 rounded-lg hover:border-gray-700 transition-colors"
						>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2 mb-1">
									<span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
										entry.type === "deploy"
											? "bg-blue-500/10 text-blue-400"
											: entry.type === "cron_aitter"
												? "bg-violet-500/10 text-violet-400"
												: entry.type === "cron_hero_image"
													? "bg-fuchsia-500/10 text-fuchsia-400"
													: entry.type === "cron_news_scrape"
														? "bg-cyan-500/10 text-cyan-400"
														: "bg-gray-800 text-gray-400"
									}`}>
										{entry.type}
									</span>
									<span className="text-[10px] font-mono text-gray-600">
										ID: {entry.id}
									</span>
									{entry.createdAt && (
										<span className="text-[10px] text-gray-600">
											{entry.createdAt.toLocaleString("ja-JP")}
										</span>
									)}
								</div>
								<p className="text-sm text-gray-300">{entry.message}</p>
								{entry.metadata && (
									<p className="text-xs text-gray-600 mt-0.5 font-mono">
										{entry.metadata}
									</p>
								)}
							</div>
							<fetcher.Form method="post" className="shrink-0">
								<input type="hidden" name="intent" value="delete-activity" />
								<input type="hidden" name="id" value={entry.id} />
								<button
									type="submit"
									disabled={isLoading}
									className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
								>
									削除
								</button>
							</fetcher.Form>
						</div>
					))}
				</div>
			)}
		</section>
	);
}
