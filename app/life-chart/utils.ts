import type { LifeChartEvent } from "./types";

/**
 * イベントをソート済みの座標点に変換し、Catmull-Rom スプラインで
 * SVG の cubic bezier パスを生成する
 */
export function buildCurvePath(
	events: LifeChartEvent[],
	toX: (age: number) => number,
	toY: (score: number) => number,
): string {
	const sorted = [...events].sort((a, b) => a.age - b.age);
	if (sorted.length === 0) return "";
	if (sorted.length === 1) {
		const x = toX(sorted[0].age);
		const y = toY(sorted[0].score);
		return `M ${x} ${y}`;
	}

	const points = sorted.map((e) => ({ x: toX(e.age), y: toY(e.score) }));

	// Catmull-Rom → cubic bezier 変換 (alpha=0.5)
	const tension = 0.3;
	let d = `M ${points[0].x} ${points[0].y}`;

	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[Math.max(0, i - 1)];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[Math.min(points.length - 1, i + 2)];

		const cp1x = p1.x + ((p2.x - p0.x) * tension);
		const cp1y = p1.y + ((p2.y - p0.y) * tension);
		const cp2x = p2.x - ((p3.x - p1.x) * tension);
		const cp2y = p2.y - ((p3.y - p1.y) * tension);

		d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
	}

	return d;
}

/**
 * チャートの X 軸の最大年齢を計算
 */
export function getMaxAge(events: LifeChartEvent[], birthYear: number): number {
	const currentAge = new Date().getFullYear() - birthYear;
	const maxEventAge = events.length > 0
		? Math.max(...events.map((e) => e.age))
		: 0;
	return Math.max(currentAge, maxEventAge + 5, 30);
}
