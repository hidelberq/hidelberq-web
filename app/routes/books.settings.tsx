import { Link } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { userProfiles, personalBooks } from "~/db/schema";
import { GENRES, AVATAR_EMOJIS } from "~/books/types";
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
	const db = drizzle(context.cloudflare.env.DB);
	const url = new URL(request.url);
	const memberId = url.searchParams.get("memberId") ?? "";

	if (!memberId) {
		return { profile: null };
	}

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
