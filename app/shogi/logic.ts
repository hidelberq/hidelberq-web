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
// 駒の表示名
// =====================

const PIECE_KANJI: Record<PieceType, string> = {
	king: "王",
	rook: "飛",
	bishop: "角",
	gold: "金",
	silver: "銀",
	knight: "桂",
	lance: "香",
	pawn: "歩",
};

const PROMOTED_KANJI: Record<PieceType, string> = {
	king: "王",
	rook: "龍",
	bishop: "馬",
	gold: "金",
	silver: "全",
	knight: "圭",
	lance: "杏",
	pawn: "と",
};

export function pieceToKanji(piece: Piece): string {
	if (piece.promoted) {
		return PROMOTED_KANJI[piece.type];
	}
	if (piece.type === "king" && piece.player === "gote") {
		return "玉";
	}
	return PIECE_KANJI[piece.type];
}

// =====================
// 初期盤面
// =====================

function makePiece(type: PieceType, player: Player): Piece {
	return { type, player, promoted: false };
}

export function createInitialBoard(): Board {
	const board: Board = Array.from({ length: 9 }, () =>
		Array.from({ length: 9 }, () => null),
	);

	// 後手 (gote) - 上側 (row 0-2)
	const goteBack: PieceType[] = [
		"lance",
		"knight",
		"silver",
		"gold",
		"king",
		"gold",
		"silver",
		"knight",
		"lance",
	];
	for (let c = 0; c < 9; c++) {
		board[0][c] = makePiece(goteBack[c], "gote");
	}
	board[1][1] = makePiece("bishop", "gote");
	board[1][7] = makePiece("rook", "gote");
	for (let c = 0; c < 9; c++) {
		board[2][c] = makePiece("pawn", "gote");
	}

	// 先手 (sente) - 下側 (row 6-8)
	const senteBack: PieceType[] = [
		"lance",
		"knight",
		"silver",
		"gold",
		"king",
		"gold",
		"silver",
		"knight",
		"lance",
	];
	for (let c = 0; c < 9; c++) {
		board[8][c] = makePiece(senteBack[c], "sente");
	}
	board[7][7] = makePiece("bishop", "sente");
	board[7][1] = makePiece("rook", "sente");
	for (let c = 0; c < 9; c++) {
		board[6][c] = makePiece("pawn", "sente");
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
	return pos.row >= 0 && pos.row < 9 && pos.col >= 0 && pos.col < 9;
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
			return offsets; // スライドは別処理
		}
		if (piece.type === "bishop") {
			// 龍馬: スライド + 上下左右1マス
			offsets.push(
				{ row: -1, col: 0 },
				{ row: 1, col: 0 },
				{ row: 0, col: -1 },
				{ row: 0, col: 1 },
			);
			return offsets; // スライドは別処理
		}
		// 成銀、成桂、成香、と金: 金と同じ動き
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
		case "knight":
			offsets.push(
				{ row: fwd * 2, col: -1 },
				{ row: fwd * 2, col: 1 },
			);
			break;
		case "pawn":
			offsets.push({ row: fwd, col: 0 });
			break;
		// lance, rook, bishop はスライド移動
		default:
			break;
	}

	return offsets;
}

