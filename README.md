# hidelberq.com

個人サイト [hidelberq.com](https://hidelberq.com) のソースコードです。

Cloudflare Workers 上で動作する React Router v7 の SSR アプリケーションで、Drizzle ORM + Cloudflare D1 によるデータ永続化、Google Gemini AI を活用した自動コンテンツ生成など、エッジコンピューティングの特性を活かした構成になっています。

## 技術スタック

| カテゴリ | 技術 |
|----------|------|
| フレームワーク | React Router v7 (SSR) |
| ランタイム / デプロイ | Cloudflare Workers |
| データベース | Cloudflare D1 (SQLite) + Drizzle ORM |
| スタイリング | Tailwind CSS v4 |
| AI | Google Gemini |
| 言語 | TypeScript (strict) |
| パッケージマネージャー | Bun |
| CI/CD | GitHub Actions → Cloudflare Workers |

## 機能一覧

### AItter — AI 生成 SNS タイムライン

ニュースサイトを定期スクレイピングし、Google Gemini が記事を読み込んでツイート風の投稿を自動生成します。複数の AI キャラクターがそれぞれ異なる視点でコメントする仕組みです。

- Cron トリガーによる定期実行 (スクレイピング → AI 要約 → 投稿生成)
- `node-html-parser` でのサイト別パーサー実装
- 記事 URL のユニーク制約による自動重複排除

### 将棋 — オンライン / ローカル対戦

9x9 標準将棋と 5x5 ミニ将棋の両方に対応。ルームコードを共有してオンライン対戦が可能です。

- 駒の移動ルール、成り、王手・詰み判定をフルスクラッチで実装
- ゲーム状態を D1 に JSON で永続化し、React Router の action で手を送信
- 標準将棋 / ミニ将棋でロジックを分離しつつ UI コンポーネントを共通化

### ヒーロー画像 — AI 日替わり画像生成

毎朝 Cron で Gemini AI がヒーロー画像を自動生成し、Cloudflare R2 に保存してトップページに表示します。Workflowy の日記データや天気情報をソースにしています。

### 積読管理 (tsundoku 2.0) — グループ読書管理アプリ

グループでの積読リスト管理、書籍レビュー、読書状況の共有ができる SNS 風の読書管理機能です。

- Google Books API 連携による書籍検索・自動情報取得
- 招待コードでのグループ参加
- レビュー・アクティビティフィードの SNS 機能
- カメラで書影を撮影し AI で書籍を認識・登録

### ライフチャート — 人生の充実度を可視化

年齢ごとの出来事と充実度スコアを記録し、折れ線グラフで人生の推移を可視化するツールです。

### 社会リズム療法 — 行動記録票

日々の活動・気分・対人関係を記録し、社会リズムの安定化を支援するツールです。

### その他

- **ザ・ワーク**: バイロン・ケイティのワークシートをデジタル化した内省支援ツール
- **空白除去**: AI 文字起こしの余計な空白を除去し、句読点を補正するユーティリティ
- **日替わり Hiphop トラック**: Gemini + Suno API で毎日 Hiphop トラックを自動生成
- **PWA 対応**: Service Worker によるオフライン対応、インストールバナー

## アーキテクチャ

```
├── app/                  # React Router アプリケーション
│   ├── routes/           # ルートコンポーネント (loader/action + UI)
│   ├── db/schema.ts      # Drizzle ORM スキーマ定義
│   ├── shogi/            # 将棋エンジン (ルール実装 + UI)
│   ├── life-chart/       # ライフチャートコンポーネント
│   └── root.tsx          # ルートレイアウト
├── workers/              # Cloudflare Workers
│   ├── app.ts            # HTTP ハンドラー + Cron ディスパッチ
│   ├── hero-image.ts     # ヒーロー画像生成 (Gemini AI)
│   ├── aitter-cron.ts    # AI ツイート生成 (Gemini AI)
│   ├── hiphop-cron.ts    # Hiphop トラック生成 (Gemini + Suno)
│   └── scraper/          # ニューススクレイピング
├── drizzle/              # マイグレーション SQL (自動生成)
└── .github/workflows/    # CI/CD
```

### データアクセス

ルートの `loader` / `action` 内で Drizzle ORM を直接使用するシンプルな構成です。

```typescript
export async function loader({ context }: Route.LoaderArgs) {
  const db = drizzle(context.cloudflare.env.DB);
  return { data: await db.select().from(table).orderBy(desc(col)).limit(10) };
}
```

### Cron ジョブ

Cloudflare Workers の Cron Triggers で定期タスクを実行しています。

| ジョブ | スケジュール | 内容 |
|--------|-------------|------|
| ヒーロー画像 + Hiphop 生成 | 毎朝 6:00 (JST) | Gemini AI で画像・音楽を自動生成 |
| スクレイピング + AItter | 1日4回 | ニュース収集 → AI ツイート生成 |

## 開発

```bash
# セットアップ
bun install --frozen-lockfile

# 開発サーバー
bun run dev          # http://localhost:5173

# 型チェック
bun run typecheck

# ビルド & デプロイ
bun run deploy
```

## ライセンス

このリポジトリは個人プロジェクトのソースコードです。コードの閲覧・参考は自由ですが、そのままの利用・再配布はご遠慮ください。
