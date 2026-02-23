import type { LifeChartEvent } from "./types";

/**
 * 年齢 + 月日から小数点付き年齢を計算
 * 例: 18歳 4月 → 18.25
 */
export function getFractionalAge(event: LifeChartEvent): number {
	let age = event.age;
	if (event.month) {
		age += (event.month - 1) / 12;
		if (event.day) {
			age += (event.day - 1) / 365;
		}
	}
	return age;
}

/**
 * イベントをソート済みの座標点に変換し、Catmull-Rom スプラインで
 * SVG の cubic bezier パスを生成する
 */
export function buildCurvePath(
	events: LifeChartEvent[],
	toX: (age: number) => number,
	toY: (score: number) => number,
): string {
	const sorted = [...events].sort(
		(a, b) => getFractionalAge(a) - getFractionalAge(b),
	);
	if (sorted.length === 0) return "";
	if (sorted.length === 1) {
		const x = toX(getFractionalAge(sorted[0]));
		const y = toY(sorted[0].score);
		return `M ${x} ${y}`;
	}

	const points = sorted.map((e) => ({
		x: toX(getFractionalAge(e)),
		y: toY(e.score),
	}));

	// Catmull-Rom → cubic bezier 変換
	const tension = 0.3;
	let d = `M ${points[0].x} ${points[0].y}`;

	for (let i = 0; i < points.length - 1; i++) {
		const p0 = points[Math.max(0, i - 1)];
		const p1 = points[i];
		const p2 = points[i + 1];
		const p3 = points[Math.min(points.length - 1, i + 2)];

		const cp1x = p1.x + (p2.x - p0.x) * tension;
		const cp1y = p1.y + (p2.y - p0.y) * tension;
		const cp2x = p2.x - (p3.x - p1.x) * tension;
		const cp2y = p2.y - (p3.y - p1.y) * tension;

		d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
	}

	return d;
}

/**
 * チャートの X 軸の最大年齢を計算
 */
export function getMaxAge(
	events: LifeChartEvent[],
	birthYear: number,
): number {
	const currentAge = new Date().getFullYear() - birthYear;
	const maxEventAge =
		events.length > 0
			? Math.max(...events.map((e) => getFractionalAge(e)))
			: 0;
	return Math.max(currentAge, Math.ceil(maxEventAge) + 5, 30);
}

/**
 * 極大・極小イベントを検出する
 * 隣接イベント（ソート後）と比較し、スコアが両隣より高い/低いものを返す
 */
export function findExtrema(events: LifeChartEvent[]): {
	maxima: Set<number>;
	minima: Set<number>;
	globalMax: number | null;
	globalMin: number | null;
} {
	const maxima = new Set<number>();
	const minima = new Set<number>();
	let globalMax: number | null = null;
	let globalMin: number | null = null;

	if (events.length === 0)
		return { maxima, minima, globalMax, globalMin };

	const sorted = [...events].sort(
		(a, b) => getFractionalAge(a) - getFractionalAge(b),
	);

	// 全体の最大・最小を求める
	let maxScore = -Infinity;
	let minScore = Infinity;
	for (const e of sorted) {
		if (e.score > maxScore) {
			maxScore = e.score;
			globalMax = e.id;
		}
		if (e.score < minScore) {
			minScore = e.score;
			globalMin = e.id;
		}
	}

	// 局所的な極大・極小を検出（3点以上必要）
	for (let i = 0; i < sorted.length; i++) {
		const prev = sorted[i - 1];
		const curr = sorted[i];
		const next = sorted[i + 1];

		if (prev && next) {
			if (curr.score > prev.score && curr.score > next.score) {
				maxima.add(curr.id);
			}
			if (curr.score < prev.score && curr.score < next.score) {
				minima.add(curr.id);
			}
		} else if (sorted.length >= 2) {
			// 端点: 最初と最後の点も隣接と比較
			if (!prev && next && curr.score > next.score) {
				maxima.add(curr.id);
			}
			if (!prev && next && curr.score < next.score) {
				minima.add(curr.id);
			}
			if (prev && !next && curr.score > prev.score) {
				maxima.add(curr.id);
			}
			if (prev && !next && curr.score < prev.score) {
				minima.add(curr.id);
			}
		}
	}

	return { maxima, minima, globalMax, globalMin };
}

/**
 * 年齢の表示テキスト（月付き）
 */
export function formatAge(
	age: number,
	month: number | null,
	day: number | null,
): string {
	let text = `${age}歳`;
	if (month) {
		text += `${month}月`;
		if (day) {
			text += `${day}日`;
		}
	}
	return text;
}
