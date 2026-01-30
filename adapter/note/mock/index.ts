import { okAsync } from "neverthrow";
import type { NotePort } from "../../../domain/Note/port";
import type { NoteInfo } from "../../../domain/Note/type";
import type { Url } from "../../../domain/vo";

// ----------------------------------------------------------------------------
// Port 実装
// ----------------------------------------------------------------------------
export const newNoteMock = (): NotePort => ({
  fetchInfo: (_, __) =>
    // 決めうちの値のモックデータを返す
    okAsync({
      type: "NoteInfo",
      title: "Mock Note Title",
      noteUserName: "Mock User",
      url: "https://note.com/mock_user/n/n1234567890ab" as Url,
      thumbnailUrl:
        "https://assets.st-note.com/production/uploads/images/mock.jpg" as Url,
    } as NoteInfo),
});
