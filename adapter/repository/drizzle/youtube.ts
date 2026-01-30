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
import type { YoutubeKiokuRepositoryPort } from "../../../domain/Kioku/port";
import type { YoutubeKioku } from "../../../domain/Kioku/type";
import { newYoutubeId } from "../../../domain/vo";
import type { YoutubeRepositoryPort } from "../../../domain/Youtube/port";
import type { Youtube } from "../../../domain/Youtube/type";
import { youtubeTable } from "./schema";
import { dbErrorHandling } from "./util";

// ----------------------------------------------------------------------------
// DbModel
// ----------------------------------------------------------------------------
type YoutubeSelectModel = InferSelectModel<typeof youtubeTable>;
type YoutubeInsertModel = InferInsertModel<typeof youtubeTable>;

// ----------------------------------------------------------------------------
// Converter (DomainType -> DbModel)
// ----------------------------------------------------------------------------
/**
 * Youtube を YoutubeInsertModel に変換
 *
 * @param y - Youtube (DomainType)
 * @return YoutubeInsertModel
 */
const convToYoutubeInsertModel = (y: Youtube): YoutubeInsertModel => ({
  id: y.id,
  title: y.info.title,
  channelName: y.info.channelName,
  duration: y.info.duration,
  isPublic: y.info.isPublic ? 1 : 0, // boolean -> integer (0 or 1)
  createdAt: y.createdAt,
  updatedAt: y.updatedAt,
});

const convToYoutubeInsertModelList = (
  y: Youtube | Youtube[],
): YoutubeInsertModel[] =>
  Array.isArray(y)
    ? y.map(convToYoutubeInsertModel)
    : [convToYoutubeInsertModel(y)];

// ----------------------------------------------------------------------------
// Validator (DbModel -> DomainType / DbModel -> DTO)
// ----------------------------------------------------------------------------
/**
 * YoutubeSelectModel を Youtube (Domain) に変換
 *
 * @param y - YoutubeSelectModel
 * @return Result<Youtube, AppError> - Youtube (Domain) or AppError
 */
const validateYoutube = (y: YoutubeSelectModel): Result<Youtube, AppError> =>
  Result.combine([newYoutubeId(y.id, "Youtube.id")]).map(([id]) => ({
    type: "Youtube",
    id,
    info: {
      type: "YoutubeInfo",
      title: y.title,
      channelName: y.channelName,
      duration: y.duration,
      isPublic: y.isPublic === 1, // integer -> boolean
    },
    createdAt: y.createdAt,
    updatedAt: y.updatedAt,
  }));

/**
 * YoutubeSelectModel を YoutubeKioku に変換
 *
 * @param y - YoutubeSelectModel
 * @return Result<YoutubeKioku, AppError> - YoutubeKioku or AppError
 */
const validateKiokuDto = (
  y: YoutubeSelectModel,
): Result<YoutubeKioku, AppError> =>
  Result.combine([newYoutubeId(y.id, "YoutubeKioku.id")]).map(([id]) => ({
    type: "YoutubeKioku",
    id: id,
    title: y.title,
    channelName: y.channelName,
    isPublic: y.isPublic === 1,
    duration: y.duration,
    createdAt: y.createdAt,
  }));

const validateKiokuDtoList = (
  ds: YoutubeSelectModel[],
): Result<YoutubeKioku[], AppError> => Result.combine(ds.map(validateKiokuDto));

