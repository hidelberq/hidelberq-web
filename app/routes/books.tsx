import { Link, useNavigate } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, and } from "drizzle-orm";
import { bookGroups, bookGroupMembers } from "~/db/schema";
import { generateGroupCode } from "~/books/types";
import type { Route } from "./+types/books";
import { useState, useEffect } from "react";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "積読 2.0 | hidelberq" },
		{
			name: "description",
			content: "個人の積読リストとグループ読書を管理するアプリ",
		},
	];
}

export async function action({ request, context }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const formData = await request.formData();
	const intent = formData.get("intent") as string;

	if (intent === "create") {
		const groupName = (formData.get("groupName") as string)?.trim();
		const displayName = (formData.get("displayName") as string)?.trim();
		const memberId = formData.get("memberId") as string;
		const description = (
			formData.get("description") as string | null
		)?.trim();

		if (!groupName || !displayName || !memberId) {
			return { error: "グループ名と表示名を入力してください" };
		}

		let groupCode = generateGroupCode();
		// コード重複チェック
		for (let i = 0; i < 5; i++) {
			const existing = await db
				.select()
				.from(bookGroups)
				.where(eq(bookGroups.groupCode, groupCode))
				.limit(1);
			if (existing.length === 0) break;
			groupCode = generateGroupCode();
		}

		const [group] = await db
			.insert(bookGroups)
			.values({
				groupCode,
				name: groupName,
				description: description || null,
				createdByMemberId: memberId,
			})
			.returning();

		await db.insert(bookGroupMembers).values({
			groupId: group.id,
			memberId,
			displayName,
		});

		return { success: true, groupCode, intent: "create" };
	}

	if (intent === "join") {
		const groupCode = (formData.get("groupCode") as string)
			?.trim()
			.toUpperCase();
		const displayName = (formData.get("displayName") as string)?.trim();
		const memberId = formData.get("memberId") as string;

		if (!groupCode || !displayName || !memberId) {
			return { error: "招待コードと表示名を入力してください" };
		}

		const [group] = await db
			.select()
			.from(bookGroups)
			.where(eq(bookGroups.groupCode, groupCode))
			.limit(1);

		if (!group) {
			return { error: "グループが見つかりません" };
		}

		// 既に参加済みかチェック
		const [existing] = await db
			.select()
			.from(bookGroupMembers)
			.where(
				and(
					eq(bookGroupMembers.groupId, group.id),
					eq(bookGroupMembers.memberId, memberId),
				),
			)
			.limit(1);

		if (existing) {
			return { success: true, groupCode, intent: "join" };
		}

		await db.insert(bookGroupMembers).values({
			groupId: group.id,
			memberId,
			displayName,
		});

		return { success: true, groupCode, intent: "join" };
	}

	if (intent === "setName") {
		const displayName = (formData.get("displayName") as string)?.trim();
		const memberId = formData.get("memberId") as string;

		if (!displayName || !memberId) {
			return { error: "表示名を入力してください" };
		}

		return { success: true, intent: "setName", displayName };
	}

	return { error: "不明な操作です" };
}

