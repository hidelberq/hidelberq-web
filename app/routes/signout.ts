import { redirect } from "react-router";
import { match } from "ts-pattern";
import type { Route } from "./+types/signout";

export async function loader({ context }: Route.LoaderArgs) {
  // CF_Authorization クッキーを削除するレスポンスヘッダーを設定
  const headers = new Headers();

  match(context.cloudflare.env.AUTH_ADAPTER)
    .with("cloudflare", () => {
      // Cloudflare アダプターの場合は SameSite=None を指定
      headers.append(
        "Set-Cookie",
        "CF_Authorization=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None",
      );
    })
    .with("mock", () => {
      // モックアダプターの場合は SameSite=Lax を指定
      headers.append(
        "Set-Cookie",
        "Mock_Authorization=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None",
      );
    });

  // サインアウト後はホームにリダイレクト
  return redirect("/", { headers });
}
