# CLAUDE.md

このファイルは Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## 言語ルール

**すべてのコミュニケーションは日本語で行うこと。** 以下を含む:

- Claude とのチャット応答
- Git コミットメッセージ
- Pull Request のタイトルと説明
- コードレビューコメント
- コード内コメント (ただし変数名・関数名等の識別子は英語のまま)

## プロジェクト概要

hidelberq.com の個人サイト。Cloudflare Workers にデプロイされた React Router v7 SSR アプリケーションで、Drizzle ORM が Cloudflare D1 (SQLite) データベースを管理しています。

### 主な機能

- **ポートフォリオ**: スキル、タイムライン、NWU 関連コンテンツを含むトップページ
- **AItter**: Google Gemini AI がニュースを読んでツイート風の投稿を生成する SNS タイムライン
- **将棋**: 9x9 標準将棋とミニ将棋 (5x5) のオンライン・ローカル対戦
- **ヒーロー画像**: Gemini AI が毎朝自動生成する日替わりヒーロー画像 (Workflowy 日記 or 天気ベース)
- **空白除去**: AI 文字起こしの余計な空白・句読点を補正するツール
- **ニューススクレイピング**: 定期的にニュースサイトをスクレイピングし、AItter の素材として活用

## 開発ツール

- **ランタイム**: Bun (パッケージマネージャー兼ランタイム)
- **フレームワーク**: React Router v7 (SSR 有効)
- **デプロイ先**: Cloudflare Workers
- **データベース**: Drizzle ORM + Cloudflare D1 (SQLite)
- **スタイリング**: Tailwind CSS v4 (`@tailwindcss/vite` プラグイン) + `@tailwindcss/typography`
- **AI**: Google Gemini (`@google/genai`, `@google/generative-ai`)
- **TypeScript**: strict モード、`verbatimModuleSyntax` 有効
- **スクレイピング**: `node-html-parser` で HTML パース
- **日本語処理**: `budoux` で日本語テキストセグメンテーション
- **Markdown**: `react-markdown` + `remark-gfm`

## 開発コマンド

### セットアップ・開発
```bash
# 依存関係のインストール
bun install --frozen-lockfile

# 開発サーバー起動 (React Router dev + HMR)
bun run dev
# http://localhost:5173 で起動

# 本番ビルドのローカルプレビュー
bun run preview
```

### コード品質
```bash
# 型チェック (Wrangler 型生成 → React Router 型生成 → tsc)
bun run typecheck
```

### ビルド・デプロイ
```bash
# 本番ビルド
bun run build

# ビルド + Cloudflare Workers へデプロイ
bun run deploy
```

### データベース操作
```bash
# スキーマ変更からマイグレーションファイルを生成
bun run db:generate

# ローカル D1 にマイグレーション適用
bun run db:migrate:local

# 本番 D1 にマイグレーション適用
bun run db:migrate:production

# Wrangler バインディングの TypeScript 型を生成
bun run typegen
```

## アーキテクチャ

### ディレクトリ構成

```
├── app/                            # React Router アプリケーション
│   ├── db/schema.ts               # Drizzle ORM テーブル定義 (単一ファイル)
│   ├── entry.server.tsx           # SSR エントリーポイント
│   ├── root.tsx                   # ルートレイアウト、メタ、エラーバウンダリー
│   ├── routes.ts                  # ルート設定 (集中定義)
│   ├── app.css                    # グローバル Tailwind スタイル
│   ├── routes/                    # ルートコンポーネント (loader + UI)
│   ├── shogi/                     # 将棋エンジン・盤面コンポーネント
│   ├── whitespace-remover/        # 日本語句読点ユーティリティ
│   └── welcome/                   # ウェルカムページアセット
├── workers/                        # Cloudflare Workers エントリー・Cron ジョブ
│   ├── app.ts                     # メイン Worker: HTTP ハンドラー + Cron ディスパッチ
│   ├── hero-image.ts              # 日替わりヒーロー画像生成 (Gemini AI)
│   ├── aitter-cron.ts            # AI ツイート生成 (Gemini AI)
│   ├── news-scrape-cron.ts        # ニューススクレイピングスケジューラー
│   └── scraper/                   # スクレイピングライブラリ (パーサー、サイト設定)
├── drizzle/                        # マイグレーション SQL ファイル (自動生成)
├── public/                         # 静的アセット (favicon)
└── .github/workflows/              # CI/CD (typecheck → build → deploy)
```

### データアクセスパターン

ルートの `loader` / `action` 内で Drizzle ORM を直接使用。リポジトリパターンや DI は使用していない。

```typescript
// 典型的なパターン: route loader で直接 DB アクセス
export async function loader({ context }: Route.LoaderArgs) {
  const db = drizzle(context.cloudflare.env.DB);
  const results = await db.select().from(tableName).orderBy(desc(col)).limit(n);
  return { results };
}
```

### データベーススキーマ (`app/db/schema.ts`)

全テーブルを単一ファイルで定義:

