import {defineConfig} from "drizzle-kit";

export default defineConfig({
    out: "./drizzle",          // マイグレーションファイルの出力先
    schema: "./app/db/schema.ts", // スキーマ定義ファイルの場所
    dialect: "sqlite",
});
