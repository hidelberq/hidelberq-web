import { createRequestHandler } from "react-router";
import { generateHeroImage } from "./hero-image";
import { generateAitterTweets } from "./aitter-cron";

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

export default {
  async fetch(request, env, ctx) {
    return requestHandler(request, {
      cloudflare: { env, ctx },
    });
  },
  async scheduled(event, env, ctx) {
    // UTC 21:00 (JST 06:00) - ヒーロー画像生成
    // 毎時0分・30分 - AIteer ツイート生成
    ctx.waitUntil(generateHeroImage(env));
    ctx.waitUntil(generateAitterTweets(env));
  },
} satisfies ExportedHandler<Env>;
