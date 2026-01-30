import type { Config } from "drizzle-kit";

export default {
  out: "./adapter/repository/drizzle/migrations",
  schema: "./adapter/repository/drizzle/schema.ts",
  dialect: "sqlite",
} satisfies Config;
