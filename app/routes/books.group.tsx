import { Link, useSearchParams } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, like, or, desc, asc, sql } from "drizzle-orm";
import {
	bookGroups,
	bookGroupMembers,
	books,
	bookMemberStatuses,
} from "~/db/schema";
import {
	BOOK_STATUSES,
	GENRES,
	getStatusColor,
	formatRating,
	type BookStatus,
} from "~/books/types";
import type { Route } from "./+types/books.group";
import { useState, useEffect } from "react";

export function meta({ data }: Route.MetaArgs) {
	return [
		{ title: `${data?.group?.name ?? "グループ"} | 積読 2.0 | hidelberq` },
	];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const url = new URL(request.url);
	const search = url.searchParams.get("q") ?? "";
	const statusFilter = url.searchParams.get("status") ?? "";
	const genreFilter = url.searchParams.get("genre") ?? "";
	const sort = url.searchParams.get("sort") ?? "newest";

	const [group] = await db
		.select()
		.from(bookGroups)
		.where(eq(bookGroups.groupCode, params.groupCode))
		.limit(1);

	if (!group) {
		throw new Response("グループが見つかりません", { status: 404 });
	}

	// メンバー一覧
	const members = await db
		.select()
		.from(bookGroupMembers)
		.where(eq(bookGroupMembers.groupId, group.id));

	// 本の検索条件
	const conditions = [eq(books.groupId, group.id)];

	if (search) {
		conditions.push(
			or(
				like(books.title, `%${search}%`),
				like(books.author, `%${search}%`),
			)!,
		);
	}
	if (genreFilter) {
		conditions.push(eq(books.genre, genreFilter));
	}

	// ソート
	let orderBy;
	switch (sort) {
		case "title":
			orderBy = asc(books.title);
			break;
		case "oldest":
			orderBy = asc(books.createdAt);
			break;
		case "author":
			orderBy = asc(books.author);
			break;
		case "genre":
			orderBy = asc(books.genre);
			break;
		default:
			orderBy = desc(books.createdAt);
	}

	const bookList = await db
		.select()
		.from(books)
		.where(and(...conditions))
		.orderBy(orderBy);

	// 各本のステータス情報を取得
	const bookIds = bookList.map((b) => b.id);
	let allStatuses: Array<{
		id: number;
		bookId: number;
		memberId: string;
		memberName: string;
		status: string;
		difficulty: number | null;
		importance: number | null;
		recommendation: number | null;
		memo: string | null;
		startedAt: string | null;
		completedAt: string | null;
		updatedAt: Date | null;
	}> = [];

	if (bookIds.length > 0) {
		// D1のバインドパラメータ上限(100)を超える場合があるためサブクエリを使用
		allStatuses = await db
			.select()
			.from(bookMemberStatuses)
			.where(
				sql`${bookMemberStatuses.bookId} IN (SELECT ${books.id} FROM ${books} WHERE ${books.groupId} = ${group.id})`,
			);
	}

	// ステータスフィルタ（メンバーIDはクライアント側で処理）
	const booksWithStatuses = bookList.map((book) => {
		const statuses = allStatuses.filter((s) => s.bookId === book.id);
		const avgRecommendation =
			statuses.filter((s) => s.recommendation !== null).length > 0
				? statuses.reduce(
						(sum, s) => sum + (s.recommendation ?? 0),
						0,
					) /
					statuses.filter((s) => s.recommendation !== null).length
				: null;

		return {
			...book,
			createdAt: book.createdAt?.getTime() ?? Date.now(),
			updatedAt: book.updatedAt?.getTime() ?? Date.now(),
			statuses: statuses.map((s) => ({
				...s,
				updatedAt: s.updatedAt?.getTime() ?? Date.now(),
			})),
			avgRecommendation,
		};
	});

	// おすすめ度ソート
	let finalBooks = booksWithStatuses;
	if (sort === "recommendation") {
		finalBooks = [...booksWithStatuses].sort((a, b) => {
			if (a.avgRecommendation === null && b.avgRecommendation === null)
				return 0;
			if (a.avgRecommendation === null) return 1;
			if (b.avgRecommendation === null) return -1;
			return b.avgRecommendation - a.avgRecommendation;
		});
	}

	return {
		group: {
			id: group.id,
			name: group.name,
			groupCode: group.groupCode,
			description: group.description,
		},
		members: members.map((m) => ({
			memberId: m.memberId,
			displayName: m.displayName,
		})),
		books: finalBooks,
		search,
		statusFilter,
		genreFilter,
		sort,
	};
}

