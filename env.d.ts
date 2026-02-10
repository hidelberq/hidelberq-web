// Cloudflare Workers シークレットの型定義
// wrangler secret で管理される変数は wrangler types で生成されないため手動で宣言
declare namespace Cloudflare {
	interface Env {
		GEMINI_API_KEY: string;
		WORKFLOWY_API_KEY: string;
		ACTIVITY_API_KEY: string;
		GOOGLE_BOOKS_API_KEY: string;
	}
}