// ----------------------------------------------------------------------------
// Adapter Logic [外部接続]
// ----------------------------------------------------------------------------
// YoutubeInsertModel を DB に保存する
const upsertYoutubeInsertModel =
  (db: AnyD1Database, log: Logger) =>
  (youtubes: YoutubeInsertModel[]): ResultAsync<undefined, AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 upsertYoutubeInsertModel 開始");

        // 既存のデータを削除するクエリ発行
        const delQuery = drizzle(db)
          .delete(youtubeTable)
          .where(
            inArray(
              youtubeTable.id,
              youtubes.map((y) => y.id),
            ),
          );
        log.debug(`SQL: ${delQuery.toSQL().sql}`);
        log.debug(`PARAMS: ${delQuery.toSQL().params}`);

        // データを挿入するクエリ発行
        const insertQuery = drizzle(db).insert(youtubeTable).values(youtubes);
        log.debug(`SQL: ${insertQuery.toSQL().sql}`);
        log.debug(`PARAMS: ${insertQuery.toSQL().params}`);

        // クエリ実行 (batch を使い, 1トランザクションで実行)
        await drizzle(db).batch([delQuery, insertQuery]);

        return undefined;
      })(),
      dbErrorHandling,
    );

// ID で Youtube を取得する
const readYoutubeSelectModel =
  (db: AnyD1Database, log: Logger) =>
  (id: string): ResultAsync<YoutubeSelectModel, AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 readYoutube 開始");

        // クエリ発行
        const query = drizzle(db)
          .select()
          .from(youtubeTable)
          .where(eq(youtubeTable.id, id));
        log.debug(`SQL: ${query.toSQL().sql}`);
        log.debug(`PARAMS: ${query.toSQL().params}`);

        // クエリ実行
        const youtubes = await query.all();

        // データが存在しない場合は NotFoundError
        if (!youtubes || youtubes.length === 0) {
          throw new NotFoundError(`youtube not found. id=${id}`);
        }

        return youtubes[0]; // ID で検索しているので、1件しか返ってこない
      })(),
      dbErrorHandling,
    );

// 全件取得
const getAllYoutubeSelectModel =
  (db: AnyD1Database, log: Logger) =>
  (): ResultAsync<YoutubeSelectModel[], AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 searchYoutube 開始");

        // クエリ作成
        const query = drizzle(db)
          .select()
          .from(youtubeTable)
          .orderBy(desc(youtubeTable.createdAt)); // createdAt でソート

        log.debug(`SQL: ${query.toSQL().sql}`);
        log.debug(`PARAMS: ${query.toSQL().params}`);

        // 実行
        const youtubes = await query.all();

        return youtubes;
      })(),
      dbErrorHandling,
    );

// 削除処理
const deleteYoutubeInsertModel =
  (db: AnyD1Database, log: Logger) =>
  (youtubes: YoutubeInsertModel[]): ResultAsync<undefined, AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 deleteYoutubeInsertModel 開始");

        // 削除クエリ発行
        const delQuery = drizzle(db)
          .delete(youtubeTable)
          .where(
            inArray(
              youtubeTable.id,
              youtubes.map((y) => y.id),
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
export const newYoutubeRepository = (
  db: AnyD1Database,
  log: Logger,
): YoutubeRepositoryPort => ({
  upsert: (youtube) =>
    okAsync(youtube)
      // Youtube -> YoutubeInsertModel
      .map(convToYoutubeInsertModelList)
      // 保存処理実行 (DB)
      .andThen(upsertYoutubeInsertModel(db, log)),

  read: (id) =>
    okAsync(id.toString())
      // ID で Youtube 取得処理実行 (DB)
      .andThen(readYoutubeSelectModel(db, log))
      // YoutubeSelectModel -> Youtube
      .andThen(validateYoutube),

  delete: (youtube) =>
    okAsync(youtube)
      // Youtube -> YoutubeInsertModel
      .map(convToYoutubeInsertModelList)
      // 削除処理実行 (DB)
      .andThen(deleteYoutubeInsertModel(db, log)),
});

export const newYoutubeKiokuRepository = (
  db: AnyD1Database,
  log: Logger,
): YoutubeKiokuRepositoryPort => ({
  getAll: () =>
    okAsync({})
      .andThen(getAllYoutubeSelectModel(db, log))
      .andThen(validateKiokuDtoList),
});
