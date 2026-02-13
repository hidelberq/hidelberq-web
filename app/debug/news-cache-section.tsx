import { useFetcher } from "react-router";
import { ActionFeedback } from "./feedback";

export function NewsCacheSection({
	entries,
}: {
	entries: Array<{
		id: number;
		content: string;
		fetchedDate: string;
		createdAt: Date | null;
	}>;
}) {
	const fetcher = useFetcher();
	const isRefreshing = fetcher.state === "submitting" || fetcher.state === "loading";

	return (
		<section>
			<ActionFeedback data={fetcher.data as Record<string, unknown> | undefined} />

			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-bold text-amber-400">ニュースキャッシュ</h2>
				<fetcher.Form method="post">
					<button
						type="submit"
						disabled={isRefreshing}
						className="flex items-center gap-2 text-sm text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-amber-400/10 border border-amber-400/30"
					>
						<svg
							className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
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
						{isRefreshing ? "取得中..." : "ニュースキャッシュ再取得"}
					</button>
				</fetcher.Form>
			</div>

			{entries.length === 0 ? (
				<div className="p-12 text-center text-gray-500">
					<p className="text-lg mb-2">ニュースキャッシュがありません</p>
					<p className="text-sm">「ニュースキャッシュ再取得」ボタンでニュースを取得できます</p>
				</div>
			) : (
				<div className="space-y-6">
					{entries.map((entry, index) => (
						<article
							key={entry.id}
							className="border border-gray-800 rounded-lg overflow-hidden"
						>
							<div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/50 border-b border-gray-800">
								<div className="flex items-center gap-3 text-sm">
									<span className="font-mono text-gray-400">ID: {entry.id}</span>
									<span className="text-gray-600">|</span>
									<span className="text-blue-400 font-medium">{entry.fetchedDate}</span>
									{index === 0 && (
										<span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-500/20 text-green-400">
											最新
										</span>
									)}
								</div>
								{entry.createdAt && (
									<span className="text-xs text-gray-500">
										{entry.createdAt.toLocaleString("ja-JP")}
									</span>
								)}
							</div>
							<div className="px-4 py-1.5 bg-gray-900/30 border-b border-gray-800 text-xs text-gray-500">
								文字数: {entry.content.length}
							</div>
							<div className="px-4 py-3">
								<pre className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-300 font-sans">
									{entry.content}
								</pre>
							</div>
						</article>
					))}
				</div>
			)}
		</section>
	);
}
