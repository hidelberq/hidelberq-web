import type { Route } from "./+types/auth.google";
import { getGoogleAuthUrl } from "~/auth";

// Google OAuth リダイレクト
export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const url = new URL(request.url);

	// CSRF 対策用 state を生成
	const state = crypto.randomUUID();

	// 既存アカウント連携用の memberId をクエリパラメータから取得
	const linkMemberId = url.searchParams.get("linkMemberId");

	const origin = url.origin;
	const redirectUri = `${origin}/auth/google/callback`;

	const googleUrl = getGoogleAuthUrl({
		clientId: env.GOOGLE_CLIENT_ID,
		redirectUri,
		state,
	});

	const headers = new Headers({ Location: googleUrl });

	// state を Cookie に保存（CSRF 検証用）
	headers.append(
		"Set-Cookie",
		`auth_state=${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
	);

	// 連携用 memberId を Cookie に保存
	if (linkMemberId) {
		headers.append(
			"Set-Cookie",
			`auth_link_member=${linkMemberId}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
		);
	}

	return new Response(null, { status: 302, headers });
}
