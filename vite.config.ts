import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// @cloudflare/vite-plugin が SSR 環境の optimizeDeps を設定した後に
// ルートファイルで使用されるパッケージを include に追加する。
// プラグインが entries にワーカーエントリのみを指定するため、
// ルート経由の依存関係が後から発見され WebSocket リロードが
// 発生してビルドが失敗する問題を回避する。
function ssrDepsPlugin(): Plugin {
  return {
    name: "ssr-deps-include",
    configEnvironment(name, config) {
      if (name === "ssr") {
        config.optimizeDeps ??= {};
        config.optimizeDeps.include ??= [];
        config.optimizeDeps.include.push("@google/genai");
        config.optimizeDeps.noDiscovery = true;
      }
    },
  };
}

export default defineConfig({
  plugins: [
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    ssrDepsPlugin(),
  ],
});
