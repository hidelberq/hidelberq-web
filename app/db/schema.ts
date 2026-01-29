import {integer, sqliteTable, text} from "drizzle-orm/sqlite-core";
import {sql} from "drizzle-orm";

export const memos = sqliteTable("memos", {
    id: integer("id").primaryKey({autoIncrement: true}),
    content: text("content").notNull(), // メモの内容
    createdAt: integer("created_at", {mode: "timestamp"})
        .default(sql`(strftime('%s', 'now'))`), // 作成日時
});