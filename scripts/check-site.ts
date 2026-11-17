import { request as httpRequest } from "node:http";
import { request as httpsRequest } from "node:https";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

type Options = { origin: string; timeout?: number; ca?: Buffer };
export async function checkSite(options: Options) {
  const origin = new URL(options.origin);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.search ||
    origin.hash ||
    origin.pathname !== "/"
  )
    throw new Error("仅接受不含账号、查询参数或路径的网站源地址。");
  if (
    origin.protocol === "http:" &&
    !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
  )
    throw new Error("非本机网站必须使用HTTPS。");
  const timeout = options.timeout ?? 8000;
  if (!Number.isInteger(timeout) || timeout < 50 || timeout > 60000)
    throw new Error("超时范围为50到60000毫秒。");
  async function probe(path: string, validate: (body: string) => boolean) {
    const started = Date.now();
    return new Promise<{
      path: string;
      ok: boolean;
      status: number | null;
      durationMs: number;
      reason: string;
    }>((accept) => {
      let settled = false;
      const finish = (ok: boolean, status: number | null, reason: string) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        accept({ path, ok, status, durationMs: Date.now() - started, reason });
      };
      const request = (
        origin.protocol === "https:" ? httpsRequest : httpRequest
      )(
        new URL(path, origin),
        {
          ca: options.ca,
          headers: {
            Accept: path.startsWith("/api/") ? "application/json" : "text/html",
          },
        },
        (response) => {
          let body = "",
            bytes = 0;
          response.setEncoding("utf8");
          response.on("data", (chunk: string) => {
            bytes += Buffer.byteLength(chunk);
            if (bytes > 1024 * 1024) {
              finish(false, response.statusCode ?? null, "response-too-large");
              request.destroy();
            } else body += chunk;
          });
          response.on("error", () =>
            finish(false, response.statusCode ?? null, "response-error"),
          );
          response.on("end", () => {
            const status = response.statusCode ?? 0;
            if (status !== 200) return finish(false, status, "http-status");
            try {
              const ok = validate(body);
              finish(ok, status, ok ? "ok" : "invalid-content");
            } catch {
              finish(false, status, "invalid-content");
            }
          });
        },
      );
      const timer = setTimeout(() => {
        finish(false, null, "timeout");
        request.destroy();
      }, timeout);
      request.on("error", () => finish(false, null, "connection-or-tls-error"));
      request.end();
    });
  }
  const checks = await Promise.all([
    probe("/dashboard", (body) => body.includes('<div id="root">')),
    probe("/api/health", (body) => {
      const value = JSON.parse(body);
      return (
        value.code === 0 &&
        value.data?.status === "ok" &&
        value.data?.service === "zhixue-api"
      );
    }),
    probe("/api/ready", (body) => {
      const value = JSON.parse(body);
      return (
        value.code === 0 &&
        value.data?.status === "ready" &&
        value.data?.database === "connected" &&
        value.data?.redis === "connected"
      );
    }),
  ]);
  return {
    checkedAt: new Date().toISOString(),
    origin: origin.origin,
    healthy: checks.every((check) => check.ok),
    checks,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const [origin, report, caFile] = process.argv.slice(2);
    if (!origin || !report || process.argv.length > 5)
      throw new Error(
        "用法：ops:check -- <网站源地址> <新报告文件> [测试证书CA文件]",
      );
    const result = await checkSite({
      origin,
      ca: caFile ? await readFile(caFile) : undefined,
    });
    await writeFile(resolve(report), JSON.stringify(result, null, 2), {
      flag: "wx",
    });
    console.log(result.healthy ? "巡检通过。" : "巡检发现故障，请查看报告。");
    if (!result.healthy) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : "巡检失败。");
    process.exitCode = 1;
  }
}
