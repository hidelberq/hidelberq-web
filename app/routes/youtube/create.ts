import type { AppError } from "@nw-union/nw-utils";
import { redirect } from "react-router";
import type { Route } from "./+types/create";

export async function loader() {
  return redirect("/kioku");
}

/**
 * 新規YouTube 作成 ACtion
 */
export async function action({ context, request }: Route.ActionArgs) {
  const { log, wf, auth } = context;

  log.info("🔄 YouTube 作成 Action");

  // 認証チェック
  const userRes = await auth.auth(request);
  if (userRes.isErr()) {
    log.error("認証に失敗しました", userRes.error);
    return new Response("Unauthorized", { status: 401 });
  }

  // フォームデータを取得
  const formData = await request.formData();
  const id = formData.get("id") as string;

  if (!id || id.trim() === "") {
    log.error("IDが空です");
    return new Response("Bad Request", { status: 400 });
  }

  // FIXME: ユーザを取得

  // 新規ドキュメントを作成
  return (
    await wf.youtube.create({
      id: id,
      userId: userRes.value.id, // FIXME: ユーザを取得したら、そのIDを使う
    })
  ).match(
    () => {
      return redirect(`/kioku`);
    },
    (e: AppError) => {
      log.error("YouTube の作成に失敗しました", e);
      return new Response("Internal Server Error", { status: 500 });
    },
  );
}
