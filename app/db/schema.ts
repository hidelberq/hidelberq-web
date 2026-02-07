import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const tweets = sqliteTable("tweets", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	content: text("content").notNull(),
	authorName: text("author_name").notNull(),
	authorHandle: text("author_handle").notNull(),
	authorEmoji: text("author_emoji").notNull(),
	category: text("category").notNull(),
	sourceUrl: text("source_url").notNull(),
	likes: integer("likes").notNull().default(0),
	retweets: integer("retweets").notNull().default(0),
	replies: integer("replies").notNull().default(0),
	views: integer("views").notNull().default(0),
	displayed: integer("displayed", { mode: "boolean" }).notNull().default(false),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

export const shogiGames = sqliteTable("shogi_games", {
	id: text("id").primaryKey(), // 4文字のルームコード
	board: text("board").notNull(), // JSON: Board
	captured: text("captured").notNull(), // JSON: CapturedPieces
	currentPlayer: text("current_player").notNull().default("sente"),
	status: text("status").notNull().default("waiting"), // waiting, playing, check, checkmate, stalemate, resigned
	winner: text("winner"), // sente | gote | null
	sentePlayerId: text("sente_player_id"),
	gotePlayerId: text("gote_player_id"),
	moveCount: integer("move_count").notNull().default(0),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

export const heroImages = sqliteTable("hero_images", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	date: text("date").notNull().unique(), // YYYY-MM-DD
	imageKey: text("image_key").notNull(), // R2 のキー
	prompt: text("prompt").notNull(), // 使用したプロンプト
	source: text("source").notNull(), // "diary" | "weather"
	diaryContent: text("diary_content"), // 日記の内容（あれば）
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

export const newsCache = sqliteTable("news_cache", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	content: text("content").notNull(),
	fetchedDate: text("fetched_date").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

export const scrapedArticles = sqliteTable("scraped_articles", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	siteId: text("site_id").notNull(),
	siteName: text("site_name").notNull(),
	siteUrl: text("site_url").notNull(),
	articleUrl: text("article_url").notNull().unique(),
	articleTitle: text("article_title").notNull(),
	imageUrl: text("image_url"),
	description: text("description"),
	category: text("category"),
	scrapedAt: integer("scraped_at", { mode: "timestamp" }).notNull(),
	usedForTweet: integer("used_for_tweet", { mode: "boolean" })
		.notNull()
		.default(false),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});
