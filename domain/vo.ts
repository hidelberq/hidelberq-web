import type { ValidationError } from "@nw-union/nw-utils";
import { toShortUuid, uuidv4 } from "@nw-union/nw-utils/lib/uuid";
import { newType } from "@nw-union/nw-utils/lib/zod";
import { ok, type Result } from "neverthrow";
import { z } from "zod";

/**
 * newVoOrNone は, ValueObjectを生成する関数を作成するためのヘルパー関数
 * 入力文字列が空文字の場合は, null. それ以外は `newVo` と同様に動作する関数を作成する
 *
 * @param schema zodのスキーマ
 * @param type VOの型名
 */
const newVoOrNone =
  <T extends z.ZodTypeAny>(schema: T, type: string) =>
  (src: unknown, name?: string): Result<z.infer<T> | null, ValidationError> =>
    src === "" ? ok(null) : newType(schema, type)(src, name);

// -------

/**
 * DocId
 *
 * UUID `z.uuidv4()`
 */
const docId = z.uuidv4().brand("DocId"); // UUID
export type DocId = z.infer<typeof docId>;
export const newDocId = newType(docId, "DocId");
export const createDocId = () => newDocId(uuidv4())._unsafeUnwrap();

export const toShortDocId = (id: DocId): string =>
  toShortUuid(id)._unsafeUnwrap();

/**
 * UserId
 *
 */
const userId = z.string().brand("UserId");
export type UserId = z.infer<typeof userId>;
export const newUserId = newType(userId, "UserId");

/**
 * YoutubeId
 *
 * youtube の Video ID と一致する文字列
 * `z.string().min(11).max(11)`
 */
const youtubeId = z.string().min(11).max(11).brand("YoutubeId");
export type YoutubeId = z.infer<typeof youtubeId>;
export const newYoutubeId = newType(youtubeId, "YoutubeId");

/**
 * NoteId
 *
 * UUID `z.uuidv4()`
 */
const noteId = z.uuidv4().brand("NoteId"); // UUID
export type NoteId = z.infer<typeof noteId>;
export const newNoteId = newType(noteId, "NoteId");
export const createNoteId = () => newNoteId(uuidv4())._unsafeUnwrap();

/**
 * String1To100 1文字以上100文字以下の文字列が入る型
 *
 * `z.string().min(1).max(100)`
 */
const string1To100 = z.string().min(1).max(100).brand("String1To100");
export type String1To100 = z.infer<typeof string1To100>;
export const newString1To100 = newType(string1To100, "String1To100");
export const newString1To100OrNone = newVoOrNone(string1To100, "String1To100");

/**
 * Url
 *
 * `z.url()`
 */
const url = z.url().brand("Url");
export type Url = z.infer<typeof url>;
export const newUrl = newType(url, "Url");
export const newUrlOrNone = newVoOrNone(url, "Url");

/**
 * パス
 *
 * `z.string().min(1)`
 */
const path = z.string().min(1).brand("Path");
export type Path = z.infer<typeof path>;
export const newPath = newType(path, "Path");

export const newUrlOrPath = (
  src: unknown,
  name?: string,
): Result<Url | Path, ValidationError> =>
  newUrl(src, name).orElse(() => newPath(src, name));

export const newUrlOrPathOrNone = (
  src: unknown,
  name?: string,
): Result<Url | Path | null, ValidationError> =>
  src === "" ? ok(null) : newUrlOrPath(src, name);

/**
 * Email
 *
 * `z.string().email()`
 */
const email = z.string().email().brand("Email");
export type Email = z.infer<typeof email>;
export const newEmail = newType(email, "Email");
