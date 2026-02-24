import { useState } from "react";
import { CATEGORIES, type Category, type LifeChartEvent } from "./types";
import { ageToYear, yearToAge } from "./utils";

type InputMode = "age" | "year";

interface EventFormProps {
	chartId: number;
	birthYear: number;
	birthMonth: number | null;
	editingEvent?: LifeChartEvent;
	onSubmit: (data: {
		intent: "addEvent" | "updateEvent";
		eventId?: number;
		chartId: number;
		age: number;
		month: number | null;
		day: number | null;
		score: number;
		category: Category;
		title: string;
		note: string;
	}) => void;
	onCancel: () => void;
}

export function EventForm({
	chartId,
	birthYear,
	birthMonth,
	editingEvent,
	onSubmit,
	onCancel,
}: EventFormProps) {
	const [inputMode, setInputMode] = useState<InputMode>("age");
	const [age, setAge] = useState(editingEvent?.age ?? 0);
	const [yearInput, setYearInput] = useState(
		editingEvent ? ageToYear(editingEvent.age, birthYear) : birthYear,
	);
	const [month, setMonth] = useState<string>(
		editingEvent?.month?.toString() ?? "",
	);
	const [day, setDay] = useState<string>(
		editingEvent?.day?.toString() ?? "",
	);
	const [score, setScore] = useState(editingEvent?.score ?? 0);
	const [category, setCategory] = useState<Category>(
		(editingEvent?.category as Category) ?? "other",
	);
	const [title, setTitle] = useState(editingEvent?.title ?? "");
	const [note, setNote] = useState(editingEvent?.note ?? "");

	const handleAgeChange = (val: number) => {
		setAge(val);
		setYearInput(ageToYear(val, birthYear));
	};

	const handleYearChange = (val: number) => {
		setYearInput(val);
		const monthNum = month ? Number(month) : null;
		setAge(yearToAge(val, birthYear, monthNum, birthMonth));
	};

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (!title.trim()) return;
		const monthNum = month ? Number(month) : null;
		const dayNum = day ? Number(day) : null;

		// 西暦モードの場合は最終的な年齢を再計算
		const finalAge =
			inputMode === "year"
				? yearToAge(yearInput, birthYear, monthNum, birthMonth)
				: age;

		onSubmit({
			intent: editingEvent ? "updateEvent" : "addEvent",
			eventId: editingEvent?.id,
			chartId,
			age: finalAge,
			month:
				monthNum && monthNum >= 1 && monthNum <= 12 ? monthNum : null,
			day: dayNum && dayNum >= 1 && dayNum <= 31 ? dayNum : null,
			score,
			category,
			title: title.trim(),
			note: note.trim(),
		});
	};

	// 表示用の相互参照テキスト
	const displayAge =
		inputMode === "year"
			? yearToAge(
					yearInput,
					birthYear,
					month ? Number(month) : null,
					birthMonth,
				)
			: age;
	const displayYear =
		inputMode === "age" ? ageToYear(age, birthYear) : yearInput;

	return (
		<form
			onSubmit={handleSubmit}
			className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4"
		>
			{/* 入力モード切替 */}
			<div className="mb-3 flex items-center gap-2">
				<span className="text-xs text-zinc-400">入力方法:</span>
				<button
					type="button"
					onClick={() => setInputMode("age")}
					className={`rounded px-2.5 py-1 text-xs transition-colors ${
						inputMode === "age"
							? "bg-blue-600 text-white"
							: "bg-zinc-700 text-zinc-400 hover:text-zinc-200"
					}`}
				>
					年齢
				</button>
				<button
					type="button"
					onClick={() => setInputMode("year")}
					className={`rounded px-2.5 py-1 text-xs transition-colors ${
						inputMode === "year"
							? "bg-blue-600 text-white"
							: "bg-zinc-700 text-zinc-400 hover:text-zinc-200"
					}`}
				>
					西暦
				</button>
			</div>

			<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{/* 年齢 or 西暦 */}
				{inputMode === "age" ? (
					<div>
						<label className="mb-1 block text-xs text-zinc-400">
							年齢
							<span className="ml-1 text-zinc-600">
								({displayYear}年)
							</span>
						</label>
						<input
							type="number"
							min={0}
							max={150}
							value={age}
							onChange={(e) =>
								handleAgeChange(Number(e.target.value))
							}
							className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
							required
						/>
					</div>
				) : (
					<div>
						<label className="mb-1 block text-xs text-zinc-400">
							西暦
							<span className="ml-1 text-zinc-600">
								({displayAge}歳)
							</span>
						</label>
						<input
							type="number"
							min={birthYear}
							max={new Date().getFullYear() + 10}
							value={yearInput}
							onChange={(e) =>
								handleYearChange(Number(e.target.value))
							}
							className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
							required
						/>
					</div>
				)}

				{/* 月（任意） */}
				<div>
					<label className="mb-1 block text-xs text-zinc-400">
						月 <span className="text-zinc-600">（任意）</span>
					</label>
					<select
						value={month}
						onChange={(e) => {
							setMonth(e.target.value);
							if (!e.target.value) setDay("");
							// 西暦モードの場合、月変更で年齢を再計算
							if (inputMode === "year") {
								const m = e.target.value
									? Number(e.target.value)
									: null;
								setAge(
									yearToAge(yearInput, birthYear, m, birthMonth),
								);
							}
						}}
						className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
					>
						<option value="">--</option>
						{Array.from({ length: 12 }, (_, i) => (
							<option key={i + 1} value={i + 1}>
								{i + 1}月
							</option>
						))}
					</select>
				</div>

				{/* 日（任意） */}
				<div>
					<label className="mb-1 block text-xs text-zinc-400">
						日 <span className="text-zinc-600">（任意）</span>
					</label>
					<select
						value={day}
						onChange={(e) => setDay(e.target.value)}
						disabled={!month}
						className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 disabled:opacity-40"
					>
						<option value="">--</option>
						{Array.from({ length: 31 }, (_, i) => (
							<option key={i + 1} value={i + 1}>
								{i + 1}日
							</option>
						))}
					</select>
				</div>

				{/* 種類 */}
				<div>
					<label className="mb-1 block text-xs text-zinc-400">
						種類
					</label>
					<select
						value={category}
						onChange={(e) =>
							setCategory(e.target.value as Category)
						}
						className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100"
					>
						{Object.entries(CATEGORIES).map(
							([key, { label, icon }]) => (
								<option key={key} value={key}>
									{icon} {label}
								</option>
							),
						)}
					</select>
				</div>
			</div>

			<div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
				{/* タイトル */}
				<div>
					<label className="mb-1 block text-xs text-zinc-400">
						タイトル
					</label>
					<input
						type="text"
						value={title}
						onChange={(e) => setTitle(e.target.value)}
						placeholder="例: 大学入学"
						maxLength={100}
						className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500"
						required
					/>
				</div>

				{/* スコア */}
				<div>
					<label className="mb-1 block text-xs text-zinc-400">
						充実度:{" "}
						<span className="font-bold text-zinc-200">
							{score > 0 ? `+${score}` : score}
						</span>
					</label>
					<input
						type="range"
						min={-10}
						max={10}
						value={score}
						onChange={(e) => setScore(Number(e.target.value))}
						className="w-full accent-blue-500"
					/>
					<div className="flex justify-between text-[10px] text-zinc-500">
						<span>-10</span>
						<span>0</span>
						<span>+10</span>
					</div>
				</div>
			</div>

			{/* 補足 */}
			<div className="mt-3">
				<label className="mb-1 block text-xs text-zinc-400">
					補足（任意）
				</label>
				<input
					type="text"
					value={note}
					onChange={(e) => setNote(e.target.value)}
					placeholder="メモやコメント"
					maxLength={500}
					className="w-full rounded border border-zinc-600 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500"
				/>
			</div>

			{/* ボタン */}
			<div className="mt-3 flex gap-2">
				<button
					type="submit"
					className="rounded bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
				>
					{editingEvent ? "更新" : "追加"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded bg-zinc-700 px-4 py-1.5 text-sm text-zinc-300 hover:bg-zinc-600"
				>
					キャンセル
				</button>
			</div>
		</form>
	);
}
