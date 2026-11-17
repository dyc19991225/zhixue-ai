import type { Request, RequestHandler } from "express";
import { getDb } from "../lib/db";
import { HttpError } from "../lib/http";
import { verifyToken } from "./tokens";
import { userView } from "./user-view";
import type { Role } from "@zhixue/shared";
export type CurrentUser = ReturnType<typeof userView>;
declare module "express-serve-static-core" {
  interface Request {
    auth?: { user: CurrentUser; sessionId: string };
  }
}
export function authenticated(request: Request) {
  if (!request.auth) throw new HttpError(401, "请先登录。");
  return request.auth;
}
export const requireAuth: RequestHandler = async (request, _response, next) => {
  const authorization = request.get("authorization");
  if (!authorization?.startsWith("Bearer "))
    throw new HttpError(401, "请先登录。");
  const claims = await verifyToken(authorization.slice(7), "access");
  const session = await getDb().authSession.findUnique({
    where: { id: claims.sessionId },
    include: { user: true },
  });
  if (
    !session ||
    session.userId !== claims.userId ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE"
  )
    throw new HttpError(401, "登录已失效，请重新登录。");
  request.auth = { user: userView(session.user), sessionId: session.id };
  next();
};
export function rbac(allowedRoles: readonly Role[]): RequestHandler {
  const allowed = new Set(allowedRoles);
  return (request, _response, next) => {
    if (!allowed.has(authenticated(request).user.role))
      throw new HttpError(403, "当前角色无权执行此操作。");
    next();
  };
}
export const requireAdmin = rbac(["ADMIN"]);
export const requireSameOrigin: RequestHandler = (request, _response, next) => {
  const allowed = new Set([process.env.APP_ORIGIN ?? "http://127.0.0.1:3000"]);
  if (process.env.NODE_ENV !== "production")
    allowed.add("http://localhost:3000");
  const origin = request.get("origin");
  if (
    request.get("x-zhixue-client") !== "web" ||
    (origin && !allowed.has(origin)) ||
    request.get("sec-fetch-site") === "cross-site"
  )
    throw new HttpError(403, "请求来源无效，请从本站操作。");
  next();
};
