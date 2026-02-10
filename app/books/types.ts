export const BOOK_STATUSES = {
	unowned: "未所持",
	interested: "気になる",
	reading: "途中",
	completed: "読了",
	abandoned: "挫折",
} as const;

export type BookStatus = keyof typeof BOOK_STATUSES;

export const BOOK_VISIBILITY = {
	public: "公開",
	private: "非公開",
} as const;

export type BookVisibility = keyof typeof BOOK_VISIBILITY;

export const GENRES = [
	"小説・文学",
	"ビジネス・経済",
	"自己啓発",
	"技術・IT",
	"科学・数学",
	"哲学・思想",
	"社会学",
	"歴史",
	"心理学",
	"芸術・デザイン",
	"語学",
	"漫画",
	"エッセイ",
	"ノンフィクション",
	"その他",
] as const;

export type Genre = (typeof GENRES)[number];

export interface BookSearchResult {
	title: string;
	author: string;
	isbn: string | null;
	publishedYear: string | null;
	publisher: string | null;
	coverImageUrl: string | null;
	pageCount: number | null;
	description: string | null;
}

export function generateGroupCode(): string {
	const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 紛らわしい文字を除外
	let code = "";
	for (let i = 0; i < 6; i++) {
		code += chars[Math.floor(Math.random() * chars.length)];
	}
	return code;
}

export function generateMemberId(): string {
	return crypto.randomUUID();
}

export function formatRating(value: number | null): string {
	if (value === null) return "-";
	return "\u2605".repeat(value) + "\u2606".repeat(5 - value);
}

export const AVATAR_EMOJIS = [
	"📚", "📖", "📕", "📗", "📘", "📙", "🎓", "🧠", "💡", "✏️",
	"🔬", "🎨", "🎵", "🌏", "🌱", "🐱", "🐶", "🦊", "🐻", "🐼",
] as const;

export function getStatusColor(status: BookStatus): string {
	switch (status) {
		case "unowned":
			return "text-gray-400 bg-gray-500/20";
		case "interested":
			return "text-yellow-400 bg-yellow-500/20";
		case "reading":
			return "text-blue-400 bg-blue-500/20";
		case "completed":
			return "text-green-400 bg-green-500/20";
		case "abandoned":
			return "text-red-400 bg-red-500/20";
	}
}
