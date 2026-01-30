import { redirect } from "react-router";

// note.com へリダイレクトする
export const loader = async () =>
  redirect("https://note.com/nwunion", { status: 307 });
