import { Link, useSearchParams } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, like, desc, sql } from "drizzle-orm";
import { userProfiles, personalBooks } from "~/db/schema";
import type { Route } from "./+types/books.users";
import { useState } from "react";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "ユーザー一覧 | 積読 2.0 | hidelberq" },
		{
			name: "description",
			content: "積読 2.0 のユーザーを探す",
		},
	];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const url = new URL(request.url);
	const search = url.searchParams.get("q") ?? "";

	// プロフィールが作成済みの公開ユーザーを取得
	const conditions = [eq(userProfiles.isPublic, true)];
	if (search) {
		conditions.push(like(userProfiles.displayName, `%${search}%`));
	}

	const profiles = await db
		.select({
			memberId: userProfiles.memberId,
			displayName: userProfiles.displayName,
			bio: userProfiles.bio,
			favoriteGenre: userProfiles.favoriteGenre,
			avatarEmoji: userProfiles.avatarEmoji,
		})
		.from(userProfiles)
		.where(
			sql`${conditions.reduce((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`))}`,
		)
		.orderBy(desc(userProfiles.createdAt))
		.limit(50);

	// 各ユーザーの公開本の数を取得
	const usersWithStats = await Promise.all(
		profiles.map(async (profile) => {
			const bookCount = await db
				.select({ count: sql<number>`count(*)` })
				.from(personalBooks)
				.where(
					sql`${personalBooks.memberId} = ${profile.memberId} AND ${personalBooks.visibility} = 'public'`,
				);
			return {
				...profile,
				bookCount: bookCount[0]?.count ?? 0,
			};
		}),
	);

	return { users: usersWithStats, search };
}

export default function BookUsers({ loaderData }: Route.ComponentProps) {
	const { users } = loaderData;
	const [searchParams, setSearchParams] = useSearchParams();
	const [localSearch, setLocalSearch] = useState(loaderData.search);

	const handleSearch = () => {
		const params = new URLSearchParams(searchParams);
		if (localSearch) {
			params.set("q", localSearch);
		} else {
			params.delete("q");
		}
		setSearchParams(params);
	};

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
				<div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-16">
				<Link
					to="/tsundoku_2_0"
					className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors mb-8"
				>
					&larr; 積読 2.0 に戻る
				</Link>

				<h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
					ユーザーを探す
				</h1>
				<p className="text-purple-200/60 mb-8">
					他のユーザーの本棚を見てみよう
				</p>

				{/* 検索 */}
				<div className="w-full max-w-2xl mb-8">
					<div className="flex gap-2">
						<input
							type="text"
							value={localSearch}
							onChange={(e) => setLocalSearch(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") handleSearch();
							}}
							placeholder="ユーザー名で検索..."
							className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-white placeholder:text-purple-300/40 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30"
						/>
						<button
							type="button"
							onClick={handleSearch}
							className="rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-purple-200 hover:bg-white/20 transition-colors"
						>
							検索
						</button>
					</div>
				</div>

				{/* ユーザーリスト */}
				<div className="w-full max-w-2xl">
					{users.length === 0 ? (
						<div className="text-center py-16 text-purple-300/40">
							{loaderData.search
								? "条件に一致するユーザーが見つかりません"
								: "まだユーザーがいません"}
						</div>
					) : (
						<div className="grid gap-3">
							{users.map((user) => (
								<Link
									key={user.memberId}
									to={`/tsundoku_2_0/user/${user.memberId}`}
									className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-fuchsia-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-fuchsia-500/10"
								>
									<span className="text-3xl flex-shrink-0">
										{user.avatarEmoji}
									</span>
									<div className="flex-1 min-w-0">
										<h3 className="font-semibold text-white truncate">
											{user.displayName}
										</h3>
										<div className="flex items-center gap-2 text-sm text-purple-300/60">
											{user.favoriteGenre && (
												<span className="truncate">
													{user.favoriteGenre}
												</span>
											)}
											{user.favoriteGenre &&
												user.bookCount > 0 && (
													<span>·</span>
												)}
											{user.bookCount > 0 && (
												<span className="flex-shrink-0">
													{user.bookCount}冊
												</span>
											)}
										</div>
										{user.bio && (
											<p className="text-xs text-purple-300/40 truncate mt-0.5">
												{user.bio}
											</p>
										)}
									</div>
									<span className="text-purple-300/30 flex-shrink-0">
										&rarr;
									</span>
								</Link>
							))}
						</div>
					)}
				</div>

				<p className="text-sm text-purple-300/30 mt-8">
					{users.length} ユーザー
				</p>
			</div>
		</div>
	);
}
