import { Link, useLocation } from "react-router";

interface BreadcrumbProps {
  currentTitle: string;
}

interface Breadcrumb {
  title: string;
  url: string | null;
}

export function Breadcrumb({ currentTitle }: BreadcrumbProps) {
  const location = useLocation();
  const pathname = location.pathname;

  // パンくずリスト生成ロジック
  const breadcrumbs: Breadcrumb[] = [];

  if (pathname.startsWith("/docs")) {
    breadcrumbs.push({ title: "TOP", url: "/" });
    // /docs ページの場合はDocsをリンクなしに、それより深い場合はリンクありに
    const isDocsRoot = pathname === "/docs" || pathname === "/docs/";
    breadcrumbs.push({ title: "Docs", url: isDocsRoot ? null : "/docs" });

    // 現在のページが /docs 自体でない場合は、現在のページタイトルを追加
    if (!isDocsRoot) {
      breadcrumbs.push({ title: currentTitle, url: null }); // 現在のページはリンクなし
    }
  }

  if (breadcrumbs.length === 0) {
    return null;
  }

  return (
    <nav
      className="mb-2 text-sm text-gray-600 dark:text-gray-400"
      aria-label="breadcrumb navigation"
    >
      {breadcrumbs.map((crumb, index) => (
        <span key={crumb.title}>
          {crumb.url ? (
            <Link
              to={crumb.url}
              className="text-blue-600 dark:text-cyan-400 hover:text-blue-700 dark:hover:text-cyan-300 hover:underline transition-colors"
            >
              {crumb.title}
            </Link>
          ) : (
            <span className="text-gray-800 dark:text-gray-300">
              {crumb.title}
            </span>
          )}
          {index < breadcrumbs.length - 1 && <span className="mx-2">＞</span>}
        </span>
      ))}
    </nav>
  );
}
