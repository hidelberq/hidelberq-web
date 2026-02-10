import { Link, useNavigate, useSearchParams } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, or } from "drizzle-orm";
import {
	bookGroups,
	bookGroupMembers,
	books,
	bookMemberStatuses,
	personalBooks,
} from "~/db/schema";
import {
	GENRES,
	BOOK_STATUSES,
	getStatusColor,
	formatRating,
	type BookSearchResult,
	type BookStatus,
} from "~/books/types";
import type { Route } from "./+types/books.detail";
import { useState, useEffect, useCallback, useRef } from "react";

export function meta({ data }: Route.MetaArgs) {
	return [
		{
			title: `${data?.book?.title ?? "本の詳細"} | 積読 2.0 | hidelberq`,
		},
	];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const url = new URL(request.url);
	const currentMemberId = url.searchParams.get("memberId") ?? "";

	const [group] = await db
		.select()
		.from(bookGroups)
		.where(eq(bookGroups.groupCode, params.groupCode))
		.limit(1);

	if (!group) {
		throw new Response("グループが見つかりません", { status: 404 });
	}

	const [book] = await db
		.select()
		.from(books)
		.where(and(eq(books.id, Number(params.bookId)), eq(books.groupId, group.id)))
		.limit(1);

	if (!book) {
		throw new Response("本が見つかりません", { status: 404 });
	}

	const statuses = await db
		.select()
		.from(bookMemberStatuses)
		.where(eq(bookMemberStatuses.bookId, book.id));

	const members = await db
		.select()
		.from(bookGroupMembers)
		.where(eq(bookGroupMembers.groupId, group.id));

	// 個人リストに既にあるかチェック
	let alreadyInPersonalList = false;
	if (currentMemberId) {
		const matchConditions = [];
		if (book.isbn) {
			matchConditions.push(eq(personalBooks.isbn, book.isbn));
		}
		matchConditions.push(
			and(eq(personalBooks.title, book.title), eq(personalBooks.author, book.author))!,
		);
		const [existing] = await db
			.select()
			.from(personalBooks)
			.where(
				and(
					eq(personalBooks.memberId, currentMemberId),
					or(...matchConditions),
				),
			)
			.limit(1);
		alreadyInPersonalList = !!existing;
	}

	return {
		group: { name: group.name, groupCode: group.groupCode },
		book: {
			...book,
			createdAt: book.createdAt?.getTime() ?? Date.now(),
			updatedAt: book.updatedAt?.getTime() ?? Date.now(),
		},
		statuses: statuses.map((s) => ({
			...s,
			updatedAt: s.updatedAt?.getTime() ?? Date.now(),
		})),
		members: members.map((m) => ({
			memberId: m.memberId,
			displayName: m.displayName,
		})),
		alreadyInPersonalList,
	};
}

