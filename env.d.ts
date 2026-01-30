// Cloudflare Secrets の型定義
// wrangler types で生成されない Secret を手動で定義
// worker-configuration.d.ts で生成された Env インターフェースに追加のプロパティをマージ
declare namespace Cloudflare {
  interface Env {
    // wrangler.jsonc に空文字列で定義されているが、実際は Secret として管理
    YOUTUBE_API_KEY: string;
    // Secret として管理 (wrangler.jsonc に未定義)
    RSS_TOKEN: string;
  }
}
