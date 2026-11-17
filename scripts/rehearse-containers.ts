import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createServer } from "node:net";
import { request as httpsRequest } from "node:https";
import { mkdir, readFile, writeFile, unlink } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { backupBundle, verifyBundle } from "./backup-bundle.js";
import { checkSite } from "./check-site.js";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const project = "zhixue-rehearsal-" + randomBytes(6).toString("hex");
const directory = resolve(root, "work", project);
await mkdir(directory, { recursive: true });
const envFile = resolve(directory, "empty.env"),
  certFile = resolve(directory, "tls.crt");
await writeFile(
  envFile,
  "# Values are supplied in process memory; no credentials stored here.\n",
);
const port = await new Promise<number>((accept, reject) => {
  const server = createServer();
  server.on("error", reject);
  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    if (!address || typeof address === "string")
      return reject(new Error("无法分配演练端口。"));
    server.close(() => accept(address.port));
  });
});
const password = randomBytes(24).toString("hex") + ":@/%#";
const origin = `https://127.0.0.1:${port}`;
const values = {
  QA_PROJECT: project,
  QA_PORT: String(port),
  QA_DB_PASSWORD: password,
  QA_DATABASE_URL: `postgresql://rehearsal:${encodeURIComponent(password)}@db:5432/rehearsal?schema=public`,
  QA_JWT_ACCESS: randomBytes(48).toString("hex"),
  QA_JWT_REFRESH: randomBytes(48).toString("hex"),
};
const checks: string[] = [];
let cleaned = false,
  failure = "";
