import type { AppError } from "@nw-union/nw-utils";
import type { ResultAsync } from "neverthrow";
import type { YoutubeId } from "../vo";
import type { Youtube, YoutubeInfo } from "./type";

// レポジトリポート
export interface YoutubeRepositoryPort {
  upsert(y: Youtube | Youtube[]): ResultAsync<undefined, AppError>;
  read(id: YoutubeId): ResultAsync<Youtube, AppError>;
  delete(y: Youtube | Youtube[]): ResultAsync<undefined, AppError>;
}

// Youtube API ポート
export interface YoutubePort {
  // 動画情報取得
  fetchInfo(id: YoutubeId): ResultAsync<YoutubeInfo, AppError>;
}
