import { redirect } from "react-router";

// Base へリダイレクトする
export const loader = async () =>
  redirect("https://shop.nw-union.net", { status: 307 });
