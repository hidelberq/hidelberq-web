import { Link } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { desc, sql } from "drizzle-orm";
import { bookReviews, userProfiles } from "~/db/schema";
import { formatRating } from "~/books/types";
import type { Route } from "./+types/books.reviews";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "レビュー一覧 | 積読 2.0 | hidelberq" },
		{ name: "description", content: "みんなの本のレビュー" },
	];
}

export async function loader({ request, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const url = new URL(request.url);
	const sort = url.searchParams.get("sort") ?? "newest";

	const orderBy =
		sort === "likes"
			? desc(bookReviews.likesCount)
			: desc(bookReviews.createdAt);

	const reviews = await db
		.select()
		.from(bookReviews)
		.orderBy(orderBy)
		.limit(50);

	// レビュー投稿者のプロフィールを取得
	const memberIds = [...new Set(reviews.map((r) => r.memberId))];
	let profiles: Array<{
		memberId: string;
		displayName: string;
		avatarEmoji: string;
	}> = [];
	if (memberIds.length > 0) {
		profiles = await db
			.select({
				memberId: userProfiles.memberId,
				displayName: userProfiles.displayName,
				avatarEmoji: userProfiles.avatarEmoji,
			})
			.from(userProfiles)
			.where(
				sql`${userProfiles.memberId} IN (${sql.join(
					memberIds.map((id) => sql`${id}`),
					sql`,`,
				)})`,
			);
	}
	const profileMap = new Map(profiles.map((p) => [p.memberId, p]));

	return {
		reviews: reviews.map((r) => {
			const profile = profileMap.get(r.memberId);
			return {
				id: r.id,
				memberId: r.memberId,
				displayName: profile?.displayName ?? "不明",
				avatarEmoji: profile?.avatarEmoji ?? "📚",
				bookTitle: r.bookTitle,
				bookAuthor: r.bookAuthor,
				bookCoverImageUrl: r.bookCoverImageUrl,
				title: r.title,
				content: r.content,
				rating: r.rating,
				containsSpoiler: r.containsSpoiler,
				likesCount: r.likesCount,
				commentsCount: r.commentsCount,
				createdAt: r.createdAt?.getTime() ?? Date.now(),
			};
		}),
		sort,
	};
}

export default function BookReviews({ loaderData }: Route.ComponentProps) {
	const { reviews, sort } = loaderData;

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
					レビュー一覧
				</h1>
				<p className="text-purple-200/60 mb-8">
					みんなの本のレビュー
				</p>

				{/* ソート */}
				<div className="w-full max-w-2xl mb-6 flex gap-2">
					<Link
						to="/tsundoku_2_0/reviews?sort=newest"
						className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
							sort === "newest"
								? "bg-fuchsia-500/30 text-fuchsia-200 border border-fuchsia-500/40"
								: "bg-white/5 border border-white/10 text-purple-300/60 hover:text-purple-200"
						}`}
					>
						新着順
					</Link>
					<Link
						to="/tsundoku_2_0/reviews?sort=likes"
						className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
							sort === "likes"
								? "bg-fuchsia-500/30 text-fuchsia-200 border border-fuchsia-500/40"
								: "bg-white/5 border border-white/10 text-purple-300/60 hover:text-purple-200"
						}`}
					>
						いいね順
					</Link>
				</div>

				{/* レビューリスト */}
				<div className="w-full max-w-2xl">
					{reviews.length === 0 ? (
						<div className="text-center py-16 text-purple-300/40">
							まだレビューがありません
						</div>
					) : (
						<div className="grid gap-4">
							{reviews.map((review) => (
								<ReviewCard key={review.id} review={review} />
							))}
						</div>
					)}
				</div>

				<p className="text-sm text-purple-300/30 mt-8">
					{reviews.length} 件のレビュー
				</p>
			</div>
		</div>
	);
}

function ReviewCard({
	review,
}: {
	review: {
		id: number;
		memberId: string;
		displayName: string;
		avatarEmoji: string;
		bookTitle: string;
		bookAuthor: string;
		bookCoverImageUrl: string | null;
		title: string | null;
		content: string;
		rating: number | null;
		containsSpoiler: boolean;
		likesCount: number;
		commentsCount: number;
		createdAt: number;
	};
}) {
	const date = new Date(review.createdAt);
	const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`;

	return (
		<Link
			to={`/tsundoku_2_0/review/${review.id}`}
			className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm p-5 transition-all duration-300 hover:border-fuchsia-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-fuchsia-500/10 block"
		>
			{/* ヘッダー: ユーザー情報 */}
			<div className="flex items-center gap-2 mb-3">
				<span className="text-lg">{review.avatarEmoji}</span>
				<span className="text-sm font-medium text-white">
					{review.displayName}
				</span>
				<span className="text-xs text-purple-300/40 ml-auto">
					{dateStr}
				</span>
			</div>

			{/* 本の情報 + レビュー */}
			<div className="flex gap-3">
				{review.bookCoverImageUrl ? (
					<img
						src={review.bookCoverImageUrl}
						alt=""
						className="w-10 h-14 object-cover rounded flex-shrink-0"
					/>
				) : (
					<div className="w-10 h-14 bg-white/10 rounded flex-shrink-0 flex items-center justify-center text-purple-300/30 text-xs">
						No img
					</div>
				)}
				<div className="flex-1 min-w-0">
					<p className="text-xs text-purple-300/50 truncate">
						{review.bookTitle} / {review.bookAuthor}
					</p>
					{review.rating !== null && (
						<p className="text-xs text-yellow-400 mt-0.5">
							{formatRating(review.rating)}
						</p>
					)}
					{review.title && (
						<p className="text-sm font-semibold text-white mt-1">
							{review.title}
						</p>
					)}
					<p className="text-sm text-purple-200/70 mt-1 line-clamp-3">
						{review.containsSpoiler
							? "⚠️ ネタバレを含むレビューです（タップして表示）"
							: review.content}
					</p>
				</div>
			</div>

			{/* フッター */}
			{(review.likesCount > 0 || review.commentsCount > 0) && (
				<div className="flex gap-4 mt-3 text-xs text-purple-300/40">
					{review.likesCount > 0 && (
						<span>♥ {review.likesCount}</span>
					)}
					{review.commentsCount > 0 && (
						<span>💬 {review.commentsCount}</span>
					)}
				</div>
			)}
		</Link>
	);
}