const secrets = [
  ...Object.values(values).filter((v) => v.length > 40),
  password,
  encodeURIComponent(password),
];
const redact = (text: string) =>
  secrets
    .reduce((s, value) => s.replaceAll(value, "[redacted]"), text)
    .replace(
      /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
      "[redacted-token]",
    )
    .replace(/zhixue_refresh=[^;\s'"]+/g, "zhixue_refresh=[redacted]");
let log = "";
async function docker(args: string[], timeout = 600000) {
  return new Promise<string>((accept, reject) => {
    const child = spawn("docker", args, {
      cwd: root,
      env: { ...process.env, ...values },
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("Docker 操作超时。"));
    }, timeout);
    child.stdout.on("data", (part) => {
      output += String(part);
    });
    child.stderr.on("data", (part) => {
      output += String(part);
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      log += redact(output) + "\n";
      if (code === 0) accept(output.trim());
      else
        reject(
          new Error(
            `Docker 步骤失败（${args[0]}，退出码 ${code}）；详情保存在演练日志。`,
          ),
        );
    });
  });
}
const compose = (...args: string[]) =>
  docker([
    "compose",
    "--project-name",
    project,
    "--env-file",
    envFile,
    "-f",
    "compose.rehearsal.yaml",
    ...args,
  ]);
const step = (name: string) => {
  checks.push(name);
  console.log("通过：" + name);
};
type Payload = {
  code: number;
  data: {
    accessToken?: string;
    user?: { id: string; role: string };
    status?: string;
    redis?: string;
    database?: string;
    enabled?: boolean;
    total?: number;
  } | null;
};
let ca: Buffer;
async function http(
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
  cookie?: string,
) {
  const data = body === undefined ? undefined : JSON.stringify(body);
  return new Promise<{
    status: number;
    headers: import("node:http").IncomingHttpHeaders;
    text: string;
    json: Payload | null;
  }>((accept, reject) => {
    const req = httpsRequest(
      origin + path,
      {
        method,
        ca,
        headers: {
          ...(data
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(data),
              }
            : {}),
          "X-Zhixue-Client": "web",
          Origin: origin,
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(cookie ? { Cookie: cookie } : {}),
        },
      },
      (res) => {
        let text = "";
        res.setEncoding("utf8");
        res.on("data", (part) => {
          text += part;
        });
        res.on("end", () => {
          let json: Payload | null = null;
          try {
            json = JSON.parse(text) as Payload;
          } catch {
            /* HTML is expected for SPA routes. */
          }
          accept({
            status: res.statusCode ?? 0,
            headers: res.headers,
            text,
            json,
          });
        });
      },
    );
    req.setTimeout(15000, () =>
      req.destroy(new Error("演练 HTTPS 请求超时。")),
    );
    req.on("error", reject);
    req.end(data);
  });
}
try {
  console.log("开始独立容器演练：" + project);
  await compose("config", "--quiet");
  console.log("构建当前源码并启动隔离服务，首次构建可能需要数分钟。");
  await compose("up", "--build", "--detach", "web");
  await compose("cp", "certs:/certs/tls.crt", certFile);
  ca = await readFile(certFile);
  const ready = await http("/api/ready");
  assert.equal(ready.status, 200);
  assert.equal(ready.json?.data?.database, "connected");
  assert.equal(ready.json?.data?.redis, "connected");
  step("生产模式迁移、数据库与 Redis 就绪");
  const healthyReport = await checkSite({ origin, ca });
  assert.equal(healthyReport.healthy, true);
  await writeFile(
    resolve(directory, "site-check.json"),
    JSON.stringify(healthyReport, null, 2),
  );
  await compose("stop", "redis");
  assert.equal((await checkSite({ origin, ca })).healthy, false);
  await compose("up", "--detach", "--wait", "--wait-timeout", "120", "redis");
  assert.equal((await checkSite({ origin, ca })).healthy, true);
  step("HTTPS巡检及缓存故障发现与恢复");
  const page = await http("/dashboard");
  assert.equal(page.status, 200);
  assert.ok(page.text.includes('<div id="root">'));
  step("HTTPS 证书验证与 SPA 路由");
  for (const service of ["web", "api", "db", "redis"]) {
    const id = await compose("ps", "--quiet", service);
    const bindings = JSON.parse(
      await docker([
        "inspect",
        "--format",
        "{{json .NetworkSettings.Ports}}",
        id,
      ]),
    ) as Record<string, { HostIp: string; HostPort: string }[] | null>;
    if (service === "web")
      assert.deepEqual(bindings["443/tcp"], [
        { HostIp: "127.0.0.1", HostPort: String(port) },
      ]);
    else
      assert.ok(Object.values(bindings).every((binding) => binding === null));
  }
  assert.equal((await http("/api/ai/status")).json?.data?.enabled, false);
  step("仅本机发布 HTTPS，内部服务不发布端口，AI 保持关闭");
  const credentials = {
    username: "qa_rehearsal_" + randomBytes(4).toString("hex"),
    passphrase: randomBytes(24).toString("hex"),
  };
  const registered = await http("/api/auth/register", "POST", {
    ...credentials,
    displayName: "独立容器验收",
    grade: "G7",
  });
  assert.equal(registered.status, 200);
  const loggedIn = await http("/api/auth/login", "POST", credentials);
  assert.equal(loggedIn.status, 200);
  assert.equal(loggedIn.json?.data?.user?.role, "STUDENT");
  const token = loggedIn.json?.data?.accessToken;
  assert.ok(token);
  const cookies = loggedIn.headers["set-cookie"] ?? [];
  const refresh = cookies.find((c) => c.startsWith("zhixue_refresh="));
  assert.ok(refresh);
  for (const flag of ["HttpOnly", "Secure", "SameSite=Strict"])
    assert.ok(refresh.includes(flag));
  assert.equal(
    (await http("/api/users/me", "GET", undefined, token)).status,
    200,
  );
  assert.equal(
    (await http("/api/admin/courses", "GET", undefined, token)).status,
    403,
  );
  assert.equal(
    (await http("/api/learning-library", "GET", undefined, token)).json?.data
      ?.total,
    0,
  );
  step("注册、登录、本人读取与管理员权限隔离");
  const renewed = await http(
    "/api/auth/refresh",
    "POST",
    {},
    undefined,
    refresh.split(";")[0],
  );
  assert.equal(renewed.status, 200);
  assert.ok(renewed.json?.data?.accessToken);
  const rotated = renewed.headers["set-cookie"]?.find((c) =>
    c.startsWith("zhixue_refresh="),
  );
  assert.ok(rotated);
  assert.notEqual(rotated.split(";")[0], refresh.split(";")[0]);
  await http("/api/auth/logout", "POST", {}, undefined, rotated.split(";")[0]);
  assert.equal(
    (
      await http(
        "/api/users/me",
        "GET",
        undefined,
        renewed.json?.data?.accessToken,
      )
    ).status,
    401,
  );
  step("Secure Cookie、会话轮换和注销撤销");
  const uid = await compose(
    "exec",
    "-T",
    "api",
    "node",
    "-e",
    "process.stdout.write(String(process.getuid()))",
  );
  assert.notEqual(uid, "0");
  await compose(
    "exec",
    "-T",
    "api",
    "node",
    "-e",
    "require('node:fs').writeFileSync('/app/.local-media/rehearsal-marker.txt','isolated-media-check')",
  );
  await compose("restart", "api");
  await compose("up", "--detach", "--wait", "--wait-timeout", "120", "api");
  const marker = await compose(
    "exec",
    "-T",
    "api",
    "node",
    "-e",
    "process.stdout.write(require('node:fs').readFileSync('/app/.local-media/rehearsal-marker.txt','utf8'))",
  );
  assert.equal(marker, "isolated-media-check");
  step("非 root API 写入媒体卷及重启持久化");
  const dbContainer = await compose("ps", "--quiet", "db");
  const apiContainer = await compose("ps", "--quiet", "api");
  const bundle = resolve(directory, "backup");
  const backupOptions = {
    dbContainer,
    apiContainer,
    user: "rehearsal",
    database: "rehearsal",
    destination: bundle,
  };
  await assert.rejects(backupBundle(backupOptions), /必须已停止/);
  await compose("stop", "api");
  await backupBundle(backupOptions);
  await verifyBundle(bundle);
  const mediaFile = resolve(bundle, "media/rehearsal-marker.txt");
  await writeFile(mediaFile, "damaged");
  await assert.rejects(verifyBundle(bundle), /完整性校验失败/);
  await writeFile(mediaFile, "isolated-media-check");
  await verifyBundle(bundle);
  step("联合备份、拒绝运行中备份及损坏文件检测");
  await compose("start", "api");
  await docker([
    "cp",
    resolve(bundle, "database.dump"),
    `${dbContainer}:/tmp/rehearsal.dump`,
  ]);
  await docker([
    "cp",
    resolve(bundle, "media"),
    `${apiContainer}:/tmp/restored-media`,
  ]);
  const restoredMedia = await compose(
    "exec",
    "-T",
    "api",
    "node",
    "-e",
    "process.stdout.write(require('node:fs').readFileSync('/tmp/restored-media/rehearsal-marker.txt','utf8'))",
  );
  assert.equal(restoredMedia, "isolated-media-check");
  step("备份媒体恢复到独立目录并核对内容");
  await compose(
    "exec",
    "-T",
    "db",
    "createdb",
    "-U",
    "rehearsal",
    "qa_restore_rehearsal",
  );
  await compose(
    "exec",
    "-T",
    "db",
    "pg_restore",
    "-U",
    "rehearsal",
    "-d",
    "qa_restore_rehearsal",
    "--exit-on-error",
    "/tmp/rehearsal.dump",
  );
  const count = await compose(
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "rehearsal",
    "-d",
    "qa_restore_rehearsal",
    "-tAc",
    'SELECT count(*) FROM "User"',
  );
  assert.equal(count, "1");
  step("数据库备份恢复到独立临时库");
} catch (error) {
  failure = redact(error instanceof Error ? error.message : "演练失败。");
  console.error(failure);
  process.exitCode = 1;
} finally {
  try {
    assert.match(
      project,
      /^zhixue-rehearsal-[a-f0-9]{12}$/,
      "拒绝清理非演练项目。",
    );
    await compose("down", "--volumes", "--remove-orphans");
    cleaned = true;
    await docker(["image", "rm", `${project}-api`, `${project}-web`]).catch(
      () => {},
    );
  } catch {
    console.error(
      "演练项目清理失败，请查看报告中的项目名；未对其他项目执行清理。",
    );
    process.exitCode = 1;
  }
  await writeFile(resolve(directory, "rehearsal.log"), log);
  await writeFile(
    resolve(directory, "report.json"),
    JSON.stringify(
      {
        project,
        finishedAt: new Date().toISOString(),
        passed: !failure && cleaned,
        checks,
        cleaned,
        failure,
        publicDeployment: false,
        productionDataUsed: false,
      },
      null,
      2,
    ),
  );
  if (cleaned) {
    await unlink(envFile).catch(() => {});
    await unlink(certFile).catch(() => {});
  }
  console.log(`演练报告：${resolve(directory, "report.json")}`);
}
