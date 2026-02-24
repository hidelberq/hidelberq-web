import {
	createContext,
	useContext,
	useState,
	useRef,
	useCallback,
	useEffect,
	type ReactNode,
} from "react";
import { Link } from "react-router";

// 再生対象のトラック情報
export type AudioTrack = {
	date: string;
	type: string;
	title: string | null;
	style: string | null;
	duration: number | null;
	source: string;
};

type AudioPlayerContextType = {
	// 状態
	tracks: AudioTrack[];
	currentIndex: number;
	isPlaying: boolean;
	progress: number;
	currentTime: number;
	duration: number;
	// 操作
	setPlaylist: (tracks: AudioTrack[], startIndex?: number) => void;
	playTrack: (track: AudioTrack) => void;
	toggle: () => void;
	next: () => void;
	prev: () => void;
	seekTo: (ratio: number) => void;
};

const AudioPlayerContext = createContext<AudioPlayerContextType | null>(null);

export function useAudioPlayer() {
	const ctx = useContext(AudioPlayerContext);
	if (!ctx) {
		throw new Error("useAudioPlayer must be used within AudioPlayerProvider");
	}
	return ctx;
}

export function AudioPlayerProvider({ children }: { children: ReactNode }) {
	const [tracks, setTracks] = useState<AudioTrack[]>([]);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [isPlaying, setIsPlaying] = useState(false);
	const [progress, setProgress] = useState(0);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);
	const audioRef = useRef<HTMLAudioElement>(null);
	const autoAdvancingRef = useRef(false);

	const track = tracks[currentIndex] as AudioTrack | undefined;
	const audioSrc = track
		? `/daily-track/audio/${track.date}/${track.type}`
		: "";

	const setPlaylist = useCallback(
		(newTracks: AudioTrack[], startIndex = 0) => {
			setTracks(newTracks);
			setCurrentIndex(startIndex);
			setProgress(0);
			setCurrentTime(0);
			setDuration(0);
		},
		[],
	);

	const playTrack = useCallback(
		(target: AudioTrack) => {
			// 現在のプレイリストから同じトラックを探す
			const idx = tracks.findIndex(
				(t) => t.date === target.date && t.type === target.type,
			);
			if (idx >= 0) {
				setCurrentIndex(idx);
				setIsPlaying(true);
			} else {
				// プレイリストにない場合は単曲で再生
				setTracks([target]);
				setCurrentIndex(0);
				setIsPlaying(true);
			}
		},
		[tracks],
	);

	const toggle = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;
		if (isPlaying) {
			audio.pause();
		} else {
			audio.play();
		}
	}, [isPlaying]);

	const prev = useCallback(() => {
		if (currentIndex < tracks.length - 1) {
			setCurrentIndex((i) => i + 1);
			setIsPlaying(true);
		}
	}, [currentIndex, tracks.length]);

	const next = useCallback(() => {
		if (currentIndex > 0) {
			setCurrentIndex((i) => i - 1);
			setIsPlaying(true);
		}
	}, [currentIndex]);

	const seekTo = useCallback(
		(ratio: number) => {
			const audio = audioRef.current;
			if (!audio || !duration) return;
			audio.currentTime = ratio * duration;
		},
		[duration],
	);

	// トラック切り替え時に自動再生
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio || !track) return;
		audio.load();
		if (isPlaying || autoAdvancingRef.current) {
			autoAdvancingRef.current = false;
			setIsPlaying(true);
			audio.play();
		}
		setProgress(0);
		setCurrentTime(0);
		setDuration(0);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentIndex, track?.date, track?.type]);

	const value: AudioPlayerContextType = {
		tracks,
		currentIndex,
		isPlaying,
		progress,
		currentTime,
		duration,
		setPlaylist,
		playTrack,
		toggle,
		next,
		prev,
		seekTo,
	};

	return (
		<AudioPlayerContext.Provider value={value}>
			{children}
			{/* 非表示 audio 要素（常に DOM に存在し続ける） */}
			{track && (
				<audio
					ref={audioRef}
					src={audioSrc}
					preload="none"
					onPlay={() => setIsPlaying(true)}
					onPause={() => {
						if (!autoAdvancingRef.current) {
							setIsPlaying(false);
						}
					}}
					onTimeUpdate={() => {
						const audio = audioRef.current;
						if (!audio) return;
						setCurrentTime(audio.currentTime);
						if (audio.duration) {
							setProgress((audio.currentTime / audio.duration) * 100);
						}
					}}
					onLoadedMetadata={() => {
						const audio = audioRef.current;
						if (audio) setDuration(audio.duration);
					}}
					onEnded={() => {
						if (currentIndex < tracks.length - 1) {
							autoAdvancingRef.current = true;
							setCurrentIndex((i) => i + 1);
						} else {
							setIsPlaying(false);
						}
					}}
				/>
			)}
			{/* ミニプレイヤー（再生中 or トラックがある場合に表示） */}
			{track && <PersistentMiniPlayer />}
		</AudioPlayerContext.Provider>
	);
}

