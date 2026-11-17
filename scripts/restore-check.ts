import "dotenv/config";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
const file = process.argv[2];
if (!file || !existsSync(file))
  throw new Error("用法：npm run db:restore-check -- <备份文件>");
const user = process.env.POSTGRES_USER;
if (!user) throw new Error("数据库用户未配置。");
const target = "qa_restore_" + randomBytes(6).toString("hex"),
  remote = `/tmp/${target}.dump`;
function run(args: string[]) {
  const result = spawnSync("docker", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error("恢复检查失败；原数据库未改动。");
  return result.stdout.trim();
}
const container = run(["compose", "ps", "-q", "db"]);
if (!container) throw new Error("数据库容器未运行。");
run(["cp", resolve(file), `${container}:${remote}`]);
let created = false;
try {
  run(["compose", "exec", "-T", "db", "createdb", "-U", user, target]);
  created = true;
  run([
    "compose",
    "exec",
    "-T",
    "db",
    "pg_restore",
    "-U",
    user,
    "-d",
    target,
    "--exit-on-error",
    remote,
  ]);
  run([
    "compose",
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    user,
    "-d",
    target,
    "-c",
    'SELECT count(*) FROM "User"; SELECT count(*) FROM "Question"; SELECT count(*) FROM "MediaAsset";',
  ]);
  console.log("独立临时数据库恢复与表查询通过，原数据库未覆盖。");
} finally {
  if (created)
    run(["compose", "exec", "-T", "db", "dropdb", "-U", user, target]);
  run(["compose", "exec", "-T", "db", "rm", remote]);
}
