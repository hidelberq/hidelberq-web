import { Link, redirect, useSubmit } from "react-router";
import { EditIcon, UserIcon } from "../components/Icons";
import { ThemeToggle } from "../components/ThemeToggle";
import { useImageUpload } from "../hooks/useImageUpload";
import { createMetaTags } from "../util";
import type { Route } from "./+types/you";

/**
 * 個人ページ Loader
 *
 */
export async function loader({ context, request }: Route.LoaderArgs) {
  const { log, auth, wf } = context;

  log.info("🔄 個人ページ Loader");

  // ログイン状態の確認
  const userRes = await auth.auth(request);
  if (userRes.isErr()) {
    log.error("認証に失敗しました", userRes.error);
    // signin して, you に戻ってくる
    return redirect("/signin?redirectUrl=/you");
  }

  return await wf.user
    .get({ id: userRes.value.id, email: userRes.value.mail })
    .match(
      (evt) => evt.user,
      (err) => {
        log.error("ユーザ情報の取得に失敗しました", err);
        return redirect("/");
      },
    );
}

/**
 * 個人ページ Action
 *
 * プロフィール画像のアップロードを処理
 */
export async function action({ context, request }: Route.ActionArgs) {
  const { log, auth, wf } = context;

  log.info("🔄 プロフィール画像 Action");

  // ログイン状態の確認
  const userRes = await auth.auth(request);
  if (userRes.isErr()) {
    log.error("認証に失敗しました", userRes.error);
    return new Response("Unauthorized", { status: 401 });
  }
  const authUser = userRes.value;

  // 現在のユーザーデータを取得
  const currentUserRes = await wf.user.get({
    id: authUser.id,
    email: authUser.mail,
  });
  if (currentUserRes.isErr()) {
    log.error("ユーザー情報の取得に失敗しました", currentUserRes.error);
    return new Response("Internal Server Error", { status: 500 });
  }
  const currentUser = currentUserRes.value.user;

  // フォームデータを解析
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  // intent に応じて処理を分岐
  if (intent === "update-image") {
    const imgUrl = formData.get("imgUrl") as string;

    if (!imgUrl) {
      log.error("画像URLが見つかりません");
      return new Response("Bad Request", { status: 400 });
    }

    // ユーザー情報を更新
    return await wf.user
      .update({
        id: authUser.id,
        name: currentUser.name,
        imgUrl: imgUrl,
        discord: currentUser.discord,
        github: currentUser.github,
      })
      .match(
        () => {
          log.info("✅ プロフィール画像の更新に成功しました");
          return redirect("/you");
        },
        (e) => {
          log.error("プロフィール画像の更新に失敗しました", e);
          return new Response("Internal Server Error", { status: 500 });
        },
      );
  }

  log.error(`不正なintent: ${intent}`);
  return new Response("Bad Request", { status: 400 });
}

export const meta = (_: Route.MetaArgs) =>
  createMetaTags({
    title: "You | NWU",
  });

export default function Show({ loaderData }: Route.ComponentProps) {
  const user = loaderData;
  const submit = useSubmit();

  const {
    isUploading,
    fileInputRef,
    triggerFileSelect: handleIconClick,
    handleFileChange,
    acceptedTypes,
  } = useImageUpload({
    onSuccess: (imgUrl) => {
      const updateFormData = new FormData();
      updateFormData.append("intent", "update-image");
      updateFormData.append("imgUrl", imgUrl);
      submit(updateFormData, { method: "post" });
    },
  });

  return (
    <main className="bg-white dark:bg-gray-900 min-h-screen pb-20 flex flex-col justify-start items-center p-8 pt-10 md:pt-16 transition-colors duration-300 font-sg">
      <div className="max-w-md w-full">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-8 transition-colors duration-300">
          <div className="flex flex-col items-center">
            {/* ---------------- Profile Icon ---------------- */}
            <div className="relative mb-6">
              <div className="w-24 h-24 rounded-full">
                {user.imgUrl ? (
                  <img
                    src={user.imgUrl}
                    alt={user.name}
                    className="w-full h-full rounded-full object-cover shadow-md"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-green-400 to-cyan-500 dark:from-green-500 dark:to-cyan-600 flex items-center justify-center shadow-md">
                    <UserIcon className="w-14 h-14 text-white stroke-[1.5]" />
                  </div>
                )}
              </div>

              {/* Edit button */}
              <button
                type="button"
                onClick={handleIconClick}
                className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center shadow-lg transition-all duration-200 border border-gray-400 dark:border-gray-600 hover:scale-110"
                title="プロフィール画像を変更"
              >
                <EditIcon className="w-4 h-4" />
              </button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes}
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* ---------------- User Info ---------------- */}
            <div className="text-center mb-8">
              <h1 className="text-xl font-medium text-gray-900 dark:text-gray-100 mb-2">
                {user.name}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {user.email}
              </p>
            </div>

            {/* ---------------- Theme Toggle ---------------- */}
            <div className="w-full mb-4">
              <ThemeToggle />
            </div>

            {/* ---------------- Logout Button ---------------- */}
            <Link
              to="/signout"
              reloadDocument
              className="w-full px-6 py-3 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors duration-200 text-center border border-gray-300 dark:border-gray-600"
            >
              Sign Out
            </Link>
          </div>
        </div>
      </div>

      {/* ---------------- Loading Overlay (ファイルアップロード中のみ) ---------------- */}
      {isUploading && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-50 transition-colors duration-300">
          <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
        </div>
      )}
    </main>
  );
}
