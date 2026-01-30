import { AppError, type Logger, SystemError } from "@nw-union/nw-utils";
import { fromPromise, Result, type ResultAsync } from "neverthrow";
import { match, P } from "ts-pattern";
import type { NotePort } from "../../../domain/Note/port";
import type { NoteInfo } from "../../../domain/Note/type";
import { newUrl, newUrlOrNone } from "../../../domain/vo";

// ----------------------------------------------------------------------------
// DTO (OGP API Response Type)
// ----------------------------------------------------------------------------
type OgpApiResponse = {
  url?: string;
  og?: {
    title?: string;
    image?: string;
  };
};

// ----------------------------------------------------------------------------
// Utility
// ----------------------------------------------------------------------------
const noteErrorHandling = (e: unknown): AppError =>
  match(e)
    .with(P.instanceOf(AppError), (e) => e)
    .with(P.instanceOf(Error), (e) => new SystemError(e.message, [], e))
    .otherwise((e) => new SystemError(`note unknown error. error: ${e}`));

// ----------------------------------------------------------------------------
// Adapter Logic
// ----------------------------------------------------------------------------
const fetchInfo =
  (log: Logger) =>
  (noteId: string, userId: string): ResultAsync<NoteInfo, AppError> =>
    fromPromise(
      (async () => {
        log.info("📝 Note API fetchInfo 開始");
        log.debug(`noteId: ${noteId}, userId: ${userId}`);

        // Step 1: ユーザ情報の取得
        const userResponse = await fetch(
          `https://ogp.nw-union.net/api?url=https://note.com/${userId}`,
        );
        if (!userResponse.ok) {
          throw new SystemError(
            `OGP API リクエストに失敗しました (ユーザ情報): ${userResponse.status} ${userResponse.statusText}`,
          );
        }
        const userData = (await userResponse.json()) as OgpApiResponse;
        const rawUserName = userData.og?.title;
        if (!rawUserName) {
          throw new SystemError(
            `OGP API からユーザ名を取得できませんでした: userId=${userId}`,
          );
        }
        // "XXXX｜note" から "｜note" を除去
        const noteUserName = rawUserName.replace(/｜note$/, "");

        // Step 2: 記事情報の取得
        const noteResponse = await fetch(
          `https://ogp.nw-union.net/api?url=https://note.com/${userId}/n/${noteId}`,
        );
        if (!noteResponse.ok) {
          throw new SystemError(
            `OGP API リクエストに失敗しました (記事情報): ${noteResponse.status} ${noteResponse.statusText}`,
          );
        }
        const noteData = (await noteResponse.json()) as OgpApiResponse;

        const url = noteData.url;
        if (!url) {
          throw new SystemError(
            `OGP API から記事URLを取得できませんでした: noteId=${noteId}`,
          );
        }

        const rawTitle = noteData.og?.title;
        if (!rawTitle) {
          throw new SystemError(
            `OGP API から記事タイトルを取得できませんでした: noteId=${noteId}`,
          );
        }
        // "XXXX｜${noteUserName}" から "｜${noteUserName}" を除去 (正規表現で末尾のみマッチ)
        const escapedUserName = noteUserName.replace(
          /[.*+?^${}()|[\]\\]/g,
          "\\$&",
        );
        const title = rawTitle.replace(new RegExp(`｜${escapedUserName}$`), "");

        const thumbnailUrl = noteData.og?.image ?? null;

        // Step 3: NoteInfo を整形 (URL を Url 型に変換)
        const result = Result.combine([
          newUrl(url, "NoteInfo.url"),
          newUrlOrNone(thumbnailUrl, "NoteInfo.thumbnailUrl"),
        ]).map(([validatedUrl, validatedThumbnailUrl]) => ({
          type: "NoteInfo" as const,
          title,
          noteUserName,
          url: validatedUrl,
          thumbnailUrl: validatedThumbnailUrl,
        }));

        if (result.isErr()) {
          throw result.error;
        }

        return result.value;
      })(),
      noteErrorHandling,
    );

// ----------------------------------------------------------------------------
// Port 実装
// ----------------------------------------------------------------------------
export const newNoteApi = (log: Logger): NotePort => ({
  fetchInfo: fetchInfo(log),
});
