import { useState, useMemo, useEffect } from "react";
import { Link, useFetcher, useSearchParams } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq, and, gte, lte } from "drizzle-orm";
import {
	rhythmEntries,
	bookGroupMembers,
	personalBooks,
} from "../db/schema";
import type { Route } from "./+types/rhythm";

export function meta(_args: Route.MetaArgs) {
	return [
		{ title: "社会リズム療法 行動記録票 - hidelberq" },
		{
			name: "description",
			content: "社会リズム療法の行動記録票 - 活動・気分・対人関係を記録",
		},
	];
}

// --- ユーティリティ ---

function toJSTDateString(d: Date): string {
	return d.toLocaleDateString("sv-SE", { timeZone: "Asia/Tokyo" });
}

function todayJST(): string {
	return toJSTDateString(new Date());
}

function getMonday(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00");
	const day = d.getDay();
	const diff = day === 0 ? -6 : 1 - day;
	d.setDate(d.getDate() + diff);
	return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, n: number): string {
	const d = new Date(dateStr + "T00:00:00");
	d.setDate(d.getDate() + n);
	return d.toISOString().slice(0, 10);
}

function getMonthStart(dateStr: string): string {
	return dateStr.slice(0, 7) + "-01";
}

function getMonthEnd(dateStr: string): string {
	const d = new Date(dateStr.slice(0, 7) + "-01T00:00:00");
	d.setMonth(d.getMonth() + 1);
	d.setDate(d.getDate() - 1);
	return d.toISOString().slice(0, 10);
}

function formatDate(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00");
	const month = d.getMonth() + 1;
	const day = d.getDate();
	const weekday = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
	return `${month}/${day} (${weekday})`;
}

function formatDateShort(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00");
	return `${d.getMonth() + 1}/${d.getDate()}`;
}

