import { redirect } from "react-router";
import type { Route } from "./+types/signin";

export async function loader({ context, request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const redirectUrl = url.searchParams.get("redirectUrl");

  const headers = new Headers();
  if (context.cloudflare.env.AUTH_ADAPTER === "mock") {
    // モックアダプターの場合はデバッグ用にログイン用クッキーをセット
    headers.append(
      "Set-Cookie",
      "Mock_Authorization=mock@nw-union.net; Path=/; Max-Age=3000; HttpOnly; Secure; SameSite=None",
    );
  }

  return redirect(redirectUrl ?? "/", { headers });
}
