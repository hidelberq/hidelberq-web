import { CATEGORIES, type Category, type LifeChartEvent } from "./types";

interface EventListProps {
	events: LifeChartEvent[];
	onEdit: (event: LifeChartEvent) => void;
	onDelete: (eventId: number) => void;
}

export function EventList({ events, onEdit, onDelete }: EventListProps) {
	const sorted = [...events].sort((a, b) => a.age - b.age);

	if (sorted.length === 0) {
		return (
			<p className="py-8 text-center text-sm text-zinc-500">
				まだイベントがありません。「+ イベントを追加」から始めましょう。
			</p>
		);
	}

	return (
		<div className="space-y-1">
			{sorted.map((event) => {
				const cat = CATEGORIES[event.category as Category] ?? CATEGORIES.other;
				return (
					<div
						key={event.id}
						className="flex items-center gap-3 rounded-lg border border-zinc-700/50 bg-zinc-800/30 px-3 py-2"
					>
						<span className="text-lg" title={cat.label}>
							{cat.icon}
						</span>
						<span className="min-w-[3rem] text-sm font-medium text-zinc-300">
							{event.age}歳
						</span>
						<span
							className="min-w-[3rem] text-sm font-bold"
							style={{ color: event.score >= 0 ? "#4ade80" : "#f87171" }}
						>
							{event.score > 0 ? `+${event.score}` : event.score}
						</span>
						<span className="flex-1 truncate text-sm text-zinc-200">
							{event.title}
						</span>
						{event.note && (
							<span className="hidden truncate text-xs text-zinc-500 sm:block sm:max-w-[150px]">
								{event.note}
							</span>
						)}
						<div className="flex shrink-0 gap-1">
							<button
								type="button"
								onClick={() => onEdit(event)}
								className="rounded px-2 py-1 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
							>
								編集
							</button>
							<button
								type="button"
								onClick={() => {
									if (confirm(`「${event.title}」を削除しますか？`)) {
										onDelete(event.id);
									}
								}}
								className="rounded px-2 py-1 text-xs text-red-400 hover:bg-red-900/30 hover:text-red-300"
							>
								削除
							</button>
						</div>
					</div>
				);
			})}
		</div>
	);
}
