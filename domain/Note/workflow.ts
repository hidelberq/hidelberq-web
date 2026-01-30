import { okAsync, ResultAsync } from "neverthrow";
import type { NoteWorkFlows } from "../../type";
import type { TimePort } from "../port";
import { createNote } from "./logic";
import type { NotePort, NoteRepositoryPort } from "./port";

export const newNoteWorkFlows = (
  r: NoteRepositoryPort,
  n: NotePort,
  t: TimePort,
): NoteWorkFlows => ({
  /**
   * Note 作成
   */
  create: ({ noteId, userId }) =>
    okAsync(noteId)
      // Step.1 Note 情報取得 & 現在日時取得 (並列実行)
      //   string -> [NoteInfo, Date]
      .andThen((id) =>
        ResultAsync.combine([
          n.fetchInfo(id, userId), // string, string -> NoteInfo
          t.getNow(), // 現在日時取得
        ]),
      )
      // Step.3 Note 作成
      //   [NoteId, NoteInfo, Date] -> Note
      .map(createNote)
      // Step.4 Note 保存
      .andThrough(r.upsert)
      // Step.5 イベント生成
      .map((note) => ({ id: note.id })),
});
