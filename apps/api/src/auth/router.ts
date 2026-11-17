import { Router, type Response, type Request } from "express";
import { limiter as sharedLimiter } from "../lib/rate-limiter";
import { ok, HttpError } from "../lib/http";
import { getDb } from "../lib/db";
import { requireAuth, requireSameOrigin, authenticated } from "./middleware";
import * as service from "./service";
import { REFRESH_SECONDS } from "./tokens";
const cookieName = "zhixue_refresh";
const cookieOptions = () => ({
  httpOnly: true,
  secure:
    process.env.AUTH_COOKIE_SECURE === "true" ||
    process.env.NODE_ENV === "production",
  sameSite: "strict" as const,
  path: "/api/auth",
});
function clear(response: Response) {
  response.clearCookie(cookieName, cookieOptions());
}
function readCookie(request: Request): string | undefined {
  const value = request.cookies?.[cookieName];
  return typeof value === "string" ? value : undefined;
}
function sendSession(
  response: Response,
  result: Awaited<ReturnType<typeof service.login>> & { recoveryCode?: string },
) {
  response.cookie(cookieName, result.refreshToken, {
    ...cookieOptions(),
    maxAge: REFRESH_SECONDS * 1000,
  });
  ok(response, {
    user: result.user,
    accessToken: result.accessToken,
    ...(result.recoveryCode ? { recoveryCode: result.recoveryCode } : {}),
  });
}
function limiter(limit: number, windowMs: number) {
  return sharedLimiter(`auth-${limit}-${windowMs}`, limit, windowMs);
}
export const authRouter = Router();
authRouter.use((_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});
authRouter.post(
  "/register",
  requireSameOrigin,
  limiter(10, 60 * 60 * 1000),
  async (request, response) => {
    sendSession(response, await service.register(request.body));
  },
);
authRouter.post(
  "/login",
  requireSameOrigin,
  limiter(20, 15 * 60 * 1000),
  async (request, response) => {
    sendSession(response, await service.login(request.body));
  },
);
authRouter.post(
  "/refresh",
  requireSameOrigin,
  limiter(120, 15 * 60 * 1000),
  async (request, response) => {
    const token = readCookie(request);
    if (!token) {
      ok(response, { user: null, accessToken: null });
      return;
    }
    try {
      sendSession(response, await service.refresh(token));
    } catch (error) {
      clear(response);
      throw error;
    }
  },
);
authRouter.post("/logout", requireSameOrigin, async (request, response) => {
  await service.logout(readCookie(request));
  clear(response);
  ok(response, null);
});
authRouter.post(
  "/logout-all",
  requireSameOrigin,
  requireAuth,
  async (request, response) => {
    await service.revokeAll(authenticated(request).user.id);
    clear(response);
    ok(response, null);
  },
);
authRouter.post(
  "/recover",
  requireSameOrigin,
  limiter(5, 15 * 60 * 1000),
  async (request, response) => {
    ok(response, await service.recoverAccount(request.body));
  },
);
authRouter.post(
  "/credentials/change",
  requireSameOrigin,
  requireAuth,
  limiter(10, 15 * 60 * 1000),
  async (request, response) => {
    await service.changePassword(authenticated(request).user.id, request.body);
    clear(response);
    ok(response, null);
  },
);
authRouter.get("/sessions", requireAuth, async (request, response) => {
  const auth = authenticated(request);
  const items = await getDb().authSession.findMany({
    where: {
      userId: auth.user.id,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, createdAt: true, lastUsedAt: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  ok(response, {
    items: items.map((item) => ({
      ...item,
      current: item.id === auth.sessionId,
    })),
  });
});
authRouter.delete(
  "/sessions/:id",
  requireSameOrigin,
  requireAuth,
  async (request, response) => {
    const auth = authenticated(request);
    const id = String(request.params.id);
    const result = await getDb().authSession.updateMany({
      where: { id, userId: auth.user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (!result.count) throw new HttpError(404, "会话不存在。");
    if (id === auth.sessionId) clear(response);
    ok(response, { current: id === auth.sessionId });
  },
);
