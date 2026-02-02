import { useState, useCallback } from "react";
import type { Route } from "./+types/shogi";
import type {
	GameState,
	Selection,
	Position,
	PieceType,
	Piece,
	Player,
} from "../shogi/types";
import {
	createInitialGameState,
	getLegalMoves,
	getDropPositions,
	applyAction,
	canPromote,
	mustPromote,
	pieceToKanji,
	summarizeCaptured,
	pieceTypeToKanji,
} from "../shogi/logic";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "将棋対戦 | nw-union.net" },
		{ name: "description", content: "将棋の対戦ができます" },
	];
}

// =====================
// メインコンポーネント
// =====================

export default function Shogi() {
	const [gameState, setGameState] = useState<GameState>(
		createInitialGameState,
	);
	const [selection, setSelection] = useState<Selection>(null);
	const [highlightedMoves, setHighlightedMoves] = useState<Position[]>([]);
	const [promotionPrompt, setPromotionPrompt] = useState<{
		from: Position;
		to: Position;
	} | null>(null);

	const resetGame = useCallback(() => {
		setGameState(createInitialGameState());
		setSelection(null);
		setHighlightedMoves([]);
		setPromotionPrompt(null);
	}, []);

	const isHighlighted = useCallback(
		(row: number, col: number) =>
			highlightedMoves.some((m) => m.row === row && m.col === col),
		[highlightedMoves],
	);

	const isSelected = useCallback(
		(row: number, col: number) =>
			selection?.kind === "board" &&
			selection.position.row === row &&
			selection.position.col === col,
		[selection],
	);

	/** 成りの選択を実行 */
	const handlePromotionChoice = useCallback(
		(promote: boolean) => {
			if (!promotionPrompt) return;
			const newState = applyAction(gameState, {
				kind: "move",
				from: promotionPrompt.from,
				to: promotionPrompt.to,
				promote,
			});
			setGameState(newState);
			setSelection(null);
			setHighlightedMoves([]);
			setPromotionPrompt(null);
		},
		[promotionPrompt, gameState],
	);

	/** 盤上のマスをクリック */
	const handleCellClick = useCallback(
		(row: number, col: number) => {
			if (promotionPrompt) return;
			if (
				gameState.status === "checkmate" ||
				gameState.status === "stalemate"
			)
				return;

			const pos: Position = { row, col };
			const clickedPiece = gameState.board[row][col];

			// 何も選択されていない場合
			if (!selection) {
				if (
					clickedPiece &&
					clickedPiece.player === gameState.currentPlayer
				) {
					setSelection({ kind: "board", position: pos });
					setHighlightedMoves(
						getLegalMoves(gameState.board, pos),
					);
				}
				return;
			}

			// 盤上の駒が選択されている場合
			if (selection.kind === "board") {
				const from = selection.position;

				// 同じマスをクリック → 選択解除
				if (from.row === row && from.col === col) {
					setSelection(null);
					setHighlightedMoves([]);
					return;
				}

				// 自分の別の駒をクリック → 選択切替
				if (
					clickedPiece &&
					clickedPiece.player === gameState.currentPlayer
				) {
					setSelection({ kind: "board", position: pos });
					setHighlightedMoves(
						getLegalMoves(gameState.board, pos),
					);
					return;
				}

				// 移動先として有効かチェック
				if (!isHighlighted(row, col)) {
					setSelection(null);
					setHighlightedMoves([]);
					return;
				}

				// 移動実行
				const piece = gameState.board[from.row][from.col];
				if (!piece) return;

				if (mustPromote(piece, pos)) {
					// 強制成り
					const newState = applyAction(gameState, {
						kind: "move",
						from,
						to: pos,
						promote: true,
					});
					setGameState(newState);
					setSelection(null);
					setHighlightedMoves([]);
				} else if (canPromote(piece, from, pos)) {
					// 成り選択ダイアログ
					setPromotionPrompt({ from, to: pos });
				} else {
					// 通常移動
					const newState = applyAction(gameState, {
						kind: "move",
						from,
						to: pos,
						promote: false,
					});
					setGameState(newState);
					setSelection(null);
					setHighlightedMoves([]);
				}
				return;
			}

			// 持ち駒が選択されている場合
			if (selection.kind === "captured") {
				// 自分の駒をクリック → 盤上の駒選択に切替
				if (
					clickedPiece &&
					clickedPiece.player === gameState.currentPlayer
				) {
					setSelection({ kind: "board", position: pos });
					setHighlightedMoves(
						getLegalMoves(gameState.board, pos),
					);
					return;
				}

				if (!isHighlighted(row, col)) {
					setSelection(null);
					setHighlightedMoves([]);
					return;
				}

				const newState = applyAction(gameState, {
					kind: "drop",
					piece: selection.piece,
					to: pos,
				});
				setGameState(newState);
				setSelection(null);
				setHighlightedMoves([]);
			}
		},
		[gameState, selection, isHighlighted, promotionPrompt],
	);

	/** 持ち駒をクリック */
	const handleCapturedClick = useCallback(
		(pieceType: PieceType, player: Player) => {
			if (promotionPrompt) return;
			if (
				gameState.status === "checkmate" ||
				gameState.status === "stalemate"
			)
				return;
			if (player !== gameState.currentPlayer) return;

			// 同じ持ち駒を再クリック → 選択解除
			if (
				selection?.kind === "captured" &&
				selection.piece === pieceType &&
				selection.player === player
			) {
				setSelection(null);
				setHighlightedMoves([]);
				return;
			}

			setSelection({ kind: "captured", piece: pieceType, player });
			setHighlightedMoves(
				getDropPositions(gameState.board, pieceType, player),
			);
		},
		[gameState, selection, promotionPrompt],
	);

	const gameOver =
		gameState.status === "checkmate" || gameState.status === "stalemate";

	return (
		<div className="min-h-screen bg-black text-white flex flex-col">
			{/* ヘッダー */}
			<header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 px-4 py-3">
				<div className="max-w-lg mx-auto flex items-center justify-between">
					<h1 className="text-lg font-bold">将棋対戦</h1>
					<button
						type="button"
						onClick={resetGame}
						className="text-sm px-3 py-1.5 rounded-full border border-gray-700 hover:bg-white/10 transition-colors"
					>
						最初から
					</button>
				</div>
			</header>

			<main className="flex-1 flex flex-col items-center justify-center px-2 py-4 gap-3">
				{/* ステータス表示 */}
				<StatusBar gameState={gameState} />

				{/* 後手の持ち駒 */}
				<CapturedPiecesBar
					player="gote"
					pieces={gameState.captured.gote}
					currentPlayer={gameState.currentPlayer}
					selection={selection}
					onPieceClick={handleCapturedClick}
				/>

				{/* 盤面 */}
				<div className="relative">
					<BoardGrid
						board={gameState.board}
						isSelected={isSelected}
						isHighlighted={isHighlighted}
						onCellClick={handleCellClick}
						currentPlayer={gameState.currentPlayer}
					/>

					{/* 成りダイアログ */}
					{promotionPrompt && (
						<PromotionDialog
							piece={
								gameState.board[promotionPrompt.from.row][
									promotionPrompt.from.col
								]
							}
							onChoice={handlePromotionChoice}
						/>
					)}
				</div>

				{/* 先手の持ち駒 */}
				<CapturedPiecesBar
					player="sente"
					pieces={gameState.captured.sente}
					currentPlayer={gameState.currentPlayer}
					selection={selection}
					onPieceClick={handleCapturedClick}
				/>

				{/* 終局表示 */}
				{gameOver && (
					<GameOverBanner gameState={gameState} onReset={resetGame} />
				)}
			</main>
		</div>
	);
}

