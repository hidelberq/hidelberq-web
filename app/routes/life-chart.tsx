import { useCallback, useEffect, useState } from "react";
import { useFetcher, useSearchParams, type MetaFunction } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { lifeCharts, lifeChartEvents } from "~/db/schema";
import { LifeChartSVG } from "~/life-chart/chart";
import { EventForm } from "~/life-chart/event-form";
import { EventList } from "~/life-chart/event-list";
import {
	CATEGORIES,
	TEMPLATE_EVENTS,
	type Category,
	type LifeChartEvent,
} from "~/life-chart/types";
import { getCurrentAge } from "~/life-chart/utils";
import type { Route } from "./+types/life-chart";

export const meta: MetaFunction = () => [
	{ title: "ライフチャート | hidelberq.com" },
	{ name: "description", content: "人生の充実度を可視化するライフチャート" },
];

export async function loader({ request, context }: Route.LoaderArgs) {
	const url = new URL(request.url);
	const memberId = url.searchParams.get("memberId");
	if (!memberId) {
		return { chart: null, events: [] };
	}

	const db = drizzle(context.cloudflare.env.DB);
	const charts = await db
		.select()
		.from(lifeCharts)
		.where(eq(lifeCharts.memberId, memberId))
		.limit(1);

	if (charts.length === 0) {
		return { chart: null, events: [] };
	}

	const chart = charts[0];
	const events = await db
		.select()
		.from(lifeChartEvents)
		.where(eq(lifeChartEvents.chartId, chart.id));

	return { chart, events };
}

function getOptionalInt(formData: FormData, key: string): number | null {
	const val = formData.get(key) as string;
	if (!val || val === "") return null;
	const num = Number(val);
	return Number.isNaN(num) ? null : num;
}

