import fs from "node:fs";
import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import { cloudflareDevProxy } from "@react-router/dev/vite/cloudflare";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import { getLoadContext } from "./load-context.ts";

// ローカル開発時に /localstorage パスを静的ファイルとして提供するプラグイン
const localStoragePlugin = (): Plugin => ({
  name: "localstorage-static",
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.startsWith("/storage/")) {
        const filePath = path.join(
          process.cwd(),
          "adapter/storage/local",
          req.url,
        );
        if (fs.existsSync(filePath)) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: Record<string, string> = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".webp": "image/webp",
          };
          res.setHeader(
            "Content-Type",
            mimeTypes[ext] || "application/octet-stream",
          );
          fs.createReadStream(filePath).pipe(res);
          return;
        }
        console.warn(`File not found: ${filePath}`);
      }
      next();
    });
  },
});

export default defineConfig(({ isSsrBuild }) => ({
  server: {
    host: true,
    port: 5173,
  },
  build: {
    rollupOptions: isSsrBuild
      ? {
          input: "./workers/app.ts",
        }
      : undefined,
  },
  ssr: {
    target: "webworker",
    noExternal: true,
    resolve: {
      conditions: ["workerd", "browser"],
      externalConditions: ["workerd", "worker", "browser"],
    },
    optimizeDeps: {
      include: [
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        "react-dom/server",
        "react-router",
        "@tiptap/react",
        "@tiptap/starter-kit",
        "use-sync-external-store/shim",
      ],
    },
  },
  plugins: [
    localStoragePlugin(),
    cloudflareDevProxy({
      getLoadContext,
    }),
    tailwindcss(),
    reactRouter(),
  ],
}));
