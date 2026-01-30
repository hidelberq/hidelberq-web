import { redirect } from "react-router";

// YouTube へリダイレクトする
export const loader = async () =>
  redirect("https://www.youtube.com/@nw-union", { status: 307 });
