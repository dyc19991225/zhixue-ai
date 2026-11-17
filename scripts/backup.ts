import "dotenv/config";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const user = process.env.POSTGRES_USER,
  db = process.env.POSTGRES_DB;
if (!user || !db) throw new Error("请先完成本地数据库配置。");
const stamp = new Date().toISOString().replace(/[:.]/g, "-"),
  filename = `zhixue-${stamp}.dump`,
  out = resolve("work/backups", filename);
mkdirSync(resolve("work/backups"), { recursive: true });
function run(args: string[]) {
  const result = spawnSync("docker", args, { encoding: "utf8" });
  if (result.status !== 0)
    throw new Error("备份命令失败，请检查 Docker 和数据库服务。");
  return result.stdout.trim();
}
run([
  "compose",
  "exec",
  "-T",
  "db",
  "pg_dump",
  "-U",
  user,
  "-d",
  db,
  "-Fc",
  "-f",
  `/tmp/${filename}`,
]);
const container = run(["compose", "ps", "-q", "db"]);
if (!container) throw new Error("数据库容器未运行。");
run(["cp", `${container}:/tmp/${filename}`, out]);
run(["compose", "exec", "-T", "db", "rm", `/tmp/${filename}`]);
console.log(`数据库备份已保存：${out}`);