function formatMonth(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00");
	return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

function getWeekdayShort(dateStr: string): string {
	const d = new Date(dateStr + "T00:00:00");
	return ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
}

const INTERPERSONAL_LABELS = [
	"一人だった",
	"他人がただそこにいた",
	"他人が積極的に関わった",
	"他人から影響を受けた",
] as const;

const INTERPERSONAL_SHORT = ["一人", "そこに", "関わり", "影響"] as const;

type Entry = {
	id: number;
	date: string;
	time: string;
	activity: string;
	mood: number;
	interpersonal: number;
	note: string | null;
};

function moodColor(mood: number): string {
	if (mood > 3) return "text-emerald-400";
	if (mood > 0) return "text-emerald-300/70";
	if (mood === 0) return "text-violet-300";
	if (mood >= -3) return "text-amber-400/70";
	return "text-red-400";
}

function moodBgClass(mood: number): string {
	if (mood > 3) return "bg-emerald-500/15";
	if (mood > 0) return "bg-emerald-500/8";
	if (mood === 0) return "";
	if (mood >= -3) return "bg-amber-500/8";
	return "bg-red-500/15";
}

// --- Loader ---

export async function loader({ context, request }: Route.LoaderArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const url = new URL(request.url);
	const view = url.searchParams.get("view") || "today";
	const dateParam = url.searchParams.get("date") || todayJST();
	const memberId = url.searchParams.get("memberId") || "";

	let startDate: string;
	let endDate: string;

	if (view === "week") {
		startDate = getMonday(dateParam);
		endDate = addDays(startDate, 6);
	} else if (view === "month") {
		startDate = getMonthStart(dateParam);
		endDate = getMonthEnd(dateParam);
	} else {
		startDate = dateParam;
		endDate = dateParam;
	}

	if (!memberId) {
		return {
			entries: [] as Entry[],
			view,
			currentDate: dateParam,
			startDate,
			endDate,
		};
	}

	try {
		const entries = await db
			.select()
			.from(rhythmEntries)
			.where(
				and(
					eq(rhythmEntries.memberId, memberId),
					gte(rhythmEntries.date, startDate),
					lte(rhythmEntries.date, endDate),
				),
			)
			.orderBy(rhythmEntries.date, rhythmEntries.time);

		return {
			entries: entries.map((e) => ({
				id: e.id,
				date: e.date,
				time: e.time,
				activity: e.activity,
				mood: e.mood,
				interpersonal: e.interpersonal,
				note: e.note,
			})),
			view,
			currentDate: dateParam,
			startDate,
			endDate,
		};
	} catch {
		// テーブルが未作成の場合（マイグレーション未適用）
		return {
			entries: [] as Entry[],
			view,
			currentDate: dateParam,
			startDate,
			endDate,
		};
	}
}

// --- Action ---

export async function action({ context, request }: Route.ActionArgs) {
	const db = drizzle(context.cloudflare.env.DB);
	const formData = await request.formData();
	const intent = formData.get("intent") as string;

	try {
		if (intent === "setName") {
			const displayName = (
				formData.get("displayName") as string
			)?.trim();
			const memberId = formData.get("memberId") as string;

			if (!displayName || !memberId) {
				return { error: "表示名を入力してください" };
			}

			// 同じ表示名の既存ユーザーを検索（デバイス間同期）
			const [existingMember] = await db
				.select({ memberId: bookGroupMembers.memberId })
				.from(bookGroupMembers)
				.where(eq(bookGroupMembers.displayName, displayName))
				.limit(1);

			if (existingMember) {
				return {
					success: true,
					intent: "setName",
					displayName,
					memberId: existingMember.memberId,
				};
			}

			// 個人積読リストからも検索
			const [existingPersonal] = await db
				.select({ memberId: personalBooks.memberId })
				.from(personalBooks)
				.where(eq(personalBooks.memberName, displayName))
				.limit(1);

			if (existingPersonal) {
				return {
					success: true,
					intent: "setName",
					displayName,
					memberId: existingPersonal.memberId,
				};
			}

			return {
				success: true,
				intent: "setName",
				displayName,
				memberId,
			};
		}

		if (intent === "create") {
			const memberId = formData.get("memberId") as string;
			const date = formData.get("date") as string;
			const time = formData.get("time") as string;
			const activity = formData.get("activity") as string;
			const mood = Number(formData.get("mood"));
			const interpersonal = Number(formData.get("interpersonal"));
			const note = (formData.get("note") as string) || null;

			if (!memberId || !date || !time || !activity) {
				return { error: "必須項目を入力してください" };
			}
			if (mood < -10 || mood > 10) {
				return { error: "気分は -10 ~ +10 の範囲で入力してください" };
			}
			if (interpersonal < 0 || interpersonal > 3) {
				return { error: "対人は 0 ~ 3 の範囲で入力してください" };
			}

			await db.insert(rhythmEntries).values({
				memberId,
				date,
				time,
				activity,
				mood,
				interpersonal,
				note,
			});

			return { success: true };
		}

		if (intent === "delete") {
			const id = Number(formData.get("id"));
			const memberId = formData.get("memberId") as string;
			if (id && memberId) {
				await db
					.delete(rhythmEntries)
					.where(
						and(
							eq(rhythmEntries.id, id),
							eq(rhythmEntries.memberId, memberId),
						),
					);
			}
			return { success: true };
		}
	} catch {
		return { error: "データベースエラー: マイグレーションが未適用の可能性があります" };
	}

	return { error: "不明な操作です" };
}

// --- コンポーネント ---

export default function RhythmTracker({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const { entries, view, currentDate, startDate, endDate } = loaderData;
	const [searchParams, setSearchParams] = useSearchParams();
	const [memberId, setMemberId] = useState("");
	const [displayName, setDisplayName] = useState("");

	useEffect(() => {
		// 積読2.0 と同じ localStorage キーを使用
		let id = localStorage.getItem("bookMemberId");
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem("bookMemberId", id);
		}
		setMemberId(id);

		const name = localStorage.getItem("bookDisplayName") || "";
		setDisplayName(name);

		// memberId が URL に含まれていなければ追加
		if (name && searchParams.get("memberId") !== id) {
			const params = new URLSearchParams(searchParams);
			params.set("memberId", id);
			setSearchParams(params, { replace: true });
		}
	}, [searchParams, setSearchParams]);

	// setName action の成功時
	useEffect(() => {
		if (
			actionData &&
			"success" in actionData &&
			actionData.success &&
			"intent" in actionData &&
			actionData.intent === "setName" &&
			"displayName" in actionData
		) {
			const newName = actionData.displayName as string;
			localStorage.setItem("bookDisplayName", newName);
			setDisplayName(newName);
			if ("memberId" in actionData && actionData.memberId) {
				const newId = actionData.memberId as string;
				localStorage.setItem("bookMemberId", newId);
				setMemberId(newId);
				// URL に memberId を反映
				const params = new URLSearchParams(searchParams);
				params.set("memberId", newId);
				setSearchParams(params, { replace: true });
			}
		}
	}, [actionData, searchParams, setSearchParams]);

	const needsName = !displayName;

	return (
		<div className="min-h-screen bg-violet-950 text-white">
			<div className="mx-auto max-w-5xl px-4 py-6">
				{/* ヘッダー */}
				<div className="mb-6">
					<Link
						to="/"
						className="text-sm text-violet-400 hover:text-violet-300"
					>
						← トップ
					</Link>
					<h1 className="mt-2 text-2xl font-bold text-white">
						社会リズム療法 行動記録票
					</h1>
					<p className="mt-1 text-sm text-violet-300">
						活動・気分・対人関係を記録して、生活リズムを可視化
					</p>
				</div>

				{/* 名前未設定の場合はログイン画面を表示 */}
				{needsName ? (
					<NameSetupForm memberId={memberId} />
				) : (
					<>
						{/* ログイン中ユーザー表示 */}
						<div className="mb-4 flex items-center justify-between text-sm">
							<span className="text-violet-400">
								ログイン中:{" "}
								<strong className="text-violet-200">
									{displayName}
								</strong>
							</span>
							<button
								type="button"
								onClick={() => {
									localStorage.removeItem("bookDisplayName");
									setDisplayName("");
								}}
								className="text-violet-500 hover:text-violet-300 transition-colors"
							>
								ログアウト
							</button>
						</div>

						{/* ビュー切り替えタブ */}
						<ViewTabs
							view={view}
							currentDate={currentDate}
							memberId={memberId}
						/>

						{/* ナビゲーション */}
						<DateNavigation
							view={view}
							currentDate={currentDate}
							startDate={startDate}
							endDate={endDate}
							memberId={memberId}
						/>

						{/* 入力フォーム */}
						<EntryForm
							currentDate={currentDate}
							memberId={memberId}
						/>

						{/* ビュー別表示 */}
						{view === "today" && (
							<TodayView
								entries={entries}
								currentDate={currentDate}
								memberId={memberId}
							/>
						)}
						{view === "week" && (
							<WeekView
								entries={entries}
								startDate={startDate}
								endDate={endDate}
								memberId={memberId}
							/>
						)}
						{view === "month" && (
							<MonthView
								entries={entries}
								currentDate={currentDate}
								startDate={startDate}
								endDate={endDate}
							/>
						)}

						{/* グラフ */}
						{entries.length > 0 && (
							<ChartSection entries={entries} />
						)}
					</>
				)}
			</div>
		</div>
	);
}

// --- 名前設定フォーム ---

function NameSetupForm({ memberId }: { memberId: string }) {
	return (
		<div className="mx-auto max-w-md">
			<div className="rounded-2xl border border-violet-700/50 bg-violet-900/30 p-6">
				<h2 className="mb-3 text-lg font-semibold text-white">
					はじめに表示名を設定
				</h2>
				<p className="mb-4 text-sm text-violet-300">
					積読 2.0 と共通のアカウントです。既に設定済みの方は同じ名前を入力してください。
				</p>
				<form method="post" className="space-y-4">
					<input type="hidden" name="intent" value="setName" />
					<input type="hidden" name="memberId" value={memberId} />
					<input
						type="text"
						name="displayName"
						required
						placeholder="例: hidelberq"
						className="w-full rounded-lg border border-violet-700 bg-violet-950 px-4 py-3 text-white placeholder:text-violet-600 focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
					/>
					<button
						type="submit"
						className="w-full rounded-lg bg-violet-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-500"
					>
						設定してはじめる
					</button>
				</form>
			</div>
		</div>
	);
}

// --- ビュータブ ---

function ViewTabs({
	view,
	currentDate,
	memberId,
}: { view: string; currentDate: string; memberId: string }) {
	const tabs = [
		{ key: "today", label: "今日" },
		{ key: "week", label: "週間" },
		{ key: "month", label: "月間" },
	] as const;

	return (
		<div className="mb-4 flex gap-1 rounded-lg bg-violet-900/50 p-1">
			{tabs.map((tab) => (
				<Link
					key={tab.key}
					to={`/rhythm?view=${tab.key}&date=${currentDate}&memberId=${memberId}`}
					className={`flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors ${
						view === tab.key
							? "bg-violet-600 text-white shadow-sm"
							: "text-violet-300 hover:bg-violet-800/50 hover:text-white"
					}`}
				>
					{tab.label}
				</Link>
			))}
		</div>
	);
}

// --- 日付ナビゲーション ---

function DateNavigation({
	view,
	currentDate,
	startDate,
	endDate,
	memberId,
}: {
	view: string;
	currentDate: string;
	startDate: string;
	endDate: string;
	memberId: string;
}) {
	let prevDate: string;
	let nextDate: string;
	let label: string;

	if (view === "week") {
		prevDate = addDays(startDate, -7);
		nextDate = addDays(startDate, 7);
		label = `${formatDate(startDate)} 〜 ${formatDate(endDate)}`;
	} else if (view === "month") {
		const d = new Date(currentDate + "T00:00:00");
		d.setMonth(d.getMonth() - 1);
		prevDate = d.toISOString().slice(0, 10);
		d.setMonth(d.getMonth() + 2);
		nextDate = d.toISOString().slice(0, 10);
		label = formatMonth(currentDate);
	} else {
		prevDate = addDays(currentDate, -1);
		nextDate = addDays(currentDate, 1);
		label = formatDate(currentDate);
	}

	return (
		<div className="mb-6 flex items-center justify-between">
			<Link
				to={`/rhythm?view=${view}&date=${prevDate}&memberId=${memberId}`}
				className="rounded-lg bg-violet-900/50 px-3 py-2 text-sm text-violet-300 transition-colors hover:bg-violet-800 hover:text-white"
			>
				←
			</Link>
			<span className="text-lg font-semibold">{label}</span>
			<Link
				to={`/rhythm?view=${view}&date=${nextDate}&memberId=${memberId}`}
				className="rounded-lg bg-violet-900/50 px-3 py-2 text-sm text-violet-300 transition-colors hover:bg-violet-800 hover:text-white"
			>
				→
			</Link>
		</div>
	);
}

// --- 入力フォーム ---

function EntryForm({
	currentDate,
	memberId,
}: { currentDate: string; memberId: string }) {
	const fetcher = useFetcher();
	const [mood, setMood] = useState(0);
	const [isOpen, setIsOpen] = useState(false);
	const isSubmitting = fetcher.state !== "idle";

	const now = new Date();
	const defaultTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

	return (
		<div className="mb-6">
			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className="w-full rounded-lg bg-violet-800/50 px-4 py-3 text-left text-sm font-medium text-violet-200 transition-colors hover:bg-violet-800"
			>
				{isOpen ? "▼ 記録を閉じる" : "＋ 新しい記録を追加"}
			</button>

			{isOpen && (
				<fetcher.Form
					method="post"
					className="mt-2 space-y-4 rounded-lg border border-violet-800 bg-violet-900/30 p-4"
					onSubmit={() => {
						setTimeout(() => {
							setIsOpen(false);
							setMood(0);
						}, 100);
					}}
				>
					<input type="hidden" name="intent" value="create" />
					<input type="hidden" name="memberId" value={memberId} />

					<div className="grid grid-cols-2 gap-4">
						<div>
							<label className="mb-1 block text-xs text-violet-400">
								日付
							</label>
							<input
								type="date"
								name="date"
								defaultValue={currentDate}
								className="w-full rounded-md border border-violet-700 bg-violet-950 px-3 py-2 text-sm text-white"
								required
							/>
						</div>
						<div>
							<label className="mb-1 block text-xs text-violet-400">
								時刻
							</label>
							<input
								type="time"
								name="time"
								defaultValue={defaultTime}
								className="w-full rounded-md border border-violet-700 bg-violet-950 px-3 py-2 text-sm text-white"
								required
							/>
						</div>
					</div>

					<div>
						<label className="mb-1 block text-xs text-violet-400">
							活動
						</label>
						<input
							type="text"
							name="activity"
							placeholder="例: 朝食、通勤、仕事、散歩..."
							className="w-full rounded-md border border-violet-700 bg-violet-950 px-3 py-2 text-sm text-white placeholder:text-violet-600"
							required
						/>
					</div>

					<div>
						<label className="mb-1 block text-xs text-violet-400">
							気分: {mood > 0 ? `+${mood}` : mood}
						</label>
						<input
							type="range"
							name="mood"
							min="-10"
							max="10"
							value={mood}
							onChange={(e) => setMood(Number(e.target.value))}
							className="w-full accent-violet-500"
						/>
						<div className="flex justify-between text-xs text-violet-500">
							<span>-10 (最悪)</span>
							<span>0</span>
							<span>+10 (最高)</span>
						</div>
					</div>

					<div>
						<label className="mb-1 block text-xs text-violet-400">
							対人
						</label>
						<div className="space-y-1">
							{INTERPERSONAL_LABELS.map((label, i) => (
								<label
									key={i}
									className="flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-violet-800/30"
								>
									<input
										type="radio"
										name="interpersonal"
										value={i}
										defaultChecked={i === 0}
										className="accent-violet-500"
									/>
									<span className="text-violet-200">
										{i}: {label}
									</span>
								</label>
							))}
						</div>
					</div>

					<div>
						<label className="mb-1 block text-xs text-violet-400">
							メモ（任意）
						</label>
						<textarea
							name="note"
							rows={2}
							placeholder="自由記入..."
							className="w-full rounded-md border border-violet-700 bg-violet-950 px-3 py-2 text-sm text-white placeholder:text-violet-600"
						/>
					</div>

					<button
						type="submit"
						disabled={isSubmitting}
						className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-violet-500 disabled:opacity-50"
					>
						{isSubmitting ? "保存中..." : "記録する"}
					</button>
				</fetcher.Form>
			)}
		</div>
	);
}

// --- エントリー削除ボタン ---

function DeleteButton({
	entryId,
	memberId,
}: { entryId: number; memberId: string }) {
	const fetcher = useFetcher();
	const [showConfirm, setShowConfirm] = useState(false);

	if (showConfirm) {
		return (
			<div className="flex gap-1">
				<fetcher.Form method="post">
					<input type="hidden" name="intent" value="delete" />
					<input type="hidden" name="id" value={entryId} />
					<input type="hidden" name="memberId" value={memberId} />
					<button
						type="submit"
						className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/20"
					>
						削除
					</button>
				</fetcher.Form>
				<button
					type="button"
					onClick={() => setShowConfirm(false)}
					className="rounded px-2 py-1 text-xs text-violet-400 hover:bg-violet-500/20"
				>
					戻す
				</button>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setShowConfirm(true)}
			className="rounded p-1 text-violet-600 transition-colors hover:text-violet-400"
		>
			<svg
				className="h-4 w-4"
				fill="none"
				viewBox="0 0 24 24"
				stroke="currentColor"
				strokeWidth={2}
			>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					d="M6 18L18 6M6 6l12 12"
				/>
			</svg>
		</button>
	);
}

// --- エントリーカード (今日ビュー用) ---

function EntryCard({
	entry,
	memberId,
}: { entry: Entry; memberId: string }) {
	return (
		<div
			className={`rounded-lg border border-violet-800/50 ${moodBgClass(entry.mood)} p-3 transition-colors hover:border-violet-700`}
		>
			<div className="flex items-start justify-between">
				<div className="flex-1">
					<div className="flex items-center gap-3">
						<span className="font-mono text-sm text-violet-400">
							{entry.time}
						</span>
						<span className="font-medium text-white">
							{entry.activity}
						</span>
					</div>
					<div className="mt-1.5 flex flex-wrap gap-3 text-xs">
						<span className={moodColor(entry.mood)}>
							気分:{" "}
							{entry.mood > 0 ? `+${entry.mood}` : entry.mood}
						</span>
						<span className="text-violet-400">
							対人: {entry.interpersonal} (
							{INTERPERSONAL_LABELS[entry.interpersonal]})
						</span>
					</div>
					{entry.note && (
						<p className="mt-1.5 text-xs text-violet-400/80">
							{entry.note}
						</p>
					)}
				</div>
				<div className="ml-2">
					<DeleteButton entryId={entry.id} memberId={memberId} />
				</div>
			</div>
		</div>
	);
}

// --- 今日ビュー ---

function TodayView({
	entries,
	currentDate,
	memberId,
}: { entries: Entry[]; currentDate: string; memberId: string }) {
	if (entries.length === 0) {
		return (
			<div className="rounded-lg border border-dashed border-violet-800 py-12 text-center text-violet-500">
				まだ記録がありません
			</div>
		);
	}

	return (
		<div className="space-y-2">
			{entries.map((entry) => (
				<EntryCard key={entry.id} entry={entry} memberId={memberId} />
			))}
			<DaySummary entries={entries} />
		</div>
	);
}

// --- 日別サマリー ---

function DaySummary({ entries }: { entries: Entry[] }) {
	if (entries.length === 0) return null;

	const avgMood = entries.reduce((s, e) => s + e.mood, 0) / entries.length;
	const avgInterpersonal =
		entries.reduce((s, e) => s + e.interpersonal, 0) / entries.length;

	return (
		<div className="mt-3 rounded-lg bg-violet-900/30 p-3 text-sm">
			<div className="flex gap-6 text-violet-300">
				<span>
					記録数:{" "}
					<strong className="text-white">{entries.length}</strong>
				</span>
				<span>
					平均気分:{" "}
					<strong className="text-white">
						{avgMood > 0 ? "+" : ""}
						{avgMood.toFixed(1)}
					</strong>
				</span>
				<span>
					平均対人:{" "}
					<strong className="text-white">
						{avgInterpersonal.toFixed(1)}
					</strong>
				</span>
			</div>
		</div>
	);
}

// --- 週間ビュー (横並びテーブル) ---

function WeekView({
	entries,
	startDate,
	endDate,
	memberId,
}: {
	entries: Entry[];
	startDate: string;
	endDate: string;
	memberId: string;
}) {
	const days = useMemo(() => {
		const result: { date: string; entries: Entry[] }[] = [];
		for (let i = 0; i < 7; i++) {
			const date = addDays(startDate, i);
			result.push({
				date,
				entries: entries.filter((e) => e.date === date),
			});
		}
		return result;
	}, [entries, startDate]);

	const today = todayJST();

	// 全日のエントリーから最大件数を算出（縦幅の目安）
	const maxEntries = Math.max(...days.map((d) => d.entries.length), 0);

	return (
		<div className="space-y-4">
			{/* 横並びテーブル */}
			<div className="overflow-x-auto">
				<table className="w-full min-w-[640px] border-collapse text-xs">
					<thead>
						<tr>
							{days.map((day) => {
								const isToday = day.date === today;
								const avgMood =
									day.entries.length > 0
										? day.entries.reduce(
												(s, e) => s + e.mood,
												0,
											) / day.entries.length
										: null;
								return (
									<th
										key={day.date}
										className={`border border-violet-800/30 p-2 text-center ${
											isToday
												? "bg-violet-700/30"
												: "bg-violet-900/30"
										}`}
									>
										<div className="text-violet-400">
											{getWeekdayShort(day.date)}
										</div>
										<div
											className={`text-sm font-semibold ${isToday ? "text-violet-200" : "text-violet-300"}`}
										>
											{formatDateShort(day.date)}
										</div>
										{avgMood !== null && (
											<div
												className={`mt-0.5 text-[10px] ${moodColor(avgMood)}`}
											>
												avg{" "}
												{avgMood > 0 ? "+" : ""}
												{avgMood.toFixed(1)}
											</div>
										)}
									</th>
								);
							})}
						</tr>
					</thead>
					<tbody>
						{maxEntries === 0 ? (
							<tr>
								<td
									colSpan={7}
									className="border border-violet-800/30 p-6 text-center text-violet-600"
								>
									この週は記録がありません
								</td>
							</tr>
						) : (
							/* エントリー行: 各日の n番目のエントリーを横に並べる */
							Array.from({ length: maxEntries }).map((_, ri) => (
								<tr key={ri}>
									{days.map((day) => {
										const entry = day.entries[ri];
										if (!entry) {
											return (
												<td
													key={day.date}
													className="border border-violet-800/30 p-1 align-top"
												/>
											);
										}
										return (
											<td
												key={day.date}
												className={`border border-violet-800/30 p-1.5 align-top ${moodBgClass(entry.mood)}`}
											>
												<WeekEntryCell
													entry={entry}
													memberId={memberId}
												/>
											</td>
										);
									})}
								</tr>
							))
						)}
						{/* サマリー行 */}
						<tr>
							{days.map((day) => {
								if (day.entries.length === 0) {
									return (
										<td
											key={day.date}
											className="border border-violet-800/30 bg-violet-900/20 p-1.5 text-center text-violet-700"
										>
											-
										</td>
									);
								}
								const avg =
									day.entries.reduce(
										(s, e) => s + e.mood,
										0,
									) / day.entries.length;
								const avgIp =
									day.entries.reduce(
										(s, e) => s + e.interpersonal,
										0,
									) / day.entries.length;
								return (
									<td
										key={day.date}
										className="border border-violet-800/30 bg-violet-900/30 p-1.5 text-center"
									>
										<div className="text-violet-400">
											{day.entries.length}件
										</div>
										<div className={moodColor(avg)}>
											{avg > 0 ? "+" : ""}
											{avg.toFixed(1)}
										</div>
										<div className="text-violet-500">
											対人 {avgIp.toFixed(1)}
										</div>
									</td>
								);
							})}
						</tr>
					</tbody>
				</table>
			</div>

			{/* 週間サマリー */}
			{entries.length > 0 && <DaySummary entries={entries} />}
		</div>
	);
}

// --- 週間ビューのセル内エントリー ---

function WeekEntryCell({
	entry,
	memberId,
}: { entry: Entry; memberId: string }) {
	return (
		<div className="space-y-0.5">
			<div className="flex items-start justify-between gap-1">
				<div className="min-w-0 flex-1">
					<span className="font-mono text-[10px] text-violet-500">
						{entry.time}
					</span>
					<div className="truncate text-[11px] font-medium text-white">
						{entry.activity}
					</div>
				</div>
				<DeleteButton entryId={entry.id} memberId={memberId} />
			</div>
			<div className="flex gap-2 text-[10px]">
				<span className={moodColor(entry.mood)}>
					{entry.mood > 0 ? `+${entry.mood}` : entry.mood}
				</span>
				<span className="text-violet-500">
					{INTERPERSONAL_SHORT[entry.interpersonal]}
				</span>
			</div>
			{entry.note && (
				<p className="truncate text-[10px] text-violet-500/70">
					{entry.note}
				</p>
			)}
		</div>
	);
}

// --- 月間ビュー ---

function MonthView({
	entries,
	currentDate,
	startDate,
	endDate,
}: {
	entries: Entry[];
	currentDate: string;
	startDate: string;
	endDate: string;
}) {
	const calendarData = useMemo(() => {
		const firstDay = new Date(startDate + "T00:00:00");
		const lastDay = new Date(endDate + "T00:00:00");
		const startDow = firstDay.getDay();
		const offset = startDow === 0 ? -6 : 1 - startDow;

		const weeks: {
			date: string;
			inMonth: boolean;
			entries: Entry[];
		}[][] = [];
		const current = new Date(firstDay);
		current.setDate(current.getDate() + offset);

		while (
			current <= lastDay ||
			weeks.length === 0 ||
			current.getDay() !== 1
		) {
			if (current.getDay() === 1 || weeks.length === 0) {
				weeks.push([]);
			}
			const dateStr = current.toISOString().slice(0, 10);
			weeks[weeks.length - 1].push({
				date: dateStr,
				inMonth: dateStr >= startDate && dateStr <= endDate,
				entries: entries.filter((e) => e.date === dateStr),
			});
			current.setDate(current.getDate() + 1);
			if (
				weeks[weeks.length - 1].length === 7 &&
				current > lastDay
			) {
				break;
			}
		}

		return weeks;
	}, [entries, startDate, endDate]);

	const weekdayHeaders = ["月", "火", "水", "木", "金", "土", "日"];
	const today = todayJST();

	return (
		<div className="overflow-x-auto">
			<table className="w-full border-collapse text-xs">
				<thead>
					<tr>
						{weekdayHeaders.map((wd) => (
							<th
								key={wd}
								className="border border-violet-800/30 bg-violet-900/30 p-1.5 text-center text-violet-400"
							>
								{wd}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{calendarData.map((week, wi) => (
						<tr key={wi}>
							{week.map((day) => {
								const avgMood =
									day.entries.length > 0
										? day.entries.reduce(
												(s, e) => s + e.mood,
												0,
											) / day.entries.length
										: null;

								const cellBg =
									avgMood === null
										? ""
										: moodBgClass(avgMood);

								const dayNum = new Date(
									day.date + "T00:00:00",
								).getDate();

								return (
									<td
										key={day.date}
										className={`border border-violet-800/30 p-1 align-top ${cellBg} ${
											!day.inMonth ? "opacity-30" : ""
										} ${day.date === today ? "ring-1 ring-inset ring-violet-500" : ""}`}
										style={{ minWidth: 80, height: 64 }}
									>
										<div className="mb-0.5 text-right text-violet-400">
											{dayNum}
										</div>
										{day.entries.length > 0 && (
											<div className="space-y-0.5">
												<div className="text-violet-200">
													{day.entries.length}件
												</div>
												{avgMood !== null && (
													<div
														className={
															avgMood >= 0
																? "text-emerald-400"
																: "text-amber-400"
														}
													>
														{avgMood > 0
															? "+"
															: ""}
														{avgMood.toFixed(1)}
													</div>
												)}
											</div>
										)}
									</td>
								);
							})}
						</tr>
					))}
				</tbody>
			</table>

			{entries.length > 0 && <DaySummary entries={entries} />}
		</div>
	);
}

// --- グラフセクション ---

function ChartSection({ entries }: { entries: Entry[] }) {
	return (
		<div className="mt-6 space-y-6">
			<h2 className="text-lg font-semibold text-violet-200">グラフ</h2>
			<MoodChart entries={entries} />
			<InterpersonalChart entries={entries} />
			<MoodDistributionChart entries={entries} />
		</div>
	);
}

// --- 気分推移グラフ (SVG折れ線) ---

function MoodChart({ entries }: { entries: Entry[] }) {
	const width = 600;
	const height = 200;
	const padding = { top: 20, right: 20, bottom: 30, left: 40 };
	const chartW = width - padding.left - padding.right;
	const chartH = height - padding.top - padding.bottom;

	if (entries.length < 2) {
		return (
			<div className="rounded-lg border border-violet-800/50 bg-violet-900/20 p-4">
				<h3 className="mb-2 text-sm font-medium text-violet-300">
					気分の推移
				</h3>
				<p className="text-xs text-violet-500">
					2件以上の記録でグラフが表示されます
				</p>
			</div>
		);
	}

	const points = entries.map((e, i) => {
		const x = padding.left + (i / (entries.length - 1)) * chartW;
		const y = padding.top + ((10 - e.mood) / 20) * chartH;
		return { x, y, entry: e };
	});

	const pathD = points
		.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
		.join(" ");

	return (
		<div className="rounded-lg border border-violet-800/50 bg-violet-900/20 p-4">
			<h3 className="mb-2 text-sm font-medium text-violet-300">
				気分の推移
			</h3>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className="w-full"
				preserveAspectRatio="xMidYMid meet"
			>
				{[-10, -5, 0, 5, 10].map((v) => {
					const y = padding.top + ((10 - v) / 20) * chartH;
					return (
						<g key={v}>
							<line
								x1={padding.left}
								x2={width - padding.right}
								y1={y}
								y2={y}
								stroke={
									v === 0 ? "#7c3aed40" : "#7c3aed20"
								}
								strokeWidth={v === 0 ? 1.5 : 1}
								strokeDasharray={v === 0 ? "" : "4,4"}
							/>
							<text
								x={padding.left - 4}
								y={y + 3}
								textAnchor="end"
								className="fill-violet-500 text-[10px]"
							>
								{v > 0 ? `+${v}` : v}
							</text>
						</g>
					);
				})}

				<path
					d={pathD}
					fill="none"
					stroke="#a78bfa"
					strokeWidth={2}
					strokeLinejoin="round"
				/>

				<path
					d={`${pathD} L ${points[points.length - 1].x} ${padding.top + (10 / 20) * chartH} L ${points[0].x} ${padding.top + (10 / 20) * chartH} Z`}
					fill="#a78bfa10"
				/>

				{points.map((p, i) => (
					<g key={i}>
						<circle
							cx={p.x}
							cy={p.y}
							r={3}
							fill={
								p.entry.mood >= 0 ? "#34d399" : "#f59e0b"
							}
							stroke="#1e1b4b"
							strokeWidth={1.5}
						/>
						<title>
							{p.entry.date} {p.entry.time} -{" "}
							{p.entry.activity}: 気分{" "}
							{p.entry.mood > 0 ? "+" : ""}
							{p.entry.mood}
						</title>
					</g>
				))}

				<text
					x={points[0].x}
					y={height - 5}
					textAnchor="start"
					className="fill-violet-500 text-[9px]"
				>
					{entries[0].date.slice(5)} {entries[0].time}
				</text>
				<text
					x={points[points.length - 1].x}
					y={height - 5}
					textAnchor="end"
					className="fill-violet-500 text-[9px]"
				>
					{entries[entries.length - 1].date.slice(5)}{" "}
					{entries[entries.length - 1].time}
				</text>
			</svg>
		</div>
	);
}

// --- 対人レベル分布 (棒グラフ) ---

function InterpersonalChart({ entries }: { entries: Entry[] }) {
	const counts = [0, 0, 0, 0];
	for (const e of entries) {
		counts[e.interpersonal]++;
	}
	const maxCount = Math.max(...counts, 1);

	const width = 600;
	const height = 160;
	const padding = { top: 10, right: 20, bottom: 50, left: 40 };
	const chartW = width - padding.left - padding.right;
	const chartH = height - padding.top - padding.bottom;
	const barWidth = chartW / 4 - 16;

	return (
		<div className="rounded-lg border border-violet-800/50 bg-violet-900/20 p-4">
			<h3 className="mb-2 text-sm font-medium text-violet-300">
				対人レベルの分布
			</h3>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className="w-full"
				preserveAspectRatio="xMidYMid meet"
			>
				{counts.map((count, i) => {
					const barH = (count / maxCount) * chartH;
					const x =
						padding.left +
						(i / 4) * chartW +
						(chartW / 4 - barWidth) / 2;
					const y = padding.top + chartH - barH;
					const colors = [
						"#8b5cf6",
						"#a78bfa",
						"#c4b5fd",
						"#ddd6fe",
					];

					return (
						<g key={i}>
							<rect
								x={x}
								y={y}
								width={barWidth}
								height={barH}
								rx={4}
								fill={colors[i]}
								opacity={0.8}
							/>
							{count > 0 && (
								<text
									x={x + barWidth / 2}
									y={y - 4}
									textAnchor="middle"
									className="fill-violet-300 text-[11px] font-medium"
								>
									{count}
								</text>
							)}
							<text
								x={x + barWidth / 2}
								y={height - padding.bottom + 14}
								textAnchor="middle"
								className="fill-violet-400 text-[9px]"
							>
								{i}:
							</text>
							<text
								x={x + barWidth / 2}
								y={height - padding.bottom + 26}
								textAnchor="middle"
								className="fill-violet-500 text-[8px]"
							>
								{INTERPERSONAL_LABELS[i].slice(0, 6)}
							</text>
						</g>
					);
				})}
			</svg>
		</div>
	);
}

// --- 気分分布ヒストグラム ---

function MoodDistributionChart({ entries }: { entries: Entry[] }) {
	const buckets = new Map<number, number>();
	for (let i = -10; i <= 10; i++) buckets.set(i, 0);
	for (const e of entries) {
		buckets.set(e.mood, (buckets.get(e.mood) || 0) + 1);
	}
	const maxCount = Math.max(...buckets.values(), 1);

	const width = 600;
	const height = 140;
	const padding = { top: 10, right: 10, bottom: 25, left: 30 };
	const chartW = width - padding.left - padding.right;
	const chartH = height - padding.top - padding.bottom;
	const barW = chartW / 21 - 1;

	return (
		<div className="rounded-lg border border-violet-800/50 bg-violet-900/20 p-4">
			<h3 className="mb-2 text-sm font-medium text-violet-300">
				気分の分布
			</h3>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				className="w-full"
				preserveAspectRatio="xMidYMid meet"
			>
				{Array.from(buckets.entries()).map(([mood, count]) => {
					const idx = mood + 10;
					const x = padding.left + (idx / 21) * chartW + 0.5;
					const barH = (count / maxCount) * chartH;
					const y = padding.top + chartH - barH;
					const color =
						mood > 3
							? "#34d399"
							: mood > 0
								? "#6ee7b7"
								: mood === 0
									? "#a78bfa"
									: mood >= -3
										? "#fbbf24"
										: "#f87171";

					return (
						<g key={mood}>
							<rect
								x={x}
								y={y}
								width={barW}
								height={barH}
								rx={2}
								fill={color}
								opacity={count > 0 ? 0.7 : 0.15}
							/>
							{mood % 5 === 0 && (
								<text
									x={x + barW / 2}
									y={height - 5}
									textAnchor="middle"
									className="fill-violet-500 text-[9px]"
								>
									{mood > 0 ? `+${mood}` : mood}
								</text>
							)}
						</g>
					);
				})}
			</svg>
		</div>
	);
}
