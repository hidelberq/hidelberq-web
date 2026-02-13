import { useState } from "react";
import { useFetcher } from "react-router";
import { ActionFeedback } from "./feedback";

export function HeroSection({
	heroEntries,
}: {
	heroEntries: Array<{
		id: number;
		date: string;
		prompt: string;
		source: string;
		diaryContent: string | null;
	}>;
}) {
	const fetcher = useFetcher();
	const isRegenerating = fetcher.state === "submitting" || fetcher.state === "loading";

	return (
		<section>
			<ActionFeedback data={fetcher.data as Record<string, unknown> | undefined} />

			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-bold text-fuchsia-400">ヒーローイメージ</h2>
				<fetcher.Form method="post">
					<input type="hidden" name="intent" value="regenerate-hero" />
					<button
						type="submit"
						disabled={isRegenerating}
						className="flex items-center gap-2 text-sm text-fuchsia-400 hover:text-fuchsia-300 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-fuchsia-400/10 border border-fuchsia-400/30"
					>
						<svg
							className={`w-4 h-4 ${isRegenerating ? "animate-spin" : ""}`}
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
						{isRegenerating ? "生成中..." : "ヒーローイメージを再生成"}
					</button>
				</fetcher.Form>
			</div>

			{heroEntries.length === 0 ? (
				<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
					<p className="text-sm">ヒーローイメージがまだ生成されていません</p>
				</div>
			) : (
				<div className="space-y-4">
					{heroEntries.map((entry, index) => (
						<HeroImageCard
							key={entry.id}
							entry={entry}
							isLatest={index === 0}
							isSubmitting={isRegenerating}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function HeroImageCard({
	entry,
	isLatest,
	isSubmitting,
}: {
	entry: {
		id: number;
		date: string;
		prompt: string;
		source: string;
		diaryContent: string | null;
	};
	isLatest: boolean;
	isSubmitting: boolean;
}) {
	const [isEditing, setIsEditing] = useState(false);
	const [editedPrompt, setEditedPrompt] = useState(entry.prompt);
	const promptFetcher = useFetcher();
	const isRegenerating =
		promptFetcher.state === "submitting" || promptFetcher.state === "loading";

	return (
		<article className="border border-gray-800 rounded-lg overflow-hidden">
			<div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/50 border-b border-gray-800">
				<div className="flex items-center gap-3 text-sm">
					<span className="text-fuchsia-400 font-medium">{entry.date}</span>
					<span className="text-gray-600">|</span>
					<span
						className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${entry.source === "diary" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"}`}
					>
						{entry.source === "diary" ? "日記" : "天気"}
					</span>
					{isLatest && (
						<span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-500/20 text-green-400">
							最新
						</span>
					)}
				</div>
			</div>
			<div className="p-4">
				<img
					src={`/hero-image/${entry.date}?t=${Date.now()}`}
					alt={`Hero image for ${entry.date}`}
					className="w-full rounded-lg aspect-video object-cover mb-3"
				/>

				{promptFetcher.data && typeof promptFetcher.data === "object" && "error" in (promptFetcher.data as Record<string, unknown>) && (
					<div className="mb-3 px-3 py-2 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
						{(promptFetcher.data as Record<string, unknown>).error as string}
					</div>
				)}
				{promptFetcher.data && typeof promptFetcher.data === "object" && "ok" in (promptFetcher.data as Record<string, unknown>) && (
					<div className="mb-3 px-3 py-2 rounded bg-green-500/10 border border-green-500/30 text-green-400 text-xs">
						{((promptFetcher.data as Record<string, unknown>).message as string) ?? "再生成しました"}
					</div>
				)}

				<details className="text-sm" open={isEditing}>
					<summary className="text-gray-400 cursor-pointer hover:text-gray-300">
						プロンプトを表示 / 編集
					</summary>

					{isEditing ? (
						<div className="mt-2">
							<textarea
								value={editedPrompt}
								onChange={(e) => setEditedPrompt(e.target.value)}
								rows={6}
								className="w-full bg-gray-900 border border-gray-700 rounded p-3 text-xs text-gray-300 font-sans focus:border-fuchsia-500/50 focus:outline-none resize-y"
							/>
							<div className="flex items-center gap-2 mt-2">
								<promptFetcher.Form method="post" className="flex-1">
									<input type="hidden" name="intent" value="regenerate-hero-with-prompt" />
									<input type="hidden" name="date" value={entry.date} />
									<input type="hidden" name="prompt" value={editedPrompt} />
									<button
										type="submit"
										disabled={isRegenerating || isSubmitting || editedPrompt.trim().length === 0}
										className="w-full flex items-center justify-center gap-2 text-xs text-fuchsia-400 hover:text-fuchsia-300 transition-colors disabled:opacity-50 px-3 py-2 rounded bg-fuchsia-400/10 border border-fuchsia-400/30 hover:bg-fuchsia-400/20"
									>
										<svg
											className={`w-3.5 h-3.5 ${isRegenerating ? "animate-spin" : ""}`}
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
										{isRegenerating ? "再生成中..." : "このプロンプトで再生成"}
									</button>
								</promptFetcher.Form>
								<button
									type="button"
									onClick={() => {
										setIsEditing(false);
										setEditedPrompt(entry.prompt);
									}}
									className="text-xs text-gray-500 hover:text-gray-400 px-3 py-2 rounded border border-gray-700 hover:bg-gray-800"
								>
									キャンセル
								</button>
							</div>
						</div>
					) : (
						<div className="mt-2">
							<pre className="whitespace-pre-wrap break-words text-xs text-gray-500 font-sans bg-gray-900/50 p-3 rounded">
								{entry.prompt}
							</pre>
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="mt-2 text-xs text-fuchsia-400/70 hover:text-fuchsia-400 transition-colors"
							>
								プロンプトを編集して再生成
							</button>
						</div>
					)}

					{entry.diaryContent && (
						<>
							<p className="mt-2 text-gray-400 text-xs">日記内容:</p>
							<pre className="mt-1 whitespace-pre-wrap break-words text-xs text-gray-500 font-sans bg-gray-900/50 p-3 rounded">
								{entry.diaryContent}
							</pre>
						</>
					)}
				</details>
			</div>
		</article>
	);
}
