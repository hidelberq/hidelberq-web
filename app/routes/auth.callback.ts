import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import type { Route } from "./+types/auth.callback";
import {
	exchangeCodeForTokens,
	fetchUserInfo,
	getCookieValue,
	clearCookie,
} from "~/auth/google";
import { createSession } from "~/auth/session";
import { googleAccounts } from "~/db/schema";

/**
 * GET /auth/callback
 * Google OAuth コールバック処理
 */
export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	// ユーザーがキャンセルした場合
	if (error) {
		return new Response(null, {
			status: 302,
			headers: { Location: "/?auth_error=cancelled" },
		});
	}

	// 必須パラメータチェック
	if (!code || !state) {
		return new Response(null, {
			status: 302,
			headers: { Location: "/?auth_error=invalid_request" },
		});
	}

	// state の検証（CSRF 防止）
	const savedState = getCookieValue(request, "oauth_state");
	if (!savedState || savedState !== state) {
		return new Response(null, {
			status: 302,
			headers: { Location: "/?auth_error=invalid_state" },
		});
	}

	const env = context.cloudflare.env;
	const origin = url.origin;
	const redirectUri = `${origin}/auth/callback`;

	try {
		// 認可コードをトークンに交換
		const { accessToken } = await exchangeCodeForTokens({
			code,
			clientId: env.GOOGLE_CLIENT_ID,
			clientSecret: env.GOOGLE_CLIENT_SECRET,
			redirectUri,
		});

		// Google ユーザー情報を取得
		const userInfo = await fetchUserInfo(accessToken);

		const db = drizzle(env.DB);

		// 既存の Google アカウントを検索
		const [existingAccount] = await db
			.select()
			.from(googleAccounts)
			.where(eq(googleAccounts.googleId, userInfo.sub))
			.limit(1);

		let memberId: string;

		if (existingAccount) {
			// 既存アカウント: そのまま memberId を使う
			memberId = existingAccount.memberId;

			// プロフィール情報を更新
			await db
				.update(googleAccounts)
				.set({
					email: userInfo.email,
					name: userInfo.name,
					avatarUrl: userInfo.picture,
				})
				.where(eq(googleAccounts.googleId, userInfo.sub));
		} else {
			// 新規アカウント: リンク用 memberId があればそれを使う、なければ新規生成
			const linkMemberId = getCookieValue(request, "link_member_id");
			memberId = linkMemberId || crypto.randomUUID();

			await db.insert(googleAccounts).values({
				googleId: userInfo.sub,
				email: userInfo.email,
				name: userInfo.name,
				avatarUrl: userInfo.picture,
				memberId,
			});
		}

		// セッション作成
		const sessionCookie = await createSession(db, memberId);

		// リダイレクト先を決定
		const returnTo = decodeURIComponent(
			getCookieValue(request, "oauth_return_to") ?? "/",
		);

		const headers = new Headers();
		headers.set("Location", returnTo);
		headers.append("Set-Cookie", sessionCookie);
		// 一時的な Cookie を削除
		headers.append("Set-Cookie", clearCookie("oauth_state"));
		headers.append("Set-Cookie", clearCookie("link_member_id"));
		headers.append("Set-Cookie", clearCookie("oauth_return_to"));

		return new Response(null, { status: 302, headers });
	} catch (e) {
		console.error("OAuth callback error:", e);
		return new Response(null, {
			status: 302,
			headers: { Location: "/?auth_error=server_error" },
		});
	}
}
