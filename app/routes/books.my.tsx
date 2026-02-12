import { Link, useSearchParams } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, like, or, desc, asc, sql } from "drizzle-orm";
import { personalBooks } from "~/db/schema";
import {
	BOOK_STATUSES,
	GENRES,
	getStatusColor,
	formatRating,
	type BookStatus,
} from "~/books/types";
import type { Route } from "./+types/books.my";
import { useState, useEffect } from "react";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "マイ積読リスト | 積読 2.0 | hidelberq" },
		{
			name: "description",
			content: "個人の積読リストを管理",
		},
	];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const url = new URL(request.url);
	const memberId = url.searchParams.get("memberId") ?? "";
	const search = url.searchParams.get("q") ?? "";
	const statusFilter = url.searchParams.get("status") ?? "";
	const genreFilter = url.searchParams.get("genre") ?? "";
	const sort = url.searchParams.get("sort") ?? "newest";
	const visibilityFilter = url.searchParams.get("visibility") ?? "";

	if (!memberId) {
		return { books: [], stats: null, search, statusFilter, genreFilter, sort, visibilityFilter };
	}

	// 検索条件
	const conditions = [eq(personalBooks.memberId, memberId)];

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
	if (visibilityFilter) {
		conditions.push(eq(personalBooks.visibility, visibilityFilter));
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

	// 読書統計
	const allBooks = await db
		.select()
		.from(personalBooks)
		.where(eq(personalBooks.memberId, memberId));

	const stats = {
		total: allBooks.length,
		completed: allBooks.filter((b) => b.status === "completed").length,
		reading: allBooks.filter((b) => b.status === "reading").length,
		tsundoku: allBooks.filter((b) => b.status === "tsundoku").length,
		wishlist: allBooks.filter((b) => b.status === "wishlist").length,
		abandoned: allBooks.filter((b) => b.status === "abandoned").length,
		totalPages: allBooks
			.filter((b) => b.status === "completed" && b.pageCount)
			.reduce((sum, b) => sum + (b.pageCount ?? 0), 0),
	};

	return {
		books: bookList.map((b) => ({
			...b,
			createdAt: b.createdAt?.getTime() ?? Date.now(),
			updatedAt: b.updatedAt?.getTime() ?? Date.now(),
		})),
		stats,
		search,
		statusFilter,
		genreFilter,
		sort,
		visibilityFilter,
	};
}

