import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parse } from "dotenv";
const path = fileURLToPath(new URL("../.env", import.meta.url));
const previous = existsSync(path) ? readFileSync(path, "utf8") : "";
const values = parse(previous);
const additions: string[] = [];
if (!values.DATABASE_URL) {
  if (previous)
    throw new Error(
      "现有 .env 未配置 DATABASE_URL，请先按手册补齐，未修改现有文件。",
    );
  const passphrase = randomBytes(32).toString("hex");
  additions.push(
    "POSTGRES_USER=zhixue",
    "POSTGRES_DB=zhixue",
    `POSTGRES_PASSWORD=${passphrase}`,
    `DATABASE_URL=postgresql://zhixue:${passphrase}@127.0.0.1:5433/zhixue?schema=public`,
  );
}
for (const name of ["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"])
  if (!values[name])
    additions.push(`${name}=${randomBytes(48).toString("hex")}`);
if (!values.APP_ORIGIN) additions.push("APP_ORIGIN=http://127.0.0.1:3000");
if (!values.API_PORT) additions.push("API_PORT=4000");
if (additions.length)
  writeFileSync(
    path,
    previous +
      (previous.endsWith("\n") || !previous ? "" : "\n") +
      additions.join("\n") +
      "\n",
    { mode: 0o600 },
  );
console.log("本地配置已准备；现有配置已保留，没有输出密码或密钥。");
