import { Link, useNavigate, useSubmit, useNavigation } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, or } from "drizzle-orm";
import { personalBooks, bookActivities, userProfiles } from "~/db/schema";
import {
	GENRES,
	BOOK_STATUSES,
	BOOK_VISIBILITY,
	type BookSearchResult,
	type BookStatus,
	type BookVisibility,
} from "~/books/types";
import type { Route } from "./+types/books.my-photo-add";
import { useState, useEffect, useRef, useCallback } from "react";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "写真から本を追加 | マイ積読リスト | 積読 2.0 | hidelberq" },
	];
}

// 認識結果の型
interface RecognizedBookResult extends BookSearchResult {
	recognized: { title: string; author: string };
}

// 各本ごとの追加設定
interface BookEditData {
	genre: string;
	status: BookStatus;
	visibility: BookVisibility;
	difficulty: number | null;
	importance: number | null;
	recommendation: number | null;
	tags: string;
	memo: string;
}

// action に送信するデータ型
interface BookToAdd extends BookSearchResult {
	recognized: { title: string; author: string };
	editData: BookEditData;
}

// 一括追加の action
export async function action({ request, context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const formData = await request.formData();

	const memberId = formData.get("memberId") as string;
	const memberName = formData.get("memberName") as string;

	if (!memberId || !memberName) {
		return { error: "ユーザー情報が不足しています" };
	}

	const booksJson = formData.get("books") as string;
	if (!booksJson) {
		return { error: "追加する本が選択されていません" };
	}

	let booksToAdd: BookToAdd[];
	try {
		booksToAdd = JSON.parse(booksJson) as BookToAdd[];
	} catch {
		return { error: "データの解析に失敗しました" };
	}

	if (booksToAdd.length === 0) {
		return { error: "追加する本が選択されていません" };
	}

	const [profile] = await db
		.select()
		.from(userProfiles)
		.where(eq(userProfiles.memberId, memberId))
		.limit(1);

	let addedCount = 0;
	let skippedCount = 0;
	for (const book of booksToAdd) {
		const title = book.title?.trim();
		const author = book.author?.trim();
		if (!title || !author) continue;

		// 重複チェック: ISBN またはタイトル+著者名で既に登録済みかを確認
		const matchConditions = [];
		if (book.isbn) {
			matchConditions.push(eq(personalBooks.isbn, book.isbn));
		}
		matchConditions.push(
			and(eq(personalBooks.title, title), eq(personalBooks.author, author))!,
		);
		const [existing] = await db
			.select({ id: personalBooks.id })
			.from(personalBooks)
			.where(
				and(
					eq(personalBooks.memberId, memberId),
					or(...matchConditions),
				),
			)
			.limit(1);

		if (existing) {
			skippedCount++;
			continue;
		}

		const edit = book.editData;
		const tagsJson = edit?.tags
			? JSON.stringify(edit.tags.split(",").map((t) => t.trim()).filter(Boolean))
			: null;

		const [inserted] = await db
			.insert(personalBooks)
			.values({
				memberId,
				memberName,
				title,
				author,
				isbn: book.isbn || null,
				publishedYear: book.publishedYear || null,
				publisher: book.publisher || null,
				coverImageUrl: book.coverImageUrl || null,
				description: book.description || null,
				pageCount: book.pageCount || null,
				genre: edit?.genre || null,
				status: edit?.status || "tsundoku",
				visibility: edit?.visibility || "public",
				difficulty: edit?.difficulty || null,
				importance: edit?.importance || null,
				recommendation: edit?.recommendation || null,
				tags: tagsJson,
				memo: edit?.memo?.trim() || null,
			})
			.returning();

		// アクティビティを記録
		await db.insert(bookActivities).values({
			memberId,
			type: "book_added",
			targetType: "book",
			targetId: inserted.id,
			metadata: JSON.stringify({
				displayName: profile?.displayName ?? memberName,
				avatarEmoji: profile?.avatarEmoji ?? "📚",
				bookTitle: title,
				bookAuthor: author,
				bookCoverImageUrl: book.coverImageUrl || null,
			}),
		});

		addedCount++;
	}

	return { success: true, addedCount, skippedCount };
}

function defaultEditData(): BookEditData {
	return {
		genre: "",
		status: "tsundoku",
		visibility: "public",
		difficulty: null,
		importance: null,
		recommendation: null,
		tags: "",
		memo: "",
	};
}

export default function BooksMyPhotoAdd({
	actionData,
}: Route.ComponentProps) {
	const navigate = useNavigate();
	const submit = useSubmit();
	const navigation = useNavigation();
	const submitting = navigation.state === "submitting";
	const [memberId, setMemberId] = useState("");
	const [memberName, setMemberName] = useState("");
	const fileInputRef = useRef<HTMLInputElement>(null);

	// 状態管理
	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	const [savedPhotoUrl, setSavedPhotoUrl] = useState<string | null>(null);
	const [recognizing, setRecognizing] = useState(false);
	const [error, setError] = useState("");
	const [recognizedBooks, setRecognizedBooks] = useState<
		RecognizedBookResult[]
	>([]);
	const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(
		new Set(),
	);
	const [editingIndex, setEditingIndex] = useState<number | null>(null);

	// 編集フォームの状態
	const [editTitle, setEditTitle] = useState("");
	const [editAuthor, setEditAuthor] = useState("");
	const [editIsbn, setEditIsbn] = useState("");
	const [editPublishedYear, setEditPublishedYear] = useState("");
	const [editPublisher, setEditPublisher] = useState("");
	const [editCoverImageUrl, setEditCoverImageUrl] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editPageCount, setEditPageCount] = useState("");

	// 各本ごとの追加設定 (index -> BookEditData)
	const [editDataMap, setEditDataMap] = useState<Map<number, BookEditData>>(
		new Map(),
	);

	// Google Books 検索の状態
	const [editSearchQuery, setEditSearchQuery] = useState("");
	const [editSearchResults, setEditSearchResults] = useState<BookSearchResult[]>([]);
	const [editSearching, setEditSearching] = useState(false);
	const [editSearchError, setEditSearchError] = useState("");
	const editDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const getEditData = (index: number): BookEditData => {
		return editDataMap.get(index) ?? defaultEditData();
	};

	const updateEditData = (index: number, partial: Partial<BookEditData>) => {
		setEditDataMap((prev) => {
			const next = new Map(prev);
			next.set(index, { ...getEditData(index), ...partial });
			return next;
		});
	};

	useEffect(() => {
		const id = localStorage.getItem("bookMemberId") || "";
		const name = localStorage.getItem("bookDisplayName") || "";
		setMemberId(id);
		setMemberName(name);
	}, []);

	useEffect(() => {
		if (actionData?.success) {
			navigate("/tsundoku_2_0/my");
		}
	}, [actionData, navigate]);

	// 編集フォーム内の Google Books 検索
	const searchBooksForEdit = useCallback(async () => {
		if (!editSearchQuery.trim()) return;
		setEditSearching(true);
		setEditSearchError("");
		try {
			const res = await fetch(
				`/api/tsundoku_2_0/search?q=${encodeURIComponent(editSearchQuery)}`,
			);
			const data = (await res.json()) as { results: BookSearchResult[]; error?: string };
			if (res.status === 429 || data.error === "rate_limited") {
				setEditSearchError("検索の利用回数上限に達しました。しばらく待ってから再度お試しください。");
				setEditSearchResults([]);
			} else {
				setEditSearchResults(data.results);
			}
		} catch {
			setEditSearchResults([]);
		} finally {
			setEditSearching(false);
		}
	}, [editSearchQuery]);

	// 編集中の検索デバウンス
	useEffect(() => {
		if (editDebounceTimer.current) {
			clearTimeout(editDebounceTimer.current);
		}
		if (editSearchQuery.trim().length >= 2) {
			editDebounceTimer.current = setTimeout(() => {
				searchBooksForEdit();
			}, 500);
		}
		return () => {
			if (editDebounceTimer.current) clearTimeout(editDebounceTimer.current);
		};
	}, [editSearchQuery, searchBooksForEdit]);

	const selectSearchResultForEdit = (result: BookSearchResult) => {
		setEditTitle(result.title);
		setEditAuthor(result.author);
		setEditIsbn(result.isbn ?? "");
		setEditPublishedYear(result.publishedYear ?? "");
		setEditPublisher(result.publisher ?? "");
		setEditCoverImageUrl(result.coverImageUrl ?? "");
		setEditDescription(result.description ?? "");
		setEditPageCount(result.pageCount?.toString() ?? "");
		setEditSearchResults([]);
		setEditSearchQuery("");
	};

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
		setRecognizedBooks([]);
		setSelectedIndexes(new Set());
		setEditDataMap(new Map());
		setError("");
	};

	const handleRecognize = async () => {
		const file = fileInputRef.current?.files?.[0];
		if (!file) {
			setError("画像を選択してください");
			return;
		}

		setRecognizing(true);
		setError("");
		setRecognizedBooks([]);

		try {
			const formData = new FormData();
			formData.append("image", file);
			formData.append("memberId", memberId);

			const res = await fetch("/api/tsundoku_2_0/recognize", {
				method: "POST",
				body: formData,
			});

			const data = (await res.json()) as {
				books?: RecognizedBookResult[];
				photoUrl?: string;
				error?: string;
				message?: string;
			};

			if (data.photoUrl) {
				setSavedPhotoUrl(data.photoUrl);
			}

			if (!res.ok || data.error) {
				setError(data.error || "認識に失敗しました");
				return;
			}

			if (!data.books || data.books.length === 0) {
				setError(
					data.message || "写真から本を認識できませんでした。別の角度で撮影してみてください。",
				);
				return;
			}

			setRecognizedBooks(data.books);
			setSelectedIndexes(
				new Set(data.books.map((_: RecognizedBookResult, i: number) => i)),
			);
		} catch {
			setError("通信エラーが発生しました");
		} finally {
			setRecognizing(false);
		}
	};

	const toggleSelect = (index: number) => {
		setSelectedIndexes((prev) => {
			const next = new Set(prev);
			if (next.has(index)) {
				next.delete(index);
			} else {
				next.add(index);
			}
			return next;
		});
	};

	const startEditing = (index: number) => {
		const book = recognizedBooks[index];
		setEditingIndex(index);
		setEditTitle(book.title);
		setEditAuthor(book.author);
		setEditIsbn(book.isbn ?? "");
		setEditPublishedYear(book.publishedYear ?? "");
		setEditPublisher(book.publisher ?? "");
		setEditCoverImageUrl(book.coverImageUrl ?? "");
		setEditDescription(book.description ?? "");
		setEditPageCount(book.pageCount?.toString() ?? "");
		setEditSearchQuery("");
		setEditSearchResults([]);
		setEditSearchError("");
	};

	const saveEdit = () => {
		if (editingIndex === null) return;
		const trimmedTitle = editTitle.trim();
		const trimmedAuthor = editAuthor.trim();
		if (!trimmedTitle) return;

		setRecognizedBooks((prev) => {
			const next = [...prev];
			next[editingIndex] = {
				...next[editingIndex],
				title: trimmedTitle,
				author: trimmedAuthor,
				isbn: editIsbn.trim() || null,
				publishedYear: editPublishedYear.trim() || null,
				publisher: editPublisher.trim() || null,
				coverImageUrl: editCoverImageUrl.trim() || null,
				description: editDescription.trim() || null,
				pageCount: editPageCount ? Number(editPageCount) : null,
			};
			return next;
		});
		setEditingIndex(null);
	};

	const cancelEdit = () => {
		setEditingIndex(null);
	};

	const toggleAll = () => {
		if (selectedIndexes.size === recognizedBooks.length) {
			setSelectedIndexes(new Set());
		} else {
			setSelectedIndexes(
				new Set(recognizedBooks.map((_, i) => i)),
			);
		}
	};

	const handleSubmit = () => {
		const selectedBooks: BookToAdd[] = recognizedBooks
			.map((book, i) => ({ book, i }))
			.filter(({ i }) => selectedIndexes.has(i))
			.map(({ book, i }) => ({
				...book,
				editData: getEditData(i),
			}));
		if (selectedBooks.length === 0) {
			setError("追加する本を選択してください");
			return;
		}

		const formData = new FormData();
		formData.append("memberId", memberId);
		formData.append("memberName", memberName);
		formData.append("books", JSON.stringify(selectedBooks));

		submit(formData, { method: "post" });
	};

	const inputClass =
		"w-full rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-sm text-white placeholder-purple-300/40 focus:outline-none focus:border-fuchsia-500/50";
	const labelClass = "text-xs text-purple-300/60 block mb-0.5";

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-16">
				<Link
					to="/tsundoku_2_0/my/add"
					className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors mb-8"
				>
					&larr; 本を追加に戻る
				</Link>

				<h1 className="text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
					写真から本を追加
				</h1>
				<p className="text-sm text-purple-300/60 mb-8">
					積まれた本の写真を撮影して、まとめてリストに追加できます
				</p>

				{/* 画像アップロードエリア */}
				<section className="w-full max-w-lg mb-8">
					<div
						className="relative rounded-2xl border-2 border-dashed border-white/20 hover:border-fuchsia-500/40 transition-colors cursor-pointer overflow-hidden"
						onClick={() => fileInputRef.current?.click()}
					>
						{(savedPhotoUrl || previewUrl) ? (
							<div className="relative">
								<img
									src={savedPhotoUrl || previewUrl || ""}
									alt="アップロードした写真"
									className="w-full max-h-80 object-contain bg-black/20"
								/>
								<div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent p-4">
									<p className="text-xs text-white/80 text-center">
										タップして別の写真を選択
									</p>
								</div>
							</div>
						) : (
							<div className="flex flex-col items-center justify-center py-16 px-4">
								<div className="w-16 h-16 rounded-full bg-fuchsia-500/20 flex items-center justify-center mb-4">
									<svg
										className="w-8 h-8 text-fuchsia-400"
										fill="none"
										viewBox="0 0 24 24"
										strokeWidth={1.5}
										stroke="currentColor"
									>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z"
										/>
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z"
										/>
									</svg>
								</div>
								<p className="text-sm font-medium text-purple-200 mb-1">
									積まれた本の写真を選択
								</p>
								<p className="text-xs text-purple-300/40">
									背表紙や表紙が見えるように撮影してください
								</p>
							</div>
						)}
					</div>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/*"
						onChange={handleFileSelect}
						className="hidden"
					/>

					{/* 認識ボタン */}
					{previewUrl && !savedPhotoUrl && !recognizing && recognizedBooks.length === 0 && (
						<button
							type="button"
							onClick={handleRecognize}
							className="w-full mt-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 font-semibold text-white transition-all hover:from-cyan-500 hover:to-blue-500 hover:shadow-lg hover:shadow-cyan-500/20"
						>
							AI で本を認識する
						</button>
					)}

					{/* 認識中 */}
					{recognizing && (
						<div className="mt-4 rounded-xl bg-white/5 border border-white/10 px-4 py-6 text-center">
							<div className="inline-block w-6 h-6 border-2 border-fuchsia-400 border-t-transparent rounded-full animate-spin mb-3" />
							<p className="text-sm text-purple-200">
								AI が本を認識中...
							</p>
							<p className="text-xs text-purple-300/40 mt-1">
								写真の解析に数秒かかります
							</p>
						</div>
					)}
				</section>

				{/* エラー表示 */}
				{error && (
					<div className="w-full max-w-lg mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
						{error}
					</div>
				)}

				{actionData?.error && (
					<div className="w-full max-w-lg mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
						{actionData.error}
					</div>
				)}

				{/* 認識結果 */}
				{recognizedBooks.length > 0 && (
					<section className="w-full max-w-lg">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80">
								認識結果（{recognizedBooks.length}冊）
							</h2>
							<button
								type="button"
								onClick={toggleAll}
								className="text-xs text-purple-300/60 hover:text-purple-200 transition-colors"
							>
								{selectedIndexes.size === recognizedBooks.length
									? "全て解除"
									: "全て選択"}
							</button>
						</div>

						<div className="space-y-3 mb-6">
							{recognizedBooks.map((book, index) => (
								<div
									key={`${book.recognized.title}-${index}`}
									className={`w-full rounded-xl border transition-all ${
										selectedIndexes.has(index)
											? "bg-fuchsia-500/10 border-fuchsia-500/40"
											: "bg-white/5 border-white/10 opacity-60"
									}`}
								>
									{/* ヘッダー行: チェックボックス + 書影 + 基本情報 */}
									<div className="flex items-start gap-3 px-4 py-3">
										{/* チェックボックス */}
										<button
											type="button"
											onClick={() => toggleSelect(index)}
											className="mt-1 flex-shrink-0"
										>
											<div
												className={`w-5 h-5 rounded flex items-center justify-center border ${
													selectedIndexes.has(index)
														? "bg-fuchsia-500 border-fuchsia-500"
														: "border-white/30"
												}`}
											>
												{selectedIndexes.has(index) && (
													<svg
														className="w-3 h-3 text-white"
														fill="none"
														viewBox="0 0 24 24"
														strokeWidth={3}
														stroke="currentColor"
													>
														<path
															strokeLinecap="round"
															strokeLinejoin="round"
															d="M4.5 12.75l6 6 9-13.5"
														/>
													</svg>
												)}
											</div>
										</button>

										{/* 書影 */}
										{book.coverImageUrl ? (
											<img
												src={book.coverImageUrl}
												alt=""
												className="w-12 h-16 object-cover rounded flex-shrink-0"
											/>
										) : (
											<div className="w-12 h-16 bg-white/10 rounded flex-shrink-0 flex items-center justify-center text-purple-300/40 text-xs">
												No img
											</div>
										)}

										{/* 情報表示 */}
										<div className="min-w-0 flex-1">
											<p className="text-sm font-medium text-white line-clamp-2">
												{book.title}
											</p>
											<p className="text-xs text-purple-300/60 mt-0.5">
												{book.author}
												{book.publishedYear &&
													` (${book.publishedYear})`}
											</p>
											{book.publisher && (
												<p className="text-xs text-purple-300/40 mt-0.5">
													{book.publisher}
												</p>
											)}
											{/* カスタム設定の表示 */}
											{editDataMap.has(index) && (
												<div className="flex flex-wrap gap-1 mt-1">
													{editDataMap.get(index)!.status !== "tsundoku" && (
														<span className="text-xs bg-fuchsia-500/20 text-fuchsia-300 rounded px-1.5 py-0.5">
															{BOOK_STATUSES[editDataMap.get(index)!.status]}
														</span>
													)}
													{editDataMap.get(index)!.genre && (
														<span className="text-xs bg-cyan-500/20 text-cyan-300 rounded px-1.5 py-0.5">
															{editDataMap.get(index)!.genre}
														</span>
													)}
												</div>
											)}
											{/* AI認識との差分表示 */}
											{book.recognized.title !== book.title && (
												<p className="text-xs text-cyan-400/60 mt-1">
													AI認識: {book.recognized.title}
												</p>
											)}
											{/* 編集ボタン */}
											<button
												type="button"
												onClick={() => startEditing(index)}
												className={`mt-2 inline-flex items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
													editingIndex === index
														? "bg-fuchsia-500/30 border border-fuchsia-500/50 text-fuchsia-200"
														: "bg-white/10 border border-white/20 text-purple-200 hover:bg-white/20 hover:text-white"
												}`}
											>
												<svg
													className="w-3 h-3"
													fill="none"
													viewBox="0 0 24 24"
													strokeWidth={2}
													stroke="currentColor"
												>
													<path
														strokeLinecap="round"
														strokeLinejoin="round"
														d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
													/>
												</svg>
												{editingIndex === index ? "編集中" : "編集"}
											</button>
										</div>
									</div>

									{/* 展開型編集フォーム */}
									{editingIndex === index && (
										<div className="border-t border-white/10 px-4 py-4 space-y-4">
											{/* Google Books 検索 */}
											<div>
												<h3 className="text-xs font-semibold uppercase tracking-widest text-cyan-400/80 mb-2">
													書籍を検索して補完
												</h3>
												<div className="flex gap-2">
													<input
														type="text"
														value={editSearchQuery}
														onChange={(e) => setEditSearchQuery(e.target.value)}
														onKeyDown={(e) => {
															if (e.key === "Enter") {
																e.preventDefault();
																searchBooksForEdit();
															}
														}}
														placeholder="タイトルまたは著者名で検索..."
														className={`${inputClass} flex-1`}
													/>
													<button
														type="button"
														onClick={searchBooksForEdit}
														disabled={editSearching}
														className="rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 px-3 py-1.5 text-xs font-medium text-white transition-all hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
													>
														{editSearching ? "..." : "検索"}
													</button>
												</div>

												{editSearchError && (
													<div className="mt-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 text-xs text-yellow-300">
														{editSearchError}
													</div>
												)}

												{editSearchResults.length > 0 && (
													<div className="mt-2 rounded-lg bg-white/5 border border-white/10 divide-y divide-white/5 max-h-48 overflow-y-auto">
														{editSearchResults.map((result, i) => (
															<button
																key={`${result.isbn ?? i}-${result.title}`}
																type="button"
																onClick={() => selectSearchResultForEdit(result)}
																className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-white/10 transition-colors"
															>
																{result.coverImageUrl ? (
																	<img
																		src={result.coverImageUrl}
																		alt=""
																		className="w-8 h-11 object-cover rounded flex-shrink-0"
																	/>
																) : (
																	<div className="w-8 h-11 bg-white/10 rounded flex-shrink-0 flex items-center justify-center text-purple-300/40 text-[10px]">
																		No img
																	</div>
																)}
																<div className="min-w-0">
																	<p className="text-xs font-medium text-white truncate">
																		{result.title}
																	</p>
																	<p className="text-[10px] text-purple-300/60">
																		{result.author}
																		{result.publishedYear && ` (${result.publishedYear})`}
																	</p>
																</div>
															</button>
														))}
													</div>
												)}
											</div>

											{/* 書籍情報フォーム */}
											<div className="space-y-3">
												<h3 className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400/80">
													書籍情報
												</h3>

												{/* 表紙プレビュー */}
												{editCoverImageUrl && (
													<div className="flex justify-center">
														<img
															src={editCoverImageUrl}
															alt="表紙"
															className="h-24 object-cover rounded-lg border border-white/10"
														/>
													</div>
												)}

												<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
													<div className="sm:col-span-2">
														<label className={labelClass}>
															タイトル<span className="text-red-400 ml-1">*</span>
														</label>
														<input
															type="text"
															value={editTitle}
															onChange={(e) => setEditTitle(e.target.value)}
															className={inputClass}
														/>
													</div>
													<div className="sm:col-span-2">
														<label className={labelClass}>
															著者<span className="text-red-400 ml-1">*</span>
														</label>
														<input
															type="text"
															value={editAuthor}
															onChange={(e) => setEditAuthor(e.target.value)}
															className={inputClass}
														/>
													</div>
													<div>
														<label className={labelClass}>ISBN</label>
														<input
															type="text"
															value={editIsbn}
															onChange={(e) => setEditIsbn(e.target.value)}
															className={inputClass}
														/>
													</div>
													<div>
														<label className={labelClass}>出版年</label>
														<input
															type="text"
															value={editPublishedYear}
															onChange={(e) => setEditPublishedYear(e.target.value)}
															className={inputClass}
														/>
													</div>
													<div>
														<label className={labelClass}>出版社</label>
														<input
															type="text"
															value={editPublisher}
															onChange={(e) => setEditPublisher(e.target.value)}
															className={inputClass}
														/>
													</div>
													<div>
														<label className={labelClass}>ページ数</label>
														<input
															type="number"
															value={editPageCount}
															onChange={(e) => setEditPageCount(e.target.value)}
															className={inputClass}
														/>
													</div>
													<div className="sm:col-span-2">
														<label className={labelClass}>ジャンル</label>
														<select
															value={getEditData(index).genre}
															onChange={(e) => updateEditData(index, { genre: e.target.value })}
															className={`${inputClass} appearance-none`}
														>
															<option value="">選択してください</option>
															{GENRES.map((g) => (
																<option key={g} value={g}>{g}</option>
															))}
														</select>
													</div>
													<div className="sm:col-span-2">
														<label className={labelClass}>内容（短く）</label>
														<textarea
															rows={2}
															value={editDescription}
															onChange={(e) => setEditDescription(e.target.value)}
															placeholder="本の内容を簡単に説明..."
															className={`${inputClass} resize-none`}
														/>
													</div>
												</div>
											</div>

											{/* ステータスと設定 */}
											<div className="space-y-3">
												<h3 className="text-xs font-semibold uppercase tracking-widest text-fuchsia-400/80">
													ステータスと設定
												</h3>

												{/* ステータス */}
												<div className="flex flex-wrap gap-1.5">
													{(Object.entries(BOOK_STATUSES) as [BookStatus, string][]).map(
														([key, label]) => (
															<label
																key={key}
																className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors text-xs ${
																	getEditData(index).status === key
																		? "border-fuchsia-500/40 bg-fuchsia-500/10"
																		: "border-white/10 bg-white/5 hover:bg-white/10"
																}`}
															>
																<input
																	type="radio"
																	name={`status-${index}`}
																	checked={getEditData(index).status === key}
																	onChange={() => updateEditData(index, { status: key })}
																	className="accent-fuchsia-500 w-3 h-3"
																/>
																<span className="text-purple-200">{label}</span>
															</label>
														),
													)}
												</div>

												{/* 公開/非公開 */}
												<div>
													<label className={labelClass}>公開設定</label>
													<div className="flex gap-1.5">
														{(Object.entries(BOOK_VISIBILITY) as [BookVisibility, string][]).map(
															([key, label]) => (
																<label
																	key={key}
																	className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 cursor-pointer transition-colors text-xs ${
																		getEditData(index).visibility === key
																			? "border-fuchsia-500/40 bg-fuchsia-500/10"
																			: "border-white/10 bg-white/5 hover:bg-white/10"
																	}`}
																>
																	<input
																		type="radio"
																		name={`visibility-${index}`}
																		checked={getEditData(index).visibility === key}
																		onChange={() => updateEditData(index, { visibility: key })}
																		className="accent-fuchsia-500 w-3 h-3"
																	/>
																	<span className="text-purple-200">{label}</span>
																</label>
															),
														)}
													</div>
												</div>

												{/* 評価 */}
												<div className="grid grid-cols-3 gap-2">
													<div>
														<label className={labelClass}>難易度</label>
														<select
															value={getEditData(index).difficulty ?? ""}
															onChange={(e) => updateEditData(index, { difficulty: e.target.value ? Number(e.target.value) : null })}
															className={`${inputClass} appearance-none`}
														>
															<option value="">-</option>
															{[1, 2, 3, 4, 5].map((v) => (
																<option key={v} value={v}>{"★".repeat(v)}{"☆".repeat(5 - v)}</option>
															))}
														</select>
													</div>
													<div>
														<label className={labelClass}>重要度</label>
														<select
															value={getEditData(index).importance ?? ""}
															onChange={(e) => updateEditData(index, { importance: e.target.value ? Number(e.target.value) : null })}
															className={`${inputClass} appearance-none`}
														>
															<option value="">-</option>
															{[1, 2, 3, 4, 5].map((v) => (
																<option key={v} value={v}>{"★".repeat(v)}{"☆".repeat(5 - v)}</option>
															))}
														</select>
													</div>
													<div>
														<label className={labelClass}>おすすめ度</label>
														<select
															value={getEditData(index).recommendation ?? ""}
															onChange={(e) => updateEditData(index, { recommendation: e.target.value ? Number(e.target.value) : null })}
															className={`${inputClass} appearance-none`}
														>
															<option value="">-</option>
															{[1, 2, 3, 4, 5].map((v) => (
																<option key={v} value={v}>{"★".repeat(v)}{"☆".repeat(5 - v)}</option>
															))}
														</select>
													</div>
												</div>

												{/* タグ */}
												<div>
													<label className={labelClass}>タグ（カンマ区切り）</label>
													<input
														type="text"
														value={getEditData(index).tags}
														onChange={(e) => updateEditData(index, { tags: e.target.value })}
														placeholder="例: 入門書, 輪読会向き, 名著"
														className={inputClass}
													/>
												</div>

												{/* メモ */}
												<div>
													<label className={labelClass}>メモ / 感想</label>
													<textarea
														rows={2}
														value={getEditData(index).memo}
														onChange={(e) => updateEditData(index, { memo: e.target.value })}
														placeholder="自由にメモや感想を..."
														className={`${inputClass} resize-none`}
													/>
												</div>
											</div>

											{/* 保存/キャンセルボタン */}
											<div className="flex gap-2 pt-1">
												<button
													type="button"
													onClick={saveEdit}
													className="rounded-lg bg-fuchsia-500/30 border border-fuchsia-500/40 px-4 py-1.5 text-xs text-fuchsia-200 hover:bg-fuchsia-500/40 transition-colors"
												>
													保存
												</button>
												<button
													type="button"
													onClick={cancelEdit}
													className="rounded-lg bg-white/10 border border-white/10 px-4 py-1.5 text-xs text-purple-300/60 hover:bg-white/20 transition-colors"
												>
													キャンセル
												</button>
											</div>
										</div>
									)}
								</div>
							))}
						</div>

						{/* 一括追加ボタン */}
						<button
							type="button"
							onClick={handleSubmit}
							disabled={
								selectedIndexes.size === 0 || submitting
							}
							className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 font-semibold text-white transition-all hover:from-fuchsia-500 hover:to-purple-500 hover:shadow-lg hover:shadow-fuchsia-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{submitting
								? "追加中..."
								: `${selectedIndexes.size}冊を積読リストに追加`}
						</button>

						{/* 再撮影ボタン */}
						<button
							type="button"
							onClick={() => {
								setPreviewUrl(null);
								setSavedPhotoUrl(null);
								setRecognizedBooks([]);
								setSelectedIndexes(new Set());
								setEditDataMap(new Map());
								setError("");
								if (fileInputRef.current) {
									fileInputRef.current.value = "";
								}
							}}
							className="w-full mt-3 rounded-xl bg-white/5 border border-white/10 px-6 py-3 text-sm text-purple-200 transition-all hover:bg-white/10"
						>
							別の写真で再認識
						</button>
					</section>
				)}
			</div>
		</div>
	);
}
