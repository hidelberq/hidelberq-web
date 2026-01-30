import type { Kioku } from "../../type";
import type { Route } from "./+types/kioku.feed";

/**
 * Kioku RSS Feed
 *
 * Allタブと同じ内容をRSS 2.0形式で提供
 */
export async function loader({ context, request }: Route.LoaderArgs) {
  const { log, wf, auth, cloudflare } = context;

  log.info("🔄 Kioku RSS Feed");

  // 認証チェック: ユーザーログインまたはトークン認証
  const userRes = await auth.auth(request);
  const isAuthenticated = userRes.isOk();

  if (!isAuthenticated) {
    // ユーザー未認証の場合、トークン認証を試行
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    const validToken = cloudflare.env.RSS_TOKEN;

    if (token !== validToken) {
      log.warn("Kioku RSS Feed: 認証失敗 - 無効なトークンまたは未認証");
      return new Response("Unauthorized", { status: 401 });
    }

    log.info("Kioku RSS Feed: トークン認証成功");
  } else {
    log.info("Kioku RSS Feed: ユーザー認証成功");
  }

  // キオク一覧を取得
  const kiokusResult = await wf.kioku.get();

  if (kiokusResult.isErr()) {
    log.error("キオク一覧の取得に失敗しました", kiokusResult.error);
    return new Response("Failed to generate RSS feed", { status: 500 });
  }

  const kiokus = kiokusResult.value;

  // RSS 2.0 フォーマットで生成
  const rssXml = generateRssFeed(kiokus);

  return new Response(rssXml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600", // 1時間キャッシュ
    },
  });
}

function generateRssFeed(kiokus: Kioku[]): string {
  const siteUrl = "https://nw-union.net";
  const feedUrl = `${siteUrl}/kioku/feed`;
  const kiokuUrl = `${siteUrl}/kioku`;
  const buildDate = new Date().toUTCString();

  // 最新の記事の日付を取得
  const latestDate =
    kiokus.length > 0 ? kiokus[0].createdAt.toUTCString() : buildDate;

  const items = kiokus
    .map((kioku) => {
      const categoryLabel = getCategoryLabel(kioku.category);
      const description = escapeXml(
        `${categoryLabel} by ${kioku.name}${kioku.duration ? ` (${kioku.duration})` : ""}`,
      );

      return `    <item>
      <title>${escapeXml(kioku.title)}</title>
      <link>${escapeXml(kioku.url)}</link>
      <guid isPermaLink="${kioku.category === "doc"}">${escapeXml(kioku.url)}</guid>
      <pubDate>${kioku.createdAt.toUTCString()}</pubDate>
      <description>${description}</description>
      <category>${escapeXml(categoryLabel)}</category>
      ${kioku.thumbnailUrl ? `<enclosure url="${escapeXml(kioku.thumbnailUrl)}" type="image/jpeg" />` : ""}
    </item>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Kioku | NWU</title>
    <link>${kiokuUrl}</link>
    <description>生きられた時間 - NWUの記憶の記録</description>
    <language>ja</language>
    <lastBuildDate>${buildDate}</lastBuildDate>
    <pubDate>${latestDate}</pubDate>
    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>`;
}

function getCategoryLabel(category: Kioku["category"]): string {
  switch (category) {
    case "doc":
      return "Doc";
    case "note":
      return "Note";
    case "youtube":
      return "YouTube";
    case "privateYoutube":
      return "Private YouTube";
  }
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
