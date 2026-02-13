import type { Route } from "./+types/api.suno-callback";

/**
 * Suno API コールバック受信エンドポイント
 * ポーリング方式で結果を取得するため、ここでは受信のみ行い処理はしない
 */
export async function action({ request }: Route.ActionArgs) {
	const body = await request.text();
	console.log("Suno callback received:", body.slice(0, 500));
	return new Response("ok", { status: 200 });
}
