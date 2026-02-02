import type { Piece, Player, Position, Selection, PieceType } from "./types";
import { pieceToKanji, summarizeCaptured, pieceTypeToKanji } from "./logic";

// =====================
// 5五将棋 盤面コンポーネント
// =====================

export function MinishogiBoardGrid({
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
	const size = 5;
	const rows = flipped
		? Array.from({ length: size }, (_, i) => size - 1 - i)
		: Array.from({ length: size }, (_, i) => i);
	const cols = flipped
		? Array.from({ length: size }, (_, i) => size - 1 - i)
		: Array.from({ length: size }, (_, i) => i);
	const colLabels = flipped
		? Array.from({ length: size }, (_, i) => i + 1)
		: Array.from({ length: size }, (_, i) => size - i);
	const rowLabels = flipped
		? ["五", "四", "三", "二", "一"]
		: ["一", "二", "三", "四", "五"];

	return (
		<div className="relative">
			{/* 筋 (列番号) */}
			<div className="flex mb-0.5 pl-6">
				{colLabels.map((label, i) => (
					<div
						key={`col-${i}`}
						className="w-11 h-4 flex items-center justify-center text-[10px] text-gray-500"
					>
						{label}
					</div>
				))}
			</div>

			<div className="flex">
				{/* 盤本体 */}
				<div className="border border-amber-900/60">
					{rows.map((row) => (
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
											w-11 h-11 border border-amber-900/30 flex items-center justify-center
											text-base font-bold transition-all relative
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
							className="w-4 h-11 flex items-center justify-center text-[10px] text-gray-500"
						>
							{label}
						</div>
					))}
				</div>
			</div>
		</div>
	);
}

function PieceDisplay({
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

export function MinishogiCapturedPiecesBar({
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