// =====================
// サブコンポーネント
// =====================

function StatusBar({ gameState }: { gameState: GameState }) {
	const playerName = gameState.currentPlayer === "sente" ? "先手" : "後手";
	const playerColor =
		gameState.currentPlayer === "sente"
			? "text-orange-400"
			: "text-sky-400";

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

function CapturedPiecesBar({
	player,
	pieces,
	currentPlayer,
	selection,
	onPieceClick,
}: {
	player: Player;
	pieces: PieceType[];
	currentPlayer: Player;
	selection: Selection;
	onPieceClick: (type: PieceType, player: Player) => void;
}) {
	const summary = summarizeCaptured(pieces);
	const label = player === "sente" ? "先手" : "後手";
	const labelColor =
		player === "sente" ? "text-orange-400" : "text-sky-400";
	const isActive = currentPlayer === player;

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

function BoardGrid({
	board,
	isSelected,
	isHighlighted,
	onCellClick,
	currentPlayer,
}: {
	board: (Piece | null)[][];
	isSelected: (row: number, col: number) => boolean;
	isHighlighted: (row: number, col: number) => boolean;
	onCellClick: (row: number, col: number) => void;
	currentPlayer: Player;
}) {
	return (
		<div className="relative">
			{/* 筋 (列番号: 9〜1) */}
			<div className="flex mb-0.5 pl-6">
				{Array.from({ length: 9 }, (_, i) => (
					<div
						key={`col-${i}`}
						className="w-9 h-4 flex items-center justify-center text-[10px] text-gray-500"
					>
						{9 - i}
					</div>
				))}
			</div>

			<div className="flex">
				{/* 盤本体 */}
				<div className="border border-amber-900/60">
					{Array.from({ length: 9 }, (_, row) => (
						<div key={`row-${row}`} className="flex">
							{Array.from({ length: 9 }, (_, col) => {
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
										{piece && (
											<PieceDisplay piece={piece} />
										)}
										{highlighted && !piece && (
											<span className="absolute w-2.5 h-2.5 rounded-full bg-green-500/50" />
										)}
									</button>
								);
							})}
						</div>
					))}
				</div>

				{/* 段 (行番号: 一〜九) */}
				<div className="flex flex-col ml-0.5">
					{["一", "二", "三", "四", "五", "六", "七", "八", "九"].map(
						(label, i) => (
							<div
								key={`row-label-${i}`}
								className="w-4 h-9 flex items-center justify-center text-[10px] text-gray-500"
							>
								{label}
							</div>
						),
					)}
				</div>
			</div>
		</div>
	);
}

function PieceDisplay({ piece }: { piece: Piece }) {
	const kanji = pieceToKanji(piece);
	const isGote = piece.player === "gote";
	const isPromoted = piece.promoted;

	return (
		<span
			className={`
				${isGote ? "rotate-180" : ""}
				${isPromoted ? "text-red-400" : ""}
				${piece.player === "sente" ? "text-orange-200" : "text-sky-200"}
				select-none leading-none
			`}
		>
			{kanji}
		</span>
	);
}

function PromotionDialog({
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
						<span className="text-xs text-gray-400">
							不成
						</span>
					</button>
				</div>
			</div>
		</div>
	);
}

function GameOverBanner({
	gameState,
	onReset,
}: {
	gameState: GameState;
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
