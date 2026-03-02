/**
 * Google OAuth 2.0 Authorization Code Flow のヘルパー
 * Cloudflare Workers (Edge Runtime) で動作するよう Web API のみ使用
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export interface GoogleUserInfo {
	sub: string; // Google の一意な ID
	email: string;
	name: string;
	picture: string;
}

/**
 * Google OAuth の認可 URL を生成
 */
export function buildAuthorizationUrl(params: {
	clientId: string;
	redirectUri: string;
	state: string;
}): string {
	const url = new URL(GOOGLE_AUTH_URL);
	url.searchParams.set("client_id", params.clientId);
	url.searchParams.set("redirect_uri", params.redirectUri);
	url.searchParams.set("response_type", "code");
	url.searchParams.set("scope", "openid email profile");
	url.searchParams.set("state", params.state);
	url.searchParams.set("access_type", "online");
	url.searchParams.set("prompt", "select_account");
	return url.toString();
}

/**
 * 認可コードをアクセストークンに交換
 */
export async function exchangeCodeForTokens(params: {
	code: string;
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}): Promise<{ accessToken: string }> {
	const response = await fetch(GOOGLE_TOKEN_URL, {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			code: params.code,
			client_id: params.clientId,
			client_secret: params.clientSecret,
			redirect_uri: params.redirectUri,
			grant_type: "authorization_code",
		}),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`トークン交換に失敗: ${response.status} ${body}`);
	}

	const data = (await response.json()) as { access_token: string };
	return { accessToken: data.access_token };
}

/**
 * アクセストークンでユーザー情報を取得
 */
export async function fetchUserInfo(
	accessToken: string,
): Promise<GoogleUserInfo> {
	const response = await fetch(GOOGLE_USERINFO_URL, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!response.ok) {
		throw new Error(`ユーザー情報取得に失敗: ${response.status}`);
	}

	return (await response.json()) as GoogleUserInfo;
}

/**
 * OAuth state パラメータ用の Cookie を生成
 */
export function serializeOAuthStateCookie(state: string): string {
	return `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

/**
 * リンク用 memberId を一時保存する Cookie を生成
 */
export function serializeLinkMemberIdCookie(memberId: string): string {
	return `link_member_id=${memberId}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`;
}

/**
 * Cookie から値を読み取るヘルパー
 */
export function getCookieValue(
	request: Request,
	name: string,
): string | null {
	const cookie = request.headers.get("Cookie");
	if (!cookie) return null;

	const match = cookie
		.split(";")
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${name}=`));

	return match ? match.split("=")[1] : null;
}

/**
 * Cookie を削除する Set-Cookie ヘッダー値を生成
 */
export function clearCookie(name: string): string {
	return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
