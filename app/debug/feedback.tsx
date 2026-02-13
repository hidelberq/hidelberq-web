// アクション結果のフィードバック表示コンポーネント
export function ActionFeedback({ data }: { data: { ok?: boolean; error?: string; message?: string; length?: number } | undefined }) {
	if (!data) return null;

	if ("error" in data && data.error) {
		return (
			<div className="mb-4 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
				{data.error}
			</div>
		);
	}

	if ("ok" in data) {
		return (
			<div className="mb-4 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-sm">
				{data.message ?? `キャッシュを更新しました（${data.length ?? 0}文字）`}
			</div>
		);
	}

	return null;
}
