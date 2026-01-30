import type { AppError } from "@nw-union/nw-utils";
import { errAsync, okAsync, ResultAsync } from "neverthrow";
import { match } from "ts-pattern";
import type { UserWorkFlows } from "../../type";
import type { TimePort } from "../port";
import { type Email, newEmail, newUrlOrPathOrNone } from "../vo";
import { convToUserDto, createUser, updateUser } from "./logic";
import type { UserRepositoryPort } from "./port";
import type { User } from "./type";

export const newUserWorkFlows = (
  r: UserRepositoryPort,
  t: TimePort,
): UserWorkFlows => ({
  /*
   * ユーザーを取得する
   */
  get: (q) =>
    okAsync(q.email)
      // Step.1 Email 検証
      // string -> Email
      .andThen(newEmail)
      // Step.2 ユーザー取得する. 存在しなければ作成する
      // Email -> User
      .andThen(getOrCreateUser(r, t)(q.id))
      // Step.3 DTO 変換
      // User -> UserDto
      .map(convToUserDto)
      // Step.4 イベント生成
      .map((user) => ({ user })),

  /*
   * ユーザーを更新する
   */
  update: (cmd) =>
    ResultAsync.combine([
      // 既存のユーザーを取得
      okAsync(cmd.id).andThen(r.read),
      // name
      okAsync(cmd.name),
      // imgUrl 検証
      okAsync(cmd.imgUrl).andThen((url) =>
        newUrlOrPathOrNone(url, "User.imgUrl"),
      ),
      // discord
      okAsync(cmd.discord),
      // github
      okAsync(cmd.github),
      // 現在日時取得
      t.getNow(),
    ])
      // ユーザー更新
      .map(updateUser)
      // ユーザー保存
      .andThen(r.upsert),
});

/**
 * ユーザーを取得する. 存在しなければ新規作成する
 */
const getOrCreateUser =
  (r: UserRepositoryPort, t: TimePort) =>
  (id: string) =>
  (email: Email): ResultAsync<User, AppError> =>
    r.read(id).orElse((err) =>
      match(err)
        // ユーザーが存在しない場合は新規作成
        .with({ name: "NotFoundError" }, () =>
          // 現在時刻取得
          t
            .getNow()
            // ユーザー作成
            .map((now) => createUser([id, email, now]))
            // DB保存
            .andThrough(r.upsert),
        )
        // その他のエラーはそのまま返す
        .otherwise(() => errAsync(err)),
    );
