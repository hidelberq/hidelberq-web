import type { DrizzleD1Database } from "drizzle-orm/d1";
import { eq, lt } from "drizzle-orm";
import { sessions, googleAccounts } from "~/db/schema";

const SESSION_COOKIE_NAME = "session_id";
const SESSION_MAX_AGE_DAYS = 30;

export interface SessionUser {
	memberId: string;
	googleId: string;
	email: string;
	name: string | null;
	avatarUrl: string | null;
}

/**
 * リクエストの Cookie からセッションを取得し、ユーザー情報を返す
 */
export async function getSessionUser(
	request: Request,
	db: DrizzleD1Database,
): Promise<SessionUser | null> {
	const sessionId = getSessionIdFromCookie(request);
	if (!sessionId) return null;

	const [session] = await db
		.select()
		.from(sessions)
		.where(eq(sessions.id, sessionId))
		.limit(1);

	if (!session) return null;

	// 有効期限チェック
	if (session.expiresAt < new Date()) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
		return null;
	}

	// Google アカウント情報を取得
	const [account] = await db
		.select()
		.from(googleAccounts)
		.where(eq(googleAccounts.memberId, session.memberId))
		.limit(1);

	if (!account) return null;

	return {
		memberId: session.memberId,
		googleId: account.googleId,
		email: account.email,
		name: account.name,
		avatarUrl: account.avatarUrl,
	};
}

/**
 * 新しいセッションを作成し、Set-Cookie ヘッダーの値を返す
 */
export async function createSession(
	db: DrizzleD1Database,
	memberId: string,
): Promise<string> {
	const sessionId = crypto.randomUUID();
	const expiresAt = new Date(
		Date.now() + SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000,
	);

	await db.insert(sessions).values({
		id: sessionId,
		memberId,
		expiresAt,
	});

	return serializeSessionCookie(sessionId, SESSION_MAX_AGE_DAYS * 24 * 60 * 60);
}

/**
 * セッションを破棄し、Cookie 削除用の Set-Cookie ヘッダーの値を返す
 */
export async function destroySession(
	request: Request,
	db: DrizzleD1Database,
): Promise<string> {
	const sessionId = getSessionIdFromCookie(request);
	if (sessionId) {
		await db.delete(sessions).where(eq(sessions.id, sessionId));
	}
	return serializeSessionCookie("", 0);
}

/**
 * 期限切れセッションを削除
 */
export async function cleanExpiredSessions(
	db: DrizzleD1Database,
): Promise<void> {
	await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}

function getSessionIdFromCookie(request: Request): string | null {
	const cookie = request.headers.get("Cookie");
	if (!cookie) return null;

	const match = cookie
		.split(";")
		.map((c) => c.trim())
		.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));

	return match ? match.split("=")[1] : null;
}

function serializeSessionCookie(value: string, maxAge: number): string {
	return `${SESSION_COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}
