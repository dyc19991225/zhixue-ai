import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../apps/api/src/generated/prisma/client";
const index = process.argv.indexOf("--username");
const username = process.argv[index + 1];
if (index < 0 || !/^[a-z0-9_]{4,32}$/.test(username ?? ""))
  throw new Error("用法：npm.cmd run user:promote -- --username 已注册账号");
if (!process.env.DATABASE_URL) throw new Error("请先配置本地数据库。");
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});
try {
  await db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { username } });
    if (!user || user.status !== "ACTIVE")
      throw new Error("未找到可用的已注册账号。");
    await tx.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });
    await tx.adminAuditLog.create({
      data: {
        actorUserId: "local-cli",
        targetUserId: user.id,
        action: "GRANT_ADMIN",
      },
    });
  });
  console.log(
    "已将指定本地账号设置为管理员，并记录操作；没有生成默认管理员密码。",
  );
} catch {
  console.error("管理员设置未完成，请检查账号与数据库状态。");
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
