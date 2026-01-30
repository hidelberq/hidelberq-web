import { okAsync, ResultAsync } from "neverthrow";
import type { YoutubeWorkFlows } from "../../type";
import type { TimePort } from "../port";
import { newYoutubeId } from "../vo";
import { createYoutube } from "./logic";
import type { YoutubePort, YoutubeRepositoryPort } from "./port";

export const newYoutubeWorkFlows = (
  r: YoutubeRepositoryPort,
  y: YoutubePort,
  t: TimePort,
): YoutubeWorkFlows => ({
  /**
   * Youtube 作成
   */
  create: ({ id }) =>
    okAsync(id)
      // Step.1 検証: string -> YoutubeId
      .andThen(newYoutubeId)
      // Step.2 Youtube 情報取得 & 現在日時取得 (並列実行)
      //   YoutubeId -> [YoutubeId, YoutubeInfo, Date]
      .andThen((youtubeId) =>
        ResultAsync.combine([
          okAsync(youtubeId), // YoutubeId をそのまま渡す
          y.fetchInfo(youtubeId), // YoutubeId -> YoutubeInfo
          t.getNow(), // 現在日時取得
        ]),
      )
      // Step.3 Youtube 作成
      //   [YoutubeId, YoutubeInfo, Date] -> Youtube
      .map(createYoutube)
      // Step.4 Youtube 保存
      .andThrough(r.upsert)
      // Step.5 イベント生成
      .map((youtube) => ({ id: youtube.id })),
});
