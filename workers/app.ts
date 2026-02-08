import { createRequestHandler } from "react-router";
import { drizzle } from "drizzle-orm/d1";
import { generateHeroImage } from "./hero-image";
import { generateAitterTweets } from "./aitter-cron";
import { scrapeNews } from "./news-scrape-cron";
import { activityLog } from "../app/db/schema";

declare module "react-router" {
  export interface AppLoadContext {
    cloudflare: {
      env: Env;
      ctx: ExecutionContext;
    };
  }
}

const requestHandler = createRequestHandler(
  () => import("virtual:react-router/server-build"),
  import.meta.env.MODE
);

async function runWithActivityLog(
  env: Env,
  type: string,
  fn: () => Promise<string | null>,
): Promise<void> {
  try {
    const message = await fn();
    if (message) {
      const db = drizzle(env.DB);
      await db.insert(activityLog).values({ type, message });
    }
  } catch (e) {
    console.error(`${type} error:`, e);
  }
}

export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
  async scheduled(event, env, ctx) {
    switch (event.cron) {
      // UTC 21:00 (JST 06:00) - ヒーロー画像生成（1日1回）
      case "0 21 * * *":
        ctx.waitUntil(
          runWithActivityLog(env, "cron_hero_image", () => generateHeroImage(env)),
        );
        break;
      // JST 8,14,20,2時 - ニューススクレイピング + AIツイート生成（1日4回）
      case "0 23,5,11,17 * * *":
        // ニューススクレイピングを先に実行（最新記事をツイート生成に活用）
        ctx.waitUntil(
          runWithActivityLog(env, "cron_news_scrape", () => scrapeNews(env)),
        );
        ctx.waitUntil(
          runWithActivityLog(env, "cron_aitter", () => generateAitterTweets(env)),
        );
        break;
    }
  },
} satisfies ExportedHandler<Env>;
