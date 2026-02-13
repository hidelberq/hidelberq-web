import { useState } from "react";
import { useFetcher } from "react-router";
import { ActionFeedback } from "./feedback";

const STATUS_LABELS: Record<string, string> = {
	wishlist: "ほしい",
	tsundoku: "積読中",
	reading: "読書中",
	completed: "読了",
	abandoned: "挫折",
};

export function BookSection({
	bookData,
}: {
	bookData: {
		groups: Array<{
			id: number;
			groupCode: string;
			name: string;
			description: string | null;
			createdByMemberId: string;
			createdAt: Date | null;
		}>;
		members: Array<{
			id: number;
			groupId: number;
			memberId: string;
			displayName: string;
			joinedAt: Date | null;
		}>;
		books: Array<{
			id: number;
			groupId: number;
			title: string;
			author: string;
			genre: string | null;
			addedByName: string;
			addedByMemberId: string;
			createdAt: Date | null;
		}>;
		bookCount: number;
		statuses: Array<{
			id: number;
			bookId: number;
			memberId: string;
			memberName: string;
			status: string;
			difficulty: number | null;
			importance: number | null;
			recommendation: number | null;
			memo: string | null;
			updatedAt: Date | null;
		}>;
		personalBooks: Array<{
			id: number;
			memberId: string;
			memberName: string;
			title: string;
			author: string;
			isbn: string | null;
			genre: string | null;
			status: string;
			visibility: string;
			difficulty: number | null;
			importance: number | null;
			recommendation: number | null;
			memo: string | null;
			tags: string | null;
			createdAt: Date | null;
		}>;
		personalBookCount: number;
		prerequisites: Array<{
			id: number;
			personalBookId: number;
			prerequisitePersonalBookId: number;
			createdAt: Date | null;
		}>;
	};
}) {
	const fetcher = useFetcher();
	const isLoading = fetcher.state === "submitting" || fetcher.state === "loading";
	const [expandedGroup, setExpandedGroup] = useState<number | null>(null);
	const [showPersonalBooks, setShowPersonalBooks] = useState(false);
	const [showPrerequisites, setShowPrerequisites] = useState(false);

	const { groups, members, books: bookList, bookCount, statuses, personalBooks: personalBookList, personalBookCount, prerequisites } = bookData;

	const getMembersForGroup = (groupId: number) => members.filter((m) => m.groupId === groupId);
	const getBooksForGroup = (groupId: number) => bookList.filter((b) => b.groupId === groupId);
	const getStatusesForBook = (bookId: number) => statuses.filter((s) => s.bookId === bookId);

	return (
		<section>
			<ActionFeedback data={fetcher.data as Record<string, unknown> | undefined} />

			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg font-bold text-orange-400">
					積読 2.0 管理
					<span className="text-sm font-normal text-gray-500 ml-2">
						({groups.length}グループ / {bookCount}冊 / 個人{personalBookCount}冊)
					</span>
				</h2>
				<fetcher.Form method="post">
					<input type="hidden" name="intent" value="clear-all-book-data" />
					<button
						type="submit"
						disabled={isLoading || (groups.length === 0 && personalBookCount === 0)}
						className="flex items-center gap-1 text-sm text-red-400/60 hover:text-red-400 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-full hover:bg-red-400/10 border border-red-400/20"
						onClick={(e) => {
							if (!confirm("積読 2.0 の全データ（グループ・メンバー・本・ステータス・個人リスト・前提本）を削除しますか？")) {
								e.preventDefault();
							}
						}}
					>
						全データ削除
					</button>
				</fetcher.Form>
			</div>

			{/* 個人積読リスト */}
			<div className="mb-4">
				<div className="flex items-center justify-between mb-2">
					<button
						type="button"
						onClick={() => setShowPersonalBooks(!showPersonalBooks)}
						className="flex items-center gap-2 text-sm font-bold text-purple-400"
					>
						<span>{showPersonalBooks ? "▼" : "▶"}</span>
						個人積読リスト ({personalBookCount}冊)
					</button>
					<fetcher.Form method="post">
						<input type="hidden" name="intent" value="clear-all-personal-books" />
						<button
							type="submit"
							disabled={isLoading || personalBookCount === 0}
							className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
							onClick={(e) => {
								if (!confirm("個人積読リストの全データ（前提本含む）を削除しますか？")) {
									e.preventDefault();
								}
							}}
						>
							個人リスト全削除
						</button>
					</fetcher.Form>
				</div>
				{showPersonalBooks && (
					<div className="space-y-2">
						{personalBookList.length === 0 ? (
							<p className="text-xs text-gray-600 pl-4">個人本なし</p>
						) : (
							personalBookList.map((pb) => (
								<div
									key={pb.id}
									className="flex items-start justify-between p-3 rounded bg-gray-900/30 border border-gray-800/50"
								>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2 mb-0.5 flex-wrap">
											<span className="text-sm font-medium text-gray-200">{pb.title}</span>
											<span className="text-[10px] text-gray-600">ID: {pb.id}</span>
											<span className={`text-[10px] px-1 py-0.5 rounded ${
												pb.status === "completed" ? "bg-green-500/10 text-green-400" :
												pb.status === "reading" ? "bg-blue-500/10 text-blue-400" :
												pb.status === "tsundoku" ? "bg-purple-500/10 text-purple-400" :
												pb.status === "abandoned" ? "bg-red-500/10 text-red-400" :
												"bg-gray-800 text-gray-400"
											}`}>
												{STATUS_LABELS[pb.status] ?? pb.status}
											</span>
											<span className={`text-[10px] px-1 py-0.5 rounded ${
												pb.visibility === "private" ? "bg-red-500/10 text-red-400" : "bg-green-500/10 text-green-400"
											}`}>
												{pb.visibility === "private" ? "非公開" : "公開"}
											</span>
										</div>
										<div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
											<span>{pb.author}</span>
											{pb.genre && (
												<span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px]">{pb.genre}</span>
											)}
											<span className="text-gray-600">by {pb.memberName}</span>
											<span className="text-[10px] text-gray-600 font-mono">{pb.memberId.slice(0, 8)}...</span>
										</div>
										<div className="flex items-center gap-2 text-[10px] text-gray-600 mt-1 flex-wrap">
											{pb.difficulty !== null && <span>難:{pb.difficulty}</span>}
											{pb.importance !== null && <span>重:{pb.importance}</span>}
											{pb.recommendation !== null && <span className="text-yellow-400/60">薦:{pb.recommendation}</span>}
											{pb.tags && <span>タグ:{pb.tags}</span>}
											{pb.memo && <span className="truncate max-w-[200px]" title={pb.memo}>メモ:{pb.memo}</span>}
										</div>
									</div>
									<fetcher.Form method="post" className="shrink-0 ml-2">
										<input type="hidden" name="intent" value="delete-personal-book" />
										<input type="hidden" name="id" value={pb.id} />
										<button
											type="submit"
											disabled={isLoading}
											className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
										>
											削除
										</button>
									</fetcher.Form>
								</div>
							))
						)}
					</div>
				)}
			</div>

			{/* 前提本 */}
			{prerequisites.length > 0 && (
				<div className="mb-4">
					<button
						type="button"
						onClick={() => setShowPrerequisites(!showPrerequisites)}
						className="flex items-center gap-2 text-sm font-bold text-purple-400 mb-2"
					>
						<span>{showPrerequisites ? "▼" : "▶"}</span>
						前提本の関連 ({prerequisites.length}件)
					</button>
					{showPrerequisites && (
						<div className="space-y-1.5">
							{prerequisites.map((pr) => {
								const bookA = personalBookList.find((b) => b.id === pr.personalBookId);
								const bookB = personalBookList.find((b) => b.id === pr.prerequisitePersonalBookId);
								return (
									<div
										key={pr.id}
										className="flex items-center justify-between p-2 rounded bg-gray-900/30 border border-gray-800/50"
									>
										<div className="flex items-center gap-2 text-xs text-gray-300 min-w-0">
											<span className="text-[10px] text-gray-600">ID: {pr.id}</span>
											<span className="truncate">{bookA?.title ?? `#${pr.personalBookId}`}</span>
											<span className="text-gray-600">&larr;</span>
											<span className="truncate">{bookB?.title ?? `#${pr.prerequisitePersonalBookId}`}</span>
										</div>
										<fetcher.Form method="post" className="shrink-0 ml-2">
											<input type="hidden" name="intent" value="delete-prerequisite" />
											<input type="hidden" name="id" value={pr.id} />
											<button
												type="submit"
												disabled={isLoading}
												className="text-[10px] text-red-400/60 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
											>
												x
											</button>
										</fetcher.Form>
									</div>
								);
							})}
						</div>
					)}
				</div>
			)}

			{/* グループ */}
			{groups.length === 0 ? (
				<div className="p-8 text-center text-gray-500 border border-gray-800 rounded-lg">
					<p className="text-sm">グループがありません</p>
				</div>
			) : (
				<div className="space-y-3">
					{groups.map((group) => {
						const groupMembers = getMembersForGroup(group.id);
						const groupBooks = getBooksForGroup(group.id);
						const isExpanded = expandedGroup === group.id;

						return (
							<div key={group.id} className="border border-gray-800 rounded-lg overflow-hidden">
								<div className="flex items-center justify-between px-4 py-3 bg-gray-900/50">
									<button
										type="button"
										onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
										className="flex items-center gap-3 text-left flex-1 min-w-0"
									>
										<span className="text-sm text-gray-400">{isExpanded ? "▼" : "▶"}</span>
										<div className="min-w-0">
											<div className="flex items-center gap-2">
												<span className="text-sm font-medium text-gray-200">{group.name}</span>
												<span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 font-mono">
													{group.groupCode}
												</span>
											</div>
											<div className="flex items-center gap-2 text-[10px] text-gray-600 mt-0.5">
												<span>ID: {group.id}</span>
												<span>メンバー: {groupMembers.length}</span>
												<span>本: {groupBooks.length}</span>
												{group.createdAt && <span>{group.createdAt.toLocaleString("ja-JP")}</span>}
											</div>
										</div>
									</button>
									<fetcher.Form method="post" className="shrink-0 ml-2">
										<input type="hidden" name="intent" value="delete-book-group" />
										<input type="hidden" name="id" value={group.id} />
										<button
											type="submit"
											disabled={isLoading}
											className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
											onClick={(e) => {
												if (!confirm(`グループ「${group.name}」と紐づく全データを削除しますか？`)) {
													e.preventDefault();
												}
											}}
										>
											削除
										</button>
									</fetcher.Form>
								</div>

								{isExpanded && (
									<div className="border-t border-gray-800">
										{/* メンバー */}
										<div className="px-4 py-3 border-b border-gray-800/50">
											<h4 className="text-xs font-bold text-orange-400/70 uppercase tracking-wider mb-2">
												メンバー ({groupMembers.length})
											</h4>
											{groupMembers.length === 0 ? (
												<p className="text-xs text-gray-600">メンバーなし</p>
											) : (
												<div className="space-y-1.5">
													{groupMembers.map((member) => (
														<div
															key={member.id}
															className="flex items-center justify-between p-2 rounded bg-gray-900/30"
														>
															<div className="flex items-center gap-2 text-sm min-w-0">
																<span className="text-gray-200 font-medium">{member.displayName}</span>
																<span className="text-[10px] text-gray-600 font-mono truncate">
																	{member.memberId.slice(0, 8)}...
																</span>
																<span className="text-[10px] text-gray-600">ID: {member.id}</span>
																{member.joinedAt && (
																	<span className="text-[10px] text-gray-600">
																		{member.joinedAt.toLocaleString("ja-JP")}
																	</span>
																)}
															</div>
															<fetcher.Form method="post" className="shrink-0">
																<input type="hidden" name="intent" value="delete-book-member" />
																<input type="hidden" name="id" value={member.id} />
																<input type="hidden" name="memberId" value={member.memberId} />
																<button
																	type="submit"
																	disabled={isLoading}
																	className="text-[10px] text-red-400/60 hover:text-red-400 px-1.5 py-0.5 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
																>
																	削除
																</button>
															</fetcher.Form>
														</div>
													))}
												</div>
											)}
										</div>

										{/* 本 */}
										<div className="px-4 py-3">
											<h4 className="text-xs font-bold text-orange-400/70 uppercase tracking-wider mb-2">
												本 ({groupBooks.length})
											</h4>
											{groupBooks.length === 0 ? (
												<p className="text-xs text-gray-600">本なし</p>
											) : (
												<div className="space-y-2">
													{groupBooks.map((book) => {
														const bookStatuses = getStatusesForBook(book.id);
														return (
															<div key={book.id} className="p-3 rounded bg-gray-900/30 border border-gray-800/50">
																<div className="flex items-start justify-between gap-2">
																	<div className="min-w-0 flex-1">
																		<div className="flex items-center gap-2 mb-0.5">
																			<span className="text-sm font-medium text-gray-200">{book.title}</span>
																			<span className="text-[10px] text-gray-600">ID: {book.id}</span>
																		</div>
																		<div className="flex items-center gap-2 text-xs text-gray-500">
																			<span>{book.author}</span>
																			{book.genre && (
																				<span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px]">
																					{book.genre}
																				</span>
																			)}
																			<span className="text-gray-600">by {book.addedByName}</span>
																		</div>

																		{bookStatuses.length > 0 && (
																			<div className="mt-2 space-y-1">
																				{bookStatuses.map((s) => (
																					<div
																						key={s.id}
																						className="flex items-center justify-between text-[10px] p-1.5 rounded bg-gray-900/50"
																					>
																						<div className="flex items-center gap-2">
																							<span className="text-gray-300">{s.memberName}</span>
																							<span className={`px-1 py-0.5 rounded ${
																								s.status === "completed" ? "bg-green-500/10 text-green-400" :
																								s.status === "reading" ? "bg-blue-500/10 text-blue-400" :
																								s.status === "tsundoku" ? "bg-purple-500/10 text-purple-400" :
																								"bg-gray-800 text-gray-400"
																							}`}>
																								{STATUS_LABELS[s.status] ?? s.status}
																							</span>
																							{s.difficulty !== null && <span className="text-gray-500">難:{s.difficulty}</span>}
																							{s.importance !== null && <span className="text-gray-500">重:{s.importance}</span>}
																							{s.recommendation !== null && <span className="text-yellow-400/60">薦:{s.recommendation}</span>}
																							{s.memo && (
																								<span className="text-gray-600 truncate max-w-[150px]" title={s.memo}>
																									{s.memo}
																								</span>
																							)}
																						</div>
																						<fetcher.Form method="post" className="shrink-0">
																							<input type="hidden" name="intent" value="delete-book-status" />
																							<input type="hidden" name="id" value={s.id} />
																							<button
																								type="submit"
																								disabled={isLoading}
																								className="text-red-400/60 hover:text-red-400 px-1 py-0.5 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
																							>
																								x
																							</button>
																						</fetcher.Form>
																					</div>
																				))}
																			</div>
																		)}
																	</div>
																	<fetcher.Form method="post" className="shrink-0">
																		<input type="hidden" name="intent" value="delete-book" />
																		<input type="hidden" name="id" value={book.id} />
																		<button
																			type="submit"
																			disabled={isLoading}
																			className="text-xs text-red-400/60 hover:text-red-400 px-2 py-1 rounded border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-50"
																		>
																			削除
																		</button>
																	</fetcher.Form>
																</div>
															</div>
														);
													})}
												</div>
											)}
										</div>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</section>
	);
}
