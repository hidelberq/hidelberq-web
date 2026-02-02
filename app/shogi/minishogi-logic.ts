import type {
	Board,
	CapturedPieces,
	GameAction,
	GameState,
	Piece,
	PieceType,
	Player,
	Position,
} from "./types";

// =====================
// 5五将棋 (ミニ将棋)
// 5×5盤、駒: 王・飛・角・金・銀・歩
// =====================

export { pieceToKanji, pieceTypeToKanji, summarizeCaptured } from "./logic";

const BOARD_SIZE = 5;

// =====================
// 初期盤面
// =====================

function makePiece(type: PieceType, player: Player): Piece {
	return { type, player, promoted: false };
}

export function createInitialBoard(): Board {
	const board: Board = Array.from({ length: BOARD_SIZE }, () =>
		Array.from({ length: BOARD_SIZE }, () => null),
	);

	// 後手 (gote) - 上側 (row 0-1)
	// Row 0: 玉 金 銀 角 飛
	const goteBack: PieceType[] = ["king", "gold", "silver", "bishop", "rook"];
	for (let c = 0; c < BOARD_SIZE; c++) {
		board[0][c] = makePiece(goteBack[c], "gote");
	}
	// Row 1: . . . . 歩
	board[1][4] = makePiece("pawn", "gote");

	// 先手 (sente) - 下側 (row 3-4)
	// Row 3: 歩 . . . .
	board[3][0] = makePiece("pawn", "sente");
	// Row 4: 飛 角 銀 金 王
	const senteBack: PieceType[] = ["rook", "bishop", "silver", "gold", "king"];
	for (let c = 0; c < BOARD_SIZE; c++) {
		board[4][c] = makePiece(senteBack[c], "sente");
	}

	return board;
}

export function createInitialGameState(): GameState {
	return {
		board: createInitialBoard(),
		captured: { sente: [], gote: [] },
		currentPlayer: "sente",
		moveHistory: [],
		status: "playing",
		winner: null,
	};
}

// =====================
// ユーティリティ
// =====================

function inBounds(pos: Position): boolean {
	return (
		pos.row >= 0 &&
		pos.row < BOARD_SIZE &&
		pos.col >= 0 &&
		pos.col < BOARD_SIZE
	);
}

