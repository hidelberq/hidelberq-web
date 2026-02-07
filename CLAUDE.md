# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

hidelberq.com の個人サイト。Cloudflare Workers にデプロイされた React Router v7 SSR アプリケーションで、Drizzle ORM が Cloudflare D1 (SQLite) データベースを管理しています。

### 主な機能

- **ポートフォリオ**: スキル、タイムライン、NWU 関連コンテンツを含むトップページ
- **AItter**: Google Gemini AI がニュースを読んでツイート風の投稿を生成する SNS タイムライン
- **将棋**: 9x9 標準将棋とミニ将棋 (5x5) のオンライン・ローカル対戦
- **ヒーロー画像**: Gemini AI が毎朝自動生成する日替わりヒーロー画像 (Workflowy 日記 or 天気ベース)
- **空白除去**: AI 文字起こしの余計な空白・句読点を補正するツール
- **ニューススクレイピング**: 定期的にニュースサイトをスクレイピングし、AItter の素材として活用

## Development Tools

- **Runtime**: Bun (パッケージマネージャー兼ランタイム)
- **Framework**: React Router v7 (SSR 有効)
- **Deployment**: Cloudflare Workers
- **Database**: Drizzle ORM + Cloudflare D1 (SQLite)
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite` プラグイン) + `@tailwindcss/typography`
- **AI**: Google Gemini (`@google/genai`, `@google/generative-ai`)
- **TypeScript**: strict モード、`verbatimModuleSyntax` 有効
- **Scraping**: `node-html-parser` で HTML パース
- **Japanese Text**: `budoux` で日本語テキストセグメンテーション
- **Markdown**: `react-markdown` + `remark-gfm`

## Development Commands

### Setup & Development
```bash
# Install dependencies
bun install --frozen-lockfile

# Start development server (React Router dev with HMR)
bun run dev
# Opens at http://localhost:5173

# Preview production build locally
bun run preview
```

### Code Quality
```bash
# Type check (generates Wrangler types → React Router types → tsc)
bun run typecheck
```

### Build & Deploy
```bash
# Build for production
bun run build

# Build and deploy to Cloudflare Workers
bun run deploy
```

### Database Operations
```bash
# Generate migration files from schema changes
bun run db:generate

# Apply migrations to local D1 database
bun run db:migrate:local

# Apply migrations to production D1 database
bun run db:migrate:production

