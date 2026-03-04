import { Link } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { userProfiles, personalBooks, authAccounts } from "~/db/schema";
import { GENRES, AVATAR_EMOJIS } from "~/books/types";
import { getAuthUser } from "~/auth";
import type { Route } from "./+types/books.settings";
import { useState, useEffect } from "react";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "プロフィール設定 | 積読 2.0 | hidelberq" },
		{
			name: "description",
			content: "プロフィールを編集",
		},
	];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const env = context.cloudflare.env;
	const db = drizzle(env.DB);
	const url = new URL(request.url);
	const memberId = url.searchParams.get("memberId") ?? "";

	// Google ログイン済みかチェック
	const authUser = await getAuthUser(request, db, env.SESSION_SECRET);

	if (!memberId) {
		return { profile: null, googleLinked: null, authUser };
	}

	// このユーザーの Google 連携状態を確認
	const [linkedAccount] = await db
		.select()
		.from(authAccounts)
		.where(
			and(
				eq(authAccounts.memberId, memberId),
				eq(authAccounts.provider, "google"),
			),
		)
		.limit(1);

	const googleLinked = linkedAccount
		? { email: linkedAccount.email, name: linkedAccount.name }
		: null;

	const [profile] = await db
		.select()
		.from(userProfiles)
		.where(eq(userProfiles.memberId, memberId))
		.limit(1);

	if (profile) {
		return {
			profile: {
				...profile,
				createdAt: profile.createdAt?.getTime() ?? Date.now(),
				updatedAt: profile.updatedAt?.getTime() ?? Date.now(),
			},
			googleLinked,
			authUser,
		};
	}

	// プロフィールがなければ既存データから表示名を取得
	const [existingBook] = await db
		.select({ memberName: personalBooks.memberName })
		.from(personalBooks)
		.where(eq(personalBooks.memberId, memberId))
		.limit(1);

	return {
		profile: null,
		existingName: existingBook?.memberName ?? null,
		googleLinked,
		authUser,
	};
}

