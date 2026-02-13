import { Link, useSearchParams } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, like, or, desc, asc, sql } from "drizzle-orm";
import { userProfiles, personalBooks } from "~/db/schema";
import {
	BOOK_STATUSES,
	GENRES,
	getStatusColor,
	formatRating,
	type BookStatus,
} from "~/books/types";
import type { Route } from "./+types/books.user";
import { useState } from "react";

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

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const memberId = params.memberId;
	const url = new URL(request.url);
	const search = url.searchParams.get("q") ?? "";
	const statusFilter = url.searchParams.get("status") ?? "";
	const genreFilter = url.searchParams.get("genre") ?? "";
	const sort = url.searchParams.get("sort") ?? "newest";

	// プロフィール取得
	const [profile] = await db
		.select()
		.from(userProfiles)
		.where(eq(userProfiles.memberId, memberId))
		.limit(1);

	// プロフィール非公開の場合は早期リターン
	if (profile?.isPublic === false) {
		return {
			memberId,
			profile: {
				displayName: profile.displayName,
				bio: profile.bio,
				favoriteGenre: profile.favoriteGenre,
				avatarEmoji: profile.avatarEmoji,
				isPublic: profile.isPublic,
			},
			books: [],
			stats: { total: 0, completed: 0, reading: 0, tsundoku: 0 },
			search,
			statusFilter,
			genreFilter,
			sort,
		};
	}

	// 検索条件
	const conditions = [
		eq(personalBooks.memberId, memberId),
		eq(personalBooks.visibility, "public"),
	];

	if (search) {
		conditions.push(
			or(
				like(personalBooks.title, `%${search}%`),
				like(personalBooks.author, `%${search}%`),
			)!,
		);
	}
	if (statusFilter) {
		conditions.push(eq(personalBooks.status, statusFilter));
	}
	if (genreFilter) {
		conditions.push(eq(personalBooks.genre, genreFilter));
	}

	// ソート
	let orderBy;
	switch (sort) {
		case "title":
			orderBy = asc(personalBooks.title);
			break;
		case "oldest":
			orderBy = asc(personalBooks.createdAt);
			break;
		case "author":
			orderBy = asc(personalBooks.author);
			break;
		case "status":
			orderBy = asc(personalBooks.status);
			break;
		case "genre":
			orderBy = asc(personalBooks.genre);
			break;
		case "importance":
			orderBy = desc(personalBooks.importance);
			break;
		case "recommendation":
			orderBy = desc(personalBooks.recommendation);
			break;
		default:
			orderBy = desc(personalBooks.createdAt);
	}

	const bookList = await db
		.select()
		.from(personalBooks)
		.where(sql`${conditions.reduce((acc, c, i) => (i === 0 ? c : sql`${acc} AND ${c}`))}`)
		.orderBy(orderBy);

	// 統計（フィルタなしの公開本全体）
	const allPublicBooks = await db
		.select()
		.from(personalBooks)
		.where(
			sql`${eq(personalBooks.memberId, memberId)} AND ${eq(personalBooks.visibility, "public")}`,
		);

	const stats = {
		total: allPublicBooks.length,
		completed: allPublicBooks.filter((b) => b.status === "completed").length,
		reading: allPublicBooks.filter((b) => b.status === "reading").length,
		tsundoku: allPublicBooks.filter((b) => b.status === "tsundoku").length,
	};

	// プロフィールがない場合は personalBooks から名前を取得
	const displayName =
		profile?.displayName ?? bookList[0]?.memberName ?? "不明なユーザー";

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
		books: bookList.map((b) => ({
			id: b.id,
			title: b.title,
			author: b.author,
			coverImageUrl: b.coverImageUrl,
			genre: b.genre,
			status: b.status,
			recommendation: b.recommendation,
			importance: b.importance,
		})),
		stats,
		search,
		statusFilter,
		genreFilter,
		sort,
	};
}