export default function BooksMyList({ loaderData }: Route.ComponentProps) {
	const { books: bookList, stats } = loaderData;
	const [searchParams, setSearchParams] = useSearchParams();
	const [memberId, setMemberId] = useState("");
	const [localSearch, setLocalSearch] = useState(loaderData.search);
	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		const id = localStorage.getItem("bookMemberId") || "";
		setMemberId(id);

		// パラメータなしで戻ってきた場合、sessionStorage から復元
		const hasFilters = searchParams.get("sort") || searchParams.get("status") || searchParams.get("genre") || searchParams.get("q") || searchParams.get("visibility");
		if (id && !hasFilters) {
			const saved = sessionStorage.getItem("tsundoku_my_list_params");
			if (saved) {
				const params = new URLSearchParams(saved);
				params.set("memberId", id);
				setSearchParams(params, { replace: true });
				setInitialized(true);
				return;
			}
		}

		// memberId をクエリパラメータに設定
		if (id && !searchParams.get("memberId")) {
			const params = new URLSearchParams(searchParams);
			params.set("memberId", id);
			setSearchParams(params, { replace: true });
		}
		setInitialized(true);
	}, [searchParams, setSearchParams]);

	// フィルタ状態を sessionStorage に保存
	useEffect(() => {
		if (!initialized) return;
		const params = new URLSearchParams(searchParams);
		params.delete("memberId");
		const filterString = params.toString();
		if (filterString) {
			sessionStorage.setItem("tsundoku_my_list_params", filterString);
		}
	}, [searchParams, initialized]);

	const updateFilter = (key: string, value: string) => {
		const params = new URLSearchParams(searchParams);
		if (value) {
			params.set(key, value);
		} else {
			params.delete(key);
		}
		// memberId を保持
		if (memberId) params.set("memberId", memberId);
		setSearchParams(params);
	};

	const handleSearch = () => {
		updateFilter("q", localSearch);
	};

	if (!initialized) return null;

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
					マイ積読リスト
				</h1>
				<p className="text-purple-200/60 mb-8">
					あなたの積読を管理
				</p>

				{/* 読書統計 */}
				{stats && stats.total > 0 && (
					<div className="w-full max-w-2xl md:max-w-5xl mb-8 grid grid-cols-3 sm:grid-cols-6 gap-2">
						<StatCard label="合計" value={stats.total} color="text-white" />
						<StatCard label="読了" value={stats.completed} color="text-green-400" />
						<StatCard label="読書中" value={stats.reading} color="text-blue-400" />
						<StatCard label="積読中" value={stats.tsundoku} color="text-purple-400" />
						<StatCard label="ほしい" value={stats.wishlist} color="text-yellow-400" />
						<StatCard label="挫折" value={stats.abandoned} color="text-red-400" />
					</div>
				)}
				{stats && stats.totalPages > 0 && (
					<p className="text-sm text-purple-300/40 mb-6">
						読了ページ数: {stats.totalPages.toLocaleString()}p
					</p>
				)}

				{/* 検索・フィルタ */}
				<div className="w-full max-w-2xl md:max-w-5xl mb-6 space-y-3">
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
							value={loaderData.visibilityFilter}
							onChange={(e) => updateFilter("visibility", e.target.value)}
							className="rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-purple-200 focus:outline-none appearance-none"
						>
							<option value="">公開/非公開</option>
							<option value="public">公開のみ</option>
							<option value="private">非公開のみ</option>
						</select>
						<select
							value={loaderData.sort}
							onChange={(e) => updateFilter("sort", e.target.value)}
							className="rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-purple-200 focus:outline-none appearance-none md:hidden"
						>
							<option value="newest">新しい順</option>
							<option value="oldest">古い順</option>
							<option value="title">タイトル順</option>
							<option value="author">著者順</option>
							<option value="status">ステータス順</option>
							<option value="genre">ジャンル順</option>
							<option value="importance">重要度順</option>
							<option value="recommendation">おすすめ度順</option>
						</select>
					</div>
				</div>

				{/* 追加ボタン */}
				<div className="w-full max-w-2xl md:max-w-5xl mb-6 flex flex-wrap gap-3">
					<Link
						to="/tsundoku_2_0/my/add"
						className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-5 py-2.5 font-medium text-white transition-all hover:from-fuchsia-500 hover:to-purple-500 hover:shadow-lg hover:shadow-fuchsia-500/20"
					>
						<span className="text-lg">+</span> 本を追加
					</Link>
					<Link
						to="/tsundoku_2_0/my/photo-add"
						className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-fuchsia-600 px-5 py-2.5 font-medium text-white transition-all hover:from-cyan-500 hover:to-fuchsia-500 hover:shadow-lg hover:shadow-cyan-500/20"
					>
						📸 写真で一括追加
					</Link>
				</div>

				{/* 本のリスト */}
				<div className="w-full max-w-2xl md:hidden">
					{bookList.length === 0 ? (
						<div className="text-center py-16 text-purple-300/40">
							{stats?.total === 0
								? "まだ本が追加されていません"
								: "条件に一致する本がありません"}
						</div>
					) : loaderData.sort === "author" ? (
						<div className="grid gap-4">
							{(() => {
								type Book = (typeof bookList)[number];
								const grouped = new Map<string, Book[]>();
								for (const book of bookList) {
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
										<h2 className="text-sm font-medium text-fuchsia-300/80 mb-2 px-1">
											{author}
											<span className="text-purple-300/40 ml-2 font-normal">{authorBooks.length}冊</span>
										</h2>
										<div className="grid gap-2">
											{authorBooks.map((book) => (
												<Link
													key={book.id}
													to={`/tsundoku_2_0/my/book/${book.id}`}
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
															{book.visibility === "private" && (
																<span className="text-xs px-2 py-0.5 rounded-full text-purple-400 bg-purple-500/20">
																	非公開
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
							{bookList.map((book) => (
								<Link
									key={book.id}
									to={`/tsundoku_2_0/my/book/${book.id}`}
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
												{BOOK_STATUSES[book.status as BookStatus]}
											</span>
											{book.visibility === "private" && (
												<span className="text-xs px-2 py-0.5 rounded-full text-purple-400 bg-purple-500/20">
													非公開
												</span>
											)}
											{book.recommendation !== null && (
												<span className="text-xs text-yellow-400">
													{formatRating(book.recommendation)}
												</span>
											)}
											{book.importance !== null && (
												<span className="text-xs text-purple-300/50">
													重要度: {formatRating(book.importance)}
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

				{/* PC向けスプレッドシートビュー */}
				<div className="w-full max-w-5xl hidden md:block">
					{bookList.length === 0 ? (
						<div className="text-center py-16 text-purple-300/40">
							{stats?.total === 0
								? "まだ本が追加されていません"
								: "条件に一致する本がありません"}
						</div>
					) : (
						<div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
							<table className="w-full text-left">
								<thead>
									<tr className="border-b border-white/10 bg-white/5">
										<th className="px-4 py-3 text-xs font-medium text-purple-300/60 w-10" />
										<SortableHeader
											label="タイトル"
											sortKey="title"
											currentSort={loaderData.sort}
											onSort={(key) => updateFilter("sort", key)}
										/>
										<SortableHeader
											label="著者"
											sortKey="author"
											currentSort={loaderData.sort}
											onSort={(key) => updateFilter("sort", key)}
										/>
										<SortableHeader
											label="ジャンル"
											sortKey="genre"
											currentSort={loaderData.sort}
											onSort={(key) => updateFilter("sort", key)}
										/>
										<SortableHeader
											label="ステータス"
											sortKey="status"
											currentSort={loaderData.sort}
											onSort={(key) => updateFilter("sort", key)}
										/>
										<SortableHeader
											label="重要度"
											sortKey="importance"
											currentSort={loaderData.sort}
											onSort={(key) => updateFilter("sort", key)}
										/>
										<SortableHeader
											label="おすすめ"
											sortKey="recommendation"
											currentSort={loaderData.sort}
											onSort={(key) => updateFilter("sort", key)}
										/>
										<th className="px-3 py-3 text-xs font-medium text-purple-300/60">
											公開
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/5">
									{bookList.map((book) => (
										<tr
											key={book.id}
											className="hover:bg-white/5 transition-colors cursor-pointer group"
											onClick={() => {
												window.location.href = `/tsundoku_2_0/my/book/${book.id}`;
											}}
										>
											<td className="px-4 py-3">
												{book.coverImageUrl ? (
													<img
														src={book.coverImageUrl}
														alt=""
														className="w-8 h-10 object-cover rounded"
													/>
												) : (
													<div className="w-8 h-10 bg-white/10 rounded flex items-center justify-center text-purple-300/20 text-[8px]">
														No img
													</div>
												)}
											</td>
											<td className="px-3 py-3 text-sm text-white font-medium max-w-48 truncate group-hover:text-fuchsia-200 transition-colors">
												{book.title}
											</td>
											<td className="px-3 py-3 text-sm text-purple-300/70 max-w-32 truncate">
												{book.author}
											</td>
											<td className="px-3 py-3 text-xs text-purple-300/50">
												{book.genre || "-"}
											</td>
											<td className="px-3 py-3">
												<span
													className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${getStatusColor(book.status as BookStatus)}`}
												>
													{BOOK_STATUSES[book.status as BookStatus]}
												</span>
											</td>
											<td className="px-3 py-3 text-xs text-purple-300/50">
												{book.importance !== null
													? formatRating(book.importance)
													: "-"}
											</td>
											<td className="px-3 py-3 text-xs text-yellow-400">
												{book.recommendation !== null
													? formatRating(book.recommendation)
													: "-"}
											</td>
											<td className="px-3 py-3 text-xs text-purple-300/50">
												{book.visibility === "private" ? (
													<span className="text-purple-400">非公開</span>
												) : (
													"公開"
												)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</div>

				<p className="text-sm text-purple-300/30 mt-8">
					{bookList.length} 冊
				</p>
			</div>
		</div>
	);
}

function SortableHeader({
	label,
	sortKey,
	currentSort,
	onSort,
}: {
	label: string;
	sortKey: string;
	currentSort: string;
	onSort: (key: string) => void;
}) {
	const isActive = currentSort === sortKey;
	return (
		<th
			className="px-3 py-3 text-xs font-medium text-purple-300/60 cursor-pointer hover:text-purple-200 transition-colors select-none whitespace-nowrap"
			onClick={() => onSort(sortKey)}
		>
			{label}
			<span className={`ml-1 ${isActive ? "text-fuchsia-400" : "text-purple-300/20"}`}>
				{isActive ? "▼" : "▽"}
			</span>
		</th>
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
