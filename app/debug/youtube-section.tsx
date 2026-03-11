import { useState } from "react";
import { useFetcher } from "react-router";
import { ActionFeedback } from "./feedback";

type VideoEntry = {
	id: number;
	videoId: string;
	title: string;
	description: string | null;
	publishedAt: string | null;
};

export function YouTubeSection({
	videoEntries,
	videoCount,
}: {
	videoEntries: VideoEntry[];
	videoCount: number;
}) {
	const addFetcher = useFetcher();
	const deleteFetcher = useFetcher();

	const isAdding =
		addFetcher.state === "submitting" || addFetcher.state === "loading";

	const [videoUrl, setVideoUrl] = useState("");
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [publishedAt, setPublishedAt] = useState("");

	const addFeedback =
		addFetcher.data as Record<string, unknown> | undefined;
	const deleteFeedback =
		deleteFetcher.data as Record<string, unknown> | undefined;

	// YouTube URL から動画IDを抽出
	function extractVideoId(url: string): string | null {
		const patterns = [
			/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
			/^([a-zA-Z0-9_-]{11})$/,
		];
		for (const pattern of patterns) {
			const match = url.match(pattern);
			if (match) return match[1];
		}
		return null;
	}

	const extractedVideoId = extractVideoId(videoUrl);

	return (
		<section>
			<ActionFeedback data={addFeedback} />
			<ActionFeedback data={deleteFeedback} />

			{/* 動画追加フォーム */}
			<div className="mb-6 p-4 rounded-xl bg-gray-900 border border-gray-800">
				<h3 className="text-sm font-bold text-red-400 mb-3">
					YouTube 動画を追加
				</h3>
				<addFetcher.Form method="post" className="space-y-3">
					<input type="hidden" name="intent" value="add-youtube-video" />
					<div>
						<label className="block text-xs text-gray-400 mb-1">
							YouTube URL または動画ID
						</label>
						<input
							type="text"
							name="videoUrl"
							value={videoUrl}
							onChange={(e) => setVideoUrl(e.target.value)}
							placeholder="https://youtube.com/watch?v=... または動画ID"
							className="w-full px-3 py-2 rounded-lg bg-black border border-gray-700 text-sm text-white placeholder:text-gray-600 focus:border-red-500 focus:outline-none"
						/>
						{videoUrl && (
							<p className="mt-1 text-xs text-gray-500">
								動画ID: {extractedVideoId ?? "無効なURL"}
							</p>
						)}
					</div>
					{extractedVideoId && (
						<div className="rounded-lg overflow-hidden border border-gray-700">
							<div className="aspect-video">
								<iframe
									src={`https://www.youtube.com/embed/${extractedVideoId}`}
									title="プレビュー"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowFullScreen
									className="w-full h-full"
								/>
							</div>
						</div>
					)}
					<div>
						<label className="block text-xs text-gray-400 mb-1">
							タイトル
						</label>
						<input
							type="text"
							name="title"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="動画タイトル"
							className="w-full px-3 py-2 rounded-lg bg-black border border-gray-700 text-sm text-white placeholder:text-gray-600 focus:border-red-500 focus:outline-none"
						/>
					</div>
					<div>
						<label className="block text-xs text-gray-400 mb-1">
							説明（任意）
						</label>
						<textarea
							name="description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="動画の説明"
							rows={2}
							className="w-full px-3 py-2 rounded-lg bg-black border border-gray-700 text-sm text-white placeholder:text-gray-600 focus:border-red-500 focus:outline-none resize-none"
						/>
					</div>
					<div>
						<label className="block text-xs text-gray-400 mb-1">
							公開日（任意）
						</label>
						<input
							type="date"
							name="publishedAt"
							value={publishedAt}
							onChange={(e) => setPublishedAt(e.target.value)}
							className="px-3 py-2 rounded-lg bg-black border border-gray-700 text-sm text-white focus:border-red-500 focus:outline-none"
						/>
					</div>
					<button
						type="submit"
						disabled={isAdding || !extractedVideoId || !title.trim()}
						className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-sm font-medium transition-colors"
					>
						{isAdding ? "追加中..." : "追加"}
					</button>
				</addFetcher.Form>
			</div>

			{/* 動画一覧 */}
			<div className="space-y-3">
				<h3 className="text-sm font-bold text-gray-400">
					登録済み動画（{videoCount}件）
				</h3>
				{videoEntries.length === 0 ? (
					<p className="text-sm text-gray-600">動画がありません</p>
				) : (
					videoEntries.map((video) => (
						<div
							key={video.id}
							className="p-4 rounded-xl bg-gray-900 border border-gray-800"
						>
							<div className="flex items-start gap-4">
								<div className="w-40 flex-shrink-0 rounded-lg overflow-hidden border border-gray-700">
									<img
										src={`https://img.youtube.com/vi/${video.videoId}/mqdefault.jpg`}
										alt={video.title}
										className="w-full aspect-video object-cover"
									/>
								</div>
								<div className="flex-1 min-w-0">
									<h4 className="text-sm font-semibold text-white truncate">
										{video.title}
									</h4>
									{video.description && (
										<p className="text-xs text-gray-400 mt-1 line-clamp-2">
											{video.description}
										</p>
									)}
									<div className="flex items-center gap-3 mt-2">
										<span className="text-xs text-gray-600">
											ID: {video.videoId}
										</span>
										{video.publishedAt && (
											<span className="text-xs text-gray-600">
												{video.publishedAt}
											</span>
										)}
									</div>
								</div>
								<deleteFetcher.Form method="post">
									<input
										type="hidden"
										name="intent"
										value="delete-youtube-video"
									/>
									<input type="hidden" name="id" value={video.id} />
									<button
										type="submit"
										className="text-xs text-red-500 hover:text-red-400 transition-colors px-2 py-1"
									>
										削除
									</button>
								</deleteFetcher.Form>
							</div>
						</div>
					))
				)}
			</div>
		</section>
	);
}
