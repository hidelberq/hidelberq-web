import { Link, useNavigate } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { personalBooks, bookActivities, userProfiles } from "~/db/schema";
import type { BookSearchResult } from "~/books/types";
import type { Route } from "./+types/books.my-photo-add";
import { useState, useEffect, useRef } from "react";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "写真から本を追加 | マイ積読リスト | 積読 2.0 | hidelberq" },
	];
}

// 認識結果の型
interface RecognizedBookResult extends BookSearchResult {
	recognized: { title: string; author: string };
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
	for (const book of booksToAdd) {
		const title = book.title?.trim();
		const author = book.author?.trim();
		if (!title || !author) continue;

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
				status: "tsundoku",
				visibility: "public",
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

	return { success: true, addedCount };
}

export default function BooksMyPhotoAdd({
	actionData,
}: Route.ComponentProps) {
	const navigate = useNavigate();
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
	const [submitting, setSubmitting] = useState(false);

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

	const toggleAll = () => {
		if (selectedIndexes.size === recognizedBooks.length) {
			setSelectedIndexes(new Set());
		} else {
			setSelectedIndexes(
				new Set(recognizedBooks.map((_, i) => i)),
			);
		}
	};

	const handleSubmit = async () => {
		const selectedBooks = recognizedBooks.filter((_, i) =>
			selectedIndexes.has(i),
		);
		if (selectedBooks.length === 0) {
			setError("追加する本を選択してください");
			return;
		}

		setSubmitting(true);
		try {
			const formData = new FormData();
			formData.append("memberId", memberId);
			formData.append("memberName", memberName);
			formData.append("books", JSON.stringify(selectedBooks));

			const res = await fetch("/tsundoku_2_0/my/photo-add", {
				method: "POST",
				body: formData,
			});

			const data = (await res.json()) as {
				success?: boolean;
				addedCount?: number;
				error?: string;
			};

			if (data.success) {
				navigate("/tsundoku_2_0/my");
			} else {
				setError(data.error || "追加に失敗しました");
			}
		} catch {
			setError("通信エラーが発生しました");
		} finally {
			setSubmitting(false);
		}
	};

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
								<button
									key={`${book.title}-${index}`}
									type="button"
									onClick={() => toggleSelect(index)}
									className={`w-full flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all ${
										selectedIndexes.has(index)
											? "bg-fuchsia-500/10 border-fuchsia-500/40"
											: "bg-white/5 border-white/10 opacity-60"
									}`}
								>
									{/* チェックボックス */}
									<div
										className={`mt-1 w-5 h-5 rounded flex-shrink-0 flex items-center justify-center border ${
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
										{/* AI認識との差分表示 */}
										{book.recognized.title !== book.title && (
											<p className="text-xs text-cyan-400/60 mt-1">
												AI認識: {book.recognized.title}
											</p>
										)}
									</div>
								</button>
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
		</div>
	);
}
