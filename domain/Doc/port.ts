import type { AppError } from "@nw-union/nw-utils";
import type { ResultAsync } from "neverthrow";
import type { Doc as DocDto, GetDocQuery } from "../../type";
import type { DocId } from "../vo";
import type { Doc } from "./type";

// Doc Repository Port
export interface DocRepositoryPort {
  // コマンド
  upsert(d: Doc | Doc[]): ResultAsync<undefined, AppError>;
  read(id: DocId): ResultAsync<Doc, AppError>;
  delete(d: Doc | Doc[]): ResultAsync<undefined, AppError>;

  // クエリ
  get(q: GetDocQuery): ResultAsync<DocDto, AppError>;
}
