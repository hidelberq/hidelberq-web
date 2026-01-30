/*
  DO NOT RENAME THIS FILE FOR DRIZZLE-ORM TO WORK
*/
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { z } from "zod";

// helper
const zEnum = <T extends z.ZodEnum>(src: string, schema: T) =>
  text(src, { enum: schema.options as [string, ...string[]] }).$type<
    z.infer<T>
  >();

// ----------------------------------------------------------------------------
// Doc Table
// ----------------------------------------------------------------------------
// status カラムの値
const docStatusDbEnum = z.enum(["public", "private", "draft"]);
export type DocStatusDbEnum = z.infer<typeof docStatusDbEnum>;

// Doc テーブルのスキーマ
export const docTable = sqliteTable(
  "doc",
  {
    id: text("doc_id").primaryKey().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    status: zEnum("status", docStatusDbEnum).notNull(),
    body: text("body").notNull(),
    thumbnailUrl: text("thumbnail_url").notNull().default(""),
    postedUserId: text("posted_user_id").notNull().default("mock-user-id"),
    createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  },
  (table) => [
    // インデックス設定
    index("idx_created_at").on(table.createdAt),
  ],
);

// -----------------------------------------
// User table
// -----------------------------------------
export const userTable = sqliteTable("user", {
  id: text("user_id").primaryKey().notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  github: text("github").notNull(),
  discord: text("discord").notNull(),
  imgUrl: text("img_url").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// -----------------------------------------
// Note table
// -----------------------------------------
export const noteTable = sqliteTable("note", {
  id: text("note_id").primaryKey().notNull(),
  title: text("title").notNull(),
  noteUserName: text("note_user_name").notNull(),
  url: text("url").notNull(),
  thumbnailUrl: text("thumbnail_url").notNull().default(""),
  postedUserId: text("posted_user_id").notNull().default("mock-user-id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// -----------------------------------------
// YouTube table
// -----------------------------------------
export const youtubeTable = sqliteTable("youtube", {
  id: text("youtube_id").primaryKey().notNull(),
  title: text("title").notNull(),
  channelName: text("channel_name").notNull(),
  duration: text("duration").notNull(),
  isPublic: integer("is_public").notNull(), // boolean を整数で保存 (0 or 1)
  postedUserId: text("posted_user_id").notNull().default("mock-user-id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
