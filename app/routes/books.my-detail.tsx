import { Link, useNavigate, useSearchParams } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, or, ne, sql } from "drizzle-orm";
import {
	personalBooks,
	bookPrerequisites,
	bookGroups,
	bookGroupMembers,
	books,
	bookMemberStatuses,
} from "~/db/schema";
import {
	GENRES,
	BOOK_STATUSES,
	BOOK_VISIBILITY,
	getStatusColor,
	formatRating,
	type BookSearchResult,
	type BookStatus,
	type BookVisibility,
} from "~/books/types";
import type { Route } from "./+types/books.my-detail";
import { useState, useEffect, useCallback, useRef } from "react";

export function meta({ data }: Route.MetaArgs) {
	return [
		{
			title: `${data?.book?.title ?? "本の詳細"} | マイ積読リスト | 積読 2.0 | hidelberq`,
		},
	];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const url = new URL(request.url);
	const currentMemberId = url.searchParams.get("memberId") ?? "";
	const bookId = Number(params.personalBookId);

	const [book] = await db
		.select()
		.from(personalBooks)
		.where(eq(personalBooks.id, bookId))
		.limit(1);

	if (!book) {
		throw new Response("本が見つかりません", { status: 404 });
	}

	const isOwner = book.memberId === currentMemberId;

	// 他のユーザーのアクセスで非公開の場合
	if (!isOwner && book.visibility === "private") {
		throw new Response("この本は非公開です", { status: 403 });
	}

	// 被り検出: ISBN またはタイトル+著者名で一致する他ユーザーの本を検索
	const overlapConditions = [];
	if (book.isbn) {
		overlapConditions.push(eq(personalBooks.isbn, book.isbn));
	}
	overlapConditions.push(
		and(
			eq(personalBooks.title, book.title),
			eq(personalBooks.author, book.author),
		)!,
	);

	const overlappingBooks = await db
		.select()
		.from(personalBooks)
		.where(
			and(
				ne(personalBooks.memberId, book.memberId),
				or(...overlapConditions),
			),
		);

	// 公開ユーザーの情報と非公開ユーザーの数
	const publicOverlaps = overlappingBooks
		.filter((b) => b.visibility === "public")
		.map((b) => ({
			memberId: b.memberId,
			memberName: b.memberName,
			status: b.status,
			bookId: b.id,
		}));

	// 同じユーザーが複数回出る可能性があるので重複排除
	const uniquePublicOverlaps = publicOverlaps.filter(
		(v, i, a) => a.findIndex((t) => t.memberId === v.memberId) === i,
	);

	const privateOverlapCount = overlappingBooks.filter(
		(b) => b.visibility === "private",
	).length;

	// ユニークメンバー数（非公開）
	const privateUniqueMembers = new Set(
		overlappingBooks
			.filter((b) => b.visibility === "private")
			.map((b) => b.memberId),
	).size;

	// 前提本の取得
	const prerequisites = await db
		.select()
		.from(bookPrerequisites)
		.where(eq(bookPrerequisites.personalBookId, bookId));

	const prerequisiteBookIds = prerequisites.map(
		(p) => p.prerequisitePersonalBookId,
	);

	let prerequisiteBooks: Array<{
		id: number;
		title: string;
		author: string;
		coverImageUrl: string | null;
		status: string;
	}> = [];

	if (prerequisiteBookIds.length > 0) {
		prerequisiteBooks = await db
			.select({
				id: personalBooks.id,
				title: personalBooks.title,
				author: personalBooks.author,
				coverImageUrl: personalBooks.coverImageUrl,
				status: personalBooks.status,
			})
			.from(personalBooks)
			.where(
				sql`${personalBooks.id} IN (${sql.join(
					prerequisiteBookIds.map((id) => sql`${id}`),
					sql`,`,
				)})`,
			);
	}

	// 自分の他の本のリスト（前提本として追加するため）
	let myOtherBooks: Array<{ id: number; title: string; author: string }> = [];
	// 自分が所属するグループのリスト
	let myGroups: Array<{ groupId: number; groupCode: string; groupName: string }> = [];
	if (isOwner) {
		myOtherBooks = await db
			.select({
				id: personalBooks.id,
				title: personalBooks.title,
				author: personalBooks.author,
			})
			.from(personalBooks)
			.where(
				and(
					eq(personalBooks.memberId, book.memberId),
					ne(personalBooks.id, bookId),
				),
			);

		const memberships = await db
			.select({
				groupId: bookGroupMembers.groupId,
			})
			.from(bookGroupMembers)
			.where(eq(bookGroupMembers.memberId, currentMemberId));

		if (memberships.length > 0) {
			const groupList = await db
				.select({
					id: bookGroups.id,
					groupCode: bookGroups.groupCode,
					name: bookGroups.name,
				})
				.from(bookGroups)
				.where(
					sql`${bookGroups.id} IN (${sql.join(
						memberships.map((m) => sql`${m.groupId}`),
						sql`,`,
					)})`,
				);
			myGroups = groupList.map((g) => ({
				groupId: g.id,
				groupCode: g.groupCode,
				groupName: g.name,
			}));
		}
	}

	return {
		book: {
			...book,
			tags: book.tags ? (JSON.parse(book.tags) as string[]) : [],
			createdAt: book.createdAt?.getTime() ?? Date.now(),
			updatedAt: book.updatedAt?.getTime() ?? Date.now(),
		},
		isOwner,
		overlaps: {
			publicUsers: uniquePublicOverlaps,
			privateCount: privateUniqueMembers,
			totalCount: uniquePublicOverlaps.length + privateUniqueMembers,
		},
		prerequisiteBooks,
		prerequisiteBookIds,
		myOtherBooks,
		myGroups,
	};
}

