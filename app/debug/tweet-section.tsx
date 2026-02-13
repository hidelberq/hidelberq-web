import { useFetcher } from "react-router";
import { ActionFeedback } from "./feedback";

export function TweetSection({
	recentTweets,
	tweetCount,
	unshownCount,
}: {
	recentTweets: Array<{
		id: number;
		content: string;
		authorEmoji: string;
		authorName: string;
		authorHandle: string;
		category: string;
		sourceUrl: string | null;
		displayed: boolean;
		createdAt: Date | null;
	}>;
	tweetCount: number;
	unshownCount: number;
}) {
	const fetcher = useFetcher();
	const isGenerating = fetcher.state === "submitting" || fetcher.state === "loading";

	return (
		<section>
			<ActionFeedback data={fetcher.data as Record<string, unknown> | undefined} />

			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-bold text-violet-400">
					AIteer ツイート生成
					<span className="text-sm font-normal text-gray-500 ml-2">
						(全{tweetCount}件 / 未表示{unshownCount}件)
					</span>
				</h2>
				<fetcher.Form method="post">
					<input type="hidden" name="intent" value="generate-tweets" />
					<button
						type="submit"
						disabled={isGenerating}
						className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-violet-400/10 border border-violet-400/30"
					>
						<svg
							className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`}
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
						{isGenerating ? "生成中..." : "ツイート生成"}
					</button>
				</fetcher.Form>
			</div>

			{recentTweets.length === 0 ? (
				<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
					<p className="text-sm">生成済みツイートがまだありません</p>
				</div>
			) : (
				<div className="space-y-2">
					{recentTweets.map((tweet) => (
						<article
							key={tweet.id}
							className="p-3 border border-gray-800 rounded-lg"
						>
							<div className="flex items-start gap-2">
								<span className="text-lg shrink-0">{tweet.authorEmoji}</span>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2 text-sm">
										<span className="font-bold text-gray-200">{tweet.authorName}</span>
										<span className="text-gray-500">@{tweet.authorHandle}</span>
									</div>
									<p className="text-sm text-gray-300 mt-1">{tweet.content}</p>
									<div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
										<span className="px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400">
											{tweet.category}
										</span>
										{tweet.sourceUrl && (
											<a
												href={tweet.sourceUrl}
												target="_blank"
												rel="noopener noreferrer"
												className="text-blue-400/60 hover:text-blue-400 truncate max-w-[200px]"
											>
												{tweet.sourceUrl}
											</a>
										)}
										<span className={tweet.displayed ? "text-gray-600" : "text-yellow-400"}>
											{tweet.displayed ? "表示済" : "未表示"}
										</span>
										{tweet.createdAt && (
											<span>{tweet.createdAt.toLocaleString("ja-JP")}</span>
										)}
									</div>
								</div>
							</div>
						</article>
					))}
				</div>
			)}
		</section>
	);
}