export default function BookUserProfile({
	loaderData,
}: Route.ComponentProps) {
	const { profile, books, stats, memberId } = loaderData;
	const [searchParams, setSearchParams] = useSearchParams();
	const [localSearch, setLocalSearch] = useState(loaderData.search);

	const updateFilter = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams);
		if (value) {
			params.set(key, value);
		} else {
			params.delete(key);
		}
		setSearchParams(params);
	};

	const handleSearch = () => {
		updateFilter("q", localSearch);
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
								label="読書中"
								value={stats.reading}
								color="text-blue-400"
							/>
							<StatCard
								label="積読中"
								value={stats.tsundoku}
								color="text-purple-400"
							/>
						</div>
					)}
				</div>

				{/* 検索・フィルタ */}
				{profile.isPublic !== false && stats.total > 0 && (
					<div className="w-full max-w-2xl mb-6 space-y-3">
						<div className="flex gap-2">
							<input
								type="text"
								value={localSearch}
								onChange={(e) => setLocalSearch(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") handleSearch();
								}}
								placeholder="タイトル・著者名で検索..."
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
						<div className="flex flex-wrap gap-2">
							<select
								value={loaderData.statusFilter}
								onChange={(e) => updateFilter("status", e.target.value)}
								className="rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-purple-200 focus:outline-none appearance-none"
							>
								<option value="">全ステータス</option>
								{(Object.entries(BOOK_STATUSES) as [BookStatus, string][]).map(
									([key, label]) => (
										<option key={key} value={key}>
											{label}
										</option>
									),
								)}
							</select>
							<select
								value={loaderData.genreFilter}
								onChange={(e) => updateFilter("genre", e.target.value)}
								className="rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-purple-200 focus:outline-none appearance-none"
							>
								<option value="">全ジャンル</option>
								{GENRES.map((g) => (
									<option key={g} value={g}>
										{g}
									</option>
								))}
							</select>
							<select
								value={loaderData.sort === "author" ? "newest" : loaderData.sort}
								onChange={(e) => updateFilter("sort", e.target.value)}
								className="rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-purple-200 focus:outline-none appearance-none"
							>
								<option value="newest">新しい順</option>
								<option value="oldest">古い順</option>
								<option value="title">タイトル順</option>
								<option value="status">ステータス順</option>
								<option value="genre">ジャンル順</option>
								<option value="importance">重要度順</option>
								<option value="recommendation">おすすめ度順</option>
							</select>
							<button
								type="button"
								onClick={() => updateFilter("sort", loaderData.sort === "author" ? "newest" : "author")}
								className={`rounded-lg px-3 py-1.5 text-sm transition-colors ${
									loaderData.sort === "author"
										? "bg-fuchsia-500/30 border border-fuchsia-400/50 text-fuchsia-200"
										: "bg-white/10 border border-white/20 text-purple-200 hover:bg-white/20"
								}`}
							>
								著者順
							</button>
						</div>
					</div>
				)}

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
							{stats.total === 0
								? "公開中の本はありません"
								: "条件に一致する本がありません"}
						</div>
					) : loaderData.sort === "author" ? (
						<div className="grid gap-4">
							{(() => {
								type Book = (typeof books)[number];
								const grouped = new Map<string, Book[]>();
								for (const book of books) {
									const key = book.author || "著者不明";
									const arr = grouped.get(key);
									if (arr) {
										arr.push(book);
									} else {
										grouped.set(key, [book]);
									}
								}
								return Array.from(grouped.entries()).map(([author, authorBooks]) => (
									<div key={author}>
										<h3 className="text-sm font-medium text-fuchsia-300/80 mb-2 px-1">
											{author}
											<span className="text-purple-300/40 ml-2 font-normal">{authorBooks.length}冊</span>
										</h3>
										<div className="grid gap-2">
											{authorBooks.map((book) => (
												<Link
													key={book.id}
													to={`/tsundoku_2_0/my/book/${book.id}?memberId=${memberId}`}
													className="flex gap-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3 transition-all duration-300 hover:border-fuchsia-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-fuchsia-500/10 overflow-hidden"
												>
													<div className="flex-1 min-w-0">
														<h3 className="font-semibold text-white truncate text-sm">
															{book.title}
														</h3>
														<div className="flex items-center gap-2 mt-1 flex-wrap">
															<span
																className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(book.status as BookStatus)}`}
															>
																{BOOK_STATUSES[book.status as BookStatus]}
															</span>
															{book.genre && (
																<span className="text-xs text-purple-300/40">
																	{book.genre}
																</span>
															)}
															{book.recommendation !== null && (
																<span className="text-xs text-yellow-400">
																	{formatRating(book.recommendation)}
																</span>
															)}
														</div>
													</div>
													<span className="text-purple-300/30 self-center text-sm">
														&rarr;
													</span>
												</Link>
											))}
										</div>
									</div>
								));
							})()}
						</div>
					) : (
						<div className="grid gap-3">
							{books.map((book) => (
								<Link
									key={book.id}
									to={`/tsundoku_2_0/my/book/${book.id}?memberId=${memberId}`}
									className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-fuchsia-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-fuchsia-500/10 overflow-hidden"
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