export async function action({ request, params, context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const formData = await request.formData();
	const intent = formData.get("intent") as string;
	const memberId = formData.get("memberId") as string;
	const bookId = Number(params.personalBookId);

	const [book] = await db
		.select()
		.from(personalBooks)
		.where(eq(personalBooks.id, bookId))
		.limit(1);

	if (!book) {
		throw new Response("本が見つかりません", { status: 404 });
	}

	if (book.memberId !== memberId) {
		return { error: "自分の本のみ操作できます" };
	}

	if (intent === "updateStatus") {
		const status = formData.get("status") as BookStatus;
		const visibility = (formData.get("visibility") as BookVisibility) || book.visibility;
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
		const startedAt = (formData.get("startedAt") as string)?.trim() || null;
		const completedAt = (formData.get("completedAt") as string)?.trim() || null;
		const tagsRaw = (formData.get("tags") as string)?.trim();
		const tags = tagsRaw
			? JSON.stringify(tagsRaw.split(",").map((t) => t.trim()).filter(Boolean))
			: null;

		await db
			.update(personalBooks)
			.set({
				status,
				visibility,
				difficulty,
				importance,
				recommendation,
				memo,
				startedAt,
				completedAt,
				tags,
			})
			.where(eq(personalBooks.id, bookId));

		return { success: true, intent: "updateStatus" };
	}

	if (intent === "editBook") {
		const title = (formData.get("title") as string)?.trim();
		const author = (formData.get("author") as string)?.trim();

		if (!title || !author) {
			return { error: "タイトルと著者名は必須です" };
		}

		await db
			.update(personalBooks)
			.set({
				title,
				author,
				isbn: (formData.get("isbn") as string)?.trim() || null,
				publishedYear: (formData.get("publishedYear") as string)?.trim() || null,
				publisher: (formData.get("publisher") as string)?.trim() || null,
				coverImageUrl: (formData.get("coverImageUrl") as string)?.trim() || null,
				description: (formData.get("description") as string)?.trim() || null,
				pageCount: formData.get("pageCount") ? Number(formData.get("pageCount")) : null,
				genre: (formData.get("genre") as string) || null,
			})
			.where(eq(personalBooks.id, bookId));

		return { success: true, intent: "editBook" };
	}

	if (intent === "deleteBook") {
		// 前提本のリレーションも削除
		await db
			.delete(bookPrerequisites)
			.where(
				or(
					eq(bookPrerequisites.personalBookId, bookId),
					eq(bookPrerequisites.prerequisitePersonalBookId, bookId),
				),
			);
		await db.delete(personalBooks).where(eq(personalBooks.id, bookId));

		return { success: true, intent: "deleteBook" };
	}

	if (intent === "addToGroup") {
		const groupId = Number(formData.get("groupId"));
		if (!groupId) {
			return { error: "グループを選択してください" };
		}

		// メンバーか確認
		const [member] = await db
			.select()
			.from(bookGroupMembers)
			.where(
				and(
					eq(bookGroupMembers.groupId, groupId),
					eq(bookGroupMembers.memberId, memberId),
				),
			)
			.limit(1);

		if (!member) {
			return { error: "グループのメンバーではありません" };
		}

		// グループに本を追加
		const [newBook] = await db
			.insert(books)
			.values({
				groupId,
				title: book.title,
				author: book.author,
				isbn: book.isbn,
				publishedYear: book.publishedYear,
				publisher: book.publisher,
				coverImageUrl: book.coverImageUrl,
				description: book.description,
				pageCount: book.pageCount,
				genre: book.genre,
				addedByMemberId: memberId,
				addedByName: member.displayName,
			})
			.returning();

		// ステータスも同期
		await db.insert(bookMemberStatuses).values({
			bookId: newBook.id,
			memberId,
			memberName: member.displayName,
			status: book.status,
			difficulty: book.difficulty,
			importance: book.importance,
			recommendation: book.recommendation,
			memo: book.memo,
			startedAt: book.startedAt,
			completedAt: book.completedAt,
		});

		return { success: true, intent: "addToGroup" };
	}

	if (intent === "addPrerequisite") {
		const prerequisiteBookId = Number(formData.get("prerequisiteBookId"));

		if (!prerequisiteBookId) {
			return { error: "前提本を選択してください" };
		}

		// 既に追加済みかチェック
		const [existing] = await db
			.select()
			.from(bookPrerequisites)
			.where(
				and(
					eq(bookPrerequisites.personalBookId, bookId),
					eq(bookPrerequisites.prerequisitePersonalBookId, prerequisiteBookId),
				),
			)
			.limit(1);

		if (existing) {
			return { error: "既に追加済みです" };
		}

		await db.insert(bookPrerequisites).values({
			personalBookId: bookId,
			prerequisitePersonalBookId: prerequisiteBookId,
		});

		return { success: true, intent: "addPrerequisite" };
	}

	if (intent === "removePrerequisite") {
		const prerequisiteBookId = Number(formData.get("prerequisiteBookId"));

		await db
			.delete(bookPrerequisites)
			.where(
				and(
					eq(bookPrerequisites.personalBookId, bookId),
					eq(bookPrerequisites.prerequisitePersonalBookId, prerequisiteBookId),
				),
			);

		return { success: true, intent: "removePrerequisite" };
	}

	return { error: "不明な操作です" };
}

export default function BookMyDetail({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { book, isOwner, overlaps, prerequisiteBooks, myOtherBooks, myGroups } = loaderData;
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [memberId, setMemberId] = useState("");
	const [editing, setEditing] = useState(false);
	const [showStatusForm, setShowStatusForm] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [showPrereqForm, setShowPrereqForm] = useState(false);
	const [showGroupForm, setShowGroupForm] = useState(false);

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

		// loader 用に memberId をクエリパラメータに設定
		if (id && !searchParams.get("memberId")) {
			const params = new URLSearchParams(searchParams);
			params.set("memberId", id);
			setSearchParams(params, { replace: true });
		}
	}, [searchParams, setSearchParams]);

	useEffect(() => {
		if (actionData?.success && actionData.intent === "deleteBook") {
			navigate("/tsundoku_2_0/my");
		}
		if (actionData?.success && actionData.intent === "editBook") {
			setEditing(false);
		}
		if (actionData?.success && actionData.intent === "updateStatus") {
			setShowStatusForm(false);
		}
		if (actionData?.success && actionData.intent === "addPrerequisite") {
			setShowPrereqForm(false);
		}
		if (actionData?.success && actionData.intent === "addToGroup") {
			setShowGroupForm(false);
		}
	}, [actionData, navigate]);

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

	const inputClass =
		"w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-purple-300/40 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30";
	const labelClass = "block text-sm font-medium text-purple-200 mb-1.5";

	// 読書会提案: 3人以上被っている場合
	const totalOverlap = overlaps.totalCount;
	const suggestReadingGroup = totalOverlap >= 2;
	const publicNames = overlaps.publicUsers.map((u) => u.memberName);

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-16">
				<Link
					to="/tsundoku_2_0/my"
					className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors mb-8"
				>
					&larr; マイ積読リストに戻る
				</Link>

				{actionData?.error && (
					<div className="w-full max-w-lg mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
						{actionData.error}
					</div>
				)}

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
										<h1 className="text-xl font-bold text-white mb-1">
											{book.title}
										</h1>
										<p className="text-purple-200/80 mb-2">{book.author}</p>
										<div className="flex flex-wrap gap-1.5">
											<span
												className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(book.status as BookStatus)}`}
											>
												{BOOK_STATUSES[book.status as BookStatus]}
											</span>
											<span
												className={`text-xs px-2 py-0.5 rounded-full ${
													book.visibility === "public"
														? "text-green-400 bg-green-500/20"
														: "text-purple-400 bg-purple-500/20"
												}`}
											>
												{BOOK_VISIBILITY[book.visibility as BookVisibility]}
											</span>
										</div>
									</div>
								</div>

								{/* 書籍情報 */}
								<div className="mt-5 grid grid-cols-2 gap-3 text-sm">
									{book.genre && <InfoItem label="ジャンル" value={book.genre} />}
									{book.publisher && <InfoItem label="出版社" value={book.publisher} />}
									{book.publishedYear && <InfoItem label="出版年" value={book.publishedYear} />}
									{book.pageCount && <InfoItem label="ページ数" value={`${book.pageCount}p`} />}
									{book.isbn && <InfoItem label="ISBN" value={book.isbn} />}
								</div>

								{/* 評価 */}
								<div className="mt-4 flex gap-4 text-sm text-purple-300/60 flex-wrap">
									{book.difficulty !== null && (
										<span>難易度: {formatRating(book.difficulty)}</span>
									)}
									{book.importance !== null && (
										<span>重要度: {formatRating(book.importance)}</span>
									)}
									{book.recommendation !== null && (
										<span>おすすめ: {formatRating(book.recommendation)}</span>
									)}
								</div>

								{/* 読書期間 */}
								{book.startedAt && (
									<p className="text-xs text-purple-300/40 mt-2">
										読み始め: {book.startedAt}
										{book.completedAt && ` → 読了: ${book.completedAt}`}
									</p>
								)}

								{/* タグ */}
								{book.tags.length > 0 && (
									<div className="mt-3 flex flex-wrap gap-1.5">
										{book.tags.map((tag) => (
											<span
												key={tag}
												className="text-xs px-2 py-0.5 rounded-full bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-500/20"
											>
												{tag}
											</span>
										))}
									</div>
								)}

								{book.description && (
									<div className="mt-4 pt-4 border-t border-white/10">
										<p className="text-sm text-purple-200/80 leading-relaxed">
											{book.description}
										</p>
									</div>
								)}

								{/* メモ */}
								{book.memo && (
									<div className="mt-4 pt-4 border-t border-white/10">
										<p className="text-xs text-purple-300/50 mb-1">メモ / 感想</p>
										<p className="text-sm text-purple-200/70 bg-white/5 rounded-lg p-3">
											{book.memo}
										</p>
									</div>
								)}

								{/* 操作ボタン */}
								{isOwner && (
									<div className="mt-5 flex gap-2 flex-wrap">
										<button
											type="button"
											onClick={() => setShowStatusForm(!showStatusForm)}
											className="text-sm rounded-lg bg-fuchsia-500/20 border border-fuchsia-500/30 px-4 py-2 text-fuchsia-200 hover:bg-fuchsia-500/30 transition-colors"
										>
											ステータスを更新
										</button>
										<button
											type="button"
											onClick={startEditing}
											className="text-sm rounded-lg bg-white/10 border border-white/20 px-4 py-2 text-purple-200 hover:bg-white/20 transition-colors"
										>
											編集
										</button>
										<button
											type="button"
											onClick={() => setConfirmDelete(true)}
											className="text-sm rounded-lg bg-red-500/20 border border-red-500/30 px-4 py-2 text-red-300 hover:bg-red-500/30 transition-colors"
										>
											削除
										</button>
										{myGroups.length > 0 && (
											<button
												type="button"
												onClick={() => setShowGroupForm(!showGroupForm)}
												className="text-sm rounded-lg bg-cyan-500/20 border border-cyan-500/30 px-4 py-2 text-cyan-200 hover:bg-cyan-500/30 transition-colors"
											>
												グループに追加
											</button>
										)}
									</div>
								)}
							</div>

							{/* グループに追加フォーム */}
							{showGroupForm && isOwner && (
								<div className="w-full mb-6 rounded-xl bg-cyan-500/10 border border-cyan-500/20 p-4">
									<h3 className="text-sm font-semibold text-cyan-300 mb-3">
										グループの積読リストに追加
									</h3>
									{actionData?.success && actionData.intent === "addToGroup" && (
										<div className="mb-3 rounded-lg bg-green-500/20 border border-green-500/30 px-3 py-2 text-sm text-green-300">
											グループに追加しました
										</div>
									)}
									<form method="post" className="flex gap-2 items-end">
										<input type="hidden" name="intent" value="addToGroup" />
										<input type="hidden" name="memberId" value={memberId} />
										<div className="flex-1">
											<select
												name="groupId"
												required
												className={`${inputClass} appearance-none`}
											>
												<option value="">グループを選択</option>
												{myGroups.map((g) => (
													<option key={g.groupId} value={g.groupId}>
														{g.groupName}
													</option>
												))}
											</select>
										</div>
										<button
											type="submit"
											className="rounded-xl bg-cyan-500/20 border border-cyan-500/30 px-4 py-3 text-sm text-cyan-200 hover:bg-cyan-500/30 transition-colors"
										>
											追加
										</button>
										<button
											type="button"
											onClick={() => setShowGroupForm(false)}
											className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm text-purple-200 hover:bg-white/20 transition-colors"
										>
											取消
										</button>
									</form>
								</div>
							)}

							{/* 削除確認 */}
							{confirmDelete && (
								<div className="w-full mb-6 rounded-xl bg-red-500/10 border border-red-500/30 p-4">
									<p className="text-sm text-red-300 mb-3">
										本当にこの本を削除しますか？この操作は取り消せません。
									</p>
									<div className="flex gap-2">
										<form method="post">
											<input type="hidden" name="intent" value="deleteBook" />
											<input type="hidden" name="memberId" value={memberId} />
											<button
												type="submit"
												className="text-sm rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500 transition-colors"
											>
												削除する
											</button>
										</form>
										<button
											type="button"
											onClick={() => setConfirmDelete(false)}
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

					{/* ステータス更新フォーム */}
					{showStatusForm && isOwner && (
						<form
							method="post"
							className="rounded-2xl bg-white/5 backdrop-blur-sm border border-fuchsia-500/20 p-6 mb-6 space-y-4"
						>
							<h2 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-2">
								ステータスを更新
							</h2>
							<input type="hidden" name="intent" value="updateStatus" />
							<input type="hidden" name="memberId" value={memberId} />

							<div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
								{(Object.entries(BOOK_STATUSES) as [BookStatus, string][]).map(
									([key, label]) => (
										<label
											key={key}
											className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 cursor-pointer hover:bg-white/10 transition-colors has-[:checked]:border-fuchsia-500/40 has-[:checked]:bg-fuchsia-500/10"
										>
											<input
												type="radio"
												name="status"
												value={key}
												required
												defaultChecked={book.status === key}
												className="accent-fuchsia-500"
											/>
											<span className="text-sm text-purple-200">{label}</span>
										</label>
									),
								)}
							</div>

							{/* 公開/非公開 */}
							<div>
								<label className={labelClass}>公開設定</label>
								<div className="flex gap-2">
									{(Object.entries(BOOK_VISIBILITY) as [BookVisibility, string][]).map(
										([key, label]) => (
											<label
												key={key}
												className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-4 py-2 cursor-pointer hover:bg-white/10 transition-colors has-[:checked]:border-fuchsia-500/40 has-[:checked]:bg-fuchsia-500/10"
											>
												<input
													type="radio"
													name="visibility"
													value={key}
													defaultChecked={book.visibility === key}
													className="accent-fuchsia-500"
												/>
												<span className="text-sm text-purple-200">{label}</span>
											</label>
										),
									)}
								</div>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
								<RatingSelect
									name="difficulty"
									label="難易度"
									defaultValue={book.difficulty}
								/>
								<RatingSelect
									name="importance"
									label="重要度"
									defaultValue={book.importance}
								/>
								<RatingSelect
									name="recommendation"
									label="おすすめ度"
									defaultValue={book.recommendation}
								/>
							</div>

							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
								<div>
									<label className={labelClass}>読み始めた日</label>
									<input
										type="date"
										name="startedAt"
										defaultValue={book.startedAt ?? ""}
										className={inputClass}
									/>
								</div>
								<div>
									<label className={labelClass}>読了日</label>
									<input
										type="date"
										name="completedAt"
										defaultValue={book.completedAt ?? ""}
										className={inputClass}
									/>
								</div>
							</div>

							<div>
								<label className={labelClass}>タグ（カンマ区切り）</label>
								<input
									type="text"
									name="tags"
									defaultValue={book.tags.join(", ")}
									placeholder="例: 入門書, 輪読会向き, 名著"
									className={inputClass}
								/>
							</div>

							<div>
								<label className={labelClass}>メモ / 感想</label>
								<textarea
									name="memo"
									rows={3}
									defaultValue={book.memo ?? ""}
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

					{/* 被り検出セクション */}
					{totalOverlap > 0 && (
						<section className="rounded-2xl bg-white/5 backdrop-blur-sm border border-cyan-500/20 p-6 mb-6">
							<h2 className="text-sm font-semibold uppercase tracking-widest text-cyan-400/80 mb-4">
								この本を持っている人 ({totalOverlap}人)
							</h2>

							{/* 公開ユーザー */}
							{overlaps.publicUsers.length > 0 && (
								<div className="grid gap-2 mb-3">
									{overlaps.publicUsers.map((user) => (
										<Link
											key={user.memberId}
											to={`/tsundoku_2_0/user/${user.memberId}`}
											className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 hover:bg-white/10 hover:border-fuchsia-500/30 transition-all"
										>
											<span className="text-sm text-white font-medium hover:text-fuchsia-200 transition-colors">
												{user.memberName}
											</span>
											<span
												className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(user.status as BookStatus)}`}
											>
												{BOOK_STATUSES[user.status as BookStatus]}
											</span>
										</Link>
									))}
								</div>
							)}

							{/* 非公開ユーザーの数 */}
							{overlaps.privateCount > 0 && (
								<p className="text-sm text-purple-300/50">
									他 {overlaps.privateCount}人が非公開で登録しています
								</p>
							)}

							{/* 読書会提案 */}
							{suggestReadingGroup && (
								<div className="mt-4 pt-4 border-t border-white/10">
									<div className="rounded-xl bg-gradient-to-r from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 p-4">
										<p className="text-sm text-cyan-200 font-medium mb-1">
											📖 読書会のご提案
										</p>
										<p className="text-sm text-purple-200/70">
											{publicNames.length > 0
												? `${publicNames.join("さん、")}さん${overlaps.privateCount > 0 ? `たち(他${overlaps.privateCount}人)` : ""}と「${book.title}」の読書会をしませんか？`
												: `${totalOverlap}人がこの本を持っています。読書会を開きませんか？`}
										</p>
									</div>
								</div>
							)}
						</section>
					)}

					{/* 前提本セクション */}
					<section className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 mb-6">
						<h2 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-4">
							先に読んでおきたい本 ({prerequisiteBooks.length})
						</h2>

						{prerequisiteBooks.length === 0 ? (
							<p className="text-sm text-purple-300/40">
								前提本はまだ設定されていません
							</p>
						) : (
							<div className="grid gap-2 mb-3">
								{prerequisiteBooks.map((prereq) => (
									<div
										key={prereq.id}
										className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-2.5"
									>
										<Link
											to={`/tsundoku_2_0/my/book/${prereq.id}`}
											className="flex items-center gap-3 flex-1 min-w-0 hover:text-fuchsia-200 transition-colors"
										>
											{prereq.coverImageUrl ? (
												<img
													src={prereq.coverImageUrl}
													alt=""
													className="w-8 h-10 object-cover rounded flex-shrink-0"
												/>
											) : (
												<div className="w-8 h-10 bg-white/10 rounded flex-shrink-0" />
											)}
											<div className="min-w-0">
												<p className="text-sm text-white font-medium truncate">
													{prereq.title}
												</p>
												<p className="text-xs text-purple-300/50">{prereq.author}</p>
											</div>
										</Link>
										<div className="flex items-center gap-2 flex-shrink-0">
											<span
												className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(prereq.status as BookStatus)}`}
											>
												{BOOK_STATUSES[prereq.status as BookStatus]}
											</span>
											{isOwner && (
												<form method="post">
													<input type="hidden" name="intent" value="removePrerequisite" />
													<input type="hidden" name="memberId" value={memberId} />
													<input
														type="hidden"
														name="prerequisiteBookId"
														value={prereq.id}
													/>
													<button
														type="submit"
														className="text-xs text-red-400 hover:text-red-300 transition-colors"
													>
														&times;
													</button>
												</form>
											)}
										</div>
									</div>
								))}
							</div>
						)}

						{/* 前提本追加フォーム */}
						{isOwner && (
							<>
								{!showPrereqForm ? (
									<button
										type="button"
										onClick={() => setShowPrereqForm(true)}
										className="text-sm text-fuchsia-300 hover:text-fuchsia-200 transition-colors"
									>
										+ 前提本を追加
									</button>
								) : (
									<form method="post" className="mt-3 flex gap-2 items-end">
										<input type="hidden" name="intent" value="addPrerequisite" />
										<input type="hidden" name="memberId" value={memberId} />
										<div className="flex-1">
											<label className={labelClass}>自分の積読リストから選択</label>
											<select
												name="prerequisiteBookId"
												required
												className={`${inputClass} appearance-none`}
											>
												<option value="">選択してください</option>
												{myOtherBooks
													.filter(
														(b) =>
															!loaderData.prerequisiteBookIds.includes(b.id),
													)
													.map((b) => (
														<option key={b.id} value={b.id}>
															{b.title} - {b.author}
														</option>
													))}
											</select>
										</div>
										<button
											type="submit"
											className="rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 px-4 py-3 text-sm text-fuchsia-200 hover:bg-fuchsia-500/30 transition-colors"
										>
											追加
										</button>
										<button
											type="button"
											onClick={() => setShowPrereqForm(false)}
											className="rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-sm text-purple-200 hover:bg-white/20 transition-colors"
										>
											取消
										</button>
									</form>
								)}
							</>
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
