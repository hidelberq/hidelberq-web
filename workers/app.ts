import { createRequestHandler } from "react-router";
import { generateHeroImage } from "./hero-image";

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
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(generateHeroImage(env));
  },
} satisfies ExportedHandler<Env>;
