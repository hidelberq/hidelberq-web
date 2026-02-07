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
    // UTC 21:00 (JST 06:00) - ヒーロー画像生成
    ctx.waitUntil(
      runWithActivityLog(env, "cron_hero_image", async () => {
        const result = await generateHeroImage(env);
        return result;
      }),
    );
    // 毎時0分・30分 - AIteer ツイート生成
    ctx.waitUntil(
      runWithActivityLog(env, "cron_aitter", async () => {
        const result = await generateAitterTweets(env);
        return result;
      }),
    );
    // 毎時0分 - ニューススクレイピング
    ctx.waitUntil(
      runWithActivityLog(env, "cron_news_scrape", async () => {
        const result = await scrapeNews(env);
        return result;
      }),
    );
  },
} satisfies ExportedHandler<Env>;
