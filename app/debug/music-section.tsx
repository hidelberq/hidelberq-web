import { useState } from "react";
import { useFetcher } from "react-router";
import { ActionFeedback } from "./feedback";

type TrackEntry = {
	id: number;
	date: string;
	type: string;
	title: string | null;
	style: string | null;
	duration: number | null;
	source: string;
	prompt: string | null;
	diaryContent: string | null;
	sunoTaskId: string | null;
};

export function MusicSection({
	trackEntries,
	trackCount,
}: {
	trackEntries: TrackEntry[];
	trackCount: number;
}) {
	const generateFetcher = useFetcher();
	const uploadFetcher = useFetcher();
	const diaryFetcher = useFetcher();
	const customFetcher = useFetcher();

	const isGenerating =
		generateFetcher.state === "submitting" ||
		generateFetcher.state === "loading";
	const isUploading =
		uploadFetcher.state === "submitting" ||
		uploadFetcher.state === "loading";
	const isFetchingDiary =
		diaryFetcher.state === "submitting" ||
		diaryFetcher.state === "loading";
	const isCustomGenerating =
		customFetcher.state === "submitting" ||
		customFetcher.state === "loading";

	const [uploadDate, setUploadDate] = useState("");
	const [uploadTitle, setUploadTitle] = useState("");

	// 日記取得テスト
	const [diaryTestDate, setDiaryTestDate] = useState("");
	const [diaryResult, setDiaryResult] = useState<string | null>(null);

	// カスタム生成
	const [customDate, setCustomDate] = useState("");
	const [customStyle, setCustomStyle] = useState("lo-fi hip-hop, chill trap, jazzy beats, 90bpm");
	const [customTitle, setCustomTitle] = useState("");
	const [customDiary, setCustomDiary] = useState("");

	// 日記取得結果をstateに反映
	const diaryData = diaryFetcher.data as Record<string, unknown> | undefined;
	if (diaryData?.ok && "diaryResult" in diaryData) {
		const result = diaryData.diaryResult as string | null;
		if (result && diaryResult !== result) {
			setDiaryResult(result);
			setCustomDiary(result);
			setCustomDate(diaryTestDate);
		}
	}

	// 各フェッチャーのフィードバックを個別に取得
	const generateFeedback =
		generateFetcher.data as Record<string, unknown> | undefined;
	const uploadFeedback =
		uploadFetcher.data as Record<string, unknown> | undefined;
	const diaryFeedback =
		diaryFetcher.data as Record<string, unknown> | undefined;
	const customFeedback =
		customFetcher.data as Record<string, unknown> | undefined;

	return (
		<section>
			<ActionFeedback data={generateFeedback} />
			<ActionFeedback data={uploadFeedback} />
			<ActionFeedback data={diaryFeedback} />
			<ActionFeedback data={customFeedback} />

			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-bold text-pink-400">
					Hiphopトラック{" "}
					<span className="text-sm font-normal text-gray-500">
						({trackCount}件)
					</span>
				</h2>
				<generateFetcher.Form method="post">
					<input type="hidden" name="intent" value="generate-hiphop" />
					<button
						type="submit"
						disabled={isGenerating}
						className="flex items-center gap-2 text-sm text-pink-400 hover:text-pink-300 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-pink-400/10 border border-pink-400/30"
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
								d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
							/>
						</svg>
						{isGenerating ? "生成中..." : "自動生成"}
					</button>
				</generateFetcher.Form>
			</div>

			{/* 日記取得テスト */}
			<div className="mb-4 border border-gray-800 rounded-lg p-4 bg-gray-900/30">
				<h3 className="text-sm font-semibold text-blue-400 mb-3">
					日記取得テスト
				</h3>
				<diaryFetcher.Form method="post">
					<input type="hidden" name="intent" value="test-diary-fetch" />
					<div className="flex gap-2 items-end">
						<div className="flex-1">
							<label className="block text-xs text-gray-400 mb-1">
								日付 (YYYY-MM-DD)
							</label>
							<input
								type="date"
								name="date"
								value={diaryTestDate}
								onChange={(e) => setDiaryTestDate(e.target.value)}
								required
								className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-blue-500/50 focus:outline-none"
							/>
						</div>
						<button
							type="submit"
							disabled={isFetchingDiary || !diaryTestDate}
							className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50 px-4 py-2 rounded bg-blue-500/10 border border-blue-500/30 hover:bg-blue-500/20"
						>
							<svg
								className={`w-4 h-4 ${isFetchingDiary ? "animate-spin" : ""}`}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
							</svg>
							{isFetchingDiary ? "取得中..." : "日記を取得"}
						</button>
					</div>
				</diaryFetcher.Form>
				{diaryResult !== null && (
					<div className="mt-3">
						<p className="text-xs text-gray-400 mb-1">取得結果:</p>
						<pre className="whitespace-pre-wrap break-words text-xs text-gray-300 font-sans bg-gray-900/50 p-3 rounded max-h-48 overflow-y-auto border border-gray-700">
							{diaryResult}
						</pre>
					</div>
				)}
			</div>

			{/* カスタムプロンプトで生成 */}
			<div className="mb-4 border border-gray-800 rounded-lg p-4 bg-gray-900/30">
				<h3 className="text-sm font-semibold text-purple-400 mb-3">
					カスタムプロンプトで生成
				</h3>
				<customFetcher.Form method="post">
					<input type="hidden" name="intent" value="generate-hiphop-with-prompt" />
					<div className="space-y-3">
						<div>
							<label className="block text-xs text-gray-400 mb-1">
								日付 (YYYY-MM-DD)
							</label>
							<input
								type="date"
								name="date"
								value={customDate}
								onChange={(e) => setCustomDate(e.target.value)}
								required
								className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-purple-500/50 focus:outline-none"
							/>
						</div>
						<div>
							<label className="block text-xs text-gray-400 mb-1">
								スタイル（英語、Suno AI形式）
							</label>
							<input
								type="text"
								name="style"
								value={customStyle}
								onChange={(e) => setCustomStyle(e.target.value)}
								required
								placeholder="lo-fi hip-hop, chill trap, jazzy beats, 90bpm"
								className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-purple-500/50 focus:outline-none"
							/>
							<p className="text-[10px] text-gray-600 mt-1">
								例: boom bap, jazzy, chill vibes, 90bpm / dark trap, 808 bass, aggressive, 140bpm
							</p>
						</div>
						<div>
							<label className="block text-xs text-gray-400 mb-1">
								タイトル
							</label>
							<input
								type="text"
								name="title"
								value={customTitle}
								onChange={(e) => setCustomTitle(e.target.value)}
								required
								placeholder="トラックタイトル"
								className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-purple-500/50 focus:outline-none"
							/>
						</div>
						<div>
							<label className="block text-xs text-gray-400 mb-1">
								日記内容（任意 - 上の「日記取得テスト」で取得すると自動入力されます）
							</label>
							<textarea
								name="diaryContent"
								value={customDiary}
								onChange={(e) => setCustomDiary(e.target.value)}
								rows={4}
								placeholder="日記の内容があればここに入力..."
								className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-purple-500/50 focus:outline-none resize-y"
							/>
						</div>
						<button
							type="submit"
							disabled={isCustomGenerating || !customDate || !customStyle.trim() || !customTitle.trim()}
							className="flex items-center gap-2 text-sm text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50 px-4 py-2 rounded bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/20"
						>
							<svg
								className={`w-4 h-4 ${isCustomGenerating ? "animate-spin" : ""}`}
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth={2}
									d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
								/>
							</svg>
							{isCustomGenerating ? "生成中（2〜5分）..." : "このプロンプトで生成"}
						</button>
					</div>
				</customFetcher.Form>
			</div>

			{/* ラップトラックアップロード */}
			<div className="mb-6 border border-gray-800 rounded-lg p-4 bg-gray-900/30">
				<h3 className="text-sm font-semibold text-cyan-400 mb-3">
					ラップトラックをアップロード
				</h3>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						const formData = new FormData(e.currentTarget);
						uploadFetcher.submit(formData, {
							method: "post",
							encType: "multipart/form-data",
						});
					}}
				>
					<input type="hidden" name="intent" value="upload-rap-track" />
					<div className="space-y-3">
						<div>
							<label className="block text-xs text-gray-400 mb-1">
								日付 (YYYY-MM-DD)
							</label>
							<input
								type="date"
								name="date"
								value={uploadDate}
								onChange={(e) => setUploadDate(e.target.value)}
								required
								className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-cyan-500/50 focus:outline-none"
							/>
						</div>
						<div>
							<label className="block text-xs text-gray-400 mb-1">
								タイトル（任意）
							</label>
							<input
								type="text"
								name="title"
								value={uploadTitle}
								onChange={(e) => setUploadTitle(e.target.value)}
								placeholder="ラップトラックのタイトル"
								className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:border-cyan-500/50 focus:outline-none"
							/>
						</div>
						<div>
							<label className="block text-xs text-gray-400 mb-1">
								音声ファイル (MP3 / M4A)
							</label>
							<input
								type="file"
								name="audio"
								accept="audio/*,.mp3,.m4a,.mp4,.aac,.wav,.ogg"
								required
								className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-cyan-500/20 file:text-cyan-400 hover:file:bg-cyan-500/30"
							/>
						</div>
						<button
							type="submit"
							disabled={isUploading || !uploadDate}
							className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300 transition-colors disabled:opacity-50 px-4 py-2 rounded bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/20"
						>
							<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
							</svg>
							{isUploading ? "アップロード中..." : "アップロード"}
						</button>
					</div>
				</form>
			</div>

			{/* トラック一覧 */}
			{trackEntries.length === 0 ? (
				<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
					<p className="text-sm">トラックがまだ生成されていません</p>
				</div>
			) : (
				<div className="space-y-3">
					{trackEntries.map((entry, index) => (
						<MusicTrackCard
							key={entry.id}
							entry={entry}
							isLatest={index === 0}
						/>
					))}
				</div>
			)}
		</section>
	);
}

