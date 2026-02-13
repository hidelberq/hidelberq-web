import { Link } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { desc } from "drizzle-orm";
import { hiphopTracks } from "../db/schema";
import type { Route } from "./+types/daily-track";
import { useState, useRef } from "react";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "Daily Hiphop Track - hidelberq" },
		{
			name: "description",
			content: "hidelberq - AI生成の日替わりHiphopトラック",
		},
	];
}

export async function loader({ context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);

	const tracks = await db
		.select()
		.from(hiphopTracks)
		.orderBy(desc(hiphopTracks.date))
		.limit(30);

	return {
		tracks: tracks.map((t) => ({
			id: t.id,
			date: t.date,
			title: t.title,
			style: t.style,
			duration: t.duration,
			source: t.source,
			hasInstrumental: !!t.instrumentalKey,
			hasRap: !!t.rapTrackKey,
			diaryContent: t.diaryContent,
		})),
	};
}

function formatDuration(seconds: number | null): string {
	if (!seconds) return "--:--";
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${s.toString().padStart(2, "0")}`;
}

function TrackPlayer({
	track,
}: {
	track: {
		id: number;
		date: string;
		title: string | null;
		style: string | null;
		duration: number | null;
		source: string;
		hasInstrumental: boolean;
		hasRap: boolean;
		diaryContent: string | null;
	};
}) {
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentType, setCurrentType] = useState<"instrumental" | "rap">(
		track.hasRap ? "rap" : "instrumental",
	);
	const [progress, setProgress] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [audioDuration, setAudioDuration] = useState(track.duration || 0);
	const [showDiary, setShowDiary] = useState(false);
	const audioRef = useRef<HTMLAudioElement>(null);

	const audioSrc = `/daily-track/audio/${track.date}/${currentType}`;

	const togglePlay = () => {
		const audio = audioRef.current;
		if (!audio) return;
		if (isPlaying) {
			audio.pause();
		} else {
			audio.play();
		}
		setIsPlaying(!isPlaying);
	};

	const handleTimeUpdate = () => {
		const audio = audioRef.current;
		if (!audio) return;
		setCurrentTime(audio.currentTime);
		if (audio.duration) {
			setProgress((audio.currentTime / audio.duration) * 100);
		}
	};

	const handleLoadedMetadata = () => {
		const audio = audioRef.current;
		if (audio?.duration) {
			setAudioDuration(audio.duration);
		}
	};

	const handleEnded = () => {
		setIsPlaying(false);
		setProgress(0);
		setCurrentTime(0);
	};

	const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
		const audio = audioRef.current;
		if (!audio || !audio.duration) return;
		const rect = e.currentTarget.getBoundingClientRect();
		const x = e.clientX - rect.left;
		const pct = x / rect.width;
		audio.currentTime = pct * audio.duration;
	};

	const switchType = (type: "instrumental" | "rap") => {
		if (type === currentType) return;
		const audio = audioRef.current;
		if (audio) {
			audio.pause();
			setIsPlaying(false);
			setProgress(0);
			setCurrentTime(0);
		}
		setCurrentType(type);
	};

	return (
		<div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 overflow-hidden transition-all hover:border-white/20">
			{/* ヘッダー */}
			<div className="px-5 pt-4 pb-2">
				<div className="flex items-center justify-between mb-1">
					<span className="text-xs text-fuchsia-400/80 font-medium">
						{track.date}
					</span>
					<span className="text-[10px] uppercase tracking-wider text-purple-300/50 bg-purple-500/10 px-2 py-0.5 rounded">
						{track.source === "diary" ? "from diary" : track.source === "weather" ? "from weather" : "manual"}
					</span>
				</div>
				<h3 className="text-lg font-bold text-white truncate">
					{track.title || "Untitled Track"}
				</h3>
				{track.style && (
					<p className="text-xs text-purple-200/50 truncate mt-0.5">
						{track.style}
					</p>
				)}
			</div>

			{/* トラックタイプ切り替え */}
			{track.hasInstrumental && track.hasRap && (
				<div className="px-5 py-2 flex gap-2">
					<button
						type="button"
						onClick={() => switchType("instrumental")}
						className={`text-xs px-3 py-1 rounded-full transition-colors ${
							currentType === "instrumental"
								? "bg-fuchsia-500/30 text-fuchsia-300 border border-fuchsia-500/50"
								: "bg-white/5 text-purple-300/60 border border-white/10 hover:border-white/20"
						}`}
					>
						Instrumental
					</button>
					<button
						type="button"
						onClick={() => switchType("rap")}
						className={`text-xs px-3 py-1 rounded-full transition-colors ${
							currentType === "rap"
								? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
								: "bg-white/5 text-purple-300/60 border border-white/10 hover:border-white/20"
						}`}
					>
						Rap Ver.
					</button>
				</div>
			)}

			{/* プレイヤー */}
			<div className="px-5 py-3">
				<audio
					ref={audioRef}
					src={audioSrc}
					preload="none"
					onTimeUpdate={handleTimeUpdate}
					onLoadedMetadata={handleLoadedMetadata}
					onEnded={handleEnded}
					onPause={() => setIsPlaying(false)}
					onPlay={() => setIsPlaying(true)}
				/>

				<div className="flex items-center gap-3">
					{/* 再生ボタン */}
					<button
						type="button"
						onClick={togglePlay}
						className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-fuchsia-500 to-cyan-500 flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
					>
						{isPlaying ? (
							<svg className="w-4 h-4 text-white" viewBox="0 0 24 24" fill="currentColor">
								<rect x="6" y="4" width="4" height="16" />
								<rect x="14" y="4" width="4" height="16" />
							</svg>
						) : (
							<svg className="w-4 h-4 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
								<polygon points="5,3 19,12 5,21" />
							</svg>
						)}
					</button>

					{/* プログレスバー */}
					<div className="flex-1 min-w-0">
						<div
							className="h-1.5 rounded-full bg-white/10 cursor-pointer group"
							onClick={handleSeek}
						>
							<div
								className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 transition-all"
								style={{ width: `${progress}%` }}
							/>
						</div>
						<div className="flex justify-between mt-1">
							<span className="text-[10px] text-purple-300/40">
								{formatDuration(Math.round(currentTime))}
							</span>
							<span className="text-[10px] text-purple-300/40">
								{formatDuration(
									Math.round(audioDuration || track.duration || 0),
								)}
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* 日記内容の展開 */}
			{track.diaryContent && (
				<div className="px-5 pb-3">
					<button
						type="button"
						onClick={() => setShowDiary(!showDiary)}
						className="text-[11px] text-purple-300/50 hover:text-purple-300/80 transition-colors"
					>
						{showDiary ? "日記を閉じる" : "日記を見る"}
					</button>
					{showDiary && (
						<div className="mt-2 p-3 rounded-lg bg-white/5 text-xs text-purple-200/60 whitespace-pre-wrap leading-relaxed max-h-40 overflow-y-auto">
							{track.diaryContent}
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export default function DailyTrackPage({ loaderData }: Route.ComponentProps) {
	const { tracks } = loaderData;

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			{/* 装飾 */}
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
				<div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-16">
				{/* ヘッダー */}
				<section className="text-center mb-12 pt-8 w-full max-w-2xl">
					<Link
						to="/"
						className="inline-block mb-4 text-sm text-fuchsia-300 hover:text-fuchsia-200 transition-colors"
					>
						&larr; Back to Home
					</Link>
					<div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-gradient-to-r from-fuchsia-500/20 to-cyan-500/20 border border-fuchsia-500/30 text-sm text-fuchsia-300">
						AI-Generated Daily Beats
					</div>
					<h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-3 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
						Daily Hiphop Track
					</h1>
					<p className="text-purple-200/60 max-w-md mx-auto">
						毎朝、昨日の日記からAIがHiphopインストゥルメンタルを自動生成
					</p>
				</section>

				{/* トラック一覧 */}
				<section className="w-full max-w-2xl space-y-4">
					{tracks.length === 0 ? (
						<div className="text-center py-12 text-purple-200/50">
							まだトラックがありません
						</div>
					) : (
						tracks.map((track) => (
							<TrackPlayer key={track.id} track={track} />
						))
					)}
				</section>

				{/* フッター */}
				<footer className="text-center text-sm text-purple-300/40 mt-16">
					Powered by Suno AI &times; Gemini
				</footer>
			</div>
		</div>
	);
}