export async function action({ request, context }: Route.ActionArgs) {
	const formData = await request.formData();
	const intent = formData.get("intent") as string;
	const db = drizzle(context.cloudflare.env.DB);

	switch (intent) {
		case "setName": {
			const displayName = (
				formData.get("displayName") as string
			)?.trim();
			const memberId = formData.get("memberId") as string;

			if (!displayName || !memberId) {
				return { error: "表示名を入力してください" };
			}

			// 同じ表示名の既存チャートを検索（デバイス間同期）
			const [existingChart] = await db
				.select({ memberId: lifeCharts.memberId })
				.from(lifeCharts)
				.where(eq(lifeCharts.displayName, displayName))
				.limit(1);

			if (existingChart) {
				return {
					success: true,
					intent: "setName",
					displayName,
					memberId: existingChart.memberId,
				};
			}

			return {
				success: true,
				intent: "setName",
				displayName,
				memberId,
			};
		}

		case "createChart": {
			const memberId = formData.get("memberId") as string;
			const displayName = (formData.get("displayName") as string) || null;
			const birthYear = Number(formData.get("birthYear"));
			const birthMonth = getOptionalInt(formData, "birthMonth");
			const birthDay = getOptionalInt(formData, "birthDay");
			const name = (formData.get("name") as string) || "マイライフチャート";

			if (!memberId || !birthYear || birthYear < 1900 || birthYear > new Date().getFullYear()) {
				return { error: "入力が不正です" };
			}

			const result = await db
				.insert(lifeCharts)
				.values({ memberId, displayName, birthYear, birthMonth, birthDay, name })
				.returning();

			return { intent: "createChart", chart: result[0], events: [] };
		}

		case "updateChart": {
			const chartId = Number(formData.get("chartId"));
			const birthYear = Number(formData.get("birthYear"));
			const birthMonth = getOptionalInt(formData, "birthMonth");
			const birthDay = getOptionalInt(formData, "birthDay");
			const name = (formData.get("name") as string) || "マイライフチャート";

			await db
				.update(lifeCharts)
				.set({ birthYear, birthMonth, birthDay, name, updatedAt: new Date() })
				.where(eq(lifeCharts.id, chartId));

			return { success: true };
		}

		case "addEvent": {
			const chartId = Number(formData.get("chartId"));
			const age = Number(formData.get("age"));
			const month = getOptionalInt(formData, "month");
			const day = getOptionalInt(formData, "day");
			const score = Number(formData.get("score"));
			const category = formData.get("category") as string;
			const title = formData.get("title") as string;
			const note = (formData.get("note") as string) || null;

			if (age < 0 || age > 150 || score < -5 || score > 5 || !title) {
				return { error: "入力が不正です" };
			}

			const result = await db
				.insert(lifeChartEvents)
				.values({ chartId, age, month, day, score, category, title, note })
				.returning();

			return { event: result[0] };
		}

		case "updateEvent": {
			const eventId = Number(formData.get("eventId"));
			const age = Number(formData.get("age"));
			const month = getOptionalInt(formData, "month");
			const day = getOptionalInt(formData, "day");
			const score = Number(formData.get("score"));
			const category = formData.get("category") as string;
			const title = formData.get("title") as string;
			const note = (formData.get("note") as string) || null;

			if (age < 0 || age > 150 || score < -5 || score > 5 || !title) {
				return { error: "入力が不正です" };
			}

			await db
				.update(lifeChartEvents)
				.set({ age, month, day, score, category, title, note })
				.where(eq(lifeChartEvents.id, eventId));

			return { success: true, updatedEvent: { id: eventId, age, month, day, score, category, title, note } };
		}

		case "deleteEvent": {
			const eventId = Number(formData.get("eventId"));
			await db
				.delete(lifeChartEvents)
				.where(eq(lifeChartEvents.id, eventId));

			return { success: true, deletedEventId: eventId };
		}

		case "addTemplateEvents": {
			const chartId = Number(formData.get("chartId"));
			const templateJson = formData.get("templates") as string;
			const templates = JSON.parse(templateJson) as Array<{
				age: number;
				month?: number;
				score: number;
				category: string;
				title: string;
			}>;

			const results = [];
			for (const t of templates) {
				const result = await db
					.insert(lifeChartEvents)
					.values({
						chartId,
						age: t.age,
						month: t.month ?? null,
						day: null,
						score: t.score,
						category: t.category,
						title: t.title,
						note: null,
					})
					.returning();
				results.push(result[0]);
			}

			return { intent: "addTemplateEvents", events: results };
		}

		default:
			return { error: "不明な操作です" };
	}
}

function NameSetupForm({ memberId }: { memberId: string }) {
	return (
		<div className="mx-auto max-w-md">
			<div className="rounded-2xl border border-blue-700/50 bg-blue-900/30 p-6">
				<h2 className="mb-3 text-lg font-semibold text-white">
					はじめに表示名を設定
				</h2>
				<p className="mb-4 text-sm text-blue-300">
					表示名を入力してください。別のデバイスでも同じ名前を入力するとデータを引き継げます。
				</p>
				<form method="post" className="space-y-4">
					<input type="hidden" name="intent" value="setName" />
					<input type="hidden" name="memberId" value={memberId} />
					<input
						type="text"
						name="displayName"
						required
						placeholder="例: hidelberq"
						className="w-full rounded-lg border border-blue-700 bg-blue-950 px-4 py-3 text-white placeholder:text-blue-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					/>
					<button
						type="submit"
						className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors hover:bg-blue-500"
					>
						設定してはじめる
					</button>
				</form>
			</div>
		</div>
	);
}

