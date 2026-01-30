import { type AppError, type Logger, NotFoundError } from "@nw-union/nw-utils";
import {
  asc,
  desc,
  eq,
  type InferInsertModel,
  type InferSelectModel,
  inArray,
} from "drizzle-orm";
import { type AnyD1Database, drizzle } from "drizzle-orm/d1";
import { fromPromise, okAsync, Result, type ResultAsync } from "neverthrow";
import { match } from "ts-pattern";
import type { DocRepositoryPort } from "../../../domain/Doc/port";
import type { Doc } from "../../../domain/Doc/type";
import type { DocKiokuRepositoryPort } from "../../../domain/Kioku/port";
import type { DocKioku } from "../../../domain/Kioku/type";
import {
  newDocId,
  newString1To100,
  newString1To100OrNone,
  newUrlOrNone,
  newUserId,
} from "../../../domain/vo";
import type { Doc as DocDto } from "../../../type";
import { type DocStatusDbEnum, docTable, userTable } from "./schema";
import { dbErrorHandling } from "./util";

// ----------------------------------------------------------------------------
// DbModel
// ----------------------------------------------------------------------------
type DocSelectModel = InferSelectModel<typeof docTable>;
type DocInsertModel = InferInsertModel<typeof docTable>;
type UserSelectModel = InferSelectModel<typeof userTable>;

type DocJoinUserSelectModel = {
  doc: DocSelectModel;
  user: UserSelectModel;
};

// ----------------------------------------------------------------------------
// Converter (DomainType -> DbModel)
// ----------------------------------------------------------------------------
/**
 * Doc を DocInsertModel に変換
 *
 * @param doc - Doc (Domain)
 * @return DocInsertModel
 *
 */
const convToDocInsertModel = (doc: Doc): DocInsertModel => ({
  id: doc.id,
  title: doc.title,
  description: match(doc.description)
    .with(null, () => "")
    .otherwise((d) => d),
  status: match(doc.status)
    // .with("draft", (): DocStatusDbEnum => "draft")
    .with("private", (): DocStatusDbEnum => "private")
    .with("public", (): DocStatusDbEnum => "public")
    .exhaustive(),
  body: doc.body,
  thumbnailUrl: match(doc.thumbnailUrl)
    .with(null, () => "")
    .otherwise((u) => u),
  postedUserId: doc.userId,
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

const convToDocInsertModelList = (doc: Doc | Doc[]): DocInsertModel[] =>
  Array.isArray(doc)
    ? doc.map(convToDocInsertModel)
    : [convToDocInsertModel(doc)];

// ----------------------------------------------------------------------------
// Validator (DbModel -> DomainType / DbModel -> DTO)
// ----------------------------------------------------------------------------
/**
 * DocSelectModel を Doc (Domain) に変換
 *
 * @param d - DocSelectModel
 * @return Result<Doc, AppError> - Doc (Domain) or AppError
 *
 */
const validateDoc = (d: DocSelectModel): Result<Doc, AppError> =>
  Result.combine([
    newDocId(d.id, "Doc.id"),
    newString1To100(d.title, "Doc.title"),
    newString1To100OrNone(d.description, "Doc.description"),
    newUrlOrNone(d.thumbnailUrl, "Doc.thumbnailUrl"),
    newUserId(d.postedUserId, "Doc.userId"),
  ]).map(([id, title, description, thumbnailUrl, userId]) => ({
    type: "Doc",
    id: id,
    title: title,
    description: description,
    status: match(d.status)
      .with("draft", () => "private" as const)
      .with("private", () => "private" as const)
      .with("public", () => "public" as const)
      .exhaustive(),
    body: d.body,
    thumbnailUrl: thumbnailUrl,
    userId: userId,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));

/**
 * DocSelectModel を DocKioku (Domain) に変換
 *
 * @param d - DocJoinSelectModel
 * @return Result<DocKioku, AppError> - DocKioku (Domain) or AppError
 *
 */
const validateDocKioku = (
  m: DocJoinUserSelectModel,
): Result<DocKioku, AppError> =>
  Result.combine([newDocId(m.doc.id, "DocKioku.id")]).map(([id]) => ({
    type: "DocKioku",
    id: id,
    title: m.doc.title,
    userName: m.user.name,
    thumbnailUrl: m.doc.thumbnailUrl,
    createdAt: m.doc.createdAt,
  }));

const validateDocKiokuList = (
  ds: DocJoinUserSelectModel[],
): Result<DocKioku[], AppError> => Result.combine(ds.map(validateDocKioku));

/**
 * DocSelectModel を DocDto に変換
 *
 * @param d - DocSelectModel
 * @return DocDto
 *
 */
const validateDocDto = (d: DocSelectModel): DocDto => ({
  id: d.id,
  title: d.title,
  description: d.description,
  status: match(d.status)
    .with("draft", () => "private" as const)
    .with("private", () => "private" as const)
    .with("public", () => "public" as const)
    .exhaustive(),
  body: d.body,
  thumbnailUrl: d.thumbnailUrl,
  createdAt: d.createdAt,
  updatedAt: d.updatedAt,
});

// ----------------------------------------------------------------------------
// Adapter Logic [外部接続]
// ----------------------------------------------------------------------------
// DocInsertModel を DB に保存する
const upsertDocInsertModel =
  (db: AnyD1Database, log: Logger) =>
  (docs: DocInsertModel[]): ResultAsync<undefined, AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 upsertDocInsertModel 開始");

        // 既存のデータを削除するクエリ発行
        const delQuery = drizzle(db)
          .delete(docTable)
          .where(
            inArray(
              docTable.id,
              docs.map((d) => d.id),
            ),
          );
        log.debug(`SQL: ${delQuery.toSQL().sql}`);
        log.debug(`PARAMS: ${delQuery.toSQL().params}`);

        // データを挿入するクエリ発行
        const insertQuery = drizzle(db).insert(docTable).values(docs);
        log.debug(`SQL: ${insertQuery.toSQL().sql}`);
        log.debug(`PARAMS: ${insertQuery.toSQL().params}`);

        // クエリ実行 (batch を使い, 1トランザクションで実行)
        await drizzle(db).batch([delQuery, insertQuery]);

        return undefined;
      })(),
      dbErrorHandling,
    );

