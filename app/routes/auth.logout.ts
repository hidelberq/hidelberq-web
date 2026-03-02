import { drizzle } from "drizzle-orm/d1";
import type { Route } from "./+types/auth.logout";
import { destroySession } from "~/auth/session";

/**
 * POST /auth/logout
 * セッションを破棄してログアウト
 */
export async function action({ request, context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const sessionCookie = await destroySession(request, db);

	const formData = await request.formData();
	const returnTo = (formData.get("returnTo") as string) || "/";

	return new Response(null, {
		status: 302,
		headers: {
			Location: returnTo,
			"Set-Cookie": sessionCookie,
		},
	});
}
