import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router";
import type { Route } from "./+types/soccer-live";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "サッカー実況 | hidelberq" },
		{
			name: "description",
			content: "サッカーの実況中継用スコアボード",
		},
	];
}

type MatchHalf = "前半" | "後半" | "延長前半" | "延長後半";

type MatchStatus =
	| { type: "未開始" }
	| { type: "進行中"; half: MatchHalf; startedAt: number; offsetSeconds: number }
	| { type: "ハーフタイム"; elapsedSeconds: number }
	| { type: "試合終了"; elapsedSeconds: number };

type Goal = {
	id: string;
	team: "home" | "away";
	minute: number;
	scorer: string;
};

const HALF_DURATION = 45 * 60; // 45分
const EXTRA_HALF_DURATION = 15 * 60; // 延長15分

function formatTime(totalSeconds: number): string {
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getHalfBaseMinute(half: MatchHalf): number {
	switch (half) {
		case "前半":
			return 0;
		case "後半":
			return 45;
		case "延長前半":
			return 90;
		case "延長後半":
			return 105;
	}
}

function getHalfDuration(half: MatchHalf): number {
	return half === "延長前半" || half === "延長後半"
		? EXTRA_HALF_DURATION
		: HALF_DURATION;
}

export default function SoccerLive() {
	const [homeTeam, setHomeTeam] = useState("ホーム");
	const [awayTeam, setAwayTeam] = useState("アウェイ");
	const [status, setStatus] = useState<MatchStatus>({ type: "未開始" });
	const [goals, setGoals] = useState<Goal[]>([]);
	const [elapsed, setElapsed] = useState(0);
	const [editingTeam, setEditingTeam] = useState<"home" | "away" | null>(null);
	const [editingTime, setEditingTime] = useState(false);
	const [timeInput, setTimeInput] = useState("");
	const [scorerInput, setScorerInput] = useState("");
	const [addingGoalFor, setAddingGoalFor] = useState<"home" | "away" | null>(
		null,
	);
	const inputRef = useRef<HTMLInputElement>(null);
	const timeInputRef = useRef<HTMLInputElement>(null);

	const homeScore = goals.filter((g) => g.team === "home").length;
	const awayScore = goals.filter((g) => g.team === "away").length;

	// タイマー更新（時間編集中は一時停止）
	useEffect(() => {
		if (status.type !== "進行中" || editingTime) return;
		const interval = setInterval(() => {
			const now = Date.now();
			const secondsPassed =
				Math.floor((now - status.startedAt) / 1000) + status.offsetSeconds;
			setElapsed(secondsPassed);
		}, 200);
		return () => clearInterval(interval);
	}, [status, editingTime]);

	// 時間編集時のフォーカス
	useEffect(() => {
		if (editingTime && timeInputRef.current) {
			timeInputRef.current.select();
		}
	}, [editingTime]);

	// チーム名編集時のフォーカス
	useEffect(() => {
		if (editingTeam && inputRef.current) {
			inputRef.current.select();
		}
	}, [editingTeam]);

	const getCurrentMinute = useCallback(() => {
		if (status.type === "進行中") {
			return getHalfBaseMinute(status.half) + Math.floor(elapsed / 60);
		}
		if (
			status.type === "ハーフタイム" ||
			status.type === "試合終了"
		) {
			return Math.floor(status.elapsedSeconds / 60);
		}
		return 0;
	}, [status, elapsed]);

	const handleKickoff = (half: MatchHalf) => {
		setStatus({
			type: "進行中",
			half,
			startedAt: Date.now(),
			offsetSeconds: 0,
		});
		setElapsed(0);
	};

	const handleHalftime = () => {
		if (status.type !== "進行中") return;
		const totalElapsed =
			getHalfBaseMinute(status.half) * 60 + elapsed;
		setStatus({ type: "ハーフタイム", elapsedSeconds: totalElapsed });
	};

	const handleEndMatch = () => {
		let totalElapsed = 0;
		if (status.type === "進行中") {
			totalElapsed = getHalfBaseMinute(status.half) * 60 + elapsed;
		} else if (status.type === "ハーフタイム") {
			totalElapsed = status.elapsedSeconds;
		}
		setStatus({ type: "試合終了", elapsedSeconds: totalElapsed });
	};

	const handleAddGoal = (team: "home" | "away") => {
		const minute = getCurrentMinute();
		const goal: Goal = {
			id: crypto.randomUUID(),
			team,
			minute,
			scorer: scorerInput.trim() || "不明",
		};
		setGoals((prev) => [...prev, goal]);
		setScorerInput("");
		setAddingGoalFor(null);
	};

	const handleRemoveGoal = (id: string) => {
		setGoals((prev) => prev.filter((g) => g.id !== id));
	};

	const handleStartEditTime = () => {
		if (status.type !== "進行中") return;
		const minutes = Math.floor(elapsed / 60);
		const seconds = elapsed % 60;
		setTimeInput(
			`${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
		);
		setEditingTime(true);
	};

	const handleConfirmTime = () => {
		if (status.type !== "進行中") return;
		const match = timeInput.match(/^(\d{1,3}):(\d{1,2})$/);
		if (match) {
			const minutes = Number.parseInt(match[1], 10);
			const seconds = Math.min(Number.parseInt(match[2], 10), 59);
			const newElapsed = minutes * 60 + seconds;
			setStatus({
				...status,
				startedAt: Date.now(),
				offsetSeconds: newElapsed,
			});
			setElapsed(newElapsed);
		}
		setEditingTime(false);
	};

	const handleReset = () => {
		setStatus({ type: "未開始" });
		setGoals([]);
		setElapsed(0);
	};

	const displayTime = () => {
		if (status.type === "未開始") return "--:--";
		if (status.type === "進行中") {
			const halfDuration = getHalfDuration(status.half);
			if (elapsed > halfDuration) {
				const additionalMinutes = Math.floor(
					(elapsed - halfDuration) / 60,
				);
				const baseMinute = getHalfBaseMinute(status.half) + 45;
				return `${baseMinute}+${additionalMinutes}'`;
			}
			return formatTime(elapsed);
		}
		if (status.type === "ハーフタイム") return "HT";
		return "FT";
	};

	const statusLabel = () => {
		if (status.type === "進行中") return status.half;
		return status.type;
	};

	const homeGoals = goals.filter((g) => g.team === "home");
	const awayGoals = goals.filter((g) => g.team === "away");

	return (
		<div className="min-h-screen bg-[#1a0a2e] text-white flex flex-col">
			{/* ヘッダー */}
			<header className="bg-gradient-to-r from-[#2d1050] via-[#4a1942] to-[#2d1050] px-4 py-3 flex items-center justify-between border-b border-amber-500/20">
				<Link
					to="/"
					className="text-amber-400/60 hover:text-amber-300 text-sm"
				>
					← トップ
				</Link>
				<div className="flex items-center gap-2">
					<span className="text-amber-400 text-xs font-bold tracking-[0.3em] uppercase">
						FIFA World Cup
					</span>
				</div>
				<div className="w-16" />
			</header>

			{/* スコアボード */}
			<div className="relative overflow-hidden">
				{/* 背景グラデーション */}
				<div className="absolute inset-0 bg-gradient-to-b from-[#2d1050] via-[#1a0a2e] to-[#0f0620]" />
				<div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(180,130,50,0.15),transparent_70%)]" />

				<div className="relative px-4 py-10">
					<div className="max-w-xl mx-auto">
						{/* ステータスバッジ */}
						<div className="text-center mb-2">
							<span className="inline-block bg-amber-500/20 text-amber-400 text-[10px] font-bold px-4 py-1 rounded-full tracking-[0.2em] uppercase border border-amber-500/30">
								{statusLabel()}
							</span>
						</div>

						{/* 時間表示 */}
						<div className="text-center mb-8">
							{editingTime && status.type === "進行中" ? (
								<input
									ref={timeInputRef}
									type="text"
									value={timeInput}
									onChange={(e) => setTimeInput(e.target.value)}
									onBlur={handleConfirmTime}
									onKeyDown={(e) => {
										if (e.key === "Enter") handleConfirmTime();
										if (e.key === "Escape") setEditingTime(false);
									}}
									className="text-4xl font-mono font-black text-amber-400 bg-[#2d1050] text-center w-40 mx-auto rounded-lg outline-none focus:ring-2 focus:ring-amber-500 block py-1"
									placeholder="MM:SS"
								/>
							) : (
								<button
									type="button"
									onClick={handleStartEditTime}
									disabled={status.type !== "進行中"}
									className="text-4xl font-mono font-black text-amber-400 cursor-pointer hover:text-amber-300 transition-colors disabled:cursor-default disabled:hover:text-amber-400"
								>
									{displayTime()}
								</button>
							)}
						</div>

						{/* メインスコアボード */}
						<div className="bg-gradient-to-b from-[#2a1048]/80 to-[#1a0a2e]/80 backdrop-blur rounded-2xl border border-amber-500/10 shadow-[0_0_40px_rgba(180,130,50,0.1)] p-6">
							<div className="flex items-center justify-between">
								{/* ホームチーム */}
								<div className="flex-1 text-center">
									{editingTeam === "home" ? (
										<input
											ref={inputRef}
											type="text"
											value={homeTeam}
											onChange={(e) => setHomeTeam(e.target.value)}
											onBlur={() => setEditingTeam(null)}
											onKeyDown={(e) => {
												if (e.key === "Enter") setEditingTeam(null);
											}}
											className="bg-[#2d1050] text-white text-lg font-bold text-center w-full px-2 py-1 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
										/>
									) : (
										<button
											type="button"
											onClick={() => setEditingTeam("home")}
											className="text-lg font-bold hover:text-amber-400 transition-colors cursor-pointer w-full uppercase tracking-wider"
										>
											{homeTeam}
										</button>
									)}
									{/* ホームの得点者一覧 */}
									{homeGoals.length > 0 && (
										<div className="mt-2 space-y-0.5">
											{homeGoals.map((g) => (
												<p
													key={g.id}
													className="text-[11px] text-amber-400/60"
												>
													{g.scorer} {g.minute}'
												</p>
											))}
										</div>
									)}
								</div>

								{/* スコア */}
								<div className="shrink-0 px-6">
									<div className="flex items-center gap-4">
										<span className="text-7xl font-black tabular-nums text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
											{homeScore}
										</span>
										<span className="text-3xl font-light text-amber-500/50">
											:
										</span>
										<span className="text-7xl font-black tabular-nums text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.2)]">
											{awayScore}
										</span>
									</div>
								</div>

								{/* アウェイチーム */}
								<div className="flex-1 text-center">
									{editingTeam === "away" ? (
										<input
											ref={inputRef}
											type="text"
											value={awayTeam}
											onChange={(e) => setAwayTeam(e.target.value)}
											onBlur={() => setEditingTeam(null)}
											onKeyDown={(e) => {
												if (e.key === "Enter") setEditingTeam(null);
											}}
											className="bg-[#2d1050] text-white text-lg font-bold text-center w-full px-2 py-1 rounded-lg outline-none focus:ring-2 focus:ring-amber-500"
										/>
									) : (
										<button
											type="button"
											onClick={() => setEditingTeam("away")}
											className="text-lg font-bold hover:text-amber-400 transition-colors cursor-pointer w-full uppercase tracking-wider"
										>
											{awayTeam}
										</button>
									)}
									{/* アウェイの得点者一覧 */}
									{awayGoals.length > 0 && (
										<div className="mt-2 space-y-0.5">
											{awayGoals.map((g) => (
												<p
													key={g.id}
													className="text-[11px] text-amber-400/60"
												>
													{g.scorer} {g.minute}'
												</p>
											))}
										</div>
									)}
								</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			{/* ゴール追加 */}
			<div className="px-4 py-4 bg-[#150826] border-y border-amber-500/10">
				<div className="max-w-xl mx-auto">
					{addingGoalFor ? (
						<div className="flex items-center gap-2">
							<span className="text-sm text-amber-400/70 shrink-0 font-semibold">
								{addingGoalFor === "home" ? homeTeam : awayTeam}:
							</span>
							<input
								type="text"
								placeholder="得点者名"
								value={scorerInput}
								onChange={(e) => setScorerInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleAddGoal(addingGoalFor);
									if (e.key === "Escape") setAddingGoalFor(null);
								}}
								className="flex-1 bg-[#2d1050] text-white px-3 py-2 rounded-lg text-sm outline-none focus:ring-2 focus:ring-amber-500 border border-amber-500/20 placeholder:text-gray-500"
								autoFocus
							/>
							<button
								type="button"
								onClick={() => handleAddGoal(addingGoalFor)}
								className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg text-sm font-bold cursor-pointer transition-colors"
							>
								GOAL
							</button>
							<button
								type="button"
								onClick={() => {
									setAddingGoalFor(null);
									setScorerInput("");
								}}
								className="text-gray-500 hover:text-gray-300 px-2 py-2 text-sm cursor-pointer"
							>
								取消
							</button>
						</div>
					) : (
						<div className="flex gap-3">
							<button
								type="button"
								onClick={() => setAddingGoalFor("home")}
								className="flex-1 bg-gradient-to-r from-[#3a1560] to-[#4a1942] hover:from-[#4a1f70] hover:to-[#5a2952] text-white py-3 rounded-xl font-bold text-sm cursor-pointer transition-all border border-amber-500/20 hover:border-amber-500/40 shadow-lg"
							>
								{homeTeam} GOAL
							</button>
							<button
								type="button"
								onClick={() => setAddingGoalFor("away")}
								className="flex-1 bg-gradient-to-r from-[#4a1942] to-[#3a1560] hover:from-[#5a2952] hover:to-[#4a1f70] text-white py-3 rounded-xl font-bold text-sm cursor-pointer transition-all border border-amber-500/20 hover:border-amber-500/40 shadow-lg"
							>
								{awayTeam} GOAL
							</button>
						</div>
					)}
				</div>
			</div>

			{/* ゴールリスト */}
			{goals.length > 0 && (
				<div className="px-4 py-4 bg-[#120720]">
					<div className="max-w-xl mx-auto space-y-2">
						<h2 className="text-[10px] font-bold text-amber-500/50 tracking-[0.2em] uppercase mb-3">
							Match Events
						</h2>
						{goals.map((goal) => (
							<div
								key={goal.id}
								className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-[#1a0a2e] border border-amber-500/10"
							>
								<div className="flex items-center gap-3">
									<span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded">
										{goal.minute}'
									</span>
									<span className="text-sm font-bold text-white/90">
										{goal.team === "home" ? homeTeam : awayTeam}
									</span>
									<span className="text-sm text-white/50">
										{goal.scorer}
									</span>
								</div>
								<button
									type="button"
									onClick={() => handleRemoveGoal(goal.id)}
									className="text-white/20 hover:text-red-400 text-xs cursor-pointer transition-colors"
								>
									取消
								</button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* 試合コントロール */}
			<div className="px-4 py-6 flex-1 bg-gradient-to-b from-[#0f0620] to-[#1a0a2e]">
				<div className="max-w-xl mx-auto space-y-3">
					<h2 className="text-[10px] font-bold text-amber-500/50 tracking-[0.2em] uppercase mb-3">
						Match Control
					</h2>

					{status.type === "未開始" && (
						<button
							type="button"
							onClick={() => handleKickoff("前半")}
							className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white py-4 rounded-xl font-black text-lg cursor-pointer tracking-wider shadow-[0_0_30px_rgba(180,130,50,0.3)] transition-all"
						>
							KICK OFF
						</button>
					)}

					{status.type === "進行中" && status.half === "前半" && (
						<button
							type="button"
							onClick={handleHalftime}
							className="w-full bg-gradient-to-r from-[#3a1560] to-[#4a1942] hover:from-[#4a1f70] hover:to-[#5a2952] text-white py-3 rounded-xl font-bold cursor-pointer border border-amber-500/20 transition-all"
						>
							HALF TIME
						</button>
					)}

					{status.type === "ハーフタイム" && (
						<button
							type="button"
							onClick={() => handleKickoff("後半")}
							className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white py-4 rounded-xl font-black text-lg cursor-pointer tracking-wider shadow-[0_0_30px_rgba(180,130,50,0.3)] transition-all"
						>
							2ND HALF KICK OFF
						</button>
					)}

					{status.type === "進行中" && status.half === "後半" && (
						<>
							<button
								type="button"
								onClick={handleEndMatch}
								className="w-full bg-gradient-to-r from-[#3a1560] to-[#4a1942] hover:from-[#4a1f70] hover:to-[#5a2952] text-white py-3 rounded-xl font-bold cursor-pointer border border-amber-500/20 transition-all"
							>
								FULL TIME
							</button>
							<button
								type="button"
								onClick={() => {
									handleHalftime();
								}}
								className="w-full bg-[#1a0a2e] hover:bg-[#2d1050] text-amber-400/70 py-2 rounded-xl text-sm cursor-pointer border border-amber-500/10 transition-all"
							>
								EXTRA TIME →
							</button>
						</>
					)}

					{status.type === "進行中" && status.half === "延長前半" && (
						<button
							type="button"
							onClick={handleHalftime}
							className="w-full bg-gradient-to-r from-[#3a1560] to-[#4a1942] hover:from-[#4a1f70] hover:to-[#5a2952] text-white py-3 rounded-xl font-bold cursor-pointer border border-amber-500/20 transition-all"
						>
							EXTRA TIME HT
						</button>
					)}

					{status.type === "進行中" && status.half === "延長後半" && (
						<button
							type="button"
							onClick={handleEndMatch}
							className="w-full bg-gradient-to-r from-[#3a1560] to-[#4a1942] hover:from-[#4a1f70] hover:to-[#5a2952] text-white py-3 rounded-xl font-bold cursor-pointer border border-amber-500/20 transition-all"
						>
							FULL TIME
						</button>
					)}

					{status.type === "試合終了" && (
						<div className="text-center py-6">
							<p className="text-[10px] font-bold text-amber-500/50 tracking-[0.3em] uppercase mb-3">
								Full Time
							</p>
							<p className="text-3xl font-black tracking-wide">
								<span className="text-white/90">{homeTeam}</span>
								<span className="text-amber-400 mx-3">
									{homeScore} : {awayScore}
								</span>
								<span className="text-white/90">{awayTeam}</span>
							</p>
						</div>
					)}

					{status.type !== "未開始" && (
						<button
							type="button"
							onClick={handleReset}
							className="w-full text-white/20 hover:text-white/50 py-2 rounded-xl text-xs cursor-pointer mt-6 transition-colors"
						>
							RESET MATCH
						</button>
					)}
				</div>
			</div>
		</div>
	);
}