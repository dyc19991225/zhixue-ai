import { randomUUID, createHash } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { HttpError } from "../lib/http";
const issuer = "zhixue-ai";
export const ACCESS_SECONDS = 15 * 60;
export const REFRESH_SECONDS = 7 * 24 * 60 * 60;
export function tokenHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
function secret(kind: "access" | "refresh") {
  const value =
    process.env[kind === "access" ? "JWT_ACCESS_SECRET" : "JWT_REFRESH_SECRET"];
  if (!value || value.length < 64)
    throw new HttpError(503, "账户服务尚未配置完成。");
  return new TextEncoder().encode(value);
}
export async function issueTokens(
  userId: string,
  sessionId: string,
  expiresAt: Date,
) {
  const accessToken = await new SignJWT({ type: "access", sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience("zhixue-web")
    .setSubject(userId)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(`${ACCESS_SECONDS}s`)
    .sign(secret("access"));
  const refreshToken = await new SignJWT({ type: "refresh", sid: sessionId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(issuer)
    .setAudience("zhixue-refresh")
    .setSubject(userId)
    .setIssuedAt()
    .setJti(randomUUID())
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret("refresh"));
  return { accessToken, refreshToken };
}
export async function verifyToken(token: string, kind: "access" | "refresh") {
  const key = secret(kind);
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer,
      audience: kind === "access" ? "zhixue-web" : "zhixue-refresh",
      requiredClaims: ["exp", "iat", "sub", "jti"],
    });
    if (
      payload.type !== kind ||
      typeof payload.sid !== "string" ||
      typeof payload.sub !== "string"
    )
      throw new Error("invalid claims");
    return { userId: payload.sub, sessionId: payload.sid };
  } catch {
    throw new HttpError(401, "登录已过期，请重新登录。");
  }
}