/** スライド移動の方向を返す */
function getSlideDirections(piece: Piece): Position[] {
	const fwd = forward(piece.player);
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

	if (piece.type === "lance" && !piece.promoted) {
		dirs.push({ row: fwd, col: 0 });
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
		for (let i = 1; i < 9; i++) {
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
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
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
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
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

/** 成れるかどうか */
export function canPromote(
	piece: Piece,
	from: Position,
	to: Position,
): boolean {
	if (piece.promoted) return false;
	if (piece.type === "king" || piece.type === "gold") return false;

	const zone = piece.player === "sente" ? [0, 1, 2] : [6, 7, 8];
	return zone.includes(from.row) || zone.includes(to.row);
}

/** 成りが必須かどうか */
export function mustPromote(piece: Piece, to: Position): boolean {
	if (piece.promoted) return false;

	if (piece.type === "pawn" || piece.type === "lance") {
		return piece.player === "sente" ? to.row === 0 : to.row === 8;
	}
	if (piece.type === "knight") {
		return piece.player === "sente" ? to.row <= 1 : to.row >= 7;
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

	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
			if (board[r][c] !== null) continue;

			// 行き場のない場所には打てない
			if (pieceType === "pawn" || pieceType === "lance") {
				if (player === "sente" && r === 0) continue;
				if (player === "gote" && r === 8) continue;
			}
			if (pieceType === "knight") {
				if (player === "sente" && r <= 1) continue;
				if (player === "gote" && r >= 7) continue;
			}

			// 二歩チェック
			if (pieceType === "pawn") {
				let hasPawnInCol = false;
				for (let rr = 0; rr < 9; rr++) {
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
	for (let r = 0; r < 9; r++) {
		for (let c = 0; c < 9; c++) {
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

// =====================
// 表示用ユーティリティ
// =====================

/** 持ち駒をソート・集計 */
export function summarizeCaptured(
	pieces: PieceType[],
): { type: PieceType; count: number }[] {
	const order: PieceType[] = [
		"rook",
		"bishop",
		"gold",
		"silver",
		"knight",
		"lance",
		"pawn",
	];
	const counts = new Map<PieceType, number>();
	for (const p of pieces) {
		counts.set(p, (counts.get(p) ?? 0) + 1);
	}
	return order
		.filter((t) => counts.has(t))
		.map((t) => ({ type: t, count: counts.get(t) ?? 0 }));
}

/** 駒種の漢字 (持ち駒表示用) */
export function pieceTypeToKanji(type: PieceType): string {
	return PIECE_KANJI[type];
}

// =====================
// サーバーサイド用: バリデーション & シリアライズ
// =====================

/** アクションが合法かどうかを検証する */
export function validateAction(
	state: GameState,
	action: GameAction,
): boolean {
	if (action.kind === "move") {
		const piece = state.board[action.from.row]?.[action.from.col];
		if (!piece || piece.player !== state.currentPlayer) return false;

		const legalMoves = getLegalMoves(state.board, action.from);
		const isLegal = legalMoves.some(
			(m) => m.row === action.to.row && m.col === action.to.col,
		);
		if (!isLegal) return false;

		if (action.promote) {
			if (!canPromote(piece, action.from, action.to)) return false;
		} else {
			if (mustPromote(piece, action.to)) return false;
		}
		return true;
	}

	// ドロップ
	if (!state.captured[state.currentPlayer].includes(action.piece))
		return false;
	const dropPositions = getDropPositions(
		state.board,
		action.piece,
		state.currentPlayer,
	);
	return dropPositions.some(
		(p) => p.row === action.to.row && p.col === action.to.col,
	);
}

/** GameState を DB 用にシリアライズ */
export function serializeGameState(state: GameState): {
	board: string;
	captured: string;
	currentPlayer: string;
	status: string;
	winner: string | null;
	moveCount: number;
} {
	return {
		board: JSON.stringify(state.board),
		captured: JSON.stringify(state.captured),
		currentPlayer: state.currentPlayer,
		status: state.status,
		winner: state.winner,
		moveCount: state.moveHistory.length,
	};
}

/** DB のデータから GameState を復元 */
export function deserializeGameState(data: {
	board: string;
	captured: string;
	currentPlayer: string;
	status: string;
	winner: string | null;
	moveCount: number;
}): GameState {
	return {
		board: JSON.parse(data.board) as Board,
		captured: JSON.parse(data.captured) as CapturedPieces,
		currentPlayer: data.currentPlayer as Player,
		status: data.status as GameState["status"],
		winner: (data.winner as Player) ?? null,
		moveHistory: [],
	};
}
