import type { AppError } from "@nw-union/nw-utils";
import type { ResultAsync } from "neverthrow";
import type { GetUserQuery, User as UserDto } from "../../type";
import type { User } from "./type";

// User Repository Port
export interface UserRepositoryPort {
  upsert(users: User | User[]): ResultAsync<undefined, AppError>;
  read(id: string): ResultAsync<User, AppError>;

  get(q: GetUserQuery): ResultAsync<UserDto, AppError>;
}
