import "dotenv/config";
import { defineConfig } from "prisma/config";
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  // generate/validate 不连接数据库；迁移前须配置 .env。
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
