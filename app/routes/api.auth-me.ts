import { drizzle } from "drizzle-orm/d1";
import type { Route } from "./+types/api.auth-me";
import { getSessionUser } from "~/auth/session";

/**
 * GET /api/auth/me
 * 現在のセッションユーザー情報を JSON で返す
 * クライアントが localStorage の memberId を同期するために使用
 */
export async function loader({ request, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const user = await getSessionUser(request, db);

	if (!user) {
		return Response.json({ authenticated: false });
	}

	return Response.json({
		authenticated: true,
		memberId: user.memberId,
		email: user.email,
		name: user.name,
		avatarUrl: user.avatarUrl,
	});
}
