import type { AppError, Logger } from "@nw-union/nw-utils";
import { NotFoundError } from "@nw-union/nw-utils";
import {
  desc,
  eq,
  type InferInsertModel,
  type InferSelectModel,
  inArray,
} from "drizzle-orm";
import { type AnyD1Database, drizzle } from "drizzle-orm/d1";
import { fromPromise, okAsync, Result, type ResultAsync } from "neverthrow";
import type { NoteKiokuRepositoryPort } from "../../../domain/Kioku/port";
import type { NoteKioku } from "../../../domain/Kioku/type";
import type { NoteRepositoryPort } from "../../../domain/Note/port";
import type { Note } from "../../../domain/Note/type";
import { newNoteId, newUrl, newUrlOrNone } from "../../../domain/vo";
import { noteTable } from "./schema";
import { dbErrorHandling } from "./util";

// ----------------------------------------------------------------------------
// DbModel
// ----------------------------------------------------------------------------
type NoteSelectModel = InferSelectModel<typeof noteTable>;
type NoteInsertModel = InferInsertModel<typeof noteTable>;

// ----------------------------------------------------------------------------
// Converter (DomainType -> DbModel)
// ----------------------------------------------------------------------------
/**
 * Note を NoteInsertModel に変換
 *
 * @param n - Note (DomainType)
 * @return NoteInsertModel
 */
const convToNoteInsertModel = (n: Note): NoteInsertModel => ({
  id: n.id,
  title: n.info.title,
  noteUserName: n.info.noteUserName,
  url: n.info.url,
  thumbnailUrl: n.info.thumbnailUrl ?? "", // null -> empty string
  createdAt: n.createdAt,
  updatedAt: n.updatedAt,
});

const convToNoteInsertModelList = (n: Note | Note[]): NoteInsertModel[] =>
  Array.isArray(n) ? n.map(convToNoteInsertModel) : [convToNoteInsertModel(n)];

// ----------------------------------------------------------------------------
// Validator (DbModel -> DomainType / DbModel -> DTO)
// ----------------------------------------------------------------------------
/**
 * NoteSelectModel を Note (DomainType) に変換
 *
 * @param n - NoteSelectModel
 * @return Result<Note, AppError> - Note (DomainType) or AppError
 */
const validateNote = (n: NoteSelectModel): Result<Note, AppError> =>
  Result.combine([
    newNoteId(n.id, "Note.id"),
    newUrl(n.url, "Note.url"),
    newUrlOrNone(n.thumbnailUrl, "Note.thumbnailUrl"),
  ]).map(([id, url, thumbnailUrl]) => ({
    type: "Note",
    id,
    info: {
      type: "NoteInfo",
      title: n.title,
      noteUserName: n.noteUserName,
      url: url,
      thumbnailUrl,
    },
    createdAt: n.createdAt,
    updatedAt: n.updatedAt,
  }));

/**
 * NoteSelectModel を NoteKioku (DomainType) に変換
 *
 * @param n - NoteSelectModel
 * @return Result<NoteKioku, AppError> - NoteKioku (DomainType) or AppError
 */
const validateKiokuDto = (n: NoteSelectModel): Result<NoteKioku, AppError> =>
  Result.combine([newNoteId(n.id, "NoteKioku.id")]).map(([id]) => ({
    type: "NoteKioku",
    id: id,
    title: n.title,
    noteUserName: n.noteUserName,
    thumbnailUrl: n.thumbnailUrl,
    url: n.url,
    createdAt: n.createdAt,
  }));

const validateKiokuDtoList = (
  ns: NoteSelectModel[],
): Result<NoteKioku[], AppError> => Result.combine(ns.map(validateKiokuDto));

// ----------------------------------------------------------------------------
// Adapter Logic [外部接続]
// ----------------------------------------------------------------------------
/**
 * NoteInsertModel を DB に保存する
 *
 * @param notes - NoteInsertModel[]
 */
