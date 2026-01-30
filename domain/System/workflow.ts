import type { AppError } from "@nw-union/nw-utils";
import { okAsync, type ResultAsync } from "neverthrow";
import type { SystemWorkFlows } from "../../type";

export const newSystemWorkFlows = (storage: StoragePort): SystemWorkFlows => ({
  // ファイルをアップロードする
  uploadFile: ({ file }) =>
    okAsync(file)
      // Step 1. アップロードする: Blob -> string
      .andThen(storage.putObject)
      // Step 2. イベント発行: string -> UploadFileEvt
      .map((url) => ({ url })),
});

export interface StoragePort {
  putObject(b: Blob): ResultAsync<string, AppError>;
}
