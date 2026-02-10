import { Link } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { personalBooks, bookReviews, bookActivities, userProfiles } from "~/db/schema";
import { formatRating } from "~/books/types";
import type { Route } from "./+types/books.my-review";
import { useState, useEffect } from "react";

export function meta({ data }: Route.MetaArgs) {
	return [
		{
			title: `レビューを書く: ${data?.book?.title ?? "本"} | 積読 2.0 | hidelberq`,
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

	// 既存レビューがあれば取得（編集用）
	let existingReview = null;
	if (currentMemberId) {
		const [review] = await db
			.select()
			.from(bookReviews)
			.where(eq(bookReviews.personalBookId, bookId))
			.limit(1);
		if (review && review.memberId === currentMemberId) {
			existingReview = {
				...review,
				createdAt: review.createdAt?.getTime() ?? Date.now(),
				updatedAt: review.updatedAt?.getTime() ?? Date.now(),
			};
		}
	}

	return {
		book: {
			id: book.id,
			title: book.title,
			author: book.author,
			isbn: book.isbn,
			coverImageUrl: book.coverImageUrl,
			memberId: book.memberId,
		},
		existingReview,
	};
}

export async function action({ request, params, context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const formData = await request.formData();
	const memberId = formData.get("memberId") as string;
	const bookId = Number(params.personalBookId);

	if (!memberId) {
		return { error: "ログインが必要です" };
	}

	const [book] = await db
		.select()
		.from(personalBooks)
		.where(eq(personalBooks.id, bookId))
		.limit(1);

	if (!book) {
		return { error: "本が見つかりません" };
	}

	if (book.memberId !== memberId) {
		return { error: "自分の本のみレビューできます" };
	}

	const title = (formData.get("title") as string)?.trim() || null;
	const content = (formData.get("content") as string)?.trim();
	const rating = formData.get("rating") ? Number(formData.get("rating")) : null;
	const containsSpoiler = formData.get("containsSpoiler") === "true";

	if (!content) {
		return { error: "レビュー内容を入力してください" };
	}

	const existingReviewId = formData.get("existingReviewId");

	// プロフィール情報を取得
	const [profile] = await db
		.select()
		.from(userProfiles)
		.where(eq(userProfiles.memberId, memberId))
		.limit(1);
	const displayName = profile?.displayName ?? book.memberName;
	const avatarEmoji = profile?.avatarEmoji ?? "📚";

	if (existingReviewId) {
		// 更新
		await db
			.update(bookReviews)
			.set({ title, content, rating, containsSpoiler })
			.where(eq(bookReviews.id, Number(existingReviewId)));

		return { success: true, reviewId: Number(existingReviewId) };
	}

	// 新規作成
	const [review] = await db
		.insert(bookReviews)
		.values({
			memberId,
			personalBookId: bookId,
			bookTitle: book.title,
			bookAuthor: book.author,
			bookIsbn: book.isbn,
			bookCoverImageUrl: book.coverImageUrl,
			title,
			content,
			rating,
			containsSpoiler,
		})
		.returning();

	// アクティビティを記録
	await db.insert(bookActivities).values({
		memberId,
		type: "review_posted",
		targetType: "review",
		targetId: review.id,
		metadata: JSON.stringify({
			displayName,
			avatarEmoji,
			bookTitle: book.title,
			bookAuthor: book.author,
			bookCoverImageUrl: book.coverImageUrl,
			reviewTitle: title,
			reviewSnippet: content.slice(0, 100),
			rating,
		}),
	});

	return { success: true, reviewId: review.id };
}

export default function BookMyReview({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { book, existingReview } = loaderData;
	const [memberId, setMemberId] = useState("");
	const [initialized, setInitialized] = useState(false);

	useEffect(() => {
		const id = localStorage.getItem("bookMemberId") || "";
		setMemberId(id);
		if (id && !new URLSearchParams(window.location.search).get("memberId")) {
			const url = new URL(window.location.href);
			url.searchParams.set("memberId", id);
			window.history.replaceState({}, "", url.toString());
			window.location.reload();
			return;
		}
		setInitialized(true);
	}, []);

	if (!initialized) return null;

	const isOwner = memberId === book.memberId;
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
					to={`/tsundoku_2_0/my/book/${book.id}`}
					className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors mb-8"
				>
					&larr; 本の詳細に戻る
				</Link>

				<h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
					{existingReview ? "レビューを編集" : "レビューを書く"}
				</h1>

				{/* 対象本 */}
				<div className="flex items-center gap-3 mb-8">
					{book.coverImageUrl ? (
						<img
							src={book.coverImageUrl}
							alt=""
							className="w-10 h-14 object-cover rounded"
						/>
					) : (
						<div className="w-10 h-14 bg-white/10 rounded flex items-center justify-center text-purple-300/30 text-xs">
							No img
						</div>
					)}
					<div>
						<p className="text-white font-medium">{book.title}</p>
						<p className="text-sm text-purple-300/60">{book.author}</p>
					</div>
				</div>

				{!isOwner ? (
					<div className="text-purple-300/50">
						自分の本のみレビューを書けます
					</div>
				) : (
					<>
						{actionData?.success && (
							<div className="w-full max-w-lg mb-4 rounded-xl bg-green-500/20 border border-green-500/30 px-4 py-3 text-sm text-green-300">
								レビューを{existingReview ? "更新" : "投稿"}しました!{" "}
								<Link
									to={`/tsundoku_2_0/review/${actionData.reviewId}`}
									className="underline hover:text-green-200"
								>
									レビューを見る
								</Link>
							</div>
						)}
						{actionData?.error && (
							<div className="w-full max-w-lg mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
								{actionData.error}
							</div>
						)}

						<form
							method="post"
							className="w-full max-w-lg rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 space-y-5"
						>
							<input type="hidden" name="memberId" value={memberId} />
							{existingReview && (
								<input
									type="hidden"
									name="existingReviewId"
									value={existingReview.id}
								/>
							)}

							{/* 評価 */}
							<div>
								<label className={labelClass}>評価</label>
								<select
									name="rating"
									defaultValue={existingReview?.rating?.toString() ?? ""}
									className={`${inputClass} appearance-none`}
								>
									<option value="">評価なし</option>
									{[1, 2, 3, 4, 5].map((v) => (
										<option key={v} value={v}>
											{formatRating(v)}
										</option>
									))}
								</select>
							</div>

							{/* タイトル */}
							<div>
								<label className={labelClass}>
									レビュータイトル（任意）
								</label>
								<input
									type="text"
									name="title"
									defaultValue={existingReview?.title ?? ""}
									placeholder="例: 世界の見方が変わる一冊"
									className={inputClass}
								/>
							</div>

							{/* 本文 */}
							<div>
								<label className={labelClass}>
									レビュー内容
									<span className="text-red-400 ml-1">*</span>
								</label>
								<textarea
									name="content"
									required
									rows={6}
									defaultValue={existingReview?.content ?? ""}
									placeholder="この本について感じたこと、学んだことを書いてみましょう..."
									className={`${inputClass} resize-none`}
								/>
							</div>

							{/* ネタバレ */}
							<label className="flex items-center gap-2 cursor-pointer">
								<input
									type="checkbox"
									name="containsSpoiler"
									value="true"
									defaultChecked={existingReview?.containsSpoiler ?? false}
									className="accent-fuchsia-500 w-4 h-4"
								/>
								<span className="text-sm text-purple-200">
									ネタバレを含む
								</span>
							</label>

							<button
								type="submit"
								className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 font-semibold text-white transition-all hover:from-fuchsia-500 hover:to-purple-500 hover:shadow-lg hover:shadow-fuchsia-500/20"
							>
								{existingReview ? "レビューを更新" : "レビューを投稿"}
							</button>
						</form>
					</>
				)}
			</div>
		</div>
	);
}