const upsertNoteInsertModel =
  (db: AnyD1Database, log: Logger) =>
  (notes: NoteInsertModel[]): ResultAsync<undefined, AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 upsertNoteInsertModel 開始");

        // 既存のデータを削除するクエリ発行
        const delQuery = drizzle(db)
          .delete(noteTable)
          .where(
            inArray(
              noteTable.id,
              notes.map((n) => n.id),
            ),
          );
        log.debug(`SQL: ${delQuery.toSQL().sql}`);
        log.debug(`PARAMS: ${delQuery.toSQL().params}`);

        // データを挿入するクエリ発行
        const insertQuery = drizzle(db).insert(noteTable).values(notes);
        log.debug(`SQL: ${insertQuery.toSQL().sql}`);
        log.debug(`PARAMS: ${insertQuery.toSQL().params}`);

        // クエリ実行 (batch を使い, 1トランザクションで実行)
        await drizzle(db).batch([delQuery, insertQuery]);

        return undefined;
      })(),
      dbErrorHandling,
    );

/**
 * ID で Note を取得する
 *
 * @param id - string
 * @return ResultAsync<NoteSelectModel, AppError>
 */
const readNoteSelectModel =
  (db: AnyD1Database, log: Logger) =>
  (id: string): ResultAsync<NoteSelectModel, AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 readNote 開始");

        // クエリ発行
        const query = drizzle(db)
          .select()
          .from(noteTable)
          .where(eq(noteTable.id, id));
        log.debug(`SQL: ${query.toSQL().sql}`);
        log.debug(`PARAMS: ${query.toSQL().params}`);

        // クエリ実行
        const notes = await query.all();

        // データが存在しない場合は NotFoundError
        if (!notes || notes.length === 0) {
          throw new NotFoundError(`note not found. id=${id}`);
        }

        return notes[0]; // ID で検索しているので、1件しか返ってこない
      })(),
      dbErrorHandling,
    );

/**
 * 全件取得
 *
 * @return ResultAsync<NoteSelectModel[], AppError>
 */
const getAllNoteSelectModel = (db: AnyD1Database, log: Logger) => () =>
  fromPromise(
    (async () => {
      log.info("💽 searchNote 開始");

      // クエリ作成
      const query = drizzle(db)
        .select()
        .from(noteTable)
        .orderBy(desc(noteTable.createdAt)); // createdAt でソート

      log.debug(`SQL: ${query.toSQL().sql}`);
      log.debug(`PARAMS: ${query.toSQL().params}`);

      // 実行
      const notes = await query.all();

      return notes;
    })(),
    dbErrorHandling,
  );

/**
 * 削除処理する
 *
 * @param notes - NoteInsertModel[]
 */
const deleteNoteInsertModel =
  (db: AnyD1Database, log: Logger) =>
  (notes: NoteInsertModel[]): ResultAsync<undefined, AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 deleteNoteInsertModel 開始");

        // 削除クエリ発行
        const delQuery = drizzle(db)
          .delete(noteTable)
          .where(
            inArray(
              noteTable.id,
              notes.map((n) => n.id),
            ),
          );
        log.debug(`SQL: ${delQuery.toSQL().sql}`);
        log.debug(`PARAMS: ${delQuery.toSQL().params}`);

        // クエリ実行
        await delQuery;

        return undefined;
      })(),
      dbErrorHandling,
    );

// ----------------------------------------------------------------------------
// Port 実装
// ----------------------------------------------------------------------------
export const newNoteRepository = (
  db: AnyD1Database,
  log: Logger,
): NoteRepositoryPort => ({
  upsert: (note) =>
    okAsync(note)
      // Note -> NoteInsertModel
      .map(convToNoteInsertModelList)
      // 保存処理実行 (DB)
      .andThen(upsertNoteInsertModel(db, log)),

  read: (id) =>
    okAsync(id.toString())
      // ID で Note 取得処理実行 (DB)
      .andThen(readNoteSelectModel(db, log))
      // NoteSelectModel -> Note
      .andThen(validateNote),

  delete: (note) =>
    okAsync(note)
      // Note -> NoteInsertModel
      .map(convToNoteInsertModelList)
      // 削除処理実行 (DB)
      .andThen(deleteNoteInsertModel(db, log)),
});

export const newNoteKiokuRepository = (
  db: AnyD1Database,
  log: Logger,
): NoteKiokuRepositoryPort => ({
  getAll: () =>
    okAsync({})
      // 全件取得処理実行 (DB)
      .andThen(getAllNoteSelectModel(db, log))
      .andThen(validateKiokuDtoList),
});
