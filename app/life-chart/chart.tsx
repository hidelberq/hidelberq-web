import { useCallback, useMemo, useRef, useState } from "react";
import type { Category, LifeChartEvent } from "./types";
import { CATEGORIES } from "./types";
import {
	buildLinePath,
	formatAge,
	getFractionalAge,
	getMaxAge,
} from "./utils";

const PADDING = { top: 40, right: 30, bottom: 40, left: 50 };
const CHART_WIDTH = 800;
const CHART_HEIGHT = 450;
const INNER_W = CHART_WIDTH - PADDING.left - PADDING.right;
const INNER_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;

interface ChartProps {
	events: LifeChartEvent[];
	birthYear: number;
	birthMonth: number | null;
	birthDay: number | null;
	hiddenCategories: Set<Category>;
}

/** 吹き出しの尻尾付き背景パス */
function balloonPath(
	x: number,
	y: number,
	w: number,
	h: number,
	tailX: number,
	tailY: number,
	r: number,
): string {
	const left = x;
	const right = x + w;
	const top = y;
	const bottom = y + h;
	const tailW = 6;

	const tx = Math.max(left + r + tailW, Math.min(right - r - tailW, tailX));

	return [
		`M ${left + r} ${top}`,
		`L ${right - r} ${top}`,
		`Q ${right} ${top} ${right} ${top + r}`,
		`L ${right} ${bottom - r}`,
		`Q ${right} ${bottom} ${right - r} ${bottom}`,
		`L ${tx + tailW} ${bottom}`,
		`L ${tailX} ${tailY}`,
		`L ${tx - tailW} ${bottom}`,
		`L ${left + r} ${bottom}`,
		`Q ${left} ${bottom} ${left} ${bottom - r}`,
		`L ${left} ${top + r}`,
		`Q ${left} ${top} ${left + r} ${top}`,
		"Z",
	].join(" ");
}