export async function action({ request, params, context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const formData = await request.formData();
	const intent = formData.get("intent") as string;
	const memberId = formData.get("memberId") as string;

	const [group] = await db
		.select()
		.from(bookGroups)
		.where(eq(bookGroups.groupCode, params.groupCode))
		.limit(1);

	if (!group) {
		throw new Response("グループが見つかりません", { status: 404 });
	}

	const [book] = await db
		.select()
		.from(books)
		.where(and(eq(books.id, Number(params.bookId)), eq(books.groupId, group.id)))
		.limit(1);

	if (!book) {
		throw new Response("本が見つかりません", { status: 404 });
	}

	// メンバーか確認
	const [member] = await db
		.select()
		.from(bookGroupMembers)
		.where(
			and(
				eq(bookGroupMembers.groupId, group.id),
				eq(bookGroupMembers.memberId, memberId),
			),
		)
		.limit(1);

	if (!member) {
		return { error: "グループのメンバーではありません" };
	}

	if (intent === "updateStatus") {
		const status = formData.get("status") as BookStatus;
		const difficulty = formData.get("difficulty")
			? Number(formData.get("difficulty"))
			: null;
		const importance = formData.get("importance")
			? Number(formData.get("importance"))
			: null;
		const recommendation = formData.get("recommendation")
			? Number(formData.get("recommendation"))
			: null;
		const memo = (formData.get("memo") as string)?.trim() || null;
		const startedAt =
			(formData.get("startedAt") as string)?.trim() || null;
		const completedAt =
			(formData.get("completedAt") as string)?.trim() || null;

		// 既存ステータスがあれば更新、なければ新規作成
		const [existing] = await db
			.select()
			.from(bookMemberStatuses)
			.where(
				and(
					eq(bookMemberStatuses.bookId, book.id),
					eq(bookMemberStatuses.memberId, memberId),
				),
			)
			.limit(1);

		if (existing) {
			await db
				.update(bookMemberStatuses)
				.set({
					status,
					difficulty,
					importance,
					recommendation,
					memo,
					startedAt,
					completedAt,
				})
				.where(eq(bookMemberStatuses.id, existing.id));
		} else {
			await db.insert(bookMemberStatuses).values({
				bookId: book.id,
				memberId,
				memberName: member.displayName,
				status,
				difficulty,
				importance,
				recommendation,
				memo,
				startedAt,
				completedAt,
			});
		}

		return { success: true, intent: "updateStatus" };
	}

	if (intent === "editBook") {
		const title = (formData.get("title") as string)?.trim();
		const author = (formData.get("author") as string)?.trim();

		if (!title || !author) {
			return { error: "タイトルと著者名は必須です" };
		}

		await db
			.update(books)
			.set({
				title,
				author,
				isbn: (formData.get("isbn") as string)?.trim() || null,
				publishedYear:
					(formData.get("publishedYear") as string)?.trim() || null,
				publisher:
					(formData.get("publisher") as string)?.trim() || null,
				coverImageUrl:
					(formData.get("coverImageUrl") as string)?.trim() || null,
				description:
					(formData.get("description") as string)?.trim() || null,
				pageCount: formData.get("pageCount")
					? Number(formData.get("pageCount"))
					: null,
				genre: (formData.get("genre") as string) || null,
			})
			.where(eq(books.id, book.id));

		return { success: true, intent: "editBook" };
	}

	if (intent === "addToPersonal") {
		// 個人リストに追加（重複チェック）
		const matchConditions = [];
		if (book.isbn) {
			matchConditions.push(eq(personalBooks.isbn, book.isbn));
		}
		matchConditions.push(
			and(eq(personalBooks.title, book.title), eq(personalBooks.author, book.author))!,
		);
		const [existingPersonal] = await db
			.select()
			.from(personalBooks)
			.where(
				and(
					eq(personalBooks.memberId, memberId),
					or(...matchConditions),
				),
			)
			.limit(1);

		if (existingPersonal) {
			return { error: "既に積読リストに登録されています" };
		}

		// グループでの自分のステータスを取得
		const [myStatus] = await db
			.select()
			.from(bookMemberStatuses)
			.where(
				and(
					eq(bookMemberStatuses.bookId, book.id),
					eq(bookMemberStatuses.memberId, memberId),
				),
			)
			.limit(1);

		await db.insert(personalBooks).values({
			memberId,
			memberName: member.displayName,
			title: book.title,
			author: book.author,
			isbn: book.isbn,
			publishedYear: book.publishedYear,
			publisher: book.publisher,
			coverImageUrl: book.coverImageUrl,
			description: book.description,
			pageCount: book.pageCount,
			genre: book.genre,
			status: myStatus?.status ?? "tsundoku",
			difficulty: myStatus?.difficulty ?? null,
			importance: myStatus?.importance ?? null,
			recommendation: myStatus?.recommendation ?? null,
			memo: myStatus?.memo ?? null,
			startedAt: myStatus?.startedAt ?? null,
			completedAt: myStatus?.completedAt ?? null,
		});

		return { success: true, intent: "addToPersonal" };
	}

	if (intent === "deleteBook") {
		if (book.addedByMemberId !== memberId) {
			return { error: "本を削除できるのは起票者のみです" };
		}

		await db
			.delete(bookMemberStatuses)
			.where(eq(bookMemberStatuses.bookId, book.id));
		await db.delete(books).where(eq(books.id, book.id));

		return { success: true, intent: "deleteBook" };
	}

	return { error: "不明な操作です" };
}

export default function BookDetail({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { group, book, statuses, members, alreadyInPersonalList } = loaderData;
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [memberId, setMemberId] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [editing, setEditing] = useState(false);
	const [showStatusForm, setShowStatusForm] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [addedToPersonal, setAddedToPersonal] = useState(false);

	// 編集モード: Google Books 検索
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [searchError, setSearchError] = useState("");
	const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	// 編集モード: フォーム状態
	const [editTitle, setEditTitle] = useState(book.title);
	const [editAuthor, setEditAuthor] = useState(book.author);
	const [editIsbn, setEditIsbn] = useState(book.isbn ?? "");
	const [editPublishedYear, setEditPublishedYear] = useState(book.publishedYear ?? "");
	const [editPublisher, setEditPublisher] = useState(book.publisher ?? "");
	const [editCoverImageUrl, setEditCoverImageUrl] = useState(book.coverImageUrl ?? "");
	const [editDescription, setEditDescription] = useState(book.description ?? "");
	const [editPageCount, setEditPageCount] = useState(book.pageCount?.toString() ?? "");
	const [editGenre, setEditGenre] = useState(book.genre ?? "");

	useEffect(() => {
		const id = localStorage.getItem("bookMemberId") || "";
		setMemberId(id);
		const name = localStorage.getItem("bookDisplayName") || "";
		setDisplayName(name);

		// loader 用に memberId をクエリパラメータに設定
		if (id && !searchParams.get("memberId")) {
			const params = new URLSearchParams(searchParams);
			params.set("memberId", id);
			setSearchParams(params, { replace: true });
		}
	}, [searchParams, setSearchParams]);

	useEffect(() => {
		if (actionData?.success && actionData.intent === "deleteBook") {
			navigate(`/tsundoku_2_0/${group.groupCode}`);
		}
		if (actionData?.success && actionData.intent === "editBook") {
			setEditing(false);
		}
		if (actionData?.success && actionData.intent === "updateStatus") {
			setShowStatusForm(false);
		}
		if (actionData?.success && actionData.intent === "addToPersonal") {
			setAddedToPersonal(true);
		}
	}, [actionData, navigate, group.groupCode]);

	// 編集モード: Google Books 検索
	const searchBooks = useCallback(async () => {
		if (!searchQuery.trim()) return;
		setSearching(true);
		setSearchError("");
		try {
			const res = await fetch(
				`/api/tsundoku_2_0/search?q=${encodeURIComponent(searchQuery)}`,
			);
			const data = (await res.json()) as { results: BookSearchResult[]; error?: string };
			if (res.status === 429 || data.error === "rate_limited") {
				setSearchError("検索の利用回数上限に達しました。しばらく待ってから再度お試しください。");
				setSearchResults([]);
			} else {
				setSearchResults(data.results);
			}
		} catch {
			setSearchResults([]);
		} finally {
			setSearching(false);
		}
	}, [searchQuery]);

	useEffect(() => {
		if (debounceTimer.current) {
			clearTimeout(debounceTimer.current);
		}
		if (searchQuery.trim().length >= 2) {
			debounceTimer.current = setTimeout(() => {
				searchBooks();
			}, 500);
		}
		return () => {
			if (debounceTimer.current) clearTimeout(debounceTimer.current);
		};
	}, [searchQuery, searchBooks]);

	const selectSearchResult = (result: BookSearchResult) => {
		setEditTitle(result.title);
		setEditAuthor(result.author);
		setEditIsbn(result.isbn ?? "");
		setEditPublishedYear(result.publishedYear ?? "");
		setEditPublisher(result.publisher ?? "");
		setEditCoverImageUrl(result.coverImageUrl ?? "");
		setEditDescription(result.description ?? "");
		setEditPageCount(result.pageCount?.toString() ?? "");
		setSearchResults([]);
		setSearchQuery("");
	};

	const startEditing = () => {
		setEditTitle(book.title);
		setEditAuthor(book.author);
		setEditIsbn(book.isbn ?? "");
		setEditPublishedYear(book.publishedYear ?? "");
		setEditPublisher(book.publisher ?? "");
		setEditCoverImageUrl(book.coverImageUrl ?? "");
		setEditDescription(book.description ?? "");
		setEditPageCount(book.pageCount?.toString() ?? "");
		setEditGenre(book.genre ?? "");
		setSearchQuery("");
		setSearchResults([]);
		setSearchError("");
		setEditing(true);
	};

	const myStatus = statuses.find((s) => s.memberId === memberId || (displayName && s.memberName === displayName));
	const isOwner = book.addedByMemberId === memberId || (displayName && book.addedByName === displayName);
	const isMember = members.some((m) => m.memberId === memberId || (displayName && m.displayName === displayName));

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
					to={`/tsundoku_2_0/${group.groupCode}`}
					className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors mb-8"
				>
					&larr; {group.name} に戻る
				</Link>

				{actionData?.error && (
					<div className="w-full max-w-lg mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
						{actionData.error}
					</div>
				)}

				{/* 本の詳細 */}
				<div className="w-full max-w-lg">
					{!editing ? (
						<>
							{/* 表示モード */}
							<div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 mb-6">
								<div className="flex gap-5">
									{book.coverImageUrl ? (
										<img
											src={book.coverImageUrl}
											alt={book.title}
											className="w-24 h-32 object-cover rounded-lg flex-shrink-0 border border-white/10"
										/>
									) : (
										<div className="w-24 h-32 bg-white/10 rounded-lg flex-shrink-0 flex items-center justify-center text-purple-300/30">
											No image
										</div>
									)}
									<div className="flex-1 min-w-0">
										<h1 className="text-xl font-bold text-white mb-1 break-words">
											{book.title}
										</h1>
										<p className="text-purple-200/80 mb-2 break-words">
											{book.author}
										</p>
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
									</div>
								</div>

								{/* 書籍情報 */}
								<div className="mt-5 grid grid-cols-2 gap-3 text-sm">
									{book.genre && (
										<InfoItem label="ジャンル" value={book.genre} />
									)}
									{book.publisher && (
										<InfoItem
											label="出版社"
											value={book.publisher}
										/>
									)}
									{book.publishedYear && (
										<InfoItem
											label="出版年"
											value={book.publishedYear}
										/>
									)}
									{book.pageCount && (
										<InfoItem
											label="ページ数"
											value={`${book.pageCount}p`}
										/>
									)}
									{book.isbn && (
										<InfoItem label="ISBN" value={book.isbn} />
									)}
									<InfoItem
										label="追加者"
										value={book.addedByName}
									/>
								</div>

								{/* 追加メタ情報 */}
								{(book.importanceLevel || book.difficultyLevel || book.prerequisiteText || book.videoUrl) && (
									<div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-3 text-sm">
										{book.importanceLevel && (
											<InfoItem label="重要度" value={book.importanceLevel} />
										)}
										{book.difficultyLevel && (
											<InfoItem label="難易度" value={"★".repeat(book.difficultyLevel) + "☆".repeat(5 - book.difficultyLevel)} />
										)}
										{book.prerequisiteText && (
											<div className="col-span-2">
												<InfoItem label="先に読んでおくべき本" value={book.prerequisiteText} />
											</div>
										)}
										{book.videoUrl && (
											<div className="col-span-2">
												<span className="text-purple-300/50 text-xs">参考動画</span>
												<p>
													<a
														href={book.videoUrl}
														target="_blank"
														rel="noopener noreferrer"
														className="text-cyan-400 hover:text-cyan-300 text-sm break-all transition-colors"
													>
														{book.videoUrl}
													</a>
												</p>
											</div>
										)}
									</div>
								)}

								{book.description && (
									<div className="mt-4 pt-4 border-t border-white/10">
										<p className="text-sm text-purple-200/80 leading-relaxed">
											{book.description}
										</p>
									</div>
								)}

								{book.memo && (
									<div className="mt-3 rounded-lg bg-yellow-500/5 border border-yellow-500/10 p-3">
										<span className="text-xs text-yellow-400/60">メモ</span>
										<p className="text-sm text-purple-200/80 mt-1">
											{book.memo}
										</p>
									</div>
								)}

								{/* 操作ボタン */}
								{isMember && (
									<div className="mt-5 flex gap-2 flex-wrap">
										<button
											type="button"
											onClick={() =>
												setShowStatusForm(!showStatusForm)
											}
											className="text-sm rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/30 px-4 py-2 text-fuchsia-200 hover:bg-fuchsia-500/30 transition-colors"
										>
											{myStatus
												? "ステータスを更新"
												: "ステータスを設定"}
										</button>
										{!alreadyInPersonalList && !addedToPersonal ? (
											<form method="post" className="inline">
												<input type="hidden" name="intent" value="addToPersonal" />
												<input type="hidden" name="memberId" value={memberId} />
												<button
													type="submit"
													className="text-sm rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-4 py-2 text-cyan-200 hover:bg-cyan-500/30 transition-colors"
												>
													📚 積読リストに追加
												</button>
											</form>
										) : (
											<span className="text-sm rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-2 text-green-300">
												積読リストに追加済み
											</span>
										)}
										<button
											type="button"
											onClick={startEditing}
											className="text-sm rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-purple-200 hover:bg-white/20 transition-colors"
										>
											編集
										</button>
										{isOwner && (
											<button
												type="button"
												onClick={() =>
													setConfirmDelete(true)
												}
												className="text-sm rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-2 text-red-300 hover:bg-red-500/30 transition-colors"
											>
												削除
											</button>
										)}
									</div>
								)}
							</div>

							{/* 削除確認 */}
							{confirmDelete && (
								<div className="w-full mb-6 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
									<p className="text-sm text-red-300 mb-3">
										本当にこの本を削除しますか？この操作は取り消せません。
									</p>
									<div className="flex gap-2">
										<form method="post">
											<input
												type="hidden"
												name="intent"
												value="deleteBook"
											/>
											<input
												type="hidden"
												name="memberId"
												value={memberId}
											/>
											<button
												type="submit"
												className="text-sm rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 transition-colors"
											>
												削除する
											</button>
										</form>
										<button
											type="button"
											onClick={() =>
												setConfirmDelete(false)
											}
											className="text-sm rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-purple-200 hover:bg-white/20 transition-colors"
										>
											キャンセル
										</button>
									</div>
								</div>
							)}
						</>
					) : (
						/* 編集モード */
						<form
							method="post"
							className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 mb-6 space-y-4"
						>
							<input type="hidden" name="intent" value="editBook" />
							<input type="hidden" name="memberId" value={memberId} />
							<input type="hidden" name="coverImageUrl" value={editCoverImageUrl} />

							{/* Google Books 検索 */}
							<div>
								<h3 className="text-sm font-semibold uppercase tracking-widest text-cyan-400/80 mb-3">
									書籍を検索して入力
								</h3>
								<div className="flex gap-2">
									<input
										type="text"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												searchBooks();
											}
										}}
										placeholder="タイトルまたは著者名で検索..."
										className={`${inputClass} flex-1`}
									/>
									<button
										type="button"
										onClick={searchBooks}
										disabled={searching}
										className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 font-medium text-white transition-all hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
									>
										{searching ? "..." : "検索"}
									</button>
								</div>
								{searchError && (
									<div className="mt-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-sm text-yellow-300">
										{searchError}
									</div>
								)}
								{searchResults.length > 0 && (
									<div className="mt-3 rounded-xl bg-white/5 border border-white/10 divide-y divide-white/5 max-h-80 overflow-y-auto">
										{searchResults.map((result, i) => (
											<button
												key={`${result.isbn ?? i}-${result.title}`}
												type="button"
												onClick={() => selectSearchResult(result)}
												className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-white/10 transition-colors"
											>
												{result.coverImageUrl ? (
													<img
														src={result.coverImageUrl}
														alt=""
														className="w-10 h-14 object-cover rounded flex-shrink-0"
													/>
												) : (
													<div className="w-10 h-14 bg-white/10 rounded flex-shrink-0 flex items-center justify-center text-purple-300/40 text-xs">
														No img
													</div>
												)}
												<div className="min-w-0">
													<p className="text-sm font-medium text-white truncate">
														{result.title}
													</p>
													<p className="text-xs text-purple-300/60">
														{result.author}
														{result.publishedYear && ` (${result.publishedYear})`}
													</p>
												</div>
											</button>
										))}
									</div>
								)}
							</div>

							<div className="border-t border-white/10 pt-4" />

							{/* 表紙プレビュー */}
							{editCoverImageUrl && (
								<div className="flex justify-center">
									<img
										src={editCoverImageUrl}
										alt="表紙"
										className="h-32 object-cover rounded-lg border border-white/10"
									/>
								</div>
							)}

							<div>
								<label className={labelClass}>
									タイトル<span className="text-red-400 ml-1">*</span>
								</label>
								<input
									type="text"
									name="title"
									required
									value={editTitle}
									onChange={(e) => setEditTitle(e.target.value)}
									className={inputClass}
								/>
							</div>
							<div>
								<label className={labelClass}>
									著者名<span className="text-red-400 ml-1">*</span>
								</label>
								<input
									type="text"
									name="author"
									required
									value={editAuthor}
									onChange={(e) => setEditAuthor(e.target.value)}
									className={inputClass}
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className={labelClass}>ISBN</label>
									<input
										type="text"
										name="isbn"
										value={editIsbn}
										onChange={(e) => setEditIsbn(e.target.value)}
										className={inputClass}
									/>
								</div>
								<div>
									<label className={labelClass}>出版年</label>
									<input
										type="text"
										name="publishedYear"
										value={editPublishedYear}
										onChange={(e) => setEditPublishedYear(e.target.value)}
										className={inputClass}
									/>
								</div>
								<div>
									<label className={labelClass}>出版社</label>
									<input
										type="text"
										name="publisher"
										value={editPublisher}
										onChange={(e) => setEditPublisher(e.target.value)}
										className={inputClass}
									/>
								</div>
								<div>
									<label className={labelClass}>ページ数</label>
									<input
										type="number"
										name="pageCount"
										value={editPageCount}
										onChange={(e) => setEditPageCount(e.target.value)}
										className={inputClass}
									/>
								</div>
							</div>
							<div>
								<label className={labelClass}>ジャンル</label>
								<select
									name="genre"
									value={editGenre}
									onChange={(e) => setEditGenre(e.target.value)}
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
							<div>
								<label className={labelClass}>内容（短く）</label>
								<textarea
									name="description"
									rows={3}
									value={editDescription}
									onChange={(e) => setEditDescription(e.target.value)}
									className={`${inputClass} resize-none`}
								/>
							</div>
							<div className="flex gap-2">
								<button
									type="submit"
									className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-5 py-2.5 font-medium text-white transition-all hover:from-fuchsia-500 hover:to-purple-500"
								>
									保存
								</button>
								<button
									type="button"
									onClick={() => setEditing(false)}
									className="rounded-xl bg-white/10 border border-white/20 px-5 py-2.5 text-purple-200 hover:bg-white/20 transition-colors"
								>
									キャンセル
								</button>
							</div>
						</form>
					)}

					{/* ステータス設定フォーム */}
					{showStatusForm && (
						<form
							method="post"
							className="rounded-2xl bg-white/5 backdrop-blur-sm border border-fuchsia-500/20 p-6 mb-6 space-y-4"
						>
							<h2 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-2">
								あなたのステータス
							</h2>
							<input
								type="hidden"
								name="intent"
								value="updateStatus"
							/>
							<input
								type="hidden"
								name="memberId"
								value={memberId}
							/>

							<div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
								{(
									Object.entries(BOOK_STATUSES) as [
										BookStatus,
										string,
									][]
								).map(([key, label]) => (
									<label
										key={key}
										className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 cursor-pointer hover:bg-white/10 transition-colors has-[:checked]:border-fuchsia-500/40 has-[:checked]:bg-fuchsia-500/10"
									>
										<input
											type="radio"
											name="status"
											value={key}
											required
											defaultChecked={
												myStatus?.status === key
											}
											className="accent-fuchsia-500"
										/>
										<span className="text-sm text-purple-200">
											{label}
										</span>
									</label>
								))}
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<RatingSelect
									name="difficulty"
									label="難易度"
									defaultValue={myStatus?.difficulty}
								/>
								<RatingSelect
									name="importance"
									label="重要度"
									defaultValue={myStatus?.importance}
								/>
								<RatingSelect
									name="recommendation"
									label="おすすめ度"
									defaultValue={myStatus?.recommendation}
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className={labelClass}>
										読み始めた日
									</label>
									<input
										type="date"
										name="startedAt"
										defaultValue={
											myStatus?.startedAt ?? ""
										}
										className={inputClass}
									/>
								</div>
								<div>
									<label className={labelClass}>
										読了日
									</label>
									<input
										type="date"
										name="completedAt"
										defaultValue={
											myStatus?.completedAt ?? ""
										}
										className={inputClass}
									/>
								</div>
							</div>

							<div>
								<label className={labelClass}>
									メモ / 感想
								</label>
								<textarea
									name="memo"
									rows={3}
									defaultValue={myStatus?.memo ?? ""}
									placeholder="自由にメモや感想を..."
									className={`${inputClass} resize-none`}
								/>
							</div>

							<div className="flex gap-2">
								<button
									type="submit"
									className="rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-5 py-2.5 font-medium text-white transition-all hover:from-fuchsia-500 hover:to-purple-500"
								>
									保存
								</button>
								<button
									type="button"
									onClick={() => setShowStatusForm(false)}
									className="rounded-xl bg-white/10 border border-white/20 px-5 py-2.5 text-purple-200 hover:bg-white/20 transition-colors"
								>
									キャンセル
								</button>
							</div>
						</form>
					)}

					{/* メンバーの評価一覧 */}
					<section className="mb-6">
						<h2 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-4">
							メンバーの評価 ({statuses.length})
						</h2>
						{statuses.length === 0 ? (
							<p className="text-sm text-purple-300/40">
								まだ誰も評価していません
							</p>
						) : (
							<div className="grid gap-3">
								{statuses.map((s) => (
									<div
										key={s.id}
										className="rounded-xl bg-white/5 border border-white/10 p-4"
									>
										<div className="flex items-center justify-between mb-2">
											<span className="font-medium text-white">
												{s.memberName}
												{(s.memberId === memberId || (displayName && s.memberName === displayName)) &&
													" (あなた)"}
											</span>
											<span
												className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(s.status as BookStatus)}`}
											>
												{
													BOOK_STATUSES[
														s.status as BookStatus
													]
												}
											</span>
										</div>
										<div className="flex gap-4 text-xs text-purple-300/60 flex-wrap">
											{s.difficulty !== null && (
												<span>
													難易度:{" "}
													{formatRating(
														s.difficulty,
													)}
												</span>
											)}
											{s.importance !== null && (
												<span>
													重要度:{" "}
													{formatRating(
														s.importance,
													)}
												</span>
											)}
											{s.recommendation !== null && (
												<span>
													おすすめ:{" "}
													{formatRating(
														s.recommendation,
													)}
												</span>
											)}
										</div>
										{s.startedAt && (
											<p className="text-xs text-purple-300/40 mt-1">
												読み始め: {s.startedAt}
												{s.completedAt &&
													` → 読了: ${s.completedAt}`}
											</p>
										)}
										{s.memo && (
											<p className="text-sm text-purple-200/70 mt-2 bg-white/5 rounded-lg p-3">
												{s.memo}
											</p>
										)}
									</div>
								))}
							</div>
						)}
					</section>
				</div>
			</div>
		</div>
	);
}

function InfoItem({ label, value }: { label: string; value: string }) {
	return (
		<div>
			<span className="text-purple-300/50 text-xs">{label}</span>
			<p className="text-purple-100/90">{value}</p>
		</div>
	);
}

function RatingSelect({
	name,
	label,
	defaultValue,
}: {
	name: string;
	label: string;
	defaultValue?: number | null;
}) {
	return (
		<div>
			<label className="block text-sm font-medium text-purple-200 mb-1.5">
				{label}
			</label>
			<select
				name={name}
				defaultValue={defaultValue?.toString() ?? ""}
				className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30 appearance-none"
			>
				<option value="">-</option>
				{[1, 2, 3, 4, 5].map((v) => (
					<option key={v} value={v}>
						{"★".repeat(v)}{"☆".repeat(5 - v)}
					</option>
				))}
			</select>
		</div>
	);
}
