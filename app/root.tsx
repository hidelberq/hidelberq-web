import type React from "react";
import type { MetaFunction } from "react-router";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigation,
  useRouteLoaderData,
} from "react-router";
import type { Route } from "./+types/root.ts";
import { FooterNav } from "./components/FooterNav";
import { createThemeCookie, getThemeFromCookie, type Theme } from "./util";

import "./app.css";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Sawarabi+Gothic&family=VT323&family=DotGothic16&display=swap",
  },
  { rel: "manifest", href: "/manifest.json" },
  // iOS用のアイコン設定
  { rel: "apple-touch-icon", href: "/icon-152.png" },
  { rel: "apple-touch-icon", sizes: "180x180", href: "/icon-180.png" },
];

export async function loader({ context, request }: Route.LoaderArgs) {
  const { auth } = context;
  const isAuthenticated = (await auth.auth(request)).isOk();
  const cookieHeader = request.headers.get("Cookie");
  const theme = getThemeFromCookie(cookieHeader) ?? "dark";
  return { isAuthenticated, theme };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const theme = formData.get("theme") as Theme;

  if (theme !== "light" && theme !== "dark") {
    return new Response("Invalid theme", { status: 400 });
  }

  return new Response(null, {
    status: 200,
    headers: {
      "Set-Cookie": createThemeCookie(theme),
    },
  });
}

export const meta: MetaFunction = () => {
  return [
    { charset: "utf-8" },
    { title: "nw-union.net" },
    {
      name: "viewport",
      content: "width=device-width,initial-scale=1",
    },

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
};

export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");
  const theme = data?.theme ?? "dark";

  return (
    <html lang="ja" className={theme === "dark" ? "dark" : ""}>
      <head>
        <Meta />
        <Links />
      </head>
      <body className="bg-white dark:bg-gray-900 leading-relaxed text-base w-full mx-auto text-zinc-900 dark:text-zinc-100 transition-colors duration-300">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  const data = useRouteLoaderData<typeof loader>("root");
  const isAuthenticated = data?.isAuthenticated ?? false;
  const navigation = useNavigation();
  const isNavigating = navigation.state !== "idle";

  return (
    <>
      {/* ローディング画面 */}
      {isNavigating && (
        <div className="fixed inset-0 bg-white dark:bg-gray-900 flex items-center justify-center z-50 transition-colors duration-300">
          <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
        </div>
      )}

      <Outlet />

      {/* フッターナビゲーション (ログイン時のみ) */}
      {isAuthenticated && <FooterNav />}
    </>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
