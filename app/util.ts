/**
 * ページのメタタグを生成する
 *
 * @param title - ページタイトル
 * @param description - ページの説明（オプション）
 * @returns メタタグの配列
 */
export const createMetaTags = ({
  title,
  description,
}: {
  title: string;
  description?: string;
}) => {
  const tags = [
    { charset: "utf-8" },
    { title },
    { name: "viewport", content: "width=device-width,initial-scale=1" },
    // iPhoneホーム画面追加時の全画面表示設定
    {
      name: "apple-mobile-web-app-capable",
      content: "yes",
    },
    {
      name: "apple-mobile-web-app-status-bar-style",
      content: "black-translucent",
    },
  ];

  // description が提供されている場合にメタタグを追加
  if (description) {
    tags.push({ name: "description", content: description });
  }

  return tags;
};

export type Theme = "light" | "dark";
const THEME_COOKIE_NAME = "theme";

/**
 * Cookie ヘッダーからテーマ設定を取得する
 *
 * @param cookieHeader - Cookie ヘッダー文字列
 * @returns テーマ（"light" または "dark"）、見つからない場合は null
 */
export function getThemeFromCookie(cookieHeader: string | null): Theme | null {
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const themeCookie = cookies.find((c) =>
    c.startsWith(`${THEME_COOKIE_NAME}=`),
  );

  if (!themeCookie) return null;

  const theme = themeCookie.split("=")[1];
  return theme === "light" || theme === "dark" ? theme : null;
}

/**
 * テーマ設定を保存する Cookie 文字列を生成する
 *
 * @param theme - 設定するテーマ（"light" または "dark"）
 * @returns Set-Cookie ヘッダー用の Cookie 文字列（有効期限1年）
 */
export const createThemeCookie = (theme: Theme): string =>
  `${THEME_COOKIE_NAME}=${theme}; Path=/; Max-Age=31536000; SameSite=Lax`;
