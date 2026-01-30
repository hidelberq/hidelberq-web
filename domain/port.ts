import type { AppError } from "@nw-union/nw-utils";
import type { ResultAsync } from "neverthrow";

/**
 * 時間関連ポート
 */
export interface TimePort {
  // 現在日時取得
  getNow(): ResultAsync<Date, AppError>;
}
