import { createClient } from "redis";
import { rateLimit } from "express-rate-limit";
import type { RequestHandler } from "express";
import { createHash } from "node:crypto";
import { HttpError } from "./http";
let client: ReturnType<typeof createClient> | undefined;
let connecting: Promise<unknown> | undefined;
async function redis() {
  if (!process.env.REDIS_URL) throw new HttpError(503, "缓存尚未配置。");
  client ??= createClient({
    url: process.env.REDIS_URL,
    socket: { connectTimeout: 2000, reconnectStrategy: false },
  }).on("error", () => {});
  if (!client.isOpen) {
    connecting ??= client.connect().finally(() => {
      connecting = undefined;
    });
    await connecting;
  }
  return client;
}
export async function checkRedis() {
  return (await redis()).ping();
}
export async function disconnectRedis() {
  if (client?.isOpen) await client.quit();
}
export function limiter(
  scope: string,
  limit: number,
  windowMs: number,
): RequestHandler {
  const memory = rateLimit({
    limit,
    windowMs,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: (_req, res) =>
      res
        .status(429)
        .json({ code: 429, message: "操作过于频繁，请稍后再试。", data: null }),
  });
  return async (req, res, next) => {
    if (!process.env.REDIS_URL) {
      if (process.env.NODE_ENV === "production")
        throw new HttpError(503, "请求限流服务尚未配置。");
      memory(req, res, next);
      return;
    }
    const identity = createHash("sha256")
      .update(req.auth?.user.id ?? req.ip ?? "unknown")
      .digest("hex");
    try {
      const result = (await (
        await redis()
      ).eval(
        "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('PTTL',KEYS[1])}",
        {
          keys: [
            `${process.env.RATE_LIMIT_NAMESPACE ?? "zhixue"}:limit:${scope}:${identity}`,
          ],
          arguments: [String(windowMs)],
        },
      )) as number[];
      if (Number(result[0]) > limit) {
        res
          .set(
            "Retry-After",
            String(Math.max(1, Math.ceil(Number(result[1]) / 1000))),
          )
          .status(429)
          .json({
            code: 429,
            message: "操作过于频繁，请稍后再试。",
            data: null,
          });
        return;
      }
      next();
    } catch {
      throw new HttpError(503, "请求限流服务暂不可用，请稍后重试。");
    }
  };
}