export default function BooksGroup({ loaderData }: Route.ComponentProps) {
	const { group, members, books: bookList } = loaderData;
	const [searchParams, setSearchParams] = useSearchParams();
	const [memberId, setMemberId] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [localSearch, setLocalSearch] = useState(loaderData.search);
	const [showMembers, setShowMembers] = useState(false);
	const [copied, setCopied] = useState(false);

	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		const id = localStorage.getItem("bookMemberId") || "";
		setMemberId(id);
		const name = localStorage.getItem("bookDisplayName") || "";
		setDisplayName(name);

		// グループ名をローカルに保存
		const groups = JSON.parse(
			localStorage.getItem("bookGroups") || "[]",
		) as Array<{ code: string; name: string }>;
		const idx = groups.findIndex((g) => g.code === group.groupCode);
		if (idx >= 0) {
			groups[idx].name = group.name;
		} else {
			groups.push({ code: group.groupCode, name: group.name });
		}
		localStorage.setItem("bookGroups", JSON.stringify(groups));

		// パラメータなしで戻ってきた場合、sessionStorage から復元
		const storageKey = `tsundoku_group_list_params_${group.groupCode}`;
		const hasFilters = searchParams.get("sort") || searchParams.get("status") || searchParams.get("genre") || searchParams.get("q");
		if (!hasFilters) {
			const saved = sessionStorage.getItem(storageKey);
			if (saved) {
				const params = new URLSearchParams(saved);
				setSearchParams(params, { replace: true });
				setInitialized(true);
				return;
			}
		}
		setInitialized(true);
	}, [group.groupCode, group.name, searchParams, setSearchParams]);

	// フィルタ状態を sessionStorage に保存
	useEffect(() => {
		if (!initialized) return;
		const params = new URLSearchParams(searchParams);
		const filterString = params.toString();
		if (filterString) {
			sessionStorage.setItem(`tsundoku_group_list_params_${group.groupCode}`, filterString);
		}
	}, [searchParams, initialized, group.groupCode]);

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

	// ステータスでフィルタ（クライアント側）
	const statusFilter = loaderData.statusFilter as BookStatus | "";
	const filteredBooks = statusFilter
		? bookList.filter((book) =>
				book.statuses.some(
					(s) =>
						(s.memberId === memberId || (displayName && s.memberName === displayName)) && s.status === statusFilter,
				),
			)
		: bookList;

	const copyInviteCode = async () => {
		await navigator.clipboard.writeText(group.groupCode);
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const isMember = members.some((m) => m.memberId === memberId || (displayName && m.displayName === displayName));

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

				{/* ヘッダー */}
				<div className="text-center mb-8 w-full max-w-2xl md:max-w-5xl">
					<h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent break-all">
						{group.name}
					</h1>
					{group.description && (
						<p className="text-purple-200/60 mb-3 break-all">
							{group.description}
						</p>
					)}
					<div className="flex items-center justify-center gap-3">
						<button
							type="button"
							onClick={copyInviteCode}
							className="text-sm text-purple-300/60 font-mono bg-white/5 border border-white/10 rounded-lg px-3 py-1 hover:bg-white/10 transition-colors"
						>
							{copied
								? "コピーしました!"
								: `招待コード: ${group.groupCode}`}
						</button>
						<button
							type="button"
							onClick={() => setShowMembers(!showMembers)}
							className="text-sm text-purple-300/60 bg-white/5 border border-white/10 rounded-lg px-3 py-1 hover:bg-white/10 transition-colors"
						>
							メンバー ({members.length})
						</button>
					</div>
				</div>

				{/* メンバー一覧 */}
				{showMembers && (
					<div className="w-full max-w-2xl md:max-w-5xl mb-6 rounded-xl bg-white/5 border border-white/10 p-4">
						<div className="flex flex-wrap gap-2">
							{members.map((m) => (
								<span
									key={m.memberId}
									className={`text-sm px-3 py-1 rounded-full border ${
										m.memberId === memberId
											? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-200"
											: "border-white/10 bg-white/5 text-purple-200/80"
									}`}
								>
									{m.displayName}
									{m.memberId === memberId && " (あなた)"}
								</span>
							))}
						</div>
					</div>
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
							onChange={(e) =>
								updateFilter("status", e.target.value)
							}
							className="rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-purple-200 focus:outline-none appearance-none"
						>
							<option value="">全ステータス</option>
							{(
								Object.entries(BOOK_STATUSES) as [
									BookStatus,
									string,
								][]
							).map(([key, label]) => (
								<option key={key} value={key}>
									{label}
								</option>
							))}
						</select>
						<select
							value={loaderData.genreFilter}
							onChange={(e) =>
								updateFilter("genre", e.target.value)
							}
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
							value={loaderData.sort}
							onChange={(e) =>
								updateFilter("sort", e.target.value)
							}
							className="rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-purple-200 focus:outline-none appearance-none md:hidden"
						>
							<option value="newest">新しい順</option>
							<option value="oldest">古い順</option>
							<option value="title">タイトル順</option>
							<option value="author">著者順</option>
							<option value="genre">ジャンル順</option>
							<option value="recommendation">
								おすすめ度順
							</option>
						</select>
					</div>
				</div>

				{/* 追加ボタン */}
				{isMember && (
					<div className="w-full max-w-2xl md:max-w-5xl mb-6 flex gap-3 flex-wrap">
						<Link
							to={`/tsundoku_2_0/${group.groupCode}/add`}
							className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-5 py-2.5 font-medium text-white transition-all hover:from-fuchsia-500 hover:to-purple-500 hover:shadow-lg hover:shadow-fuchsia-500/20"
						>
							<span className="text-lg">+</span> 本を追加
						</Link>
						<Link
							to={`/tsundoku_2_0/${group.groupCode}/add-from-personal`}
							className="inline-flex items-center gap-2 rounded-xl bg-white/10 border border-white/20 px-5 py-2.5 font-medium text-purple-200 transition-all hover:bg-white/20"
						>
							📚 マイ積読リストから追加
						</Link>
					</div>
				)}

				{/* 本のリスト（モバイル） */}
				<div className="w-full max-w-2xl md:hidden">
					{filteredBooks.length === 0 ? (
						<div className="text-center py-16 text-purple-300/40">
							{bookList.length === 0
								? "まだ本が追加されていません"
								: "条件に一致する本がありません"}
						</div>
					) : loaderData.sort === "author" ? (
						<div className="grid gap-4">
							{(() => {
								type Book = (typeof filteredBooks)[number];
								const grouped = new Map<string, Book[]>();
								for (const book of filteredBooks) {
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
										<h2 className="text-sm font-medium text-cyan-300/80 mb-2 px-1">
											{author}
											<span className="text-purple-300/40 ml-2 font-normal">{authorBooks.length}冊</span>
										</h2>
										<div className="grid gap-2">
											{authorBooks.map((book) => {
												const myStatus = book.statuses.find(
													(s) => s.memberId === memberId || (displayName && s.memberName === displayName),
												);
												return (
													<Link
														key={book.id}
														to={`/tsundoku_2_0/${group.groupCode}/book/${book.id}`}
														className="flex gap-3 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-3 transition-all duration-300 hover:border-cyan-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden"
													>
														<div className="flex-1 min-w-0">
															<h3 className="font-semibold text-white truncate text-sm">
																{book.title}
															</h3>
															<div className="flex items-center gap-2 mt-1 flex-wrap">
																{myStatus && (
																	<span
																		className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(myStatus.status as BookStatus)}`}
																	>
																		{BOOK_STATUSES[myStatus.status as BookStatus]}
																	</span>
																)}
																{book.genre && (
																	<span className="text-xs text-purple-300/40">
																		{book.genre}
																	</span>
																)}
																{book.avgRecommendation !== null && (
																	<span className="text-xs text-yellow-400">
																		{"★".repeat(Math.round(book.avgRecommendation))}
																		{"☆".repeat(5 - Math.round(book.avgRecommendation))}
																	</span>
																)}
															</div>
														</div>
														<span className="text-purple-300/30 self-center text-sm">
															&rarr;
														</span>
													</Link>
												);
											})}
										</div>
									</div>
								));
							})()}
						</div>
					) : (
						<div className="grid gap-3">
							{filteredBooks.map((book) => {
								const myStatus = book.statuses.find(
									(s) => s.memberId === memberId || (displayName && s.memberName === displayName),
								);
								return (
									<Link
										key={book.id}
										to={`/tsundoku_2_0/${group.groupCode}/book/${book.id}`}
										className="flex gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-cyan-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-500/10 overflow-hidden"
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
												{book.genre &&
													` / ${book.genre}`}
											</p>
											<div className="flex items-center gap-2 mt-1.5 flex-wrap">
												{myStatus && (
													<span
														className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(myStatus.status as BookStatus)}`}
													>
														{
															BOOK_STATUSES[
																myStatus.status as BookStatus
															]
														}
													</span>
												)}
												{book.avgRecommendation !==
													null && (
													<span className="text-xs text-yellow-400">
														{"★".repeat(Math.round(book.avgRecommendation))}
														{"☆".repeat(5 - Math.round(book.avgRecommendation))}
													</span>
												)}
												<span className="text-xs text-purple-300/40">
													{book.addedByName}
												</span>
											</div>
										</div>
										<span className="text-purple-300/30 self-center">
											&rarr;
										</span>
									</Link>
								);
							})}
						</div>
					)}
				</div>

				{/* PC向けスプレッドシートビュー */}
				<div className="w-full max-w-5xl hidden md:block">
					{filteredBooks.length === 0 ? (
						<div className="text-center py-16 text-purple-300/40">
							{bookList.length === 0
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
										<th className="px-3 py-3 text-xs font-medium text-purple-300/60 whitespace-nowrap">
											自分のステータス
										</th>
										<SortableHeader
											label="おすすめ (平均)"
											sortKey="recommendation"
											currentSort={loaderData.sort}
											onSort={(key) => updateFilter("sort", key)}
										/>
										<th className="px-3 py-3 text-xs font-medium text-purple-300/60">
											追加者
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-white/5">
									{filteredBooks.map((book) => {
										const myStatus = book.statuses.find(
											(s) => s.memberId === memberId || (displayName && s.memberName === displayName),
										);
										return (
											<tr
												key={book.id}
												className="hover:bg-white/5 transition-colors cursor-pointer group"
												onClick={() => {
													window.location.href = `/tsundoku_2_0/${group.groupCode}/book/${book.id}`;
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
												<td className="px-3 py-3 text-sm text-white font-medium max-w-48 truncate group-hover:text-cyan-200 transition-colors">
													{book.title}
												</td>
												<td className="px-3 py-3 text-sm text-purple-300/70 max-w-32 truncate">
													{book.author}
												</td>
												<td className="px-3 py-3 text-xs text-purple-300/50">
													{book.genre || "-"}
												</td>
												<td className="px-3 py-3">
													{myStatus ? (
														<span
															className={`text-xs px-2 py-0.5 rounded-full whitespace-nowrap ${getStatusColor(myStatus.status as BookStatus)}`}
														>
															{BOOK_STATUSES[myStatus.status as BookStatus]}
														</span>
													) : (
														<span className="text-xs text-purple-300/30">-</span>
													)}
												</td>
												<td className="px-3 py-3 text-xs text-yellow-400">
													{book.avgRecommendation !== null
														? formatRating(Math.round(book.avgRecommendation))
														: "-"}
												</td>
												<td className="px-3 py-3 text-xs text-purple-300/50">
													{book.addedByName}
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					)}
				</div>

				<p className="text-sm text-purple-300/30 mt-8">
					{filteredBooks.length} 冊
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
