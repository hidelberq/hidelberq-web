import type { Piece, PieceType, Player, Position, Selection } from "./types";
import { pieceToKanji, summarizeCaptured, pieceTypeToKanji } from "./logic";

// =====================
// 盤面コンポーネント
// =====================

export function BoardGrid({
	board,
	isSelected,
	isHighlighted,
	onCellClick,
	currentPlayer,
	flipped,
}: {
	board: (Piece | null)[][];
	isSelected: (row: number, col: number) => boolean;
	isHighlighted: (row: number, col: number) => boolean;
	onCellClick: (row: number, col: number) => void;
	currentPlayer: Player;
	flipped?: boolean;
}) {
	const rows = flipped
		? Array.from({ length: 9 }, (_, i) => 8 - i)
		: Array.from({ length: 9 }, (_, i) => i);
	const cols = flipped
		? Array.from({ length: 9 }, (_, i) => 8 - i)
		: Array.from({ length: 9 }, (_, i) => i);
	const colLabels = flipped
		? Array.from({ length: 9 }, (_, i) => i + 1)
		: Array.from({ length: 9 }, (_, i) => 9 - i);
	const rowLabels = flipped
		? ["九", "八", "七", "六", "五", "四", "三", "二", "一"]
		: ["一", "二", "三", "四", "五", "六", "七", "八", "九"];

	return (
		<div className="relative">
			{/* 筋 (列番号) */}
			<div className="flex mb-0.5 pl-6">
				{colLabels.map((label, i) => (
					<div
						key={`col-${i}`}
						className="w-9 h-4 flex items-center justify-center text-[10px] text-gray-500"
					>
						{label}
					</div>
				))}
			</div>

			<div className="flex">
				{/* 盤本体 */}
				<div className="border border-amber-900/60">
					{rows.map((row, ri) => (
						<div key={`row-${row}`} className="flex">
							{cols.map((col) => {
								const piece = board[row][col];
								const selected = isSelected(row, col);
								const highlighted = isHighlighted(row, col);
								const isEnemy =
									piece !== null &&
									piece.player !== currentPlayer &&
									highlighted;

								return (
									<button
										key={`${row}-${col}`}
										type="button"
										onClick={() => onCellClick(row, col)}
										className={`
											w-9 h-9 border border-amber-900/30 flex items-center justify-center
											text-sm font-bold transition-all relative
											${selected ? "bg-amber-700/50" : ""}
											${highlighted && !isEnemy ? "bg-green-900/40" : ""}
											${isEnemy ? "bg-red-900/40" : ""}
											${!selected && !highlighted ? "bg-amber-950/20 hover:bg-amber-900/20" : ""}
										`}
									>
										{piece && <PieceDisplay piece={piece} flipped={flipped} />}
										{highlighted && !piece && (
											<span className="absolute w-2.5 h-2.5 rounded-full bg-green-500/50" />
										)}
									</button>
								);
							})}
						</div>
					))}
				</div>

				{/* 段 (行番号) */}
				<div className="flex flex-col ml-0.5">
					{rowLabels.map((label, i) => (
						<div
							key={`row-label-${i}`}
							className="w-4 h-9 flex items-center justify-center text-[10px] text-gray-500"
						>
							{label}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

export function PieceDisplay({
	piece,
	flipped,
}: {
	piece: Piece;
	flipped?: boolean;
}) {
	const kanji = pieceToKanji(piece);
	const shouldRotate =
		(piece.player === "gote") !== (flipped ?? false);
	const isPromoted = piece.promoted;

	return (
		<span
			className={`
				${shouldRotate ? "rotate-180" : ""}
				${isPromoted ? "text-red-400" : ""}
				${piece.player === "sente" ? "text-orange-200" : "text-sky-200"}
				select-none leading-none
			`}
		>
			{kanji}
		</span>
	);
}

export function CapturedPiecesBar({
	player,
	pieces,
	currentPlayer,
	selection,
	onPieceClick,
	interactive = true,
}: {
	player: Player;
	pieces: PieceType[];
	currentPlayer: Player;
	selection: Selection;
	onPieceClick: (type: PieceType, player: Player) => void;
	interactive?: boolean;
}) {
	const summary = summarizeCaptured(pieces);
	const label = player === "sente" ? "先手" : "後手";
	const labelColor = player === "sente" ? "text-orange-400" : "text-sky-400";
	const isActive = currentPlayer === player && interactive;

	return (
		<div className="max-w-lg w-full flex items-center gap-2 px-1">
			<span
				className={`text-xs font-bold ${labelColor} ${isActive ? "opacity-100" : "opacity-50"} min-w-[2.5rem]`}
			>
				{label}
			</span>
			<div className="flex gap-1 flex-wrap min-h-[2rem] items-center">
				{summary.length === 0 && (
					<span className="text-xs text-gray-600">なし</span>
				)}
				{summary.map(({ type, count }) => {
					const isSelectedPiece =
						selection?.kind === "captured" &&
						selection.piece === type &&
						selection.player === player;
					return (
						<button
							key={type}
							type="button"
							onClick={() => onPieceClick(type, player)}
							disabled={!isActive}
							className={`
								relative w-8 h-8 flex items-center justify-center rounded text-sm font-bold transition-all
								${isActive ? "cursor-pointer hover:bg-amber-900/40" : "cursor-default opacity-50"}
								${isSelectedPiece ? "bg-amber-700/60 ring-1 ring-amber-400" : "bg-gray-800/80"}
							`}
						>
							{pieceTypeToKanji(type)}
							{count > 1 && (
								<span className="absolute -top-1 -right-1 text-[10px] bg-gray-700 rounded-full w-4 h-4 flex items-center justify-center">
									{count}
								</span>
							)}
						</button>
					);
				})}
			</div>
		</div>
	);
}

export function PromotionDialog({
	piece,
	onChoice,
}: {
	piece: Piece | null;
	onChoice: (promote: boolean) => void;
}) {
	if (!piece) return null;

	const promoted: Piece = { ...piece, promoted: true };
	const unpromoted: Piece = { ...piece, promoted: false };

	return (
		<div className="absolute inset-0 bg-black/70 flex items-center justify-center z-20 rounded">
			<div className="bg-gray-900 border border-gray-700 rounded-lg p-4 flex flex-col items-center gap-3">
				<p className="text-sm text-gray-300">成りますか？</p>
				<div className="flex gap-4">
					<button
						type="button"
						onClick={() => onChoice(true)}
						className="flex flex-col items-center gap-1 px-4 py-2 bg-red-900/40 hover:bg-red-900/60 border border-red-800/50 rounded-lg transition-colors"
					>
						<span className="text-2xl font-bold text-red-400">
							{pieceToKanji(promoted)}
						</span>
						<span className="text-xs text-gray-400">成る</span>
					</button>
					<button
						type="button"
						onClick={() => onChoice(false)}
						className="flex flex-col items-center gap-1 px-4 py-2 bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 rounded-lg transition-colors"
					>
						<span className="text-2xl font-bold text-gray-300">
							{pieceToKanji(unpromoted)}
						</span>
						<span className="text-xs text-gray-400">不成</span>
					</button>
				</div>
			</div>
		</div>
	);
}

export function GameOverBanner({
	gameState,
	onReset,
}: {
	gameState: { status: string; winner: string | null };
	onReset: () => void;
}) {
	const isCheckmate = gameState.status === "checkmate";

	return (
		<div className="mt-4 p-4 border border-gray-700 rounded-lg bg-gray-900/80 text-center max-w-sm">
			<p className="text-lg font-bold mb-1">
				{isCheckmate ? "対局終了" : "引き分け"}
			</p>
			{isCheckmate && gameState.winner && (
				<p
					className={`text-sm mb-3 ${
						gameState.winner === "sente"
							? "text-orange-400"
							: "text-sky-400"
					}`}
				>
					{gameState.winner === "sente" ? "先手" : "後手"}の勝利
				</p>
			)}
			<button
				type="button"
				onClick={onReset}
				className="px-4 py-2 bg-amber-800/40 hover:bg-amber-800/60 border border-amber-700/50 rounded-lg transition-colors text-sm"
			>
				もう一度
			</button>
		</div>
	);
}

export function StatusBar({
	gameState,
}: {
	gameState: { currentPlayer: string; status: string; winner: string | null };
}) {
	const playerName = gameState.currentPlayer === "sente" ? "先手" : "後手";
	const playerColor =
		gameState.currentPlayer === "sente" ? "text-orange-400" : "text-sky-400";

	let message: string;
	switch (gameState.status) {
		case "playing":
			message = `${playerName}の番`;
			break;
		case "check":
			message = `王手！ ${playerName}の番`;
			break;
		case "checkmate":
			message = `詰み！ ${gameState.winner === "sente" ? "先手" : "後手"}の勝ち`;
			break;
		case "stalemate":
			message = "千日手（引き分け）";
			break;
		default:
			message = "";
	}

	return (
		<div
			className={`text-center text-sm font-bold ${
				gameState.status === "check"
					? "text-red-400"
					: gameState.status === "checkmate"
						? "text-yellow-400"
						: playerColor
			}`}
		>
			{message}
		</div>
	);
}