export function LifeChartSVG({
	events,
	birthYear,
	birthMonth,
	birthDay,
	hiddenCategories,
}: ChartProps) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [activeEventId, setActiveEventId] = useState<number | null>(null);

	const visibleEvents = events.filter(
		(e) => !hiddenCategories.has(e.category as Category),
	);
	const maxAge = getMaxAge(events, birthYear, birthMonth, birthDay);

	const toX = useCallback(
		(age: number) => PADDING.left + (age / maxAge) * INNER_W,
		[maxAge],
	);
	const toY = useCallback(
		(score: number) => PADDING.top + ((10 - score) / 20) * INNER_H,
		[],
	);

	const linePath = buildLinePath(visibleEvents, toX, toY);

	// X 軸の目盛り (5歳刻み)
	const xTicks: number[] = [];
	for (let age = 0; age <= maxAge; age += 5) {
		xTicks.push(age);
	}
	const yTicks = [-10, -5, 0, 5, 10];

	const sortedVisible = useMemo(
		() =>
			[...visibleEvents].sort(
				(a, b) => getFractionalAge(a) - getFractionalAge(b),
			),
		[visibleEvents],
	);

	const handleExport = useCallback(() => {
		const svg = svgRef.current;
		if (!svg) return;
		const serializer = new XMLSerializer();
		const source = serializer.serializeToString(svg);
		const blob = new Blob(
			[`<?xml version="1.0" encoding="UTF-8"?>${source}`],
			{ type: "image/svg+xml;charset=utf-8" },
		);
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "life-chart.svg";
		a.click();
		URL.revokeObjectURL(url);
	}, []);

	return (
		<div>
			<div className="overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-900/50">
				<svg
					ref={svgRef}
					viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
					className="min-w-[600px] w-full"
				>
					{/* グリッド線 */}
					{yTicks.map((score) => (
						<line
							key={`grid-y-${score}`}
							x1={PADDING.left}
							y1={toY(score)}
							x2={CHART_WIDTH - PADDING.right}
							y2={toY(score)}
							stroke={score === 0 ? "#71717a" : "#3f3f46"}
							strokeWidth={score === 0 ? 1.5 : 0.5}
							strokeDasharray={score === 0 ? undefined : "4 4"}
						/>
					))}
					{xTicks.map((age) => (
						<line
							key={`grid-x-${age}`}
							x1={toX(age)}
							y1={PADDING.top}
							x2={toX(age)}
							y2={CHART_HEIGHT - PADDING.bottom}
							stroke="#3f3f46"
							strokeWidth={0.5}
							strokeDasharray="4 4"
						/>
					))}

					{/* 軸ラベル */}
					{yTicks.map((score) => (
						<text
							key={`label-y-${score}`}
							x={PADDING.left - 10}
							y={toY(score) + 4}
							textAnchor="end"
							fill="#a1a1aa"
							fontSize={12}
						>
							{score > 0 ? `+${score}` : score}
						</text>
					))}
					{xTicks.map((age) => (
						<text
							key={`label-x-${age}`}
							x={toX(age)}
							y={CHART_HEIGHT - PADDING.bottom + 20}
							textAnchor="middle"
							fill="#a1a1aa"
							fontSize={12}
						>
							{age}歳
						</text>
					))}

					{/* 折れ線 */}
					{linePath && (
						<path
							d={linePath}
							fill="none"
							stroke="#60a5fa"
							strokeWidth={2.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					)}

					{/* 背景クリックで吹き出しを閉じる */}
					<rect
						x={PADDING.left}
						y={PADDING.top}
						width={INNER_W}
						height={INNER_H}
						fill="transparent"
						onClick={() => setActiveEventId(null)}
					/>

					{/* データポイント */}
					{sortedVisible.map((event) => {
						const cat =
							CATEGORIES[event.category as Category] ??
							CATEGORIES.other;
						const fAge = getFractionalAge(event);
						const cx = toX(fAge);
						const cy = toY(event.score);
						const above = event.score >= 0;
						const labelY = above ? cy - 10 : cy + 16;

						return (
							<g key={event.id}>
								<circle
									cx={cx}
									cy={cy}
									r={5}
									fill={cat.color}
									stroke="#18181b"
									strokeWidth={2}
									className="pointer-events-none"
								/>

								{/* タイトル */}
								<text
									x={cx}
									y={labelY}
									textAnchor="middle"
									fill="#d4d4d8"
									fontSize={8}
									className="pointer-events-none"
								>
									{event.title}
								</text>

								{/* 補足 */}
								{event.note && (
									<text
										x={cx}
										y={above ? labelY - 10 : labelY + 10}
										textAnchor="middle"
										fill="#71717a"
										fontSize={7}
										className="pointer-events-none"
									>
										{event.note.length > 15
											? `${event.note.slice(0, 15)}…`
											: event.note}
									</text>
								)}

								{/* タッチ/ホバー用の透明ヒットエリア */}
								<circle
									cx={cx}
									cy={cy}
									r={16}
									fill="transparent"
									className="cursor-pointer"
									onMouseEnter={() =>
										setActiveEventId(event.id)
									}
									onMouseLeave={() =>
										setActiveEventId((prev) =>
											prev === event.id ? null : prev,
										)
									}
									onClick={(e) => {
										e.stopPropagation();
										setActiveEventId((prev) =>
											prev === event.id
												? null
												: event.id,
										);
									}}
								/>
							</g>
						);
					})}

					{/* アクティブなイベントの吹き出し（最前面に描画） */}
					{activeEventId != null &&
						(() => {
							const event = sortedVisible.find(
								(e) => e.id === activeEventId,
							);
							if (!event) return null;
							const cat =
								CATEGORIES[event.category as Category] ??
								CATEGORIES.other;
							const fAge = getFractionalAge(event);
							const cx = toX(fAge);
							const cy = toY(event.score);

							const ageText = formatAge(
								event.age,
								event.month,
								event.day,
							);
							const scoreText =
								event.score > 0
									? `+${event.score}`
									: String(event.score);
							const line1 = `${cat.icon} ${event.title}`;
							const line2 = `${ageText} / ${scoreText}`;
							const hasNote = !!event.note;

							const bW = Math.max(
								line1.length * 7 + 16,
								line2.length * 6.5 + 16,
								hasNote
									? Math.min(event.note!.length, 20) * 6 + 16
									: 0,
								90,
							);
							const bH = hasNote ? 48 : 34;
							const above = cy > PADDING.top + INNER_H / 2;
							const bY = above ? cy - bH - 16 : cy + 16;
							let bX = cx - bW / 2;
							if (bX < PADDING.left) bX = PADDING.left;
							if (bX + bW > CHART_WIDTH - PADDING.right)
								bX = CHART_WIDTH - PADDING.right - bW;
							const tailY = above ? bY + bH : bY;

							return (
								<g className="pointer-events-none">
									<path
										d={balloonPath(
											bX,
											bY,
											bW,
											bH,
											cx,
											tailY,
											4,
										)}
										fill="#27272aee"
										stroke="#52525b"
										strokeWidth={0.5}
									/>
									<text
										x={bX + 8}
										y={bY + 14}
										fill="#fafafa"
										fontSize={11}
										fontWeight="bold"
									>
										{line1}
									</text>
									<text
										x={bX + 8}
										y={bY + 28}
										fill="#a1a1aa"
										fontSize={10}
									>
										{line2}
									</text>
									{hasNote && (
										<text
											x={bX + 8}
											y={bY + 42}
											fill="#78716c"
											fontSize={9}
										>
											{event.note!.length > 20
												? `${event.note!.slice(0, 20)}…`
												: event.note}
										</text>
									)}
								</g>
							);
						})()}
				</svg>
			</div>

			{/* エクスポートボタン */}
			<div className="mt-2 flex justify-end">
				<button
					type="button"
					onClick={handleExport}
					className="rounded bg-zinc-700 px-3 py-1 text-xs text-zinc-300 hover:bg-zinc-600"
				>
					SVG でダウンロード
				</button>
			</div>
		</div>
	);
}