function MusicTrackCard({
	entry,
	isLatest,
}: {
	entry: TrackEntry;
	isLatest: boolean;
}) {
	const deleteFetcher = useFetcher();
	const titleFetcher = useFetcher();
	const isDeleting =
		deleteFetcher.state === "submitting" ||
		deleteFetcher.state === "loading";
	const isSavingTitle =
		titleFetcher.state === "submitting" ||
		titleFetcher.state === "loading";

	const [isEditingTitle, setIsEditingTitle] = useState(false);
	const [editTitle, setEditTitle] = useState(entry.title || "");

	const titleFeedback =
		titleFetcher.data as Record<string, unknown> | undefined;

	const isInstrumental = entry.type === "instrumental";
	const typeColor = isInstrumental ? "pink" : "cyan";

	return (
		<article className="border border-gray-800 rounded-lg overflow-hidden">
			<ActionFeedback data={titleFeedback} />
			<div className="flex items-center justify-between px-4 py-2.5 bg-gray-900/50 border-b border-gray-800">
				<div className="flex items-center gap-3 text-sm min-w-0">
					<span className={`text-${typeColor}-400 font-medium shrink-0`}>{entry.date}</span>
					<span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
						isInstrumental
							? "bg-pink-500/20 text-pink-400"
							: "bg-cyan-500/20 text-cyan-400"
					}`}>
						{isInstrumental ? "Instrumental" : "Rap"}
					</span>
					{isEditingTitle ? (
						<titleFetcher.Form
							method="post"
							className="flex items-center gap-1 min-w-0 flex-1"
							onSubmit={() => setIsEditingTitle(false)}
						>
							<input type="hidden" name="intent" value="update-track-title" />
							<input type="hidden" name="id" value={entry.id} />
							<input
								type="text"
								name="title"
								value={editTitle}
								onChange={(e) => setEditTitle(e.target.value)}
								className="flex-1 min-w-0 bg-gray-900 border border-gray-600 rounded px-2 py-0.5 text-sm text-gray-300 focus:border-gray-400 focus:outline-none"
								autoFocus
								onKeyDown={(e) => {
									if (e.key === "Escape") {
										setIsEditingTitle(false);
										setEditTitle(entry.title || "");
									}
								}}
							/>
							<button
								type="submit"
								disabled={isSavingTitle || !editTitle.trim()}
								className="text-xs text-green-400 hover:text-green-300 px-1.5 disabled:opacity-50"
							>
								保存
							</button>
							<button
								type="button"
								onClick={() => {
									setIsEditingTitle(false);
									setEditTitle(entry.title || "");
								}}
								className="text-xs text-gray-500 hover:text-gray-400 px-1"
							>
								取消
							</button>
						</titleFetcher.Form>
					) : (
						<>
							<span className="text-gray-300 font-medium truncate">
								{entry.title || "Untitled"}
							</span>
							<button
								type="button"
								onClick={() => setIsEditingTitle(true)}
								className="shrink-0 text-gray-600 hover:text-gray-400 transition-colors"
								title="タイトルを編集"
							>
								<svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
								</svg>
							</button>
						</>
					)}
					<span
						className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
							entry.source === "diary"
								? "bg-blue-500/20 text-blue-400"
								: entry.source === "weather"
									? "bg-yellow-500/20 text-yellow-400"
									: "bg-gray-500/20 text-gray-400"
						}`}
					>
						{entry.source === "diary" ? "日記" : entry.source === "weather" ? "天気" : "手動"}
					</span>
					{isLatest && (
						<span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium bg-green-500/20 text-green-400 shrink-0">
							最新
						</span>
					)}
				</div>
				<deleteFetcher.Form method="post">
					<input type="hidden" name="intent" value="delete-hiphop-track" />
					<input type="hidden" name="id" value={entry.id} />
					<input type="hidden" name="date" value={entry.date} />
					<input type="hidden" name="type" value={entry.type} />
					<button
						type="submit"
						disabled={isDeleting}
						className="text-xs text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50"
					>
						削除
					</button>
				</deleteFetcher.Form>
			</div>
			<div className="p-4 space-y-2">
				<div className="flex items-center gap-4 text-xs text-gray-500">
					{entry.duration && (
						<span>
							{Math.floor(entry.duration / 60)}:{(entry.duration % 60).toString().padStart(2, "0")}
						</span>
					)}
				</div>

				{/* 試聴プレイヤー */}
				<div className="flex items-center gap-2">
					<audio
						controls
						preload="none"
						src={`/daily-track/audio/${entry.date}/${entry.type}`}
						className="h-8 w-full [&::-webkit-media-controls-panel]:bg-gray-800"
					/>
					<a
						href={`/daily-track/audio/${entry.date}/${entry.type}?download=1`}
						className={`shrink-0 text-gray-500 hover:text-${typeColor}-400 transition-colors`}
						title="ダウンロード"
					>
						<svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
						</svg>
					</a>
				</div>

				{entry.style && (
					<p className="text-xs text-gray-600 truncate">Style: {entry.style}</p>
				)}

				{entry.prompt && (
					<details className="text-xs">
						<summary className="text-gray-500 cursor-pointer hover:text-gray-400">
							プロンプト
						</summary>
						<pre className="mt-1 whitespace-pre-wrap break-words text-gray-600 font-sans bg-gray-900/50 p-2 rounded">
							{entry.prompt}
						</pre>
					</details>
				)}

				{entry.diaryContent && (
					<details className="text-xs">
						<summary className="text-gray-500 cursor-pointer hover:text-gray-400">
							日記内容
						</summary>
						<pre className="mt-1 whitespace-pre-wrap break-words text-gray-600 font-sans bg-gray-900/50 p-2 rounded max-h-32 overflow-y-auto">
							{entry.diaryContent}
						</pre>
					</details>
				)}

				{entry.sunoTaskId && (
					<p className="text-[10px] text-gray-700 truncate">
						Task: {entry.sunoTaskId}
					</p>
				)}
			</div>
		</article>
	);
}