export default function Books({ actionData }: Route.ComponentProps) {
	const navigate = useNavigate();
	const [memberId, setMemberId] = useState("");
	const [displayName, setDisplayName] = useState("");
	const [savedGroups, setSavedGroups] = useState<
		Array<{ code: string; name: string }>
	>([]);
	const [tab, setTab] = useState<"create" | "join">("create");
	const [showGroupSection, setShowGroupSection] = useState(false);

	useEffect(() => {
		// localStorage から memberId を取得 or 生成
		let id = localStorage.getItem("bookMemberId");
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem("bookMemberId", id);
		}
		setMemberId(id);

		// 表示名を取得
		const name = localStorage.getItem("bookDisplayName") || "";
		setDisplayName(name);

		// 保存済みグループを取得
		const groups = JSON.parse(
			localStorage.getItem("bookGroups") || "[]",
		) as Array<{ code: string; name: string }>;
		setSavedGroups(groups);
	}, []);

	// action 成功時の処理
	useEffect(() => {
		if (actionData?.success && actionData.intent === "setName" && "displayName" in actionData) {
			localStorage.setItem("bookDisplayName", actionData.displayName as string);
			setDisplayName(actionData.displayName as string);
		}
		if (actionData?.success && actionData.groupCode) {
			const groups = JSON.parse(
				localStorage.getItem("bookGroups") || "[]",
			) as Array<{ code: string; name: string }>;
			if (!groups.some((g) => g.code === actionData.groupCode)) {
				groups.push({
					code: actionData.groupCode,
					name: actionData.groupCode,
				});
				localStorage.setItem("bookGroups", JSON.stringify(groups));
			}
			navigate(`/books/${actionData.groupCode}`);
		}
	}, [actionData, navigate]);

	const needsName = !displayName;

	return (
		<div className="min-h-dvh bg-gradient-to-br from-violet-950 via-fuchsia-950 to-indigo-950">
			<div className="fixed inset-0 overflow-hidden pointer-events-none">
				<div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl" />
				<div className="absolute top-1/4 -right-20 w-80 h-80 bg-fuchsia-500/20 rounded-full blur-3xl" />
				<div className="absolute bottom-1/4 left-1/4 w-72 h-72 bg-cyan-500/15 rounded-full blur-3xl" />
			</div>

			<div className="relative flex flex-col items-center px-4 py-16">
				<Link
					to="/"
					className="text-sm text-purple-300/60 hover:text-purple-200 transition-colors mb-8"
				>
					&larr; トップに戻る
				</Link>

				<h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-2 bg-gradient-to-r from-white via-fuchsia-200 to-cyan-200 bg-clip-text text-transparent">
					積読 2.0
				</h1>
				<p className="text-purple-200/60 mb-12">
					個人の積読リストとグループ読書を管理
				</p>

				{/* 表示名設定（初回のみ） */}
				{needsName && (
					<section className="w-full max-w-md mb-12">
						<div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-fuchsia-500/30 p-6">
							<h2 className="text-lg font-semibold text-white mb-3">
								はじめに表示名を設定
							</h2>
							<p className="text-sm text-purple-200/60 mb-4">
								他のユーザーに表示される名前です
							</p>
							<form method="post" className="space-y-4">
								<input type="hidden" name="intent" value="setName" />
								<input type="hidden" name="memberId" value={memberId} />
								<input
									type="text"
									name="displayName"
									required
									placeholder="例: hidelberq"
									className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-purple-300/40 focus:outline-none focus:border-fuchsia-500/50 focus:ring-1 focus:ring-fuchsia-500/30"
								/>
								<button
									type="submit"
									className="w-full rounded-xl bg-gradient-to-r from-fuchsia-600 to-purple-600 px-6 py-3 font-semibold text-white transition-all hover:from-fuchsia-500 hover:to-purple-500 hover:shadow-lg hover:shadow-fuchsia-500/20"
								>
									設定する
								</button>
							</form>
						</div>
					</section>
				)}

				{/* メインナビゲーション */}
				{!needsName && (
					<>
						<div className="w-full max-w-md grid gap-4 mb-12">
							{/* 個人積読リスト */}
							<Link
								to="/books/my"
								className="group relative flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-5 transition-all duration-300 hover:border-fuchsia-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-fuchsia-500/10"
							>
								<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500/30 to-purple-600/30 text-2xl flex-shrink-0">
									📚
								</div>
								<div className="flex-1 min-w-0">
									<h2 className="text-lg font-semibold text-white mb-0.5">
										マイ積読リスト
									</h2>
									<p className="text-sm text-purple-200/60">
										個人の読書リストを管理・公開
									</p>
								</div>
								<span className="text-purple-300/40 group-hover:text-fuchsia-300 transition-colors">
									&rarr;
								</span>
							</Link>

							{/* グループ読書セクション */}
							<button
								type="button"
								onClick={() => setShowGroupSection(!showGroupSection)}
								className="group relative flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-6 py-5 transition-all duration-300 hover:border-cyan-500/40 hover:bg-white/10 hover:shadow-lg hover:shadow-cyan-500/10 text-left"
							>
								<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-600/30 text-2xl flex-shrink-0">
									👥
								</div>
								<div className="flex-1 min-w-0">
									<h2 className="text-lg font-semibold text-white mb-0.5">
										グループ読書
									</h2>
									<p className="text-sm text-purple-200/60">
										グループでの読書リスト管理
									</p>
								</div>
								<span className={`text-purple-300/40 transition-transform ${showGroupSection ? "rotate-90" : ""}`}>
									&rarr;
								</span>
							</button>
						</div>

						{/* 参加済みグループ */}
						{savedGroups.length > 0 && (
							<section className="w-full max-w-md mb-8">
								<h2 className="text-sm font-semibold uppercase tracking-widest text-cyan-400/80 mb-4">
									参加済みグループ
								</h2>
								<div className="grid gap-3">
									{savedGroups.map((group) => (
										<Link
											key={group.code}
											to={`/books/${group.code}`}
											className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm px-5 py-4 transition-all duration-300 hover:border-cyan-500/40 hover:bg-white/10"
										>
											<div>
												<span className="text-lg font-semibold text-white">
													{group.name}
												</span>
												<p className="text-sm text-purple-300/60 font-mono">
													{group.code}
												</p>
											</div>
											<span className="text-purple-300/40">
												&rarr;
											</span>
										</Link>
									))}
								</div>
							</section>
						)}

						{/* グループ作成/参加フォーム */}
						{showGroupSection && (
							<section className="w-full max-w-md">
								<div className="flex mb-6 rounded-xl bg-white/5 border border-white/10 p-1">
									<button
										type="button"
										onClick={() => setTab("create")}
										className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
											tab === "create"
												? "bg-cyan-500/30 text-cyan-200 border border-cyan-500/40"
												: "text-purple-300/60 hover:text-purple-200"
										}`}
									>
										グループ作成
									</button>
									<button
										type="button"
										onClick={() => setTab("join")}
										className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all ${
											tab === "join"
												? "bg-cyan-500/30 text-cyan-200 border border-cyan-500/40"
												: "text-purple-300/60 hover:text-purple-200"
										}`}
									>
										グループ参加
									</button>
								</div>

								{actionData?.error && (
									<div className="mb-4 rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-3 text-sm text-red-300">
										{actionData.error}
									</div>
								)}

								{tab === "create" ? (
									<form method="post" className="space-y-4">
										<input
											type="hidden"
											name="intent"
											value="create"
										/>
										<input
											type="hidden"
											name="memberId"
											value={memberId}
										/>
										<input
											type="hidden"
											name="displayName"
											value={displayName}
										/>
										<div>
											<label className="block text-sm font-medium text-purple-200 mb-1.5">
												グループ名
											</label>
											<input
												type="text"
												name="groupName"
												required
												placeholder="例: NWU読書会"
												className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-purple-300/40 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30"
											/>
										</div>
										<div>
											<label className="block text-sm font-medium text-purple-200 mb-1.5">
												グループの説明（任意）
											</label>
											<textarea
												name="description"
												rows={2}
												placeholder="グループの目的や説明を入力"
												className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-purple-300/40 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 resize-none"
											/>
										</div>
										<button
											type="submit"
											className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 font-semibold text-white transition-all hover:from-cyan-500 hover:to-blue-500 hover:shadow-lg hover:shadow-cyan-500/20"
										>
											グループを作成
										</button>
									</form>
								) : (
									<form method="post" className="space-y-4">
										<input type="hidden" name="intent" value="join" />
										<input
											type="hidden"
											name="memberId"
											value={memberId}
										/>
										<input
											type="hidden"
											name="displayName"
											value={displayName}
										/>
										<div>
											<label className="block text-sm font-medium text-purple-200 mb-1.5">
												招待コード
											</label>
											<input
												type="text"
												name="groupCode"
												required
												maxLength={6}
												placeholder="6文字のコードを入力"
												className="w-full rounded-xl bg-white/10 border border-white/20 px-4 py-3 text-white placeholder:text-purple-300/40 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 font-mono text-center text-lg tracking-widest uppercase"
											/>
										</div>
										<button
											type="submit"
											className="w-full rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-6 py-3 font-semibold text-white transition-all hover:from-cyan-500 hover:to-blue-500 hover:shadow-lg hover:shadow-cyan-500/20"
										>
											グループに参加
										</button>
									</form>
								)}
							</section>
						)}
					</>
				)}

				{/* 表示名情報 */}
				{displayName && (
					<p className="text-xs text-purple-300/30 mt-8">
						表示名: {displayName}
					</p>
				)}
			</div>
		</div>
	);
}