export default function LifeChartPage({
	loaderData,
	actionData,
}: Route.ComponentProps) {
	const fetcher = useFetcher();
	const [searchParams, setSearchParams] = useSearchParams();

	// memberId / displayName を localStorage から取得・生成
	const [memberId, setMemberId] = useState<string | null>(null);
	const [displayName, setDisplayName] = useState<string>("");

	useEffect(() => {
		let id = localStorage.getItem("lifeChartMemberId");
		if (!id) {
			id = crypto.randomUUID();
			localStorage.setItem("lifeChartMemberId", id);
		}
		setMemberId(id);

		const name = localStorage.getItem("lifeChartDisplayName") || "";
		setDisplayName(name);

		// displayName がある場合、memberId を URL に反映
		if (name && searchParams.get("memberId") !== id) {
			const params = new URLSearchParams(searchParams);
			params.set("memberId", id);
			setSearchParams(params, { replace: true });
		}
	}, [searchParams, setSearchParams]);

	// setName アクション成功時に localStorage を更新
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
			localStorage.setItem("lifeChartDisplayName", newName);
			setDisplayName(newName);
			if ("memberId" in actionData && actionData.memberId) {
				const newId = actionData.memberId as string;
				localStorage.setItem("lifeChartMemberId", newId);
				setMemberId(newId);
				const params = new URLSearchParams(searchParams);
				params.set("memberId", newId);
				setSearchParams(params, { replace: true });
			}
		}
	}, [actionData, searchParams, setSearchParams]);

	// UI state
	const [showForm, setShowForm] = useState(false);
	const [editingEvent, setEditingEvent] = useState<LifeChartEvent | null>(null);
	const [hiddenCategories, setHiddenCategories] = useState<Set<Category>>(new Set());
	const [birthYearInput, setBirthYearInput] = useState("");
	const [birthMonthInput, setBirthMonthInput] = useState("");
	const [birthDayInput, setBirthDayInput] = useState("");
	const [chartName, setChartName] = useState("");

	// fetcher の createChart 結果で URL に memberId を反映
	useEffect(() => {
		if (!fetcher.data) return;
		const data = fetcher.data as Record<string, unknown>;
		if (data.intent === "createChart" && data.chart && memberId) {
			const params = new URLSearchParams(searchParams);
			params.set("memberId", memberId);
			setSearchParams(params, { replace: true });
		}
	}, [fetcher.data, memberId, searchParams, setSearchParams]);

	// フォームリセット用
	useEffect(() => {
		if (fetcher.state === "idle" && fetcher.data) {
			const data = fetcher.data as Record<string, unknown>;
			if (data.event || data.updatedEvent) {
				setShowForm(false);
				setEditingEvent(null);
			}
		}
	}, [fetcher.state, fetcher.data]);

	const chart = loaderData.chart;
	const events = (loaderData.events ?? []) as LifeChartEvent[];

	const toggleCategory = useCallback((cat: Category) => {
		setHiddenCategories((prev) => {
			const next = new Set(prev);
			if (next.has(cat)) next.delete(cat);
			else next.add(cat);
			return next;
		});
	}, []);

	const needsName = !displayName;

	// 表示名未設定 → NameSetupForm
	if (needsName) {
		return (
			<div className="mx-auto max-w-2xl px-4 py-8">
				<h1 className="mb-6 text-2xl font-bold text-zinc-100">
					ライフチャート
				</h1>
				<p className="mb-6 text-sm text-zinc-400">
					人生の出来事とその充実度を折れ線グラフで可視化します。
				</p>
				{memberId ? (
					<NameSetupForm memberId={memberId} />
				) : (
					<p className="text-sm text-zinc-500">読み込み中...</p>
				)}
			</div>
		);
	}

	// チャート未作成 → 作成フォーム
	if (!chart) {
		return (
			<div className="mx-auto max-w-2xl px-4 py-8">
				<h1 className="mb-6 text-2xl font-bold text-zinc-100">
					ライフチャート
				</h1>

				{/* ログイン情報 */}
				<div className="mb-4 flex items-center justify-between text-sm">
					<span className="text-blue-400">
						ログイン中:{" "}
						<strong className="text-blue-200">
							{displayName}
						</strong>
					</span>
					<button
						type="button"
						onClick={() => {
							localStorage.removeItem("lifeChartDisplayName");
							setDisplayName("");
						}}
						className="text-blue-500 transition-colors hover:text-blue-300"
					>
						ログアウト
					</button>
				</div>

				<p className="mb-4 text-sm text-zinc-400">
					まず生年月日を入力してください。
				</p>

				{memberId && (
					<div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-6">
						<div className="mb-4">
							<label className="mb-1 block text-sm text-zinc-300">
								チャート名
							</label>
							<input
								type="text"
								value={chartName}
								onChange={(e) => setChartName(e.target.value)}
								placeholder="マイライフチャート"
								className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
							/>
						</div>
						<div className="mb-4 grid grid-cols-3 gap-3">
							<div>
								<label className="mb-1 block text-sm text-zinc-300">
									生まれ年（西暦）
								</label>
								<input
									type="number"
									value={birthYearInput}
									onChange={(e) => setBirthYearInput(e.target.value)}
									placeholder="1990"
									min={1900}
									max={new Date().getFullYear()}
									className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-zinc-100 placeholder:text-zinc-500"
									required
								/>
							</div>
							<div>
								<label className="mb-1 block text-sm text-zinc-300">
									月 <span className="text-zinc-600">（任意）</span>
								</label>
								<select
									value={birthMonthInput}
									onChange={(e) => {
										setBirthMonthInput(e.target.value);
										if (!e.target.value) setBirthDayInput("");
									}}
									className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-zinc-100"
								>
									<option value="">--</option>
									{Array.from({ length: 12 }, (_, i) => (
										<option key={i + 1} value={i + 1}>
											{i + 1}月
										</option>
									))}
								</select>
							</div>
							<div>
								<label className="mb-1 block text-sm text-zinc-300">
									日 <span className="text-zinc-600">（任意）</span>
								</label>
								<select
									value={birthDayInput}
									onChange={(e) => setBirthDayInput(e.target.value)}
									disabled={!birthMonthInput}
									className="w-full rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-zinc-100 disabled:opacity-40"
								>
									<option value="">--</option>
									{Array.from({ length: 31 }, (_, i) => (
										<option key={i + 1} value={i + 1}>
											{i + 1}日
										</option>
									))}
								</select>
							</div>
						</div>
						<button
							type="button"
							disabled={
								!birthYearInput ||
								Number(birthYearInput) < 1900 ||
								fetcher.state !== "idle"
							}
							onClick={() => {
								const fd = new FormData();
								fd.set("intent", "createChart");
								fd.set("memberId", memberId);
								fd.set("displayName", displayName);
								fd.set("birthYear", birthYearInput);
								if (birthMonthInput) fd.set("birthMonth", birthMonthInput);
								if (birthDayInput) fd.set("birthDay", birthDayInput);
								fd.set("name", chartName || "マイライフチャート");
								fetcher.submit(fd, { method: "post" });
							}}
							className="rounded bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
						>
							{fetcher.state !== "idle" ? "作成中..." : "チャートを作成"}
						</button>
					</div>
				)}
			</div>
		);
	}

	const isSubmitting = fetcher.state !== "idle";

	// 生年月日の表示テキスト
	const birthDateText = [
		`${chart.birthYear}年`,
		chart.birthMonth ? `${chart.birthMonth}月` : null,
		chart.birthDay ? `${chart.birthDay}日` : null,
	]
		.filter(Boolean)
		.join("");

	return (
		<div className="mx-auto max-w-4xl px-4 py-8">
			{/* ヘッダー */}
			<div className="mb-6 flex flex-wrap items-center justify-between gap-3">
				<h1 className="text-2xl font-bold text-zinc-100">{chart.name}</h1>
				<div className="flex items-center gap-3 text-sm text-zinc-400">
					<span>生年月日: {birthDateText}</span>
					<span>
						現在: {getCurrentAge(chart.birthYear, chart.birthMonth, chart.birthDay)}歳
					</span>
				</div>
			</div>

			{/* ログイン情報 */}
			<div className="mb-4 flex items-center justify-between text-sm">
				<span className="text-blue-400">
					ログイン中:{" "}
					<strong className="text-blue-200">
						{displayName}
					</strong>
				</span>
				<button
					type="button"
					onClick={() => {
						localStorage.removeItem("lifeChartDisplayName");
						setDisplayName("");
					}}
					className="text-blue-500 transition-colors hover:text-blue-300"
				>
					ログアウト
				</button>
			</div>

			{/* カテゴリフィルター */}
			<div className="mb-4 flex flex-wrap gap-2">
				{Object.entries(CATEGORIES).map(([key, { label, color, icon }]) => {
					const cat = key as Category;
					const hidden = hiddenCategories.has(cat);
					return (
						<button
							key={key}
							type="button"
							onClick={() => toggleCategory(cat)}
							className="flex items-center gap-1 rounded-full border px-3 py-1 text-xs transition-opacity"
							style={{
								borderColor: hidden ? "#52525b" : color,
								color: hidden ? "#71717a" : color,
								opacity: hidden ? 0.5 : 1,
							}}
						>
							{icon} {label}
						</button>
					);
				})}
			</div>

			{/* チャート */}
			<LifeChartSVG
				events={events}
				birthYear={chart.birthYear}
				birthMonth={chart.birthMonth}
				birthDay={chart.birthDay}
				hiddenCategories={hiddenCategories}
			/>

			{/* イベント追加ボタン & テンプレート */}
			<div className="mt-6 flex flex-wrap items-center gap-2">
				{!showForm && !editingEvent && (
					<>
						<button
							type="button"
							onClick={() => {
								setShowForm(true);
								setEditingEvent(null);
							}}
							className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
						>
							+ イベントを追加
						</button>
						{events.length === 0 && (
							<button
								type="button"
								disabled={isSubmitting}
								onClick={() => {
									const fd = new FormData();
									fd.set("intent", "addTemplateEvents");
									fd.set("chartId", String(chart.id));
									fd.set("templates", JSON.stringify(TEMPLATE_EVENTS));
									fetcher.submit(fd, { method: "post" });
								}}
								className="rounded border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700"
							>
								テンプレートで始める
							</button>
						)}
					</>
				)}
			</div>

			{/* イベントフォーム */}
			{(showForm || editingEvent) && (
				<div className="mt-4">
					<EventForm
						chartId={chart.id}
						birthYear={chart.birthYear}
						birthMonth={chart.birthMonth}
						editingEvent={editingEvent ?? undefined}
						onSubmit={(data) => {
							const fd = new FormData();
							fd.set("intent", data.intent);
							fd.set("chartId", String(data.chartId));
							fd.set("age", String(data.age));
							if (data.month != null) fd.set("month", String(data.month));
							if (data.day != null) fd.set("day", String(data.day));
							fd.set("score", String(data.score));
							fd.set("category", data.category);
							fd.set("title", data.title);
							fd.set("note", data.note);
							if (data.eventId) {
								fd.set("eventId", String(data.eventId));
							}
							fetcher.submit(fd, { method: "post" });
						}}
						onCancel={() => {
							setShowForm(false);
							setEditingEvent(null);
						}}
					/>
				</div>
			)}

			{/* イベント一覧 */}
			<div className="mt-6">
				<h2 className="mb-3 text-lg font-semibold text-zinc-200">
					イベント一覧
				</h2>
				<EventList
					events={events}
					onEdit={(event) => {
						setEditingEvent(event);
						setShowForm(false);
					}}
					onDelete={(eventId) => {
						const fd = new FormData();
						fd.set("intent", "deleteEvent");
						fd.set("eventId", String(eventId));
						fetcher.submit(fd, { method: "post" });
					}}
				/>
			</div>
		</div>
	);
}