export async function action({ request, context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const formData = await request.formData();
	const memberId = formData.get("memberId") as string;

	if (!memberId) {
		return { error: "ログインが必要です" };
	}

	const displayName = (formData.get("displayName") as string)?.trim();
	const bio = (formData.get("bio") as string)?.trim() || null;
	const favoriteGenre = (formData.get("favoriteGenre") as string) || null;
	const avatarEmoji = (formData.get("avatarEmoji") as string) || "📚";
	const isPublic = formData.get("isPublic") === "true";

	if (!displayName) {
		return { error: "表示名を入力してください" };
	}

	// 既存プロフィールを確認
	const [existing] = await db
		.select()
		.from(userProfiles)
		.where(eq(userProfiles.memberId, memberId))
		.limit(1);

	if (existing) {
		await db
			.update(userProfiles)
			.set({
				displayName,
				bio,
				favoriteGenre,
				avatarEmoji,
				isPublic,
			})
			.where(eq(userProfiles.memberId, memberId));
	} else {
		await db.insert(userProfiles).values({
			memberId,
			displayName,
			bio,
			favoriteGenre,
			avatarEmoji,
			isPublic,
		});
	}

	// personalBooks の memberName も同期
	await db
		.update(personalBooks)
		.set({ memberName: displayName })
		.where(eq(personalBooks.memberId, memberId));

	return { success: true };
}

export default function BookSettings({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const [memberId, setMemberId] = useState("");
	const [initialized, setInitialized] = useState(false);
	const [selectedEmoji, setSelectedEmoji] = useState(
		loaderData.profile?.avatarEmoji ?? "📚",
	);

	useEffect(() => {
		const id = localStorage.getItem("bookMemberId") || "";
		setMemberId(id);

		// memberId をクエリパラメータに設定（loaderにデータを渡すため）
		if (id && !new URLSearchParams(window.location.search).get("memberId")) {
			const url = new URL(window.location.href);
			url.searchParams.set("memberId", id);
			window.history.replaceState({}, "", url.toString());
			window.location.reload();
			return;
		}
		setInitialized(true);
	}, []);

	useEffect(() => {
		if (actionData?.success) {
			// 表示名を localStorage にも同期
			const form = document.querySelector("form");
			const nameInput = form?.querySelector<HTMLInputElement>(
				'input[name="displayName"]',
			);
			if (nameInput?.value) {
				localStorage.setItem("bookDisplayName", nameInput.value);
			}
		}
	}, [actionData]);

	if (!initialized) return null;

	const profile = loaderData.profile;
	const existingName =
		"existingName" in loaderData ? loaderData.existingName : null;

	const inputClass =
		"w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-purple-300/40 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30";
	const labelClass = "block text-sm font-medium text-purple-200 mb-1.5";

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-16">
				<Link
					to="/tsundoku_2_0"
					className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors mb-8"
				>
					&larr; 積読 2.0 に戻る
				</Link>

				<h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
					プロフィール設定
				</h1>
				<p className="text-purple-200/60 mb-8">
					他のユーザーに表示される情報を編集
				</p>

				{actionData?.success && (
					<div className="w-full max-w-md mb-4 rounded-xl bg-green-500/20 border border-green-500/30 px-4 py-3 text-sm text-green-300">
						プロフィールを保存しました
					</div>
				)}
				{actionData?.error && (
					<div className="w-full max-w-md mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
						{actionData.error}
					</div>
				)}

				<form
					method="post"
					className="w-full max-w-md rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 space-y-5"
				>
					<input type="hidden" name="memberId" value={memberId} />
					<input type="hidden" name="avatarEmoji" value={selectedEmoji} />

					{/* アバター絵文字 */}
					<div>
						<label className={labelClass}>アバター</label>
						<div className="flex items-center gap-4 mb-2">
							<span className="text-5xl">{selectedEmoji}</span>
							<span className="text-sm text-purple-300/50">
								タップして選択
							</span>
						</div>
						<div className="grid grid-cols-10 gap-1.5">
							{AVATAR_EMOJIS.map((emoji) => (
								<button
									key={emoji}
									type="button"
									onClick={() => setSelectedEmoji(emoji)}
									className={`text-xl p-1.5 rounded-lg transition-all ${
										selectedEmoji === emoji
											? "bg-fuchsia-500/30 border border-fuchsia-500/50 scale-110"
											: "bg-white/5 border border-white/10 hover:bg-white/10"
									}`}
								>
									{emoji}
								</button>
							))}
						</div>
					</div>

					{/* 表示名 */}
					<div>
						<label className={labelClass}>
							表示名<span className="text-red-400 ml-1">*</span>
						</label>
						<input
							type="text"
							name="displayName"
							required
							defaultValue={
								profile?.displayName ?? existingName ?? ""
							}
							placeholder="例: hidelberq"
							className={inputClass}
						/>
					</div>

					{/* 自己紹介 */}
					<div>
						<label className={labelClass}>自己紹介</label>
						<textarea
							name="bio"
							rows={3}
							maxLength={280}
							defaultValue={profile?.bio ?? ""}
							placeholder="どんな本が好きですか？（280文字以内）"
							className={`${inputClass} resize-none`}
						/>
					</div>

					{/* お気に入りジャンル */}
					<div>
						<label className={labelClass}>お気に入りジャンル</label>
						<select
							name="favoriteGenre"
							defaultValue={profile?.favoriteGenre ?? ""}
							className={`${inputClass} appearance-none`}
						>
							<option value="">選択してください</option>
							{GENRES.map((g) => (
								<option key={g} value={g}>
									{g}
								</option>
							))}
						</select>
					</div>

					{/* 公開設定 */}
					<div>
						<label className={labelClass}>プロフィールの公開</label>
						<div className="flex gap-3">
							<label className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 cursor-pointer hover:bg-white/10 transition-colors has-[:checked]:border-fuchsia-500/40 has-[:checked]:bg-fuchsia-500/10">
								<input
									type="radio"
									name="isPublic"
									value="true"
									defaultChecked={profile?.isPublic !== false}
									className="accent-fuchsia-500"
								/>
								<span className="text-sm text-purple-200">
									公開
								</span>
							</label>
							<label className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 cursor-pointer hover:bg-white/10 transition-colors has-[:checked]:border-fuchsia-500/40 has-[:checked]:bg-fuchsia-500/10">
								<input
									type="radio"
									name="isPublic"
									value="false"
									defaultChecked={profile?.isPublic === false}
									className="accent-fuchsia-500"
								/>
								<span className="text-sm text-purple-200">
									非公開
								</span>
							</label>
						</div>
						<p className="text-xs text-purple-300/40 mt-1.5">
							非公開にするとユーザー一覧に表示されません
						</p>
					</div>

					<button
						type="submit"
						className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 font-semibold text-white transition-all hover:from-fuchsia-500 hover:to-purple-500 hover:shadow-lg hover:shadow-fuchsia-500/20"
					>
						{profile ? "保存する" : "プロフィールを作成"}
					</button>
				</form>

				{/* Google アカウント連携 */}
				<div className="w-full max-w-md mt-6 rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 space-y-4">
					<h2 className="text-lg font-semibold text-white">
						アカウント連携
					</h2>

					{loaderData.googleLinked ? (
						<div className="rounded-xl bg-green-500/10 border border-green-500/20 px-4 py-3 space-y-1">
							<p className="text-sm font-medium text-green-300">
								Google アカウント連携済み
							</p>
							<p className="text-xs text-green-300/60">
								{loaderData.googleLinked.email}
							</p>
						</div>
					) : (
						<div className="space-y-3">
							<p className="text-sm text-purple-200/60">
								Google アカウントを連携すると、ブラウザが変わってもログインできます
							</p>
							<a
								href={`/auth/google?linkMemberId=${memberId}`}
								className="flex items-center justify-center gap-3 w-full rounded-xl bg-white px-6 py-3 font-semibold text-gray-700 transition-all hover:bg-gray-50 hover:shadow-lg hover:shadow-white/10 active:scale-[0.98]"
							>
								<svg
									viewBox="0 0 24 24"
									width="20"
									height="20"
									className="shrink-0"
								>
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
								Google アカウントを連携
							</a>
						</div>
					)}
				</div>

				{/* 公開プロフィールへのリンク */}
				{profile && (
					<Link
						to={`/tsundoku_2_0/user/${memberId}`}
						className="mt-6 text-sm text-fuchsia-300/70 hover:text-fuchsia-200 transition-colors"
					>
						公開プロフィールを見る &rarr;
					</Link>
				)}
			</div>
		</div>
	);
}
