import { eq, and, gt } from "drizzle-orm";
import type { DrizzleD1Database } from "drizzle-orm/d1";
import { sessions, authAccounts } from "~/db/schema";

const SESSION_COOKIE_NAME = "sid";
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30日

// --- Cookie 署名 (HMAC-SHA256) ---

async function hmacSign(value: string, secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const key = await crypto.subtle.importKey(
		"raw",
		encoder.encode(secret),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
	const sigHex = Array.from(new Uint8Array(signature))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	return `${value}.${sigHex}`;
}

async function hmacVerify(signed: string, secret: string): Promise<string | null> {
	const lastDot = signed.lastIndexOf(".");
	if (lastDot === -1) return null;
	const value = signed.substring(0, lastDot);
	const expected = await hmacSign(value, secret);
	if (expected !== signed) return null;
	return value;
}

// --- セッション CRUD ---

export async function createSession(
	db: DrizzleD1Database,
	memberId: string,
): Promise<{ sessionId: string; cookie: string }> {
	const sessionId = crypto.randomUUID();
	const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

	await db.insert(sessions).values({
		id: sessionId,
		memberId,
		expiresAt,
	});

	return { sessionId, cookie: sessionId };
}

export async function getSessionUser(
	db: DrizzleD1Database,
	sessionId: string,
): Promise<{ memberId: string } | null> {
	const [session] = await db
		.select()
		.from(sessions)
		.where(
			and(
				eq(sessions.id, sessionId),
				gt(sessions.expiresAt, new Date()),
			),
		)
		.limit(1);

	if (!session) return null;
	return { memberId: session.memberId };
}

export async function deleteSession(
	db: DrizzleD1Database,
	sessionId: string,
): Promise<void> {
	await db.delete(sessions).where(eq(sessions.id, sessionId));
}

// --- Cookie ヘルパー ---

export async function setSessionCookie(
	sessionId: string,
	secret: string,
): Promise<string> {
	const signed = await hmacSign(sessionId, secret);
	return `${SESSION_COOKIE_NAME}=${signed}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
}

export function clearSessionCookie(): string {
	return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`;
}

export async function getSessionIdFromRequest(
	request: Request,
	secret: string,
): Promise<string | null> {
	const cookie = request.headers.get("Cookie") ?? "";
	const match = cookie.match(new RegExp(`${SESSION_COOKIE_NAME}=([^;]+)`));
	if (!match) return null;
	return hmacVerify(match[1], secret);
}

// --- 認証済みユーザー取得 ---

export interface AuthUser {
	memberId: string;
	email: string | null;
	name: string | null;
	avatarUrl: string | null;
	provider: string;
}

export async function getAuthUser(
	request: Request,
	db: DrizzleD1Database,
	secret: string,
): Promise<AuthUser | null> {
	const sessionId = await getSessionIdFromRequest(request, secret);
	if (!sessionId) return null;

	const session = await getSessionUser(db, sessionId);
	if (!session) return null;

	const [account] = await db
		.select()
		.from(authAccounts)
		.where(eq(authAccounts.memberId, session.memberId))
		.limit(1);

	if (!account) return null;

	return {
		memberId: session.memberId,
		email: account.email,
		name: account.name,
		avatarUrl: account.avatarUrl,
		provider: account.provider,
	};
}

// --- Google OAuth ヘルパー ---

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

export function getGoogleAuthUrl(params: {
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

export async function exchangeCodeForTokens(params: {
	code: string;
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}): Promise<{ access_token: string; id_token: string }> {
	const res = await fetch(GOOGLE_TOKEN_URL, {
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

	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Google token exchange failed: ${res.status} ${text}`);
	}

	return res.json() as Promise<{ access_token: string; id_token: string }>;
}

export interface GoogleUserInfo {
	id: string;
	email: string;
	name: string;
	picture: string;
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
	const res = await fetch(GOOGLE_USERINFO_URL, {
		headers: { Authorization: `Bearer ${accessToken}` },
	});

	if (!res.ok) {
		throw new Error(`Google userinfo failed: ${res.status}`);
	}

	return res.json() as Promise<GoogleUserInfo>;
}
