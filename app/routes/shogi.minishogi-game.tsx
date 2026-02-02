import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useFetcher, useRevalidator, data } from "react-router";
import type { Route } from "./+types/shogi.minishogi-game";
import type {
	GameState,
	Selection,
	Position,
	PieceType,
	Player,
	GameAction,
} from "../shogi/types";
import { drizzle } from "drizzle-orm/d1";
import { shogiGames } from "../db/schema";
import { eq } from "drizzle-orm";
import {
	deserializeGameState,
	serializeGameState,
	validateAction,
	applyAction,
	getLegalMoves,
	getDropPositions,
	canPromote,
	mustPromote,
} from "../shogi/minishogi-logic";
import {
	MinishogiBoardGrid,
	MinishogiCapturedPiecesBar,
} from "../shogi/minishogi-board";
import {
	PromotionDialog,
	GameOverBanner,
	StatusBar,
} from "../shogi/board";

// =====================
// Cookie ヘルパー
// =====================

function getPlayerId(request: Request): string | null {
	const cookie = request.headers.get("Cookie") ?? "";
	const match = cookie.match(/shogi_pid=([^;]+)/);
	return match ? match[1] : null;
}

function setPlayerIdCookie(playerId: string): string {
	return `shogi_pid=${playerId}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

// =====================
// Loader / Action
// =====================

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const gameId = params.gameId;

	const [game] = await db
		.select()
		.from(shogiGames)
		.where(eq(shogiGames.id, gameId))
		.limit(1);

	if (!game) {
		throw new Response("ゲームが見つかりません", { status: 404 });
	}

	let playerId = getPlayerId(request);
	const headers: Record<string, string> = {};
	if (!playerId) {
		playerId = crypto.randomUUID();
		headers["Set-Cookie"] = setPlayerIdCookie(playerId);
	}

	let myRole: "sente" | "gote" | "spectator" = "spectator";
	if (game.sentePlayerId === playerId) {
		myRole = "sente";
	} else if (game.gotePlayerId === playerId) {
		myRole = "gote";
	}

	const responseData = {
		gameId: game.id,
		board: game.board,
		captured: game.captured,
		currentPlayer: game.currentPlayer,
		status: game.status,
		winner: game.winner,
		moveCount: game.moveCount,
		myRole,
	};

	if (Object.keys(headers).length > 0) {
		return data(responseData, { headers });
	}
	return responseData;
}

export async function action({ params, request, context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const gameId = params.gameId;
	const formData = await request.formData();
	const intent = formData.get("intent");

	const playerId = getPlayerId(request);
	if (!playerId) {
		return data({ error: "プレイヤーが識別できません。" }, { status: 401 });
	}

	const [game] = await db
		.select()
		.from(shogiGames)
		.where(eq(shogiGames.id, gameId))
		.limit(1);

	if (!game) {
		return data({ error: "ゲームが見つかりません。" }, { status: 404 });
	}

	if (intent === "move") {
		// プレイヤーの役割を確認
		let myRole: Player | null = null;
		if (game.sentePlayerId === playerId) myRole = "sente";
		else if (game.gotePlayerId === playerId) myRole = "gote";

		if (!myRole) {
			return data({ error: "このゲームに参加していません。" }, { status: 403 });
		}

		if (game.currentPlayer !== myRole) {
			return data({ error: "あなたの番ではありません。" }, { status: 400 });
		}

		if (game.status !== "playing" && game.status !== "check") {
			return data({ error: "ゲームは終了しています。" }, { status: 400 });
		}

		// アクションをパース
		const actionJson = formData.get("action");
		if (typeof actionJson !== "string") {
			return data({ error: "不正なアクションです。" }, { status: 400 });
		}

		let gameAction: GameAction;
		try {
			gameAction = JSON.parse(actionJson) as GameAction;
		} catch {
			return data({ error: "不正なアクションです。" }, { status: 400 });
		}

		// ゲーム状態を復元して検証
		const gameState = deserializeGameState({
			board: game.board,
			captured: game.captured,
			currentPlayer: game.currentPlayer,
			status: game.status,
			winner: game.winner,
			moveCount: game.moveCount,
		});

		if (!validateAction(gameState, gameAction)) {
			return data({ error: "不正な手です。" }, { status: 400 });
		}

		// 手を適用
		const newState = applyAction(gameState, gameAction);
		const serialized = serializeGameState(newState);

		await db
			.update(shogiGames)
			.set({
				board: serialized.board,
				captured: serialized.captured,
				currentPlayer: serialized.currentPlayer,
				status: serialized.status,
				winner: serialized.winner,
				moveCount: game.moveCount + 1,
			})
			.where(eq(shogiGames.id, gameId));

		return { ok: true };
	}

	if (intent === "resign") {
		let myRole: Player | null = null;
		if (game.sentePlayerId === playerId) myRole = "sente";
		else if (game.gotePlayerId === playerId) myRole = "gote";

		if (!myRole) {
			return data({ error: "このゲームに参加していません。" }, { status: 403 });
		}

		const winner = myRole === "sente" ? "gote" : "sente";
		await db
			.update(shogiGames)
			.set({ status: "checkmate", winner })
			.where(eq(shogiGames.id, gameId));

		return { ok: true };
	}

	return data({ error: "不正なリクエストです。" }, { status: 400 });
}

export function meta({ data: loaderData }: Route.MetaArgs) {
	const gameData = loaderData as { gameId?: string } | undefined;
	const gameId = gameData?.gameId ?? "";
	return [
		{ title: `5五将棋対戦 ${gameId} | nw-union.net` },
		{ name: "description", content: "5五将棋のオンライン対戦" },
	];
}

// =====================
// メインコンポーネント
// =====================

export default function MinishogiGame({ loaderData }: Route.ComponentProps) {
	const {
		gameId,
		board,
		captured,
		currentPlayer,
		status,
		winner,
		moveCount,
		myRole,
	} = loaderData as {
		gameId: string;
		board: string;
		captured: string;
		currentPlayer: string;
		status: string;
		winner: string | null;
		moveCount: number;
		myRole: "sente" | "gote" | "spectator";
	};

	const gameState: GameState = deserializeGameState({
		board,
		captured,
		currentPlayer,
		status,
		winner,
		moveCount,
	});

	const revalidator = useRevalidator();
	const fetcher = useFetcher();
	const moveCountRef = useRef(moveCount);

	// 最新のmoveCountを追跡
	useEffect(() => {
		moveCountRef.current = moveCount;
	}, [moveCount]);

	// 相手の番のときポーリング (2秒間隔)
	const isMyTurn = myRole === currentPlayer;
	const isWaiting = status === "waiting";
	const gameOver = status === "checkmate" || status === "stalemate";

	useEffect(() => {
		if (gameOver) return;
		if (isMyTurn && !isWaiting) return;

		const interval = setInterval(() => {
			if (revalidator.state === "idle") {
				revalidator.revalidate();
			}
		}, 2000);

		return () => clearInterval(interval);
	}, [isMyTurn, isWaiting, gameOver, revalidator]);

	const [selection, setSelection] = useState<Selection>(null);
	const [highlightedMoves, setHighlightedMoves] = useState<Position[]>([]);
	const [promotionPrompt, setPromotionPrompt] = useState<{
		from: Position;
		to: Position;
	} | null>(null);

	// moveCount が変わったら選択をリセット
	useEffect(() => {
		setSelection(null);
		setHighlightedMoves([]);
		setPromotionPrompt(null);
	}, [moveCount]);

	const canInteract =
		myRole !== "spectator" && isMyTurn && !gameOver && !isWaiting;

	const flipped = myRole === "gote";

	const submitMove = useCallback(
		(action: GameAction) => {
			const formData = new FormData();
			formData.set("intent", "move");
			formData.set("action", JSON.stringify(action));
			fetcher.submit(formData, { method: "post" });
		},
		[fetcher],
	);

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
			submitMove({
				kind: "move",
				from: promotionPrompt.from,
				to: promotionPrompt.to,
				promote,
			});
			setSelection(null);
			setHighlightedMoves([]);
			setPromotionPrompt(null);
		},
		[promotionPrompt, submitMove],
	);

	const handleCellClick = useCallback(
		(row: number, col: number) => {
			if (!canInteract) return;
			if (promotionPrompt) return;

			const pos: Position = { row, col };
			const clickedPiece = gameState.board[row][col];

			if (!selection) {
				if (
					clickedPiece &&
					clickedPiece.player === gameState.currentPlayer
				) {
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

				if (
					clickedPiece &&
					clickedPiece.player === gameState.currentPlayer
				) {
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
					submitMove({
						kind: "move",
						from,
						to: pos,
						promote: true,
					});
					setSelection(null);
					setHighlightedMoves([]);
				} else if (canPromote(piece, from, pos)) {
					setPromotionPrompt({ from, to: pos });
				} else {
					submitMove({
						kind: "move",
						from,
						to: pos,
						promote: false,
					});
					setSelection(null);
					setHighlightedMoves([]);
				}
				return;
			}

			if (selection.kind === "captured") {
				if (
					clickedPiece &&
					clickedPiece.player === gameState.currentPlayer
				) {
					setSelection({ kind: "board", position: pos });
					setHighlightedMoves(getLegalMoves(gameState.board, pos));
					return;
				}

				if (!isHighlighted(row, col)) {
					setSelection(null);
					setHighlightedMoves([]);
					return;
				}

				submitMove({
					kind: "drop",
					piece: selection.piece,
					to: pos,
				});
				setSelection(null);
				setHighlightedMoves([]);
			}
		},
		[
			canInteract,
			gameState,
			selection,
			isHighlighted,
			promotionPrompt,
			submitMove,
		],
	);

	const handleCapturedClick = useCallback(
		(pieceType: PieceType, player: Player) => {
			if (!canInteract) return;
			if (promotionPrompt) return;
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
			setHighlightedMoves(
				getDropPositions(gameState.board, pieceType, player),
			);
		},
		[canInteract, gameState, selection, promotionPrompt],
	);

	const handleResign = useCallback(() => {
		if (!confirm("投了しますか？")) return;
		const formData = new FormData();
		formData.set("intent", "resign");
		fetcher.submit(formData, { method: "post" });
	}, [fetcher]);

	// 上に表示するプレイヤー・下に表示するプレイヤー
	const topPlayer: Player = flipped ? "sente" : "gote";
	const bottomPlayer: Player = flipped ? "gote" : "sente";

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
					<h1 className="text-lg font-bold">
						5五将棋{" "}
						<span className="text-amber-400 font-mono">{gameId}</span>
					</h1>
					{myRole !== "spectator" && !gameOver && !isWaiting && (
						<button
							type="button"
							onClick={handleResign}
							className="text-sm px-3 py-1.5 rounded-full border border-red-900/50 text-red-400 hover:bg-red-900/20 transition-colors"
						>
							投了
						</button>
					)}
					{(gameOver || isWaiting || myRole === "spectator") && (
						<div className="w-14" />
					)}
				</div>
			</header>

			<main className="flex-1 flex flex-col items-center justify-center px-2 py-4 gap-3">
				{/* 待機中 */}
				{isWaiting && (
					<WaitingRoom gameId={gameId} myRole={myRole} />
				)}

				{/* 対局中 / 観戦中 */}
				{!isWaiting && (
					<>
						<OnlineStatusBar
							gameState={gameState}
							myRole={myRole}
							isMyTurn={isMyTurn}
						/>

						<MinishogiCapturedPiecesBar
							player={topPlayer}
							pieces={gameState.captured[topPlayer]}
							currentPlayer={gameState.currentPlayer}
							selection={selection}
							onPieceClick={handleCapturedClick}
							interactive={canInteract}
						/>

						<div className="relative">
							<MinishogiBoardGrid
								board={gameState.board}
								isSelected={isSelected}
								isHighlighted={isHighlighted}
								onCellClick={handleCellClick}
								currentPlayer={gameState.currentPlayer}
								flipped={flipped}
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

						<MinishogiCapturedPiecesBar
							player={bottomPlayer}
							pieces={gameState.captured[bottomPlayer]}
							currentPlayer={gameState.currentPlayer}
							selection={selection}
							onPieceClick={handleCapturedClick}
							interactive={canInteract}
						/>

						{gameOver && (
							<GameOverBanner
								gameState={gameState}
								onReset={() => {
									window.location.href = "/shogi";
								}}
							/>
						)}
					</>
				)}
			</main>
		</div>
	);
}

// =====================
// サブコンポーネント
// =====================

function WaitingRoom({
	gameId,
	myRole,
}: {
	gameId: string;
	myRole: string;
}) {
	const [copied, setCopied] = useState(false);

	const copyCode = useCallback(() => {
		navigator.clipboard.writeText(gameId).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}, [gameId]);

	return (
		<div className="text-center space-y-6 p-6">
			<div className="space-y-2">
				<p className="text-gray-400 text-sm">対戦相手を待っています...</p>
				<div className="flex items-center justify-center gap-2">
					<span className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
					<span className="text-xs text-gray-500">
						{myRole === "sente" ? "先手" : "観戦者"}としてエントリー中
					</span>
				</div>
			</div>

			<div className="space-y-3">
				<p className="text-xs text-gray-500">
					相手にこのコードを共有してください
				</p>
				<div className="flex items-center justify-center gap-3">
					<span className="text-4xl font-mono font-bold tracking-[0.3em] text-purple-400">
						{gameId}
					</span>
					<button
						type="button"
						onClick={copyCode}
						className="px-3 py-1.5 text-xs border border-gray-700 rounded-lg hover:bg-white/10 transition-colors"
					>
						{copied ? "コピー済" : "コピー"}
					</button>
				</div>
			</div>
		</div>
	);
}

function OnlineStatusBar({
	gameState,
	myRole,
	isMyTurn,
}: {
	gameState: GameState;
	myRole: "sente" | "gote" | "spectator";
	isMyTurn: boolean;
}) {
	const gameOver =
		gameState.status === "checkmate" || gameState.status === "stalemate";

	if (gameOver) {
		return <StatusBar gameState={gameState} />;
	}

	const currentPlayerName =
		gameState.currentPlayer === "sente" ? "先手" : "後手";
	const playerColor =
		gameState.currentPlayer === "sente" ? "text-orange-400" : "text-sky-400";

	if (myRole === "spectator") {
		return (
			<div className={`text-center text-sm font-bold ${playerColor}`}>
				{gameState.status === "check" ? "王手！ " : ""}
				{currentPlayerName}の番（観戦中）
			</div>
		);
	}

	const turnText = isMyTurn ? "あなたの番です" : "相手の番です";

	return (
		<div className="text-center">
			<div
				className={`text-sm font-bold ${
					gameState.status === "check"
						? "text-red-400"
						: isMyTurn
							? "text-purple-400"
							: "text-gray-400"
				}`}
			>
				{gameState.status === "check" ? "王手！ " : ""}
				{turnText}
			</div>
			<div className="text-[10px] text-gray-600 mt-0.5">
				あなた: {myRole === "sente" ? "先手" : "後手"}
			</div>
		</div>
	);
}
