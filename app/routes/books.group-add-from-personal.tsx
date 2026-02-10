import { Link, useNavigate, useSearchParams } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import {
	bookGroups,
	bookGroupMembers,
	books,
	bookMemberStatuses,
	personalBooks,
} from "~/db/schema";
import { getStatusColor, BOOK_STATUSES, type BookStatus } from "~/books/types";
import type { Route } from "./+types/books.group-add-from-personal";
import { useState, useEffect } from "react";

export function meta(): Route.MetaDescriptors {
	return [{ title: "マイ積読リストから追加 | 読書リスト | 積読 2.0 | hidelberq" }];
}

export async function loader({ params, request, context }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const url = new URL(request.url);
	const memberId = url.searchParams.get("memberId") ?? "";

	const [group] = await db
		.select()
		.from(bookGroups)
		.where(eq(bookGroups.groupCode, params.groupCode))
		.limit(1);

	if (!group) {
		throw new Response("グループが見つかりません", { status: 404 });
	}

	// 個人リストの本を取得
	let myBooks: Array<{
		id: number;
		title: string;
		author: string;
		coverImageUrl: string | null;
		status: string;
		genre: string | null;
	}> = [];

	if (memberId) {
		myBooks = await db
			.select({
				id: personalBooks.id,
				title: personalBooks.title,
				author: personalBooks.author,
				coverImageUrl: personalBooks.coverImageUrl,
				status: personalBooks.status,
				genre: personalBooks.genre,
			})
			.from(personalBooks)
			.where(eq(personalBooks.memberId, memberId));
	}

	return {
		group: { id: group.id, name: group.name, groupCode: group.groupCode },
		myBooks,
	};
}

export async function action({ request, params, context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const formData = await request.formData();
	const memberId = formData.get("memberId") as string;
	const personalBookId = Number(formData.get("personalBookId"));

	const [group] = await db
		.select()
		.from(bookGroups)
		.where(eq(bookGroups.groupCode, params.groupCode))
		.limit(1);

	if (!group) {
		throw new Response("グループが見つかりません", { status: 404 });
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

	// 個人の本を取得
	const [personalBook] = await db
		.select()
		.from(personalBooks)
		.where(
			and(
				eq(personalBooks.id, personalBookId),
				eq(personalBooks.memberId, memberId),
			),
		)
		.limit(1);

	if (!personalBook) {
		return { error: "本が見つかりません" };
	}

	// グループに本を追加
	const [book] = await db
		.insert(books)
		.values({
			groupId: group.id,
			title: personalBook.title,
			author: personalBook.author,
			isbn: personalBook.isbn,
			publishedYear: personalBook.publishedYear,
			publisher: personalBook.publisher,
			coverImageUrl: personalBook.coverImageUrl,
			description: personalBook.description,
			pageCount: personalBook.pageCount,
			genre: personalBook.genre,
			addedByMemberId: memberId,
			addedByName: member.displayName,
		})
		.returning();

	// 個人のステータスもグループに反映
	await db.insert(bookMemberStatuses).values({
		bookId: book.id,
		memberId,
		memberName: member.displayName,
		status: personalBook.status,
		difficulty: personalBook.difficulty,
		importance: personalBook.importance,
		recommendation: personalBook.recommendation,
		memo: personalBook.memo,
		startedAt: personalBook.startedAt,
		completedAt: personalBook.completedAt,
	});

	return { success: true, bookId: book.id };
}

export default function BooksGroupAddFromPersonal({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { group, myBooks } = loaderData;
	const navigate = useNavigate();
	const [searchParams, setSearchParams] = useSearchParams();
	const [memberId, setMemberId] = useState("");

	useEffect(() => {
		const id = localStorage.getItem("bookMemberId") || "";
		setMemberId(id);

		// loader 用に memberId をクエリパラメータに設定
		if (id && !searchParams.get("memberId")) {
			const params = new URLSearchParams(searchParams);
			params.set("memberId", id);
			setSearchParams(params, { replace: true });
		}
	}, [searchParams, setSearchParams]);

	useEffect(() => {
		if (actionData?.success) {
			navigate(`/books/${group.groupCode}`);
		}
	}, [actionData, navigate, group.groupCode]);

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

				<h1 className="text-3xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
					マイ積読リストから追加
				</h1>
				<p className="text-purple-200/60 mb-8">
					マイ積読リストからグループに本を追加
				</p>

				{actionData?.error && (
					<div className="w-full max-w-lg mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
						{actionData.error}
					</div>
				)}

				<div className="w-full max-w-lg">
					{myBooks.length === 0 ? (
						<div className="text-center py-16">
							<p className="text-purple-300/40 mb-4">
								個人の積読リストに本がありません
							</p>
							<Link
								to="/books/my/add"
								className="text-sm text-fuchsia-300 hover:text-fuchsia-200 transition-colors"
							>
								まず積読リストに本を追加 &rarr;
							</Link>
						</div>
					) : (
						<div className="grid gap-3">
							{myBooks.map((book) => (
								<form key={book.id} method="post">
									<input type="hidden" name="memberId" value={memberId} />
									<input type="hidden" name="personalBookId" value={book.id} />
									<button
										type="submit"
										className="w-full flex gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-fuchsia-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-fuchsia-500/10 text-left"
									>
										{book.coverImageUrl ? (
											<img
												src={book.coverImageUrl}
												alt=""
												className="w-12 h-16 object-cover rounded flex-shrink-0"
											/>
										) : (
											<div className="w-12 h-16 bg-white/10 rounded flex-shrink-0 flex items-center justify-center text-purple-300/30 text-xs">
												No img
											</div>
										)}
										<div className="flex-1 min-w-0">
											<h3 className="font-semibold text-white truncate">
												{book.title}
											</h3>
											<p className="text-sm text-purple-300/60 truncate">
												{book.author}
												{book.genre && ` / ${book.genre}`}
											</p>
											<div className="flex items-center gap-2 mt-1.5">
												<span
													className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(book.status as BookStatus)}`}
												>
													{BOOK_STATUSES[book.status as BookStatus]}
												</span>
											</div>
										</div>
										<span className="text-fuchsia-300/60 self-center text-sm">
											追加
										</span>
									</button>
								</form>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
