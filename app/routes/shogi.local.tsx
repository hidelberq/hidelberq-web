import { useCallback, useState } from "react";
import { Link } from "react-router";
import {
	BoardGrid,
	CapturedPiecesBar,
	GameOverBanner,
	PromotionDialog,
	StatusBar,
} from "../shogi/board";
import {
	applyAction,
	canPromote,
	createInitialGameState,
	getDropPositions,
	getLegalMoves,
	mustPromote,
} from "../shogi/logic";
import type {
	GameState,
	PieceType,
	Player,
	Position,
	Selection,
} from "../shogi/types";
import { vibrateTurnChange } from "../shogi/vibrate";
import type { Route } from "./+types/shogi.local";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "将棋ローカル対戦 | nw-union.net" },
		{ name: "description", content: "将棋のローカル2人対戦" },
	];
}

export default function ShogiLocal() {
	const [gameState, setGameState] = useState<GameState>(createInitialGameState);
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
			vibrateTurnChange();
			setSelection(null);
			setHighlightedMoves([]);
			setPromotionPrompt(null);
		},
		[promotionPrompt, gameState],
	);

	const handleCellClick = useCallback(
		(row: number, col: number) => {
			if (promotionPrompt) return;
			if (gameState.status === "checkmate" || gameState.status === "stalemate")
				return;

			const pos: Position = { row, col };
			const clickedPiece = gameState.board[row][col];

			if (!selection) {
				if (clickedPiece && clickedPiece.player === gameState.currentPlayer) {
					setSelection({ kind: "board", position: pos });
					setHighlightedMoves(getLegalMoves(gameState.board, pos));
				}
				return;
			}

			if (selection.kind === "board") {
				const from = selection.position;

				if (from.row === row && from.col === col) {
					setSelection(null);
					setHighlightedMoves([]);
					return;
				}

				if (clickedPiece && clickedPiece.player === gameState.currentPlayer) {
					setSelection({ kind: "board", position: pos });
					setHighlightedMoves(getLegalMoves(gameState.board, pos));
					return;
				}

				if (!isHighlighted(row, col)) {
					setSelection(null);
					setHighlightedMoves([]);
					return;
				}

				const piece = gameState.board[from.row][from.col];
				if (!piece) return;

				if (mustPromote(piece, pos)) {
					const newState = applyAction(gameState, {
						kind: "move",
						from,
						to: pos,
						promote: true,
					});
					setGameState(newState);
					vibrateTurnChange();
					setSelection(null);
					setHighlightedMoves([]);
				} else if (canPromote(piece, from, pos)) {
					setPromotionPrompt({ from, to: pos });
				} else {
					const newState = applyAction(gameState, {
						kind: "move",
						from,
						to: pos,
						promote: false,
					});
					setGameState(newState);
					vibrateTurnChange();
					setSelection(null);
					setHighlightedMoves([]);
				}
				return;
			}

			if (selection.kind === "captured") {
				if (clickedPiece && clickedPiece.player === gameState.currentPlayer) {
					setSelection({ kind: "board", position: pos });
					setHighlightedMoves(getLegalMoves(gameState.board, pos));
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
				vibrateTurnChange();
				setSelection(null);
				setHighlightedMoves([]);
			}
		},
		[gameState, selection, isHighlighted, promotionPrompt],
	);

	const handleCapturedClick = useCallback(
		(pieceType: PieceType, player: Player) => {
			if (promotionPrompt) return;
			if (gameState.status === "checkmate" || gameState.status === "stalemate")
				return;
			if (player !== gameState.currentPlayer) return;

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
			setHighlightedMoves(getDropPositions(gameState.board, pieceType, player));
		},
		[gameState, selection, promotionPrompt],
	);

	const gameOver =
		gameState.status === "checkmate" || gameState.status === "stalemate";

	return (
		<div className="min-h-screen bg-black text-white flex flex-col">
			<header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 px-4 py-3">
				<div className="max-w-lg mx-auto flex items-center justify-between">
					<Link
						to="/shogi"
						className="text-sm text-gray-400 hover:text-white transition-colors"
					>
						← 戻る
					</Link>
					<h1 className="text-lg font-bold">ローカル対戦</h1>
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
				<StatusBar gameState={gameState} />

				<CapturedPiecesBar
					player="gote"
					pieces={gameState.captured.gote}
					currentPlayer={gameState.currentPlayer}
					selection={selection}
					onPieceClick={handleCapturedClick}
				/>

				<div className="relative">
					<BoardGrid
						board={gameState.board}
						isSelected={isSelected}
						isHighlighted={isHighlighted}
						onCellClick={handleCellClick}
						currentPlayer={gameState.currentPlayer}
					/>

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

				<CapturedPiecesBar
					player="sente"
					pieces={gameState.captured.sente}
					currentPlayer={gameState.currentPlayer}
					selection={selection}
					onPieceClick={handleCapturedClick}
				/>

				{gameOver && (
					<GameOverBanner gameState={gameState} onReset={resetGame} />
				)}
			</main>
		</div>
	);
}
