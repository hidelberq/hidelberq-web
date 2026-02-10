import { Link } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { desc, sql } from "drizzle-orm";
import { bookActivities, userProfiles } from "~/db/schema";
import type { Route } from "./+types/books.feed";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "フィード | 積読 2.0 | hidelberq" },
		{ name: "description", content: "みんなの読書アクティビティ" },
	];
}

interface ActivityMetadata {
	displayName: string;
	avatarEmoji: string;
	bookTitle?: string;
	bookAuthor?: string;
	bookCoverImageUrl?: string | null;
	reviewTitle?: string | null;
	reviewSnippet?: string;
	rating?: number | null;
	oldStatus?: string;
	newStatus?: string;
}

export async function loader({ context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);

	// 全公開アクティビティを新着順で取得
	const activities = await db
		.select()
		.from(bookActivities)
		.orderBy(desc(bookActivities.createdAt))
		.limit(50);

	// プロフィールを取得
	const memberIds = [...new Set(activities.map((a) => a.memberId))];
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
		activities: activities.map((a) => {
			const metadata = JSON.parse(a.metadata) as ActivityMetadata;
			const profile = profileMap.get(a.memberId);
			return {
				id: a.id,
				memberId: a.memberId,
				type: a.type,
				targetType: a.targetType,
				targetId: a.targetId,
				displayName: profile?.displayName ?? metadata.displayName ?? "不明",
				avatarEmoji: profile?.avatarEmoji ?? metadata.avatarEmoji ?? "📚",
				metadata,
				createdAt: a.createdAt?.getTime() ?? Date.now(),
			};
		}),
	};
}

const STATUS_LABELS: Record<string, string> = {
	wishlist: "ほしい",
	tsundoku: "積読中",
	reading: "読書中",
	completed: "読了",
	abandoned: "挫折",
};

function getActivityMessage(
	type: string,
	metadata: ActivityMetadata,
): string {
	switch (type) {
		case "review_posted":
			return `「${metadata.bookTitle}」のレビューを投稿しました`;
		case "started_reading":
			return `「${metadata.bookTitle}」を読み始めました`;
		case "completed_reading":
			return `「${metadata.bookTitle}」を読了しました`;
		case "book_added":
			return `「${metadata.bookTitle}」を積読リストに追加しました`;
		case "status_changed": {
			const newLabel = STATUS_LABELS[metadata.newStatus ?? ""] ?? metadata.newStatus;
			return `「${metadata.bookTitle}」のステータスを「${newLabel}」に変更しました`;
		}
		default:
			return `「${metadata.bookTitle ?? ""}」に関するアクティビティ`;
	}
}

function getActivityIcon(type: string): string {
	switch (type) {
		case "review_posted":
			return "✍️";
		case "started_reading":
			return "📖";
		case "completed_reading":
			return "🎉";
		case "book_added":
			return "📚";
		case "status_changed":
			return "🔄";
		default:
			return "📌";
	}
}

export default function BookFeed({ loaderData }: Route.ComponentProps) {
	const { activities } = loaderData;

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
					フィード
				</h1>
				<p className="text-purple-200/60 mb-8">
					みんなの読書アクティビティ
				</p>

				<div className="w-full max-w-2xl">
					{activities.length === 0 ? (
						<div className="text-center py-16 text-purple-300/40">
							まだアクティビティがありません
						</div>
					) : (
						<div className="grid gap-3">
							{activities.map((activity) => {
								const date = new Date(activity.createdAt);
								const dateStr = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
								const message = getActivityMessage(
									activity.type,
									activity.metadata,
								);
								const icon = getActivityIcon(activity.type);

								// レビュー投稿の場合はレビュー詳細へリンク
								const linkTo =
									activity.type === "review_posted"
										? `/tsundoku_2_0/review/${activity.targetId}`
										: undefined;

								const Content = (
									<div className="flex gap-4 p-4">
										{/* ユーザーアバター */}
										<Link
											to={`/tsundoku_2_0/user/${activity.memberId}`}
											className="flex-shrink-0"
										>
											<span className="text-2xl">
												{activity.avatarEmoji}
											</span>
										</Link>

										<div className="flex-1 min-w-0">
											{/* ユーザー名 + 時間 */}
											<div className="flex items-center gap-2 mb-1">
												<Link
													to={`/tsundoku_2_0/user/${activity.memberId}`}
													className="text-sm font-semibold text-white hover:text-fuchsia-200 transition-colors truncate flex-shrink-0 max-w-[50%]"
												>
													{activity.displayName}
												</Link>
												<span className="text-xs text-purple-300/40 flex-shrink-0">
													{dateStr}
												</span>
											</div>

											{/* アクティビティメッセージ */}
											<p className="text-sm text-purple-200/70 break-all">
												{icon} {message}
											</p>

											{/* レビュースニペット */}
											{activity.type === "review_posted" &&
												activity.metadata.reviewSnippet && (
													<div className="mt-2 rounded-lg bg-white/5 border border-white/10 p-3">
														{activity.metadata.reviewTitle && (
															<p className="text-sm font-medium text-white mb-1 break-all">
																{activity.metadata.reviewTitle}
															</p>
														)}
														{activity.metadata.rating != null && (
															<p className="text-xs text-yellow-400 mb-1">
																{"★".repeat(activity.metadata.rating)}
																{"☆".repeat(5 - activity.metadata.rating)}
															</p>
														)}
														<p className="text-xs text-purple-300/50 line-clamp-2">
															{activity.metadata.reviewSnippet}...
														</p>
													</div>
												)}

											{/* 本のカバー画像 */}
											{activity.metadata.bookCoverImageUrl && (
												<div className="mt-2 flex items-center gap-2">
													<img
														src={activity.metadata.bookCoverImageUrl}
														alt=""
														className="w-8 h-11 object-cover rounded"
													/>
													<span className="text-xs text-purple-300/40">
														{activity.metadata.bookAuthor}
													</span>
												</div>
											)}
										</div>
									</div>
								);

								return linkTo ? (
									<Link
										key={activity.id}
										to={linkTo}
										className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm transition-all duration-300 hover:border-fuchsia-500/40 hover:bg-white/10 block overflow-hidden"
									>
										{Content}
									</Link>
								) : (
									<div
										key={activity.id}
										className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden"
									>
										{Content}
									</div>
								);
							})}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
