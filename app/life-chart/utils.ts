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
 * 生年月日を考慮した正確な現在年齢を計算
 */
export function getCurrentAge(
	birthYear: number,
	birthMonth: number | null,
	birthDay: number | null,
): number {
	const now = new Date();
	const thisYear = now.getFullYear();
	const thisMonth = now.getMonth() + 1;
	const thisDay = now.getDate();

	let age = thisYear - birthYear;

	// 月日が指定されている場合、誕生日がまだ来ていなければ -1
	if (birthMonth) {
		if (thisMonth < birthMonth) {
			age--;
		} else if (thisMonth === birthMonth && birthDay && thisDay < birthDay) {
			age--;
		}
	}

	return age;
}

/**
 * イベントをソート済みの座標点に変換し、折れ線グラフのパスを生成する
 */
export function buildLinePath(
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

	let d = `M ${points[0].x} ${points[0].y}`;
	for (let i = 1; i < points.length; i++) {
		d += ` L ${points[i].x} ${points[i].y}`;
	}

	return d;
}

/**
 * チャートの X 軸の最大年齢を計算
 */
export function getMaxAge(
	events: LifeChartEvent[],
	birthYear: number,
	birthMonth: number | null,
	birthDay: number | null,
): number {
	const currentAge = getCurrentAge(birthYear, birthMonth, birthDay);
	const maxEventAge =
		events.length > 0
			? Math.max(...events.map((e) => getFractionalAge(e)))
			: 0;
	return Math.max(currentAge, Math.ceil(maxEventAge) + 5, 30);
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

/**
 * 西暦から年齢に変換
 */
export function yearToAge(
	year: number,
	birthYear: number,
	month?: number | null,
	birthMonth?: number | null,
): number {
	let age = year - birthYear;
	if (month && birthMonth && month < birthMonth) {
		age--;
	}
	return Math.max(0, age);
}

/**
 * 年齢から西暦に変換
 */
export function ageToYear(age: number, birthYear: number): number {
	return birthYear + age;
}
