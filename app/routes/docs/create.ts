import { toShortUuid } from "@nw-union/nw-utils/lib/uuid";
import { redirect } from "react-router";
import type { Route } from "./+types/create";

export async function loader() {
  return redirect("/kioku");
}

/**
 * 新規ドキュメント作成 Action
 */
export async function action({ context, request }: Route.ActionArgs) {
  const { log, wf, auth } = context;

  log.info("🔄 ドキュメント作成 Action");

  // 認証チェック
  const userRes = await auth.auth(request);
  if (userRes.isErr()) {
    log.error("認証に失敗しました", userRes.error);
    return new Response("Unauthorized", { status: 401 });
  }

  // フォームデータを取得
  const formData = await request.formData();
  const title = formData.get("title") as string;

  if (!title || title.trim() === "") {
    log.error("タイトルが空です");
    return new Response("Bad Request", { status: 400 });
  }

  // FIXME: ユーザを取得

  // 新規ドキュメントを作成
  return (
    await wf.doc.create({
      title: title,
      userId: userRes.value.id, // FIXME: ユーザを取得したら、そのIDを使う
    })
  ).match(
    ({ id }) => {
      const slugRes = toShortUuid(id);
      if (slugRes.isErr()) {
        log.error("SlugへのUUID変換に失敗しました");
        return new Response("Internal Server Error", { status: 500 });
      }
      return redirect(`/docs/${slugRes.value}/edit`);
    },
    (e) => {
      log.error("ドキュメントの作成に失敗しました", e);
      return new Response("Internal Server Error", { status: 500 });
    },
  );
}
