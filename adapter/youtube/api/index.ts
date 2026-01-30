import { AppError, type Logger, SystemError } from "@nw-union/nw-utils";
import { fromPromise, type ResultAsync } from "neverthrow";
import { match, P } from "ts-pattern";
import type { YoutubePort } from "../../../domain/Youtube/port";
import type { YoutubeInfo } from "../../../domain/Youtube/type";

// ----------------------------------------------------------------------------
// DTO (YouTube API Response Type)
// ----------------------------------------------------------------------------
type YoutubeApiResponse = {
  items?: Array<{
    snippet: {
      title: string;
      channelTitle: string;
      description: string;
    };
    contentDetails: {
      duration: string;
    };
    status: {
      privacyStatus: string;
    };
  }>;
};

// ----------------------------------------------------------------------------
// Utility
// ----------------------------------------------------------------------------
const youtubeErrorHandling = (e: unknown): AppError =>
  match(e)
    .with(P.instanceOf(AppError), (e) => e)
    .with(P.instanceOf(Error), (e) => new SystemError(e.message, [], e))
    .otherwise((e) => new SystemError(`youtube unknown error. error: ${e}`));

// ----------------------------------------------------------------------------
// Adapter Logic
// ----------------------------------------------------------------------------
const fetchInfo =
  (key: string, log: Logger) =>
  (id: string): ResultAsync<YoutubeInfo, AppError> =>
    fromPromise(
      (async () => {
        log.info("📺 YouTube API fetchInfo 開始");
        log.debug(`id: ${id}`);

        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${id}&key=${key}`,
        );
        if (!response.ok) {
          throw new SystemError(
            `YouTube API リクエストに失敗しました: ${response.status} ${response.statusText}`,
          );
        }

        const data = (await response.json()) as YoutubeApiResponse;
        if (!data.items || data.items.length === 0) {
          throw new SystemError(`YouTube 動画が見つかりません: id=${id}`);
        }

        const item = data.items[0];

        return {
          type: "YoutubeInfo",

          title: item.snippet.title,
          channelName: item.snippet.channelTitle,
          description: item.snippet.description,
          duration: item.contentDetails.duration,
          isPublic: item.status.privacyStatus === "public",
        };
      })(),
      youtubeErrorHandling,
    );

// ----------------------------------------------------------------------------
// Port 実装
// ----------------------------------------------------------------------------
export const newYoutubeApi = (key: string, log: Logger): YoutubePort => ({
  fetchInfo: fetchInfo(key, log),
});
