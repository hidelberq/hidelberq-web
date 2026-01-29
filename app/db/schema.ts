import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const tweets = sqliteTable("tweets", {
	id: integer("id").primaryKey({ autoIncrement: true }),
	content: text("content").notNull(),
	authorName: text("author_name").notNull(),
	authorHandle: text("author_handle").notNull(),
	authorEmoji: text("author_emoji").notNull(),
	category: text("category").notNull(),
	sourceUrl: text("source_url"),
	likes: integer("likes").notNull().default(0),
	retweets: integer("retweets").notNull().default(0),
	replies: integer("replies").notNull().default(0),
	views: integer("views").notNull().default(0),
	displayed: integer("displayed", { mode: "boolean" }).notNull().default(false),
	createdAt: integer("created_at", { mode: "timestamp" }).default(
		sql`(strftime('%s', 'now'))`,
	),
});
