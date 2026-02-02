/** 駒の種類 */
export type PieceType =
	| "king"
	| "rook"
	| "bishop"
	| "gold"
	| "silver"
	| "knight"
	| "lance"
	| "pawn";

/** プレイヤー (先手/後手) */
export type Player = "sente" | "gote";

/** 盤上の駒 */
export interface Piece {
	type: PieceType;
	player: Player;
	promoted: boolean;
}

/** 盤上の位置 (0-indexed, row=0 が後手側) */
export interface Position {
	row: number;
	col: number;
}

/** 盤面: 9x9 の2次元配列 */
export type Board = (Piece | null)[][];

/** 持ち駒 */
export type CapturedPieces = Record<Player, PieceType[]>;

/** 通常の移動 */
export interface MoveAction {
	kind: "move";
	from: Position;
	to: Position;
	promote: boolean;
}

/** 持ち駒を打つ */
export interface DropAction {
	kind: "drop";
	piece: PieceType;
	to: Position;
}

export type GameAction = MoveAction | DropAction;

/** ゲームの状態 */
export interface GameState {
	board: Board;
	captured: CapturedPieces;
	currentPlayer: Player;
	moveHistory: GameAction[];
	status: "playing" | "check" | "checkmate" | "stalemate";
	winner: Player | null;
}

/** UI の選択状態 */
export type Selection =
	| { kind: "board"; position: Position }
	| { kind: "captured"; piece: PieceType; player: Player }
	| null;
