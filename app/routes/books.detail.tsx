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
	getStatusColor,
	formatRating,
	type BookStatus,
} from "~/books/types";
import type { Route } from "./+types/books.detail";
import { useState, useEffect } from "react";

export function meta({ data }: Route.MetaArgs) {
	return [
		{
			title: `${data?.book?.title ?? "本の詳細"} | 読書リスト | hidelberq`,
		},
	];
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
	const { group, book, statuses, members } = loaderData;
	const navigate = useNavigate();
	const [memberId, setMemberId] = useState("");
	const [editing, setEditing] = useState(false);
	const [showStatusForm, setShowStatusForm] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	useEffect(() => {
		const id = localStorage.getItem("bookMemberId") || "";
		setMemberId(id);
	}, []);

	useEffect(() => {
		if (actionData?.success && actionData.intent === "deleteBook") {
			navigate(`/books/${group.groupCode}`);
		}
		if (actionData?.success && actionData.intent === "editBook") {
			setEditing(false);
		}
		if (actionData?.success && actionData.intent === "updateStatus") {
			setShowStatusForm(false);
		}
	}, [actionData, navigate, group.groupCode]);

	const myStatus = statuses.find((s) => s.memberId === memberId);
	const isOwner = book.addedByMemberId === memberId;
	const isMember = members.some((m) => m.memberId === memberId);

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
										<h1 className="text-xl font-bold text-white mb-1">
											{book.title}
										</h1>
										<p className="text-purple-200/80 mb-2">
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

								{book.description && (
									<div className="mt-4 pt-4 border-t border-white/10">
										<p className="text-sm text-purple-200/80 leading-relaxed">
											{book.description}
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
										<button
											type="button"
											onClick={() => setEditing(true)}
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
							<input
								type="hidden"
								name="intent"
								value="editBook"
							/>
							<input
								type="hidden"
								name="memberId"
								value={memberId}
							/>

							<div>
								<label className={labelClass}>
									タイトル
									<span className="text-red-400 ml-1">
										*
									</span>
								</label>
								<input
									type="text"
									name="title"
									required
									defaultValue={book.title}
									className={inputClass}
								/>
							</div>
							<div>
								<label className={labelClass}>
									著者名
									<span className="text-red-400 ml-1">
										*
									</span>
								</label>
								<input
									type="text"
									name="author"
									required
									defaultValue={book.author}
									className={inputClass}
								/>
							</div>
							<div className="grid grid-cols-2 gap-4">
								<div>
									<label className={labelClass}>ISBN</label>
									<input
										type="text"
										name="isbn"
										defaultValue={book.isbn ?? ""}
										className={inputClass}
									/>
								</div>
								<div>
									<label className={labelClass}>
										出版年
									</label>
									<input
										type="text"
										name="publishedYear"
										defaultValue={
											book.publishedYear ?? ""
										}
										className={inputClass}
									/>
								</div>
								<div>
									<label className={labelClass}>
										出版社
									</label>
									<input
										type="text"
										name="publisher"
										defaultValue={book.publisher ?? ""}
										className={inputClass}
									/>
								</div>
								<div>
									<label className={labelClass}>
										ページ数
									</label>
									<input
										type="number"
										name="pageCount"
										defaultValue={
											book.pageCount?.toString() ?? ""
										}
										className={inputClass}
									/>
								</div>
							</div>
							<div>
								<label className={labelClass}>ジャンル</label>
								<select
									name="genre"
									defaultValue={book.genre ?? ""}
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
								<label className={labelClass}>
									内容（短く）
								</label>
								<textarea
									name="description"
									rows={3}
									defaultValue={book.description ?? ""}
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
												{s.memberId === memberId &&
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
