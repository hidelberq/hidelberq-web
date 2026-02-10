import { Link } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, desc } from "drizzle-orm";
import { userProfiles, personalBooks } from "~/db/schema";
import {
	BOOK_STATUSES,
	getStatusColor,
	formatRating,
	type BookStatus,
} from "~/books/types";
import type { Route } from "./+types/books.user";

export function meta({ data }: Route.MetaArgs) {
	const name = data?.profile?.displayName ?? "ユーザー";
	return [
		{ title: `${name}の本棚 | 積読 2.0 | hidelberq` },
		{
			name: "description",
			content: `${name}の公開積読リスト`,
		},
	];
}

export async function loader({ params, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const memberId = params.memberId;

	// プロフィール取得
	const [profile] = await db
		.select()
		.from(userProfiles)
		.where(eq(userProfiles.memberId, memberId))
		.limit(1);

	// 公開本を取得
	const publicBooks = await db
		.select()
		.from(personalBooks)
		.where(eq(personalBooks.memberId, memberId))
		.orderBy(desc(personalBooks.createdAt));

	// 公開本のみフィルタ（プロフィール非公開の場合は全て非表示）
	const visibleBooks =
		profile?.isPublic === false
			? []
			: publicBooks
					.filter((b) => b.visibility === "public")
					.map((b) => ({
						id: b.id,
						title: b.title,
						author: b.author,
						coverImageUrl: b.coverImageUrl,
						genre: b.genre,
						status: b.status,
						recommendation: b.recommendation,
						importance: b.importance,
					}));

	// プロフィールがない場合は personalBooks から名前を取得
	const displayName =
		profile?.displayName ?? publicBooks[0]?.memberName ?? "不明なユーザー";

	// 統計
	const publicBooksAll = publicBooks.filter(
		(b) => b.visibility === "public",
	);
	const stats = {
		total: publicBooksAll.length,
		completed: publicBooksAll.filter((b) => b.status === "completed").length,
		reading: publicBooksAll.filter((b) => b.status === "reading").length,
		interested: publicBooksAll.filter((b) => b.status === "interested")
			.length,
	};

	return {
		memberId,
		profile: profile
			? {
					displayName: profile.displayName,
					bio: profile.bio,
					favoriteGenre: profile.favoriteGenre,
					avatarEmoji: profile.avatarEmoji,
					isPublic: profile.isPublic,
				}
			: {
					displayName,
					bio: null,
					favoriteGenre: null,
					avatarEmoji: "📚",
					isPublic: true,
				},
		books: visibleBooks,
		stats,
	};
}

export default function BookUserProfile({
	loaderData,
}: Route.ComponentProps) {
	const { profile, books, stats, memberId } = loaderData;

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
				<div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-16">
				<Link
					to="/tsundoku_2_0/users"
					className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors mb-8"
				>
					&larr; ユーザー一覧に戻る
				</Link>

				{/* プロフィールカード */}
				<div className="w-full max-w-2xl rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 mb-8">
					<div className="flex items-start gap-4">
						<span className="text-5xl">{profile.avatarEmoji}</span>
						<div className="flex-1 min-w-0">
							<h1 className="text-2xl font-bold text-white mb-1">
								{profile.displayName}
							</h1>
							{profile.favoriteGenre && (
								<p className="text-sm text-fuchsia-300/70 mb-2">
									{profile.favoriteGenre}
								</p>
							)}
							{profile.bio && (
								<p className="text-sm text-purple-200/70 leading-relaxed">
									{profile.bio}
								</p>
							)}
						</div>
					</div>

					{/* 統計 */}
					{stats.total > 0 && (
						<div className="mt-5 grid grid-cols-4 gap-2">
							<StatCard
								label="公開本"
								value={stats.total}
								color="text-white"
							/>
							<StatCard
								label="読了"
								value={stats.completed}
								color="text-green-400"
							/>
							<StatCard
								label="途中"
								value={stats.reading}
								color="text-blue-400"
							/>
							<StatCard
								label="気になる"
								value={stats.interested}
								color="text-yellow-400"
							/>
						</div>
					)}
				</div>

				{/* 公開本棚 */}
				<div className="w-full max-w-2xl">
					<h2 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-4">
						公開本棚 ({books.length}冊)
					</h2>

					{profile.isPublic === false ? (
						<div className="text-center py-16 text-purple-300/40">
							このユーザーのプロフィールは非公開です
						</div>
					) : books.length === 0 ? (
						<div className="text-center py-16 text-purple-300/40">
							公開中の本はありません
						</div>
					) : (
						<div className="grid gap-3">
							{books.map((book) => (
								<Link
									key={book.id}
									to={`/tsundoku_2_0/my/book/${book.id}?memberId=${memberId}`}
									className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-fuchsia-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-fuchsia-500/10"
								>
									{book.coverImageUrl ? (
										<img
											src={book.coverImageUrl}
											alt=""
											className="w-12 h-16 object-cover rounded flex-shrink-0"
										/>
									) : (
										<div className="w-12 h-16 bg-white/10 rounded flex-shrink-0 flex items-center justify-center text-purple-300/30 text-xs">
											No img
										</div>
									)}
									<div className="flex-1 min-w-0">
										<h3 className="font-semibold text-white truncate">
											{book.title}
										</h3>
										<p className="text-sm text-purple-300/60 truncate">
											{book.author}
											{book.genre && ` / ${book.genre}`}
										</p>
										<div className="flex items-center gap-2 mt-1.5 flex-wrap">
											<span
												className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(book.status as BookStatus)}`}
											>
												{
													BOOK_STATUSES[
														book.status as BookStatus
													]
												}
											</span>
											{book.recommendation !== null && (
												<span className="text-xs text-yellow-400">
													{formatRating(
														book.recommendation,
													)}
												</span>
											)}
										</div>
									</div>
									<span className="text-purple-300/30 self-center">
										&rarr;
									</span>
								</Link>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function StatCard({
	label,
	value,
	color,
}: {
	label: string;
	value: number;
	color: string;
}) {
	return (
		<div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
			<p className={`text-xl font-bold ${color}`}>{value}</p>
			<p className="text-xs text-purple-300/50">{label}</p>
		</div>
	);
}
