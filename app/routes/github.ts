import { redirect } from "react-router";

export const loader = async () =>
  redirect("https://github.com/nw-union", { status: 307 });
