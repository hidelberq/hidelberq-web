import { type AppError, type Logger, NotFoundError } from "@nw-union/nw-utils";
import {
  eq,
  type InferInsertModel,
  type InferSelectModel,
  inArray,
} from "drizzle-orm";
import { type AnyD1Database, drizzle } from "drizzle-orm/d1";
import { fromPromise, okAsync, Result, type ResultAsync } from "neverthrow";
import type { UserRepositoryPort } from "../../../domain/User/port";
import type { User } from "../../../domain/User/type";
import { newEmail, newUrlOrPathOrNone } from "../../../domain/vo";
import type { User as UserDto } from "../../../type";
import { userTable } from "./schema";
import { dbErrorHandling } from "./util";

// ----------------------------------------------------------------------------
// DTO
// ----------------------------------------------------------------------------
type UserSelectModel = InferSelectModel<typeof userTable>;
type UserInsertModel = InferInsertModel<typeof userTable>;

// ----------------------------------------------------------------------------
// Converter (Domain Type -> DTO)
// ----------------------------------------------------------------------------
/**
 * User を UserInsertModel に変換
 *
 * @param u - User (Domain)
 * @return UserInsertModel (DTO)
 *
 */
const convToUserInsertModel = (u: User): UserInsertModel => ({
  id: u.id,
  name: u.name,
  email: u.email,
  imgUrl: u.imgUrl ?? "",
  discord: u.discord,
  github: u.github,
  createdAt: u.createdAt,
  updatedAt: u.updatedAt,
});

const convToUserInsertModelList = (us: User | User[]): UserInsertModel[] =>
  Array.isArray(us)
    ? us.map((u) => convToUserInsertModel(u))
    : [convToUserInsertModel(us)];

const validateUser = (d: UserSelectModel): Result<User, AppError> =>
  Result.combine([
    newUrlOrPathOrNone(d.imgUrl, "User.imgUrl"),
    newEmail(d.email, "User.email"),
  ]).map(([imgUrl, email]) => ({
    type: "User",
    id: d.id,
    name: d.name,
    email: email,
    imgUrl: imgUrl,
    discord: d.discord,
    github: d.github,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));

const validateUserDto = (d: UserSelectModel): UserDto => ({
  id: d.id,
  name: d.name,
  email: d.email,
  imgUrl: d.imgUrl,
  discord: d.discord,
  github: d.github,
});

// ----------------------------------------------------------------------------
// Adapter Logic [外部接続]
// ----------------------------------------------------------------------------
// UserInsertModel を DB に保存する
const upsertUserInsertModel =
  (db: AnyD1Database, log: Logger) =>
  (users: UserInsertModel[]): ResultAsync<undefined, AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 upsertUserInsertModel 開始");

        // 既存のデータを削除するクエリ発行
        const delQuery = drizzle(db)
          .delete(userTable)
          .where(
            inArray(
              userTable.id,
              users.map((d) => d.id),
            ),
          );
        log.debug(`SQL: ${delQuery.toSQL().sql}`);
        log.debug(`PARAMS: ${delQuery.toSQL().params}`);

        // データを挿入するクエリ発行
        const insertQuery = drizzle(db).insert(userTable).values(users);
        log.debug(`SQL: ${insertQuery.toSQL().sql}`);
        log.debug(`PARAMS: ${insertQuery.toSQL().params}`);

        // クエリ実行 (batch を使い, 1トランザクションで実行)
        await drizzle(db).batch([delQuery, insertQuery]);

        return undefined;
      })(),
      dbErrorHandling,
    );

// ID でドキュメントを取得する
const readUser =
  (db: AnyD1Database, log: Logger) =>
  (id: string): ResultAsync<UserSelectModel, AppError> =>
    fromPromise(
      (async () => {
        log.info("💽 readUser 開始");

        // クエリ発行
        const query = drizzle(db)
          .select()
          .from(userTable)
          .where(eq(userTable.id, id));
        log.debug(`SQL: ${query.toSQL().sql}`);
        log.debug(`PARAMS: ${query.toSQL().params}`);

        // クエリ実行
        const users = await query.all();

        // content が null / undefined の場合は、NotFound とする
        if (!users || users.length === 0) {
          throw new NotFoundError(`user not found. id=${id}`);
        }

        return users[0]; // ID で検索しているので、1件しか返ってこない
      })(),
      dbErrorHandling,
    );

// ----------------------------------------------------------------------------
// Port 実装
// ----------------------------------------------------------------------------
export const newUserRepository = (
  db: AnyD1Database,
  log: Logger,
): UserRepositoryPort => ({
  upsert: (users) =>
    okAsync(users)
      .map(convToUserInsertModelList)
      .andThen(upsertUserInsertModel(db, log)),

  read: (id) => okAsync(id).andThen(readUser(db, log)).andThen(validateUser),
  get: ({ id }) => okAsync(id).andThen(readUser(db, log)).map(validateUserDto),
});
