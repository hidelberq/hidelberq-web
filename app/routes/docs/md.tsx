import { fromShortUuid } from "@nw-union/nw-utils/lib/uuid";
import { convertToMarkdown } from "../../markdown-converter";
import type { Route } from "./+types/md";

/**
 * ドキュメントのMarkdown出力 Loader
 */
export async function loader({ context, params, request }: Route.LoaderArgs) {
  const { log, wf, auth } = context;

  log.info(`🔄 マークダウン出力 Loader. slug: ${params.slug}`);
  const isLogin = (await auth.auth(request)).isOk();

  // 1. SlugをUUIDに変換
  const idRes = fromShortUuid(params.slug);
  if (idRes.isErr()) {
    log.error(`Invalid slug: ${params.slug}`);
    return new Response("Not Found", { status: 404 });
  }
  const id = idRes.value;

  // 2. ドキュメント取得
  const docRes = await wf.doc.get({ id });
  if (docRes.isErr()) {
    log.error(`ドキュメントの取得に失敗しました: ${params.slug}`, docRes.error);
    return new Response("Not Found", { status: 404 });
  }
  const { doc } = docRes.value;

  // 3. 公開状態チェック
  if (!isLogin && doc.status !== "public") {
    log.warn(`Unauthorized access to private document: ${params.slug}`);
    return new Response("Not Found", { status: 404 });
  }

  // 4. JSON → Markdown 変換
  const markdownRes = convertToMarkdown(doc.body);
  if (markdownRes.isErr()) {
    log.error("マークダウン変換に失敗しました", markdownRes.error);
    return new Response("Internal Server Error", { status: 500 });
  }

  return new Response(markdownRes.value, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
