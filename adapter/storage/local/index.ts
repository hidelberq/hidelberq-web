import { AppError, type Logger, SystemError } from "@nw-union/nw-utils";
import { uuidv4 } from "@nw-union/nw-utils/lib/uuid";
import {
  err,
  fromPromise,
  ok,
  okAsync,
  type Result,
  type ResultAsync,
} from "neverthrow";
import { match, P } from "ts-pattern";
import type { StoragePort } from "../../../domain/System/workflow";

// ----------------------------------------------------------------------------
// Helper Functions
// ----------------------------------------------------------------------------
// エラーハンドリング
const fsErrorHandling = (e: unknown): AppError =>
  match(e)
    .with(P.instanceOf(AppError), (e) => e)
    .with(P.instanceOf(Error), (e) => new SystemError(e.message, [], e))
    .otherwise((e) => new SystemError(`filesystem unknown error. error: ${e}`));

// パスを結合する関数 (join)
const join = (...parts: string[]): string => {
  return parts
    .filter((part) => typeof part === "string" && part.length > 0) // 空文字を除外
    .join("/")
    .replace(/\/+/g, "/"); // 重複したスラッシュを1つにまとめる
};

// ディレクトリ名を取得する関数 (dirname)
const dirname = (path: string): string =>
  match(path)
    .with("", () => ".")
    .otherwise((p) => {
      const normalized = p.replace(/\/+$/, "");
      const lastSlash = normalized.lastIndexOf("/");

      return match(lastSlash)
        .with(-1, () => ".") // スラッシュがない場合はカレントディレクトリ
        .with(0, () => "/") // ルート直下の場合
        .otherwise((idx) => normalized.substring(0, idx));
    });

// ----------------------------------------------------------------------------
// Adapter Logic
// ----------------------------------------------------------------------------
const writeLocalFile =
  (log: Logger, data: Blob) =>
  (src: string): ResultAsync<string, AppError> =>
    fromPromise(
      (async () => {
        log.info("💾 writeLocalFile 開始");
        const path = `/storage/${src}`;
        log.debug(`path: ${path}`);

        const fullPath = join("./adapter/storage/local", path);
        const dirPath = dirname(fullPath);

        // ディレクトリを再帰的に作成
        // NOTE: cloudflare workers 環境では fs が使えないため、
        //       ビルドエラーが出ないように動的インポートを使用
        const fs = await import("node:fs/promises");
        await fs.mkdir(dirPath, { recursive: true });

        // Blob を Buffer に変換して書き込み
        const arrayBuffer = await data.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await fs.writeFile(fullPath, buffer);

        log.debug(`file written: ${fullPath}`);
        return path;
      })(),
      fsErrorHandling,
    );

// ファイルからファイルパスを作成します
const getFilePath = (file: Blob): Result<string, AppError> =>
  match(file.type)
    .with("image/png", () => ok(`image/${uuidv4()}.png`))
    .with("image/jpeg", () => ok(`image/${uuidv4()}.jpg`))
    .with("image/jpg", () => ok(`image/${uuidv4()}.jpg`))
    .with("image/webp", () => ok(`image/${uuidv4()}.webp`))
    .with("audio/mpeg", () => ok(`audio/${uuidv4()}.mp3`))
    .with("audio/x-m4a", () => ok(`audio/${uuidv4()}.m4a`))
    .with("video/mp4", () => ok(`video/${uuidv4()}.mp4`))
    // .... TODO: 必要に応じて追加
    .otherwise(() =>
      // FIXME
      err(
        new SystemError(
          `サポートされていないファイル形式です: ${file.type || "不明"}`,
        ),
      ),
    );

// ----------------------------------------------------------------------------
// Port 実装
// ----------------------------------------------------------------------------
export const newLocalStorage = (log: Logger): StoragePort => ({
  putObject: (data: Blob) =>
    okAsync(data).andThen(getFilePath).andThen(writeLocalFile(log, data)),
});
