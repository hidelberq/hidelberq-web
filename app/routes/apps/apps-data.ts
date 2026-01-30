export const APPS_DATA = [
  {
    name: "BeTree",
    description: "気になるイベント管理ツール",
    url: "https://betree.nw-union.net",
    source: "https://github.com/nw-union/betree",
    icon: "🌳",
    status: "development" as const,
  },
  {
    name: "Hypomnema",
    description: "自己の記録 / 覚え書き のためのエディタ",
    url: "https://hypomnema.nw-union.net",
    source: "https://github.com/nw-union/hypomnema",
    icon: "📑",
    status: "live" as const,
  },
  {
    name: "Weekly Contents",
    description: "コンテンツの排泄場所（更新停止中）",
    url: "https://wc.nw-union.net",
    source: "https://github.com/nw-union/weeklycontents",
    icon: "🧻",
    status: "live" as const,
  },
  {
    name: "Ogp API",
    description: "外部サイトの OGP の情報を取得する API",
    url: "https://ogp.nw-union.net",
    source: "https://github.com/nw-union/ogp",
    icon: "🔧",
    status: "live" as const,
  },
  {
    name: "nw-union.net",
    description: "シンプルなランディングページ。ドキュメント置き場。",
    url: "https://nw-union.net",
    source: "https://github.com/nw-union/web",
    icon: "🌐",
    status: "live" as const,
  },
] as const;

export type AppData = (typeof APPS_DATA)[number];
