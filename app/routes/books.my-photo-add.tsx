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

// 認識結果の型（個別設定を含む拡張版）
interface RecognizedBookResult extends BookSearchResult {
	recognized: { title: string; author: string };
	// 個別設定フィールド
	status?: BookStatus;
	visibility?: BookVisibility;
	genre?: string;
	difficulty?: number | null;
	importance?: number | null;
	recommendation?: number | null;
	tags?: string;
	memo?: string;
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

	let booksToAdd: RecognizedBookResult[];
	try {
		booksToAdd = JSON.parse(booksJson) as RecognizedBookResult[];
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

		const tagsValue = book.tags?.trim()
			? JSON.stringify(
					book.tags
						.split(",")
						.map((t) => t.trim())
						.filter(Boolean),
				)
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
				genre: book.genre || null,
				status: book.status || "tsundoku",
				visibility: book.visibility || "public",
				difficulty: book.difficulty ?? null,
				importance: book.importance ?? null,
				recommendation: book.recommendation ?? null,
				memo: book.memo?.trim() || null,
				tags: tagsValue,
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
	const [editTitle, setEditTitle] = useState("");
	const [editAuthor, setEditAuthor] = useState("");
	const [editIsbn, setEditIsbn] = useState("");
	const [editPublishedYear, setEditPublishedYear] = useState("");
	const [editPublisher, setEditPublisher] = useState("");
	const [editCoverImageUrl, setEditCoverImageUrl] = useState("");
	const [editDescription, setEditDescription] = useState("");
	const [editPageCount, setEditPageCount] = useState("");
	const [editGenre, setEditGenre] = useState("");
	const [editStatus, setEditStatus] = useState<BookStatus>("tsundoku");
	const [editVisibility, setEditVisibility] = useState<BookVisibility>("public");
	const [editDifficulty, setEditDifficulty] = useState("");
	const [editImportance, setEditImportance] = useState("");
	const [editRecommendation, setEditRecommendation] = useState("");
	const [editTags, setEditTags] = useState("");
	const [editMemo, setEditMemo] = useState("");

	// 編集モーダル内の検索
	const [editSearchQuery, setEditSearchQuery] = useState("");
	const [editSearchResults, setEditSearchResults] = useState<BookSearchResult[]>([]);
	const [editSearching, setEditSearching] = useState(false);
	const [editSearchError, setEditSearchError] = useState("");
	const editDebounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

	const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// プレビュー表示
		const url = URL.createObjectURL(file);
		setPreviewUrl(url);
		setRecognizedBooks([]);
		setSelectedIndexes(new Set());
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
			// 全て選択状態にする
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

	// 編集モーダル内の書籍検索
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

	// 編集モーダル内のデバウンス検索
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

	const selectBookForEdit = (book: BookSearchResult) => {
		setEditTitle(book.title);
		setEditAuthor(book.author);
		setEditIsbn(book.isbn ?? "");
		setEditPublishedYear(book.publishedYear ?? "");
		setEditPublisher(book.publisher ?? "");
		setEditCoverImageUrl(book.coverImageUrl ?? "");
		setEditDescription(book.description ?? "");
		setEditPageCount(book.pageCount?.toString() ?? "");
		setEditSearchResults([]);
		setEditSearchQuery("");
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
		setEditGenre(book.genre ?? "");
		setEditStatus(book.status ?? "tsundoku");
		setEditVisibility(book.visibility ?? "public");
		setEditDifficulty(book.difficulty?.toString() ?? "");
		setEditImportance(book.importance?.toString() ?? "");
		setEditRecommendation(book.recommendation?.toString() ?? "");
		setEditTags(book.tags ?? "");
		setEditMemo(book.memo ?? "");
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
				genre: editGenre || undefined,
				status: editStatus,
				visibility: editVisibility,
				difficulty: editDifficulty ? Number(editDifficulty) : null,
				importance: editImportance ? Number(editImportance) : null,
				recommendation: editRecommendation ? Number(editRecommendation) : null,
				tags: editTags.trim() || undefined,
				memo: editMemo.trim() || undefined,
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
		const selectedBooks = recognizedBooks.filter((_, i) =>
			selectedIndexes.has(i),
		);
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
									className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
										selectedIndexes.has(index)
											? "bg-fuchsia-500/10 border-fuchsia-500/40"
											: "bg-white/5 border-white/10 opacity-60"
									}`}
								>
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

									{/* 情報 */}
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
										{/* 個別設定の表示 */}
										<div className="flex flex-wrap gap-1 mt-1">
											{book.status && book.status !== "tsundoku" && (
												<span className="inline-block text-xs bg-white/10 rounded px-1.5 py-0.5 text-purple-200">
													{BOOK_STATUSES[book.status]}
												</span>
											)}
											{book.genre && (
												<span className="inline-block text-xs bg-white/10 rounded px-1.5 py-0.5 text-purple-200">
													{book.genre}
												</span>
											)}
										</div>
										{/* AI認識との差分表示 */}
										{book.recognized.title !==
											book.title && (
											<p className="text-xs text-cyan-400/60 mt-1">
												AI認識:{" "}
												{book.recognized.title}
											</p>
										)}
										{/* 編集ボタン */}
										<button
											type="button"
											onClick={() =>
												startEditing(index)
											}
											className="text-xs text-purple-300/40 hover:text-fuchsia-400 mt-1.5 transition-colors"
										>
											編集
										</button>
									</div>
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

			{/* 編集モーダル */}
			{editingIndex !== null && (
				<div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 backdrop-blur-sm">
					<div className="relative w-full max-w-lg mx-4 my-8 rounded-2xl bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950 border border-white/10 shadow-2xl">
						{/* モーダルヘッダー */}
						<div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-white/10 bg-violet-950/80 backdrop-blur-sm rounded-t-2xl">
							<h2 className="text-lg font-bold text-white">
								本を編集
							</h2>
							<button
								type="button"
								onClick={cancelEdit}
								className="rounded-lg bg-white/10 p-2 text-purple-300/60 hover:bg-white/20 hover:text-white transition-colors"
							>
								<svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
									<path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
								</svg>
							</button>
						</div>

						<div className="px-6 py-6 space-y-6">
							{/* 書籍検索 */}
							<section>
								<h3 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-3">
									書籍を検索
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
										className="rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-3 font-medium text-white transition-all hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50"
									>
										{editSearching ? "..." : "検索"}
									</button>
								</div>

								{/* 検索エラー */}
								{editSearchError && (
									<div className="mt-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 px-4 py-3 text-sm text-yellow-300">
										{editSearchError}
									</div>
								)}

								{/* 検索結果 */}
								{editSearchResults.length > 0 && (
									<div className="mt-3 rounded-xl bg-white/5 border border-white/10 divide-y divide-white/5 max-h-60 overflow-y-auto">
										{editSearchResults.map((result, i) => (
											<button
												key={`${result.isbn ?? i}-${result.title}`}
												type="button"
												onClick={() => selectBookForEdit(result)}
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
							</section>

							{/* 書影プレビュー */}
							{editCoverImageUrl && (
								<div className="flex justify-center">
									<img
										src={editCoverImageUrl}
										alt="表紙"
										className="h-32 object-cover rounded-lg border border-white/10"
									/>
								</div>
							)}

							{/* 基本情報 */}
							<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
										著者名<span className="text-red-400 ml-1">*</span>
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
								<div className="sm:col-span-2">
									<label className={labelClass}>内容（短く）</label>
									<textarea
										rows={3}
										value={editDescription}
										onChange={(e) => setEditDescription(e.target.value)}
										placeholder="本の内容を簡単に説明..."
										className={`${inputClass} resize-none`}
									/>
								</div>
							</div>

							{/* ステータス・設定 */}
							<div className="border-t border-white/10 pt-4">
								<h3 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-4">
									ステータスと設定
								</h3>

								<div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
									{(Object.entries(BOOK_STATUSES) as [BookStatus, string][]).map(
										([key, label]) => (
											<label
												key={key}
												className="flex items-center gap-2 rounded-xl bg-white/5 border border-white/10 px-3 py-2 cursor-pointer hover:bg-white/10 transition-colors has-[:checked]:border-fuchsia-500/40 has-[:checked]:bg-fuchsia-500/10"
											>
												<input
													type="radio"
													name="editStatus"
													value={key}
													checked={editStatus === key}
													onChange={() => setEditStatus(key)}
													className="accent-fuchsia-500"
												/>
												<span className="text-sm text-purple-200">{label}</span>
											</label>
										),
									)}
								</div>

								{/* 公開/非公開 */}
								<div className="mb-4">
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
														name="editVisibility"
														value={key}
														checked={editVisibility === key}
														onChange={() => setEditVisibility(key)}
														className="accent-fuchsia-500"
													/>
													<span className="text-sm text-purple-200">{label}</span>
												</label>
											),
										)}
									</div>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
									<RatingSelect label="難易度" value={editDifficulty} onChange={setEditDifficulty} />
									<RatingSelect label="重要度" value={editImportance} onChange={setEditImportance} />
									<RatingSelect label="おすすめ度" value={editRecommendation} onChange={setEditRecommendation} />
								</div>

								{/* タグ */}
								<div className="mb-4">
									<label className={labelClass}>タグ（カンマ区切り）</label>
									<input
										type="text"
										value={editTags}
										onChange={(e) => setEditTags(e.target.value)}
										placeholder="例: 入門書, 輪読会向き, 名著"
										className={inputClass}
									/>
								</div>

								{/* メモ */}
								<div>
									<label className={labelClass}>メモ / 感想</label>
									<textarea
										rows={3}
										value={editMemo}
										onChange={(e) => setEditMemo(e.target.value)}
										placeholder="自由にメモや感想を..."
										className={`${inputClass} resize-none`}
									/>
								</div>
							</div>
						</div>

						{/* モーダルフッター */}
						<div className="sticky bottom-0 flex gap-3 px-6 py-4 border-t border-white/10 bg-violet-950/80 backdrop-blur-sm rounded-b-2xl">
							<button
								type="button"
								onClick={cancelEdit}
								className="flex-1 rounded-xl bg-white/10 border border-white/10 px-6 py-3 text-sm font-medium text-purple-200 hover:bg-white/20 transition-colors"
							>
								キャンセル
							</button>
							<button
								type="button"
								onClick={saveEdit}
								className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:from-fuchsia-500 hover:to-purple-500 hover:shadow-lg hover:shadow-fuchsia-500/20"
							>
								保存
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

function RatingSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
	return (
		<div>
			<label className="block text-sm font-medium text-purple-200 mb-1.5">
				{label}
			</label>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
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
