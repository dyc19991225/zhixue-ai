import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../apps/api/src/generated/prisma/client";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || connectionString.includes("REPLACE_WITH")) {
    throw new Error("请先在 .env 中配置本地数据库连接。");
  }
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString, connectionTimeoutMillis: 5000 }),
  });
  try {
    await db.$queryRaw`SELECT 1`;
    const count = await db.course.count();
    console.log(`数据库连接和 Course 表验证成功；当前课程数：${count}。`);
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "数据库验证未通过。请检查 Docker 服务、.env 和迁移状态；不会输出连接凭据。",
  );
  process.exitCode = 1;
});
