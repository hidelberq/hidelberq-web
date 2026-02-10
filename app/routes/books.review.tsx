import { Link } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { bookReviews, userProfiles } from "~/db/schema";
import { formatRating } from "~/books/types";
import type { Route } from "./+types/books.review";

export function meta({ data }: Route.MetaArgs) {
	const title = data?.review?.title ?? "レビュー";
	const bookTitle = data?.review?.bookTitle ?? "";
	return [
		{
			title: `${title || bookTitle + "のレビュー"} | 積読 2.0 | hidelberq`,
		},
	];
}

export async function loader({ params, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const reviewId = Number(params.reviewId);

	const [review] = await db
		.select()
		.from(bookReviews)
		.where(eq(bookReviews.id, reviewId))
		.limit(1);

	if (!review) {
		throw new Response("レビューが見つかりません", { status: 404 });
	}

	// プロフィール取得
	const [profile] = await db
		.select()
		.from(userProfiles)
		.where(eq(userProfiles.memberId, review.memberId))
		.limit(1);

	return {
		review: {
			id: review.id,
			memberId: review.memberId,
			personalBookId: review.personalBookId,
			bookTitle: review.bookTitle,
			bookAuthor: review.bookAuthor,
			bookIsbn: review.bookIsbn,
			bookCoverImageUrl: review.bookCoverImageUrl,
			title: review.title,
			content: review.content,
			rating: review.rating,
			containsSpoiler: review.containsSpoiler,
			likesCount: review.likesCount,
			commentsCount: review.commentsCount,
			createdAt: review.createdAt?.getTime() ?? Date.now(),
			updatedAt: review.updatedAt?.getTime() ?? Date.now(),
		},
		author: {
			memberId: review.memberId,
			displayName: profile?.displayName ?? "不明",
			avatarEmoji: profile?.avatarEmoji ?? "📚",
			bio: profile?.bio ?? null,
		},
	};
}

export default function BookReviewDetail({
	loaderData,
}: Route.ComponentProps) {
	const { review, author } = loaderData;

	const date = new Date(review.createdAt);
	const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-16">
				<Link
					to="/tsundoku_2_0/reviews"
					className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors mb-8"
				>
					&larr; レビュー一覧に戻る
				</Link>

				<div className="w-full max-w-2xl">
					{/* レビューカード */}
					<div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6 mb-6">
						{/* 投稿者 */}
						<Link
							to={`/tsundoku_2_0/user/${author.memberId}`}
							className="flex items-center gap-3 mb-5 hover:opacity-80 transition-opacity"
						>
							<span className="text-3xl">{author.avatarEmoji}</span>
							<div>
								<p className="text-white font-semibold">
									{author.displayName}
								</p>
								<p className="text-xs text-purple-300/40">{dateStr}</p>
							</div>
						</Link>

						{/* 本の情報 */}
						<div className="flex gap-4 p-4 rounded-xl bg-white/5 border border-white/10 mb-5">
							{review.bookCoverImageUrl ? (
								<img
									src={review.bookCoverImageUrl}
									alt={review.bookTitle}
									className="w-16 h-22 object-cover rounded-lg flex-shrink-0"
								/>
							) : (
								<div className="w-16 h-22 bg-white/10 rounded-lg flex-shrink-0 flex items-center justify-center text-purple-300/30 text-sm">
									No img
								</div>
							)}
							<div className="flex-1 min-w-0">
								<h2 className="text-lg font-bold text-white break-words">
									{review.bookTitle}
								</h2>
								<p className="text-sm text-purple-300/60 break-words">
									{review.bookAuthor}
								</p>
								{review.rating !== null && (
									<p className="text-yellow-400 mt-1">
										{formatRating(review.rating)}
									</p>
								)}
							</div>
						</div>

						{/* レビュー内容 */}
						{review.title && (
							<h3 className="text-xl font-bold text-white mb-3 break-words">
								{review.title}
							</h3>
						)}

						{review.containsSpoiler && (
							<div className="rounded-lg bg-yellow-500/10 border border-yellow-500/20 px-3 py-2 mb-3 text-sm text-yellow-300">
								⚠️ このレビューはネタバレを含みます
							</div>
						)}

						<div className="text-purple-200/80 leading-relaxed whitespace-pre-wrap">
							{review.content}
						</div>

						{/* いいね・コメント数 */}
						<div className="flex gap-4 mt-5 pt-4 border-t border-white/10 text-sm text-purple-300/50">
							<span>♥ {review.likesCount} いいね</span>
							<span>💬 {review.commentsCount} コメント</span>
						</div>
					</div>

					{/* コメントセクション（Phase 3 で実装） */}
					<div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-6">
						<h3 className="text-sm font-semibold uppercase tracking-widest text-cyan-400/80 mb-4">
							コメント
						</h3>
						<p className="text-sm text-purple-300/40">
							コメント機能は今後追加予定です
						</p>
					</div>
				</div>
			</div>
		</div>
	);
}