// ID でドキュメントを取得する
const readDocSelectModel =
  (db: AnyD1Database, log: Logger) =>
  (id: string): ResultAsync<DocSelectModel, AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 readDoc 開始");

        // クエリ発行
        const query = drizzle(db)
          .select()
          .from(docTable)
          .where(eq(docTable.id, id))
          .orderBy(asc(docTable.createdAt)); // orderNum でソート
        log.debug(`SQL: ${query.toSQL().sql}`);
        log.debug(`PARAMS: ${query.toSQL().params}`);

        // クエリ実行
        const docs = await query.all();

        // content が null / undefined の場合は、NotFound とする
        if (!docs || docs.length === 0) {
          throw new NotFoundError(`doc not found. id=${id}`);
        }

        return docs[0]; // ID で検索しているので、1件しか返ってこない
      })(),
      dbErrorHandling,
    );

const getAllDocSelectModel =
  (db: AnyD1Database, log: Logger) =>
  (): ResultAsync<DocJoinUserSelectModel[], AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 searchDocs 開始");

        // クエリ作成
        const query = drizzle(db)
          .select()
          .from(docTable)
          .innerJoin(userTable, eq(docTable.postedUserId, userTable.id)) // user と結合
          .orderBy(desc(docTable.createdAt)); // createdAt でソート

        log.debug(`SQL: ${query.toSQL().sql}`);
        log.debug(`PARAMS: ${query.toSQL().params}`);

        // 実行
        const rows = await query.all();

        // 結果を DocJoinUserSelectModel に詰める
        const docs: DocJoinUserSelectModel[] = rows
          .map((r) => ({
            doc: r.doc,
            user: r.user,
          }))
          // null チェック
          .filter((d) => d.doc && d.user)
          // 重複削除
          .reduce<DocJoinUserSelectModel[]>((acc, current) => {
            if (!acc.find((d) => d.doc.id === current.doc.id)) {
              acc.push(current);
            }
            return acc;
          }, []);

        // TODO: NotFound をエラーハンドリング

        return docs;
      })(),
      dbErrorHandling,
    );

// DocInsertModel を DB から削除する
const deleteDocInsertModel =
  (db: AnyD1Database, log: Logger) =>
  (docs: DocInsertModel[]): ResultAsync<undefined, AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 deleteDocInsertModel 開始");

        // 削除クエリ発行
        const delQuery = drizzle(db)
          .delete(docTable)
          .where(
            inArray(
              docTable.id,
              docs.map((d) => d.id),
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
export const newDocRepository = (
  db: AnyD1Database,
  log: Logger,
): DocRepositoryPort => ({
  upsert: (doc) =>
    okAsync(doc)
      // Doc -> DocInsertModel
      .map(convToDocInsertModelList)
      // 保存処理実行 (DB)
      .andThen(upsertDocInsertModel(db, log)),

  read: (id) =>
    okAsync(id.toString())
      // ID でドキュメント取得処理実行 (DB)
      .andThen(readDocSelectModel(db, log))
      // DocSelectModel -> Doc
      .andThen(validateDoc),

  delete: (doc) =>
    okAsync(doc)
      // Doc -> DocInsertModel
      .map(convToDocInsertModelList)
      // 削除処理実行 (DB)
      .andThen(deleteDocInsertModel(db, log)),

  get: (q) =>
    okAsync(q.id)
      // ID でドキュメント取得処理実行 (DB)
      .andThen(readDocSelectModel(db, log))
      // DocSelectModel -> DocDto
      .map(validateDocDto),
});

export const newDocKiokuRepository = (
  db: AnyD1Database,
  log: Logger,
): DocKiokuRepositoryPort => ({
  getAll: () =>
    okAsync({})
      // 全件取得処理実行 (DB)
      .andThen(getAllDocSelectModel(db, log))
      // DocSelectModel[] -> DocKioku[]
      .andThen(validateDocKiokuList),
});