| テーブル | 用途 |
|----------|------|
| `tweets` | AI 生成ツイート (content, author, category, engagement metrics, displayed flag) |
| `shogiGames` | 将棋ゲーム状態 (board/captured を JSON で保存, player IDs, status, move count) |
| `heroImages` | 日替わりヒーロー画像 (date, R2 key, prompt, source) |
| `newsCache` | ニュースコンテキストキャッシュ (日次) |
| `scrapeSites` | スクレイパーサイト設定 (siteId, url, parserId) |
| `scrapedArticles` | スクレイピング済み記事 (articleUrl unique, usedForTweet flag) |

**スキーマ変更後**: `bun run db:generate` → `bun run db:migrate:local` の順で実行。

### ルート定義 (`app/routes.ts`)

```
/                              → home.tsx (ポートフォリオトップ)
/aitter                        → aitter.tsx (AI タイムライン)
/debug                         → debug.tsx (デバッグページ、noindex)
/hero-image/:date              → hero-image.ts (R2 からヒーロー画像を返す loader)
/whitespace-remover            → whitespace-remover.tsx (空白除去ツール)
/shogi                         → shogi.tsx (将棋トップ)
/shogi/local                   → shogi.local.tsx (ローカル対戦 9x9)
/shogi/game/:gameId            → shogi.game.tsx (オンライン対戦 9x9)
/shogi/minishogi/local         → shogi.minishogi-local.tsx (ミニ将棋ローカル)
/shogi/minishogi/game/:gameId  → shogi.minishogi-game.tsx (ミニ将棋オンライン)
```

### Cloudflare Workers エントリー (`workers/app.ts`)

`fetch` ハンドラーで React Router SSR リクエストを処理し、`scheduled` ハンドラーで Cron ジョブをディスパッチ:

| Cron | スケジュール | Worker |
|------|-------------|--------|
| ヒーロー画像生成 | `0 21 * * *` (JST 06:00) | `hero-image.ts` |
| AItter ツイート生成 | `*/30 * * * *` (30分毎) | `aitter-cron.ts` |
| ニューススクレイピング | `0 * * * *` (毎時) | `news-scrape-cron.ts` |

### 将棋エンジン (`app/shogi/`)

- `types.ts`: PieceType, Player, Board, GameAction, Selection 等の型定義
- `logic.ts`: 9x9 標準将棋ルール (駒移動、成り、王手、詰み判定)
- `minishogi-logic.ts`: 5x5 ミニ将棋バリアント
- `board.tsx` / `minishogi-board.tsx`: 盤面 UI コンポーネント
- ゲーム状態は D1 に JSON として保存、React Router の action で手を送信

### ウェブスクレイピング (`workers/scraper/`)

- `types.ts`: ScrapeSiteConfig, ScrapedArticle インターフェース
- `run.ts`: `scrapeAllSites()` メインロジック
- `parsers.ts`: 利用可能なパーサー定義
- `sites/`: サイト別パーサー実装 (Yahoo News Top, generic link/OGP)
- 記事は `articleUrl` の unique 制約で自動重複排除、7日経過で自動削除

## Cloudflare バインディング

`wrangler.jsonc` で定義、`context.cloudflare.env` でアクセス:

| バインディング | 種類 | 名前 |
|---------------|------|------|
| `DB` | D1 Database | `hidelberq-web-db` |
| `HERO_BUCKET` | R2 Bucket | `hidelberq-hero-images` |

### シークレット (`env.d.ts`)

`wrangler secret` で管理。`wrangler types` では生成されないため `env.d.ts` で手動宣言:

- `GEMINI_API_KEY`: Google Gemini API キー
- `WORKFLOWY_API_KEY`: Workflowy API キー (日記アクセス用)

## CI/CD

### Pull Request (`ci.yml`)
1. `bun install --frozen-lockfile`
2. `bun run typecheck`
3. `bun run build`
4. Cloudflare Workers へプレビューデプロイ (PR 番号付き)
5. プレビュー URL を PR コメントに投稿

### 本番デプロイ (`deploy.yml`)
`main` ブランチへの push で自動デプロイ:
1. `bun install --frozen-lockfile` → `bun run typecheck` → `bun run build` → `bun wrangler deploy`

## TypeScript 設定

| 設定ファイル | 用途 |
|-------------|------|
| `tsconfig.json` | ベース: strict, verbatimModuleSyntax, noEmit |
| `tsconfig.cloudflare.json` | App・Workers: ES2022, react-jsx, パスエイリアス `~/*` → `./app/*` |
| `tsconfig.node.json` | Vite 設定ファイル用 |

**テストファイルの除外**: `tsconfig.cloudflare.json` は `app/**/*.test.ts` を exclude している。

## 主要な規約

- **パスエイリアス**: `~/` は `./app/` にマッピング (`import { tweets } from "~/db/schema"`)
- **ルート型**: React Router が `.react-router/types/` に自動生成 (`import type { Route } from "./+types/home"`)
- **Wrangler 型**: `wrangler.jsonc` 変更後は `bun run typegen` を実行
- **Bun バージョン**: CI では `1.3.8` を使用
- **互換性**: `nodejs_compat` フラグ有効、`compatibility_date: 2025-04-04`
- **Future flags**: `v8_viteEnvironmentApi: true` (`react-router.config.ts`)
