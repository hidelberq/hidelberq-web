import { useState } from "react";
import { redirect, useFetcher, Link, data } from "react-router";
import type { Route } from "./+types/shogi";
import { drizzle } from "drizzle-orm/d1";
import { shogiGames } from "../db/schema";
import { eq } from "drizzle-orm";
import {
	createInitialGameState,
	serializeGameState,
} from "../shogi/logic";

function generateRoomCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字を除外
	let code = "";
	for (let i = 0; i < 4; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

function generatePlayerId(): string {
	return crypto.randomUUID();
}

function getPlayerId(request: Request): string | null {
	const cookie = request.headers.get("Cookie") ?? "";
	const match = cookie.match(/shogi_pid=([^;]+)/);
	return match ? match[1] : null;
}

function setPlayerIdCookie(playerId: string): string {
	return `shogi_pid=${playerId}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "将棋 | nw-union.net" },
		{ name: "description", content: "将棋で対戦しよう" },
	];
}

export async function action({ request, context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const formData = await request.formData();
	const intent = formData.get("intent");

	let playerId = getPlayerId(request);
	const headers: Record<string, string> = {};
	if (!playerId) {
		playerId = generatePlayerId();
		headers["Set-Cookie"] = setPlayerIdCookie(playerId);
	}

	if (intent === "create") {
		// ルーム作成
		const initialState = createInitialGameState();
		const serialized = serializeGameState(initialState);

		// ユニークなコードが見つかるまでリトライ
		let roomCode: string;
		for (let i = 0; i < 10; i++) {
			roomCode = generateRoomCode();
			const existing = await db
				.select({ id: shogiGames.id })
				.from(shogiGames)
				.where(eq(shogiGames.id, roomCode))
				.limit(1);
			if (existing.length === 0) {
				await db.insert(shogiGames).values({
					id: roomCode,
					board: serialized.board,
					captured: serialized.captured,
					currentPlayer: serialized.currentPlayer,
					status: "waiting",
					sentePlayerId: playerId,
				});
				return redirect(`/shogi/game/${roomCode}`, { headers });
			}
		}
		return data({ error: "ルーム作成に失敗しました。もう一度お試しください。" }, { status: 500, headers });
	}

	if (intent === "join") {
		const code = String(formData.get("code") ?? "").trim().toUpperCase();
		if (!code || code.length !== 4) {
			return data({ error: "4文字のルームコードを入力してください。" }, { status: 400, headers });
		}

		const [game] = await db
			.select()
			.from(shogiGames)
			.where(eq(shogiGames.id, code))
			.limit(1);

		if (!game) {
			return data({ error: "ルームが見つかりません。" }, { status: 404, headers });
		}

		if (game.sentePlayerId === playerId) {
			// 自分が作ったルームに再参加
			return redirect(`/shogi/game/${code}`, { headers });
		}

		if (game.gotePlayerId && game.gotePlayerId !== playerId) {
			return data({ error: "このルームは満員です。" }, { status: 400, headers });
		}

		if (!game.gotePlayerId) {
			await db
				.update(shogiGames)
				.set({ gotePlayerId: playerId, status: "playing" })
				.where(eq(shogiGames.id, code));
		}

		return redirect(`/shogi/game/${code}`, { headers });
	}

	return data({ error: "不正なリクエストです。" }, { status: 400, headers });
}

export default function ShogiLobby({ actionData }: Route.ComponentProps) {
	const [joinCode, setJoinCode] = useState("");
	const fetcher = useFetcher();
	const error =
		(fetcher.data as { error?: string } | undefined)?.error ??
		(actionData as { error?: string } | undefined)?.error;
	const isSubmitting = fetcher.state !== "idle";

	return (
		<div className="min-h-screen bg-black text-white flex flex-col">
			<header className="sticky top-0 z-10 bg-black/80 backdrop-blur-md border-b border-gray-800 px-4 py-3">
				<div className="max-w-lg mx-auto">
					<h1 className="text-lg font-bold text-center">将棋</h1>
				</div>
			</header>

			<main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-8">
				<div className="text-center mb-4">
					<h2 className="text-2xl font-bold mb-2">将棋対戦</h2>
					<p className="text-gray-400 text-sm">
						オンラインで対戦するか、ローカルで2人対戦できます
					</p>
				</div>

				{/* オンライン対戦 */}
				<div className="w-full max-w-sm space-y-4">
					<h3 className="text-sm font-bold text-amber-400 uppercase tracking-wider">
						オンライン対戦
					</h3>

					{/* ルーム作成 */}
					<fetcher.Form method="post">
						<input type="hidden" name="intent" value="create" />
						<button
							type="submit"
							disabled={isSubmitting}
							className="w-full px-4 py-3 bg-amber-800/40 hover:bg-amber-800/60 border border-amber-700/50 rounded-lg transition-colors text-sm font-bold disabled:opacity-50"
						>
							{isSubmitting ? "作成中..." : "対局を作成する"}
						</button>
					</fetcher.Form>

					{/* ルーム参加 */}
					<fetcher.Form method="post" className="flex gap-2">
						<input type="hidden" name="intent" value="join" />
						<input
							type="text"
							name="code"
							value={joinCode}
							onChange={(e) =>
								setJoinCode(e.target.value.toUpperCase().slice(0, 4))
							}
							placeholder="コード"
							maxLength={4}
							className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-center font-mono tracking-widest uppercase placeholder:text-gray-600 focus:outline-none focus:border-amber-700"
						/>
						<button
							type="submit"
							disabled={isSubmitting || joinCode.length !== 4}
							className="px-4 py-2 bg-sky-800/40 hover:bg-sky-800/60 border border-sky-700/50 rounded-lg transition-colors text-sm font-bold disabled:opacity-50"
						>
							参加
						</button>
					</fetcher.Form>

					{error && (
						<p className="text-red-400 text-xs text-center">{error}</p>
					)}
				</div>

				{/* 区切り線 */}
				<div className="w-full max-w-sm flex items-center gap-3">
					<div className="flex-1 border-t border-gray-800" />
					<span className="text-xs text-gray-600">または</span>
					<div className="flex-1 border-t border-gray-800" />
				</div>

				{/* ローカル対戦 */}
				<div className="w-full max-w-sm space-y-3">
					<h3 className="text-sm font-bold text-green-400 uppercase tracking-wider">
						ローカル対戦
					</h3>
					<Link
						to="/shogi/local"
						className="block w-full px-4 py-3 bg-green-900/30 hover:bg-green-900/50 border border-green-800/50 rounded-lg transition-colors text-sm font-bold text-center"
					>
						本将棋（9×9）
					</Link>
					<Link
						to="/shogi/minishogi/local"
						className="block w-full px-4 py-3 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-800/50 rounded-lg transition-colors text-sm font-bold text-center"
					>
						5五将棋（5×5）
					</Link>
				</div>
			</main>
		</div>
	);
}
