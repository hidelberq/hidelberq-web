export const CATEGORIES = {
	education: { label: "学業", color: "#3B82F6", icon: "🎓" },
	career: { label: "仕事", color: "#F59E0B", icon: "💼" },
	relationship: { label: "人間関係", color: "#EC4899", icon: "💕" },
	health: { label: "健康", color: "#10B981", icon: "🏥" },
	hobby: { label: "趣味", color: "#8B5CF6", icon: "🎨" },
	other: { label: "その他", color: "#6B7280", icon: "📌" },
} as const;

export type Category = keyof typeof CATEGORIES;

export interface LifeChartEvent {
	id: number;
	chartId: number;
	age: number;
	score: number;
	category: Category;
	title: string;
	note: string | null;
}

export interface LifeChart {
	id: number;
	memberId: string;
	name: string;
	birthYear: number;
}

export interface TemplateEvent {
	age: number;
	score: number;
	category: Category;
	title: string;
}

export const TEMPLATE_EVENTS: TemplateEvent[] = [
	{ age: 0, score: 5, category: "other", title: "誕生" },
	{ age: 6, score: 3, category: "education", title: "小学校入学" },
	{ age: 12, score: 3, category: "education", title: "中学校入学" },
	{ age: 15, score: 3, category: "education", title: "高校入学" },
	{ age: 18, score: 5, category: "education", title: "大学入学" },
	{ age: 22, score: 4, category: "career", title: "就職" },
	{ age: 25, score: 6, category: "relationship", title: "結婚" },
	{ age: 30, score: 8, category: "relationship", title: "第一子誕生" },
];
