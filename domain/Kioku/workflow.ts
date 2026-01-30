import { ResultAsync } from "neverthrow";
import type { KiokuWorkFlows } from "../../type";
import { convertToKiokuDto, mergeAndSortKiokus } from "./logic";
import type {
  DocKiokuRepositoryPort,
  NoteKiokuRepositoryPort,
  YoutubeKiokuRepositoryPort,
} from "./port";

export const newKiokuWorkFlows = (
  d: DocKiokuRepositoryPort,
  s: NoteKiokuRepositoryPort,
  y: YoutubeKiokuRepositoryPort,
): KiokuWorkFlows => ({
  /*
   * Kioku を取得する
   */
  get: () =>
    // Step.1 各キオクを DB から取得
    ResultAsync.combine([d.getAll(), s.getAll(), y.getAll()])
      // Step.2 キオクをマージして作成日時でソート
      .map(mergeAndSortKiokus)
      // Step.3 KiokuDto に変換
      .map((kiokus) => kiokus.map(convertToKiokuDto)),
});
