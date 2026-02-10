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

export const scrapeSites = sqliteTable("scrape_sites", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	siteId: text("site_id").notNull().unique(),
	name: text("name").notNull(),
	url: text("url").notNull(),
	parserId: text("parser_id").notNull(), // "yahoo-top" | "generic-links" | "generic-page"
	enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

export const activityLog = sqliteTable("activity_log", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	type: text("type").notNull(), // "deploy" | "cron_aitter" | "cron_hero_image" | "cron_news_scrape"
	message: text("message").notNull(),
	metadata: text("metadata"), // JSON (コミットハッシュ等)
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

// Google Books API 検索キャッシュ
export const bookSearchCache = sqliteTable("book_search_cache", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	query: text("query").notNull().unique(), // 正規化済みの検索クエリ
	results: text("results").notNull(), // JSON: BookSearchResult[]
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

// 積読リスト管理
export const bookGroups = sqliteTable("book_groups", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	groupCode: text("group_code").notNull().unique(), // 6文字の招待コード
	name: text("name").notNull(),
	description: text("description"),
	createdByMemberId: text("created_by_member_id").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

export const bookGroupMembers = sqliteTable("book_group_members", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	groupId: integer("group_id").notNull(),
	memberId: text("member_id").notNull(), // localStorage の UUID
	displayName: text("display_name").notNull(),
	joinedAt: integer("joined_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

export const books = sqliteTable("books", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	groupId: integer("group_id").notNull(),
	title: text("title").notNull(),
	author: text("author").notNull(),
	isbn: text("isbn"),
	publishedYear: text("published_year"),
	publisher: text("publisher"),
	coverImageUrl: text("cover_image_url"),
	description: text("description"),
	pageCount: integer("page_count"),
	genre: text("genre"),
	addedByMemberId: text("added_by_member_id").notNull(),
	addedByName: text("added_by_name").notNull(),
	videoUrl: text("video_url"),
	prerequisiteText: text("prerequisite_text"),
	importanceLevel: text("importance_level"), // "S" | "A" | "B"
	difficultyLevel: integer("difficulty_level"), // 1-5
	memo: text("memo"),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

export const bookMemberStatuses = sqliteTable("book_member_statuses", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	bookId: integer("book_id").notNull(),
	memberId: text("member_id").notNull(),
	memberName: text("member_name").notNull(),
	status: text("status").notNull().default("interested"), // unowned, interested, reading, completed
	difficulty: integer("difficulty"), // 1-5
	importance: integer("importance"), // 1-5
	recommendation: integer("recommendation"), // 1-5
	memo: text("memo"),
	startedAt: text("started_at"), // YYYY-MM-DD
	completedAt: text("completed_at"), // YYYY-MM-DD
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

// 個人積読リスト
export const personalBooks = sqliteTable("personal_books", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	memberId: text("member_id").notNull(), // localStorage の UUID
	memberName: text("member_name").notNull(),
	// 本の情報
	googleBooksId: text("google_books_id"),
	title: text("title").notNull(),
	author: text("author").notNull(),
	isbn: text("isbn"),
	publishedYear: text("published_year"),
	publisher: text("publisher"),
	coverImageUrl: text("cover_image_url"),
	description: text("description"),
	pageCount: integer("page_count"),
	genre: text("genre"),
	// ステータス・評価
	status: text("status").notNull().default("interested"), // unowned, interested, reading, completed, abandoned
	difficulty: integer("difficulty"), // 1-5
	importance: integer("importance"), // 1-5
	recommendation: integer("recommendation"), // 1-5
	visibility: text("visibility").notNull().default("public"), // public, private
	memo: text("memo"),
	startedAt: text("started_at"), // YYYY-MM-DD
	completedAt: text("completed_at"), // YYYY-MM-DD
	tags: text("tags"), // JSON 配列: ["輪読会向き", "入門書"]
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
	updatedAt: integer("updated_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});

// 前提本（先に読んでおいた方がいい本）
export const bookPrerequisites = sqliteTable("book_prerequisites", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	personalBookId: integer("personal_book_id").notNull(), // この本を読む前に
	prerequisitePersonalBookId: integer("prerequisite_personal_book_id").notNull(), // この本を先に読んでおくべき
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