# Generate TypeScript types for Wrangler bindings
bun run typegen
```

## Architecture

### Directory Structure

```
├── app/                            # React Router application
│   ├── db/schema.ts               # Drizzle ORM table definitions (single file)
│   ├── entry.server.tsx           # SSR entry point
│   ├── root.tsx                   # Root layout, meta, error boundary
│   ├── routes.ts                  # Centralized route configuration
│   ├── app.css                    # Global Tailwind styles
│   ├── routes/                    # Route components (loaders + UI)
│   ├── shogi/                     # Shogi game engine & board components
│   ├── whitespace-remover/        # Japanese punctuation utility
│   └── welcome/                   # Welcome page assets
├── workers/                        # Cloudflare Workers entry & cron jobs
│   ├── app.ts                     # Main Worker: HTTP handler + cron dispatcher
│   ├── hero-image.ts              # Daily hero image generation (Gemini AI)
│   ├── aitter-cron.ts            # AI tweet generation (Gemini AI)
│   ├── news-scrape-cron.ts        # News scraping scheduler
│   └── scraper/                   # Scraping library (parsers, site configs)
├── drizzle/                        # Migration SQL files (auto-generated)
├── public/                         # Static assets (favicon)
└── .github/workflows/              # CI/CD (typecheck → build → deploy)
```

### Data Access Pattern

ルートの `loader` / `action` 内で Drizzle ORM を直接使用します。リポジトリパターンや DI は使用していません。

```typescript
// 典型的なパターン: route loader で直接 DB アクセス
export async function loader({ context }: Route.LoaderArgs) {
  const db = drizzle(context.cloudflare.env.DB);
  const results = await db.select().from(tableName).orderBy(desc(col)).limit(n);
  return { results };
}
```

### Database Schema (`app/db/schema.ts`)

全テーブルを単一ファイルで定義:

| Table | Purpose |
|-------|---------|
| `tweets` | AI 生成ツイート (content, author, category, engagement metrics, displayed flag) |
| `shogiGames` | 将棋ゲーム状態 (board/captured as JSON, player IDs, status, move count) |
| `heroImages` | 日替わりヒーロー画像 (date, R2 key, prompt, source) |
| `newsCache` | ニュースコンテキストキャッシュ (日次) |
| `scrapeSites` | スクレイパーサイト設定 (siteId, url, parserId) |
| `scrapedArticles` | スクレイピング済み記事 (articleUrl unique, usedForTweet flag) |

**スキーマ変更後**: `bun run db:generate` → `bun run db:migrate:local` の順で実行。

### Routes (`app/routes.ts`)

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

### Cloudflare Workers Entry (`workers/app.ts`)

`fetch` ハンドラーで React Router SSR リクエストを処理し、`scheduled` ハンドラーで cron ジョブをディスパッチ:

| Cron | Schedule | Worker |
|------|----------|--------|
| ヒーロー画像生成 | `0 21 * * *` (JST 06:00) | `hero-image.ts` |
| AItter ツイート生成 | `*/30 * * * *` (30分毎) | `aitter-cron.ts` |
| ニューススクレイピング | `0 * * * *` (毎時) | `news-scrape-cron.ts` |

### Shogi Game Engine (`app/shogi/`)

- `types.ts`: PieceType, Player, Board, GameAction, Selection 等の型定義
- `logic.ts`: 9x9 標準将棋ルール (駒移動、成り、王手、詰み判定)
- `minishogi-logic.ts`: 5x5 ミニ将棋バリアント
- `board.tsx` / `minishogi-board.tsx`: 盤面 UI コンポーネント
- ゲーム状態は D1 に JSON として保存、React Router の action で手を送信

### Web Scraping (`workers/scraper/`)

- `types.ts`: ScrapeSiteConfig, ScrapedArticle インターフェース
- `run.ts`: `scrapeAllSites()` メインロジック
- `parsers.ts`: 利用可能なパーサー定義
- `sites/`: サイト別パーサー実装 (Yahoo News Top, generic link/OGP)
- 記事は `articleUrl` の unique 制約で自動重複排除、7日経過で自動削除

## Cloudflare Bindings

`wrangler.jsonc` で定義、`context.cloudflare.env` でアクセス:

| Binding | Type | Name |
|---------|------|------|
| `DB` | D1 Database | `hidelberq-web-db` |
| `HERO_BUCKET` | R2 Bucket | `hidelberq-hero-images` |

### Secrets (`env.d.ts`)

`wrangler secret` で管理。`wrangler types` では生成されないため `env.d.ts` で手動宣言:

- `GEMINI_API_KEY`: Google Gemini API キー
- `WORKFLOWY_API_KEY`: Workflowy API キー (日記アクセス用)

## CI/CD

### Pull Request (`ci.yml`)
1. `bun install --frozen-lockfile`
2. `bun run typecheck`
3. `bun run build`
4. Preview deploy to Cloudflare Workers (PR 番号付き)
5. Preview URL を PR コメントに投稿

### Production Deploy (`deploy.yml`)
`main` ブランチへの push で自動デプロイ:
1. `bun install --frozen-lockfile` → `bun run typecheck` → `bun run build` → `bun wrangler deploy`

## TypeScript Configuration

| Config | Purpose |
|--------|---------|
| `tsconfig.json` | Base: strict, verbatimModuleSyntax, noEmit |
| `tsconfig.cloudflare.json` | App & Workers: ES2022, react-jsx, path alias `~/*` → `./app/*` |
| `tsconfig.node.json` | Vite config のみ |

**テストファイルの除外**: `tsconfig.cloudflare.json` は `app/**/*.test.ts` を exclude しています。

## Key Conventions

- **Path alias**: `~/` は `./app/` にマッピング (`import { tweets } from "~/db/schema"`)
- **Route types**: React Router が `.react-router/types/` に自動生成 (`import type { Route } from "./+types/home"`)
- **Wrangler types**: `wrangler.jsonc` 変更後は `bun run typegen` を実行
- **Bun version**: CI では `1.3.8` を使用
- **Compatibility**: `nodejs_compat` フラグ有効、`compatibility_date: 2025-04-04`
- **Future flags**: `v8_viteEnvironmentApi: true` (`react-router.config.ts`)
