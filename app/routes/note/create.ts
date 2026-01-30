import type { AppError } from "@nw-union/nw-utils";
import { redirect } from "react-router";
import type { Route } from "./+types/create";

export async function loader() {
  return redirect("/kioku");
}

/**
 * 新規 Note 作成 Action
 */
export async function action({ context, request }: Route.ActionArgs) {
  const { log, wf, auth } = context;

  log.info("🔄 Note 作成 Action");

  // 認証チェック
  const userRes = await auth.auth(request);
  if (userRes.isErr()) {
    log.error("認証に失敗しました", userRes.error);
    return new Response("Unauthorized", { status: 401 });
  }

  // フォームデータを取得
  const formData = await request.formData();
  const noteUrl = formData.get("noteUrl") as string;

  if (!noteUrl || noteUrl.trim() === "") {
    log.error("Note URL が空です");
    return new Response("Bad Request", { status: 400 });
  }

  // URL から userId と noteId を抽出
  const match = noteUrl.match(
    /^https:\/\/note\.com\/([^/]+)\/n\/([a-zA-Z0-9]+)$/,
  );
  if (!match) {
    log.error(`無効な Note URL: ${noteUrl}`);
    return new Response("Bad Request", { status: 400 });
  }

  const noteUserId = match[1];
  const noteId = match[2];

  log.debug(`noteUserId: ${noteUserId}, noteId: ${noteId}`);

  // Note 作成ワークフロー実行
  return (
    await wf.note.create({
      noteId: noteId,
      userId: noteUserId,
    })
  ).match(
    () => {
      return redirect("/kioku");
    },
    (e: AppError) => {
      log.error("Note の作成に失敗しました", e);
      return new Response("Internal Server Error", { status: 500 });
    },
  );
}
