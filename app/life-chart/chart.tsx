import { useCallback, useRef, useState } from "react";
import type { Category, LifeChartEvent } from "./types";
import { CATEGORIES } from "./types";
import { buildCurvePath, getMaxAge } from "./utils";

const PADDING = { top: 30, right: 30, bottom: 40, left: 50 };
const CHART_WIDTH = 800;
const CHART_HEIGHT = 400;
const INNER_W = CHART_WIDTH - PADDING.left - PADDING.right;
const INNER_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;

interface ChartProps {
	events: LifeChartEvent[];
	birthYear: number;
	hiddenCategories: Set<Category>;
}

export function LifeChartSVG({ events, birthYear, hiddenCategories }: ChartProps) {
	const svgRef = useRef<SVGSVGElement>(null);
	const [tooltip, setTooltip] = useState<{
		x: number;
		y: number;
		event: LifeChartEvent;
	} | null>(null);

	const visibleEvents = events.filter(
		(e) => !hiddenCategories.has(e.category as Category),
	);
	const maxAge = getMaxAge(events, birthYear);

	const toX = useCallback(
		(age: number) => PADDING.left + (age / maxAge) * INNER_W,
		[maxAge],
	);
	const toY = useCallback(
		(score: number) => PADDING.top + ((10 - score) / 20) * INNER_H,
		[],
	);

	const curvePath = buildCurvePath(visibleEvents, toX, toY);

	// X 軸の目盛り (5歳刻み)
	const xTicks: number[] = [];
	for (let age = 0; age <= maxAge; age += 5) {
		xTicks.push(age);
	}

	// Y 軸の目盛り
	const yTicks = [-10, -5, 0, 5, 10];

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
					onMouseLeave={() => setTooltip(null)}
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

					{/* 曲線 */}
					{curvePath && (
						<path
							d={curvePath}
							fill="none"
							stroke="#60a5fa"
							strokeWidth={2.5}
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					)}

					{/* データポイント */}
					{visibleEvents
						.sort((a, b) => a.age - b.age)
						.map((event) => {
							const cat = CATEGORIES[event.category as Category] ?? CATEGORIES.other;
							return (
								<g key={event.id}>
									<circle
										cx={toX(event.age)}
										cy={toY(event.score)}
										r={6}
										fill={cat.color}
										stroke="#18181b"
										strokeWidth={2}
										className="cursor-pointer"
										onMouseEnter={() =>
											setTooltip({
												x: toX(event.age),
												y: toY(event.score),
												event,
											})
										}
										onMouseLeave={() => setTooltip(null)}
									/>
									{/* イベント名ラベル (点の上に) */}
									<text
										x={toX(event.age)}
										y={toY(event.score) - 12}
										textAnchor="middle"
										fill="#d4d4d8"
										fontSize={10}
										className="pointer-events-none"
									>
										{event.title}
									</text>
								</g>
							);
						})}

					{/* ツールチップ */}
					{tooltip && (() => {
						const cat = CATEGORIES[tooltip.event.category as Category] ?? CATEGORIES.other;
						const boxW = 180;
						const boxH = tooltip.event.note ? 62 : 46;
						let tx = tooltip.x - boxW / 2;
						let ty = tooltip.y - boxH - 24;
						if (tx < PADDING.left) tx = PADDING.left;
						if (tx + boxW > CHART_WIDTH - PADDING.right) tx = CHART_WIDTH - PADDING.right - boxW;
						if (ty < 4) ty = tooltip.y + 16;
						return (
							<g className="pointer-events-none">
								<rect
									x={tx}
									y={ty}
									width={boxW}
									height={boxH}
									rx={6}
									fill="#27272a"
									stroke="#52525b"
									strokeWidth={1}
								/>
								<text x={tx + 8} y={ty + 18} fill="#fafafa" fontSize={12} fontWeight="bold">
									{cat.icon} {tooltip.event.title}
								</text>
								<text x={tx + 8} y={ty + 36} fill="#a1a1aa" fontSize={11}>
									{tooltip.event.age}歳 / スコア: {tooltip.event.score > 0 ? `+${tooltip.event.score}` : tooltip.event.score} / {cat.label}
								</text>
								{tooltip.event.note && (
									<text x={tx + 8} y={ty + 54} fill="#a1a1aa" fontSize={10}>
										{tooltip.event.note.slice(0, 30)}{tooltip.event.note.length > 30 ? "…" : ""}
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
