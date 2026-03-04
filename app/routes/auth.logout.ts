import type { Route } from "./+types/auth.logout";
import { drizzle } from "drizzle-orm/d1";
import {
	getSessionIdFromRequest,
	deleteSession,
	clearSessionCookie,
} from "~/auth";

// ログアウト
export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const db = drizzle(env.DB);

	const sessionId = await getSessionIdFromRequest(request, env.SESSION_SECRET);
	if (sessionId) {
		await deleteSession(db, sessionId);
	}

	const headers = new Headers({ Location: "/auth/login" });
	headers.append("Set-Cookie", clearSessionCookie());
	return new Response(null, { status: 302, headers });
}
