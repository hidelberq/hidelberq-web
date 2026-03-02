import type { Route } from "./+types/auth.google";
import {
	buildAuthorizationUrl,
	serializeOAuthStateCookie,
	serializeLinkMemberIdCookie,
} from "~/auth/google";

/**
 * GET /auth/google
 * Google OAuth 認可画面にリダイレクト
 * クエリパラメータ:
 *   - memberId: 既存の memberId をリンクする場合に指定
 *   - returnTo: ログイン後のリダイレクト先
 */
export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const memberId = url.searchParams.get("memberId") ?? "";
	const returnTo = url.searchParams.get("returnTo") ?? "/";

	const env = context.cloudflare.env;
	const origin = url.origin;
	const redirectUri = `${origin}/auth/callback`;

	// CSRF 防止用の state トークン
	const state = crypto.randomUUID();

	const authUrl = buildAuthorizationUrl({
		clientId: env.GOOGLE_CLIENT_ID,
		redirectUri,
		state,
	});

	const headers = new Headers();
	headers.set("Location", authUrl);
	// state を Cookie に保存（callback で検証）
	headers.append("Set-Cookie", serializeOAuthStateCookie(state));
	// リンク用 memberId を Cookie に保存
	if (memberId) {
		headers.append("Set-Cookie", serializeLinkMemberIdCookie(memberId));
	}
	// リダイレクト先を Cookie に保存
	headers.append(
		"Set-Cookie",
		`oauth_return_to=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
	);

	return new Response(null, { status: 302, headers });
}
