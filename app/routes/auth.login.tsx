import { Link } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import type { Route } from "./+types/auth.login";
import { getAuthUser, type AuthUser } from "~/auth";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "ログイン | hidelberq" },
		{ name: "description", content: "Google アカウントでログイン" },
	];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const db = drizzle(env.DB);
	const url = new URL(request.url);
	const error = url.searchParams.get("error");

	const user = await getAuthUser(request, db, env.SESSION_SECRET);

	return { user, error };
}

const ERROR_MESSAGES: Record<string, string> = {
	oauth_denied: "ログインがキャンセルされました",
	invalid_request: "無効なリクエストです",
	invalid_state: "セッションが期限切れです。もう一度お試しください",
	callback_failed: "ログインに失敗しました。もう一度お試しください",
};

function GoogleIcon() {
	return (
		<svg viewBox="0 0 24 24" width="20" height="20" className="shrink-0">
			<path
				d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
				fill="#4285F4"
			/>
			<path
				d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
				fill="#34A853"
			/>
			<path
				d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
				fill="#FBBC05"
			/>
			<path
				d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
				fill="#EA4335"
			/>
		</svg>
	);
}

function LoggedInView({ user }: { user: AuthUser }) {
	return (
		<div className="w-full max-w-md">
			<div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 space-y-5">
				<div className="flex items-center gap-4">
					{user.avatarUrl ? (
						<img
							src={user.avatarUrl}
							alt=""
							className="w-14 h-14 rounded-full border-2 border-fuchsia-500/30"
							referrerPolicy="no-referrer"
						/>
					) : (
						<div className="w-14 h-14 rounded-full bg-fuchsia-500/20 border-2 border-fuchsia-500/30 flex items-center justify-center text-2xl">
							{user.name?.[0] ?? "?"}
						</div>
					)}
					<div className="min-w-0">
						<p className="text-lg font-semibold text-white truncate">
							{user.name ?? "ユーザー"}
						</p>
						{user.email && (
							<p className="text-sm text-purple-300/60 truncate">
								{user.email}
							</p>
						)}
					</div>
				</div>

				<div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3">
					<p className="text-sm text-green-300">
						Google アカウントでログイン中
					</p>
				</div>

				<div className="space-y-3">
					<Link
						to="/tsundoku_2_0"
						className="block w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 font-semibold text-white text-center transition-all hover:from-fuchsia-500 hover:to-purple-500 hover:shadow-lg hover:shadow-fuchsia-500/20"
					>
						積読 2.0 へ
					</Link>

					<Link
						to="/"
						className="block w-full rounded-xl bg-white/5 border border-white/10 px-6 py-3 font-semibold text-purple-200 text-center transition-all hover:bg-white/10"
					>
						トップページへ
					</Link>

					<a
						href="/auth/logout"
						className="block w-full rounded-xl bg-white/5 border border-red-500/20 px-6 py-3 text-sm text-red-300 text-center transition-all hover:bg-red-500/10"
					>
						ログアウト
					</a>
				</div>
			</div>
		</div>
	);
}

function LoginView({ error }: { error: string | null }) {
	return (
		<div className="w-full max-w-md space-y-6">
			{error && (
				<div className="rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
					{ERROR_MESSAGES[error] ?? "エラーが発生しました"}
				</div>
			)}

			<div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 space-y-5">
				<div className="text-center space-y-2">
					<p className="text-purple-200/70 text-sm">
						Google アカウントで簡単にログインできます
					</p>
				</div>

				<a
					href="/auth/google"
					className="flex items-center justify-center gap-3 w-full rounded-xl bg-white px-6 py-3.5 font-semibold text-gray-700 transition-all hover:bg-gray-50 hover:shadow-lg hover:shadow-white/10 active:scale-[0.98]"
				>
					<GoogleIcon />
					Google でログイン
				</a>

				<div className="relative">
					<div className="absolute inset-0 flex items-center">
						<div className="w-full border-t border-white/10" />
					</div>
					<div className="relative flex justify-center text-xs">
						<span className="bg-violet-950/80 px-3 text-purple-300/40">
							または
						</span>
					</div>
				</div>

				<p className="text-xs text-purple-300/40 text-center leading-relaxed">
					既に積読 2.0 をご利用の方は、プロフィール設定から
					Google アカウントを連携できます
				</p>
			</div>

			<div className="text-center">
				<Link
					to="/"
					className="text-sm text-purple-300/50 hover:text-purple-200 transition-colors"
				>
					&larr; トップページへ戻る
				</Link>
			</div>
		</div>
	);
}

export default function AuthLogin({ loaderData }: Route.ComponentProps) {
	const { user, error } = loaderData;

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
				<div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-indigo-500/15 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center justify-center min-h-dvh px-4 py-16">
				<div className="mb-8 text-center">
					<h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
						ログイン
					</h1>
					<p className="text-purple-200/50 text-sm">hidelberq.com</p>
				</div>

				{user ? <LoggedInView user={user} /> : <LoginView error={error} />}
			</div>
		</div>
	);
}
