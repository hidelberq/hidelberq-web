import { Link, useNavigate } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import {
	bookGroups,
	bookGroupMembers,
	books,
	bookMemberStatuses,
} from "~/db/schema";
import {
	GENRES,
	BOOK_STATUSES,
	type BookSearchResult,
	type BookStatus,
} from "~/books/types";
import type { Route } from "./+types/books.add";
import { useState, useEffect, useCallback } from "react";

export function meta(): Route.MetaDescriptors {
	return [{ title: "本を追加 | 読書リスト | hidelberq" }];
}

export async function loader({ params, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const [group] = await db
		.select()
		.from(bookGroups)
		.where(eq(bookGroups.groupCode, params.groupCode))
		.limit(1);

	if (!group) {
		throw new Response("グループが見つかりません", { status: 404 });
	}

	return { group: { id: group.id, name: group.name, groupCode: group.groupCode } };
}

export async function action({ request, params, context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const formData = await request.formData();

	const [group] = await db
		.select()
		.from(bookGroups)
		.where(eq(bookGroups.groupCode, params.groupCode))
		.limit(1);

	if (!group) {
		throw new Response("グループが見つかりません", { status: 404 });
	}

	const memberId = formData.get("memberId") as string;

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

	const title = (formData.get("title") as string)?.trim();
	const author = (formData.get("author") as string)?.trim();

	if (!title || !author) {
		return { error: "タイトルと著者名は必須です" };
	}

	const [book] = await db
		.insert(books)
		.values({
			groupId: group.id,
			title,
			author,
			isbn: (formData.get("isbn") as string)?.trim() || null,
			publishedYear:
				(formData.get("publishedYear") as string)?.trim() || null,
			publisher: (formData.get("publisher") as string)?.trim() || null,
			coverImageUrl:
				(formData.get("coverImageUrl") as string)?.trim() || null,
			description:
				(formData.get("description") as string)?.trim() || null,
			pageCount: formData.get("pageCount")
				? Number(formData.get("pageCount"))
				: null,
			genre: (formData.get("genre") as string) || null,
			addedByMemberId: memberId,
			addedByName: member.displayName,
		})
		.returning();

	// 自分のステータスも同時に保存
	const status = formData.get("status") as BookStatus | null;
	if (status) {
		await db.insert(bookMemberStatuses).values({
			bookId: book.id,
			memberId,
			memberName: member.displayName,
			status,
			difficulty: formData.get("difficulty")
				? Number(formData.get("difficulty"))
				: null,
			importance: formData.get("importance")
				? Number(formData.get("importance"))
				: null,
			recommendation: formData.get("recommendation")
				? Number(formData.get("recommendation"))
				: null,
		});
	}

	return { success: true, bookId: book.id };
}

export default function BooksAdd({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { group } = loaderData;
	const navigate = useNavigate();
	const [memberId, setMemberId] = useState("");
	const [searchQuery, setSearchQuery] = useState("");
	const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [selectedBook, setSelectedBook] = useState<BookSearchResult | null>(
		null,
	);

	// フォーム状態
	const [title, setTitle] = useState("");
	const [author, setAuthor] = useState("");
	const [isbn, setIsbn] = useState("");
	const [publishedYear, setPublishedYear] = useState("");
	const [publisher, setPublisher] = useState("");
	const [coverImageUrl, setCoverImageUrl] = useState("");
	const [description, setDescription] = useState("");
	const [pageCount, setPageCount] = useState("");
	const [genre, setGenre] = useState("");

	useEffect(() => {
		const id = localStorage.getItem("bookMemberId") || "";
		setMemberId(id);
	}, []);

	useEffect(() => {
		if (actionData?.success) {
			navigate(`/books/${group.groupCode}`);
		}
	}, [actionData, navigate, group.groupCode]);

	const searchBooks = useCallback(async () => {
		if (!searchQuery.trim()) return;
		setSearching(true);
		try {
			const res = await fetch(
				`/api/books/search?q=${encodeURIComponent(searchQuery)}`,
			);
			const data = (await res.json()) as { results: BookSearchResult[] };
			setSearchResults(data.results);
		} catch {
			setSearchResults([]);
		} finally {
			setSearching(false);
		}
	}, [searchQuery]);

	const selectBook = (book: BookSearchResult) => {
		setSelectedBook(book);
		setTitle(book.title);
		setAuthor(book.author);
		setIsbn(book.isbn ?? "");
		setPublishedYear(book.publishedYear ?? "");
		setPublisher(book.publisher ?? "");
		setCoverImageUrl(book.coverImageUrl ?? "");
		setDescription(book.description ?? "");
		setPageCount(book.pageCount?.toString() ?? "");
		setSearchResults([]);
		setSearchQuery("");
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
					to={`/books/${group.groupCode}`}
					className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors mb-8"
				>
					&larr; {group.name} に戻る
				</Link>

				<h1 className="text-3xl font-bold tracking-tight mb-8 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
					本を追加
				</h1>

				{/* Google Books 検索 */}
				<section className="w-full max-w-lg mb-8">
					<h2 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-4">
						書籍を検索
					</h2>
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

					{/* 検索結果 */}
					{searchResults.length > 0 && (
						<div className="mt-3 rounded-xl bg-white/5 border border-white/10 divide-y divide-white/5 max-h-80 overflow-y-auto">
							{searchResults.map((result, i) => (
								<button
									key={`${result.isbn ?? i}-${result.title}`}
									type="button"
									onClick={() => selectBook(result)}
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
											{result.publishedYear &&
												` (${result.publishedYear})`}
										</p>
									</div>
								</button>
							))}
						</div>
					)}
				</section>

				{actionData?.error && (
					<div className="w-full max-w-lg mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
						{actionData.error}
					</div>
				)}

				{/* 登録フォーム */}
				<form method="post" className="w-full max-w-lg space-y-4">
					<input type="hidden" name="memberId" value={memberId} />
					<input
						type="hidden"
						name="coverImageUrl"
						value={coverImageUrl}
					/>

					{/* プレビュー */}
					{coverImageUrl && (
						<div className="flex justify-center">
							<img
								src={coverImageUrl}
								alt="表紙"
								className="h-32 object-cover rounded-lg border border-white/10"
							/>
						</div>
					)}

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div className="sm:col-span-2">
							<label className={labelClass}>
								タイトル
								<span className="text-red-400 ml-1">*</span>
							</label>
							<input
								type="text"
								name="title"
								required
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className={inputClass}
							/>
						</div>
						<div className="sm:col-span-2">
							<label className={labelClass}>
								著者名
								<span className="text-red-400 ml-1">*</span>
							</label>
							<input
								type="text"
								name="author"
								required
								value={author}
								onChange={(e) => setAuthor(e.target.value)}
								className={inputClass}
							/>
						</div>
						<div>
							<label className={labelClass}>ISBN</label>
							<input
								type="text"
								name="isbn"
								value={isbn}
								onChange={(e) => setIsbn(e.target.value)}
								className={inputClass}
							/>
						</div>
						<div>
							<label className={labelClass}>出版年</label>
							<input
								type="text"
								name="publishedYear"
								value={publishedYear}
								onChange={(e) =>
									setPublishedYear(e.target.value)
								}
								className={inputClass}
							/>
						</div>
						<div>
							<label className={labelClass}>出版社</label>
							<input
								type="text"
								name="publisher"
								value={publisher}
								onChange={(e) => setPublisher(e.target.value)}
								className={inputClass}
							/>
						</div>
						<div>
							<label className={labelClass}>ページ数</label>
							<input
								type="number"
								name="pageCount"
								value={pageCount}
								onChange={(e) => setPageCount(e.target.value)}
								className={inputClass}
							/>
						</div>
						<div className="sm:col-span-2">
							<label className={labelClass}>ジャンル</label>
							<select
								name="genre"
								value={genre}
								onChange={(e) => setGenre(e.target.value)}
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
								name="description"
								rows={3}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="本の内容を簡単に説明..."
								className={`${inputClass} resize-none`}
							/>
						</div>
					</div>

					{/* 自分のステータス設定 */}
					<div className="border-t border-white/10 pt-4 mt-6">
						<h3 className="text-sm font-semibold uppercase tracking-widest text-fuchsia-400/80 mb-4">
							あなたのステータス（任意）
						</h3>
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
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
							/>
							<RatingSelect
								name="importance"
								label="重要度"
							/>
							<RatingSelect
								name="recommendation"
								label="おすすめ度"
							/>
						</div>
					</div>

					<button
						type="submit"
						className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 font-semibold text-white transition-all hover:from-fuchsia-500 hover:to-purple-500 hover:shadow-lg hover:shadow-fuchsia-500/20 mt-6"
					>
						本を追加
					</button>
				</form>
			</div>
		</div>
	);
}

function RatingSelect({ name, label }: { name: string; label: string }) {
	return (
		<div>
			<label className="block text-sm font-medium text-purple-200 mb-1.5">
				{label}
			</label>
			<select
				name={name}
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