function cloneBoard(board: Board): Board {
	return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function cloneCaptured(captured: CapturedPieces): CapturedPieces {
	return {
		sente: [...captured.sente],
		gote: [...captured.gote],
	};
}

function opponent(player: Player): Player {
	return player === "sente" ? "gote" : "sente";
}

/** 前方向 (senteは上、goteは下) */
function forward(player: Player): number {
	return player === "sente" ? -1 : 1;
}

// =====================
// 移動先の計算
// =====================

/** ステップ移動 (1マスの移動) の差分を返す */
function getStepOffsets(piece: Piece): Position[] {
	const fwd = forward(piece.player);
	const offsets: Position[] = [];

	if (piece.promoted && piece.type !== "king" && piece.type !== "gold") {
		if (piece.type === "rook") {
			// 龍王: スライド + 斜め1マス
			offsets.push(
				{ row: -1, col: -1 },
				{ row: -1, col: 1 },
				{ row: 1, col: -1 },
				{ row: 1, col: 1 },
			);
			return offsets;
		}
		if (piece.type === "bishop") {
			// 龍馬: スライド + 上下左右1マス
			offsets.push(
				{ row: -1, col: 0 },
				{ row: 1, col: 0 },
				{ row: 0, col: -1 },
				{ row: 0, col: 1 },
			);
			return offsets;
		}
		// 成銀、と金: 金と同じ動き
		offsets.push(
			{ row: fwd, col: 0 },
			{ row: fwd, col: -1 },
			{ row: fwd, col: 1 },
			{ row: 0, col: -1 },
			{ row: 0, col: 1 },
			{ row: -fwd, col: 0 },
		);
		return offsets;
	}

	switch (piece.type) {
		case "king":
			offsets.push(
				{ row: -1, col: -1 },
				{ row: -1, col: 0 },
				{ row: -1, col: 1 },
				{ row: 0, col: -1 },
				{ row: 0, col: 1 },
				{ row: 1, col: -1 },
				{ row: 1, col: 0 },
				{ row: 1, col: 1 },
			);
			break;
		case "gold":
			offsets.push(
				{ row: fwd, col: 0 },
				{ row: fwd, col: -1 },
				{ row: fwd, col: 1 },
				{ row: 0, col: -1 },
				{ row: 0, col: 1 },
				{ row: -fwd, col: 0 },
			);
			break;
		case "silver":
			offsets.push(
				{ row: fwd, col: 0 },
				{ row: fwd, col: -1 },
				{ row: fwd, col: 1 },
				{ row: -fwd, col: -1 },
				{ row: -fwd, col: 1 },
			);
			break;
		case "pawn":
			offsets.push({ row: fwd, col: 0 });
			break;
		default:
			break;
	}

	return offsets;
}

/** スライド移動の方向を返す */
function getSlideDirections(piece: Piece): Position[] {
	const dirs: Position[] = [];

	if (piece.type === "rook") {
		dirs.push(
			{ row: -1, col: 0 },
			{ row: 1, col: 0 },
			{ row: 0, col: -1 },
			{ row: 0, col: 1 },
		);
	}

	if (piece.type === "bishop") {
		dirs.push(
			{ row: -1, col: -1 },
			{ row: -1, col: 1 },
			{ row: 1, col: -1 },
			{ row: 1, col: 1 },
		);
	}

	return dirs;
}

/** 駒の移動可能なマスをすべて返す (王手の考慮なし) */
function getRawMoves(board: Board, from: Position): Position[] {
	const piece = board[from.row][from.col];
	if (!piece) return [];

	const moves: Position[] = [];

	// ステップ移動
	for (const offset of getStepOffsets(piece)) {
		const to = { row: from.row + offset.row, col: from.col + offset.col };
		if (!inBounds(to)) continue;
		const target = board[to.row][to.col];
		if (target && target.player === piece.player) continue;
		moves.push(to);
	}

	// スライド移動
	for (const dir of getSlideDirections(piece)) {
		for (let i = 1; i < BOARD_SIZE; i++) {
			const to = {
				row: from.row + dir.row * i,
				col: from.col + dir.col * i,
			};
			if (!inBounds(to)) break;
			const target = board[to.row][to.col];
			if (target) {
				if (target.player !== piece.player) {
					moves.push(to);
				}
				break;
			}
			moves.push(to);
		}
	}

	return moves;
}

// =====================
// 王手の判定
// =====================

function findKing(board: Board, player: Player): Position | null {
	for (let r = 0; r < BOARD_SIZE; r++) {
		for (let c = 0; c < BOARD_SIZE; c++) {
			const p = board[r][c];
			if (p && p.player === player && p.type === "king") {
				return { row: r, col: c };
			}
		}
	}
	return null;
}

/** player の王が相手に取られる状態か */
function isInCheck(board: Board, player: Player): boolean {
	const kingPos = findKing(board, player);
	if (!kingPos) return false;

	const opp = opponent(player);
	for (let r = 0; r < BOARD_SIZE; r++) {
		for (let c = 0; c < BOARD_SIZE; c++) {
			const p = board[r][c];
			if (!p || p.player !== opp) continue;
			const moves = getRawMoves(board, { row: r, col: c });
			if (
				moves.some(
					(m) => m.row === kingPos.row && m.col === kingPos.col,
				)
			) {
				return true;
			}
		}
	}
	return false;
}

// =====================
// 成り判定
// =====================

/** 成れるかどうか (5五将棋: 相手の最奥1段のみ) */
export function canPromote(
	piece: Piece,
	from: Position,
	to: Position,
): boolean {
	if (piece.promoted) return false;
	if (piece.type === "king" || piece.type === "gold") return false;

	const zone = piece.player === "sente" ? [0] : [4];
	return zone.includes(from.row) || zone.includes(to.row);
}

/** 成りが必須かどうか */
export function mustPromote(piece: Piece, to: Position): boolean {
	if (piece.promoted) return false;

	if (piece.type === "pawn") {
		return piece.player === "sente" ? to.row === 0 : to.row === 4;
	}
	return false;
}

// =====================
// 駒を打つ (ドロップ) の判定
// =====================

/** 持ち駒を打てるマスを返す */
export function getDropPositions(
	board: Board,
	pieceType: PieceType,
	player: Player,
): Position[] {
	const positions: Position[] = [];

	for (let r = 0; r < BOARD_SIZE; r++) {
		for (let c = 0; c < BOARD_SIZE; c++) {
			if (board[r][c] !== null) continue;

			// 行き場のない場所には打てない
			if (pieceType === "pawn") {
				if (player === "sente" && r === 0) continue;
				if (player === "gote" && r === 4) continue;
			}

			// 二歩チェック
			if (pieceType === "pawn") {
				let hasPawnInCol = false;
				for (let rr = 0; rr < BOARD_SIZE; rr++) {
					const p = board[rr][c];
					if (
						p &&
						p.player === player &&
						p.type === "pawn" &&
						!p.promoted
					) {
						hasPawnInCol = true;
						break;
					}
				}
				if (hasPawnInCol) continue;
			}

			positions.push({ row: r, col: c });
		}
	}

	// 打った後に自玉が王手にならないかチェック
	return positions.filter((pos) => {
		const newBoard = cloneBoard(board);
		newBoard[pos.row][pos.col] = {
			type: pieceType,
			player,
			promoted: false,
		};
		return !isInCheck(newBoard, player);
	});
}

// =====================
// 合法手の計算
// =====================

/** ある駒の合法移動先 (王手考慮済み) */
export function getLegalMoves(board: Board, from: Position): Position[] {
	const piece = board[from.row][from.col];
	if (!piece) return [];

	const rawMoves = getRawMoves(board, from);

	return rawMoves.filter((to) => {
		const newBoard = cloneBoard(board);
		newBoard[to.row][to.col] = newBoard[from.row][from.col];
		newBoard[from.row][from.col] = null;
		return !isInCheck(newBoard, piece.player);
	});
}

/** プレイヤーに合法手が存在するか */
function hasAnyLegalMove(
	board: Board,
	captured: CapturedPieces,
	player: Player,
): boolean {
	// 盤上の駒の移動
	for (let r = 0; r < BOARD_SIZE; r++) {
		for (let c = 0; c < BOARD_SIZE; c++) {
			const p = board[r][c];
			if (!p || p.player !== player) continue;
			if (getLegalMoves(board, { row: r, col: c }).length > 0) return true;
		}
	}

	// 持ち駒を打つ
	const uniqueTypes = [...new Set(captured[player])];
	for (const pt of uniqueTypes) {
		if (getDropPositions(board, pt, player).length > 0) return true;
	}

	return false;
}

// =====================
// アクション適用
// =====================

export function applyAction(state: GameState, action: GameAction): GameState {
	const board = cloneBoard(state.board);
	const captured = cloneCaptured(state.captured);
	const player = state.currentPlayer;
	const opp = opponent(player);

	if (action.kind === "move") {
		const piece = board[action.from.row][action.from.col];
		if (!piece) return state;

		// 移動先に相手の駒があれば取る
		const target = board[action.to.row][action.to.col];
		if (target && target.player === opp) {
			captured[player].push(target.type);
		}

		// 駒を移動
		board[action.to.row][action.to.col] = {
			...piece,
			promoted: action.promote ? true : piece.promoted,
		};
		board[action.from.row][action.from.col] = null;
	} else {
		// ドロップ
		board[action.to.row][action.to.col] = {
			type: action.piece,
			player,
			promoted: false,
		};
		// 持ち駒から1つ除去
		const idx = captured[player].indexOf(action.piece);
		if (idx !== -1) {
			captured[player].splice(idx, 1);
		}
	}

	// ステータス更新
	const inCheck = isInCheck(board, opp);
	const hasLegal = hasAnyLegalMove(board, captured, opp);

	let status: GameState["status"] = "playing";
	let winner: Player | null = null;

	if (!hasLegal) {
		if (inCheck) {
			status = "checkmate";
			winner = player;
		} else {
			status = "stalemate";
		}
	} else if (inCheck) {
		status = "check";
	}

	return {
		board,
		captured,
		currentPlayer: opp,
		moveHistory: [...state.moveHistory, action],
		status,
		winner,
	};
}
