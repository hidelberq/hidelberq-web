/** ターン切り替え時にスマホを振動させる (Vibration API) */
export function vibrateTurnChange(): void {
	if (typeof navigator !== "undefined" && navigator.vibrate) {
		navigator.vibrate(100);
	}
}