function PersistentMiniPlayer() {
	const {
		tracks,
		currentIndex,
		isPlaying,
		progress,
		currentTime,
		duration,
		toggle,
		next,
		prev,
		seekTo,
	} = useAudioPlayer();

	const track = tracks[currentIndex];
	if (!track) return null;

	const formatTime = (sec: number) => {
		const m = Math.floor(sec / 60);
		const s = Math.floor(sec % 60);
		return `${m}:${s.toString().padStart(2, "0")}`;
	};

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-white/10">
			{/* プログレスバー */}
			<div
				className="h-1 bg-white/10 cursor-pointer"
				onClick={(e) => {
					if (!duration) return;
					const rect = e.currentTarget.getBoundingClientRect();
					const ratio = (e.clientX - rect.left) / rect.width;
					seekTo(ratio);
				}}
			>
				<div
					className="h-full bg-gradient-to-r from-fuchsia-500 to-cyan-400 transition-[width] duration-200"
					style={{ width: `${progress}%` }}
				/>
			</div>

			<div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2 sm:gap-3">
				{/* トラック情報 */}
				<Link
					to="/daily-track"
					className="flex-1 min-w-0 flex items-center gap-2 sm:gap-3 group"
				>
					<div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 border border-white/10 flex items-center justify-center">
						<svg
							className="w-4 h-4 sm:w-5 sm:h-5 text-fuchsia-300"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
						>
							<path d="M9 18V5l12-3v13" />
							<circle cx="6" cy="18" r="3" />
							<circle cx="18" cy="15" r="3" />
						</svg>
					</div>
					<div className="min-w-0">
						<p className="text-sm font-semibold text-white group-hover:text-fuchsia-200 transition-colors truncate">
							{track.title || "Untitled Track"}
						</p>
						<div className="flex items-center gap-1.5">
							<span className="inline-flex items-center gap-0.5 px-1 py-px rounded bg-fuchsia-500/20 border border-fuchsia-400/20 text-[7px] font-medium text-fuchsia-300/80">
								昨日の日記からAI生成
							</span>
							<span className="text-[10px] text-purple-300/50">
								{track.date}
							</span>
							<span
								className={`text-[10px] ${track.type === "rap" ? "text-cyan-400/60" : "text-fuchsia-400/60"}`}
							>
								{track.type === "rap" ? "Rap" : "Inst."}
							</span>
							{duration > 0 && (
								<span className="text-[10px] text-purple-300/40">
									{formatTime(currentTime)} / {formatTime(duration)}
								</span>
							)}
						</div>
					</div>
				</Link>

				{/* コントロール */}
				<div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
					{/* 前の曲（古い方） */}
					<button
						type="button"
						onClick={prev}
						disabled={currentIndex >= tracks.length - 1}
						className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white disabled:text-white/20 transition-colors"
						title="前の曲"
					>
						<svg
							className="w-4 h-4"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path d="M6 6h2v12H6zm3.5 6 8.5 6V6z" />
						</svg>
					</button>
					{/* 再生/一時停止 */}
					<button
						type="button"
						onClick={toggle}
						className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white text-black hover:bg-white/90 transition-colors"
						title={isPlaying ? "一時停止" : "再生"}
					>
						{isPlaying ? (
							<svg
								className="w-5 h-5"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M6 4h4v16H6zm8 0h4v16h-4z" />
							</svg>
						) : (
							<svg
								className="w-5 h-5 ml-0.5"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path d="M8 5v14l11-7z" />
							</svg>
						)}
					</button>
					{/* 次の曲（新しい方） */}
					<button
						type="button"
						onClick={next}
						disabled={currentIndex <= 0}
						className="w-8 h-8 flex items-center justify-center text-white/70 hover:text-white disabled:text-white/20 transition-colors"
						title="次の曲"
					>
						<svg
							className="w-4 h-4"
							viewBox="0 0 24 24"
							fill="currentColor"
						>
							<path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
						</svg>
					</button>
				</div>

				{/* トラック番号 */}
				<span className="text-[10px] text-purple-300/40 flex-shrink-0 hidden sm:block">
					{tracks.length - currentIndex}/{tracks.length}
				</span>
			</div>
		</div>
	);
}
