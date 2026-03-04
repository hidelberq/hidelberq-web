import type { Route } from "./+types/auth.google-callback";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { authAccounts } from "~/db/schema";
import {
	exchangeCodeForTokens,
	getGoogleUserInfo,
	createSession,
	setSessionCookie,
} from "~/auth";

function getCookieValue(request: Request, name: string): string | null {
	const cookie = request.headers.get("Cookie") ?? "";
	const match = cookie.match(new RegExp(`${name}=([^;]+)`));
	return match ? match[1] : null;
}

// Google OAuth コールバック
export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const db = drizzle(env.DB);
	const url = new URL(request.url);

	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	// エラーハンドリング
	if (error) {
		return new Response(null, {
			status: 302,
			headers: { Location: "/auth/login?error=oauth_denied" },
		});
	}

	if (!code || !state) {
		return new Response(null, {
			status: 302,
			headers: { Location: "/auth/login?error=invalid_request" },
		});
	}

	// CSRF state 検証
	const savedState = getCookieValue(request, "auth_state");
	if (!savedState || savedState !== state) {
		return new Response(null, {
			status: 302,
			headers: { Location: "/auth/login?error=invalid_state" },
		});
	}

	// 連携用 memberId を取得
	const linkMemberId = getCookieValue(request, "auth_link_member");

	const origin = url.origin;
	const redirectUri = `${origin}/auth/google/callback`;

	try {
		// アクセストークンを取得
		const tokens = await exchangeCodeForTokens({
			code,
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
			redirectUri,
		});

		// Google ユーザー情報を取得
		const googleUser = await getGoogleUserInfo(tokens.access_token);

		// 既存の authAccount を検索
		const [existingAccount] = await db
			.select()
			.from(authAccounts)
			.where(
				and(
					eq(authAccounts.provider, "google"),
					eq(authAccounts.providerAccountId, googleUser.id),
				),
			)
			.limit(1);

		let memberId: string;

		if (existingAccount) {
			// 既にリンク済み → そのまま使う
			memberId = existingAccount.memberId;

			// ユーザー情報を更新
			await db
				.update(authAccounts)
				.set({
					email: googleUser.email,
					name: googleUser.name,
					avatarUrl: googleUser.picture,
				})
				.where(eq(authAccounts.id, existingAccount.id));
		} else if (linkMemberId) {
			// 既存ユーザーとの連携
			memberId = linkMemberId;

			await db.insert(authAccounts).values({
				memberId,
				provider: "google",
				providerAccountId: googleUser.id,
				email: googleUser.email,
				name: googleUser.name,
				avatarUrl: googleUser.picture,
			});
		} else {
			// 新規ユーザー: 新しい memberId を生成
			memberId = crypto.randomUUID();

			await db.insert(authAccounts).values({
				memberId,
				provider: "google",
				providerAccountId: googleUser.id,
				email: googleUser.email,
				name: googleUser.name,
				avatarUrl: googleUser.picture,
			});
		}

		// セッション作成
		const { sessionId } = await createSession(db, memberId);
		const sessionCookie = await setSessionCookie(sessionId, env.SESSION_SECRET);

		// リダイレクト先の決定
		const redirectTo = linkMemberId
			? "/tsundoku_2_0/settings"
			: "/auth/login";

		const headers = new Headers({ Location: redirectTo });
		headers.append("Set-Cookie", sessionCookie);
		// state / link_member Cookie をクリア
		headers.append(
			"Set-Cookie",
			"auth_state=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
		);
		headers.append(
			"Set-Cookie",
			"auth_link_member=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
		);

		return new Response(null, { status: 302, headers });
	} catch (e) {
		console.error("Google OAuth callback error:", e);
		return new Response(null, {
			status: 302,
			headers: { Location: "/auth/login?error=callback_failed" },
		});
	}
}
