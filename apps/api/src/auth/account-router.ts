import { Router } from "express";
import { getDb } from "../lib/db";
import { HttpError, ok } from "../lib/http";
import {
  requireAuth,
  requireAdmin,
  requireSameOrigin,
  authenticated,
} from "./middleware";
import { parseInput, statusSchema } from "./validation";
import { updateProfile } from "./service";
import { Prisma } from "../generated/prisma/client";
export const accountRouter = Router();
accountRouter.use((_request, response, next) => {
  response.set("Cache-Control", "no-store");
  next();
});
accountRouter.get("/users/me", requireAuth, (request, response) => {
  ok(response, authenticated(request).user);
});
accountRouter.patch(
  "/users/me",
  requireSameOrigin,
  requireAuth,
  async (request, response) => {
    ok(
      response,
      await updateProfile(authenticated(request).user.id, request.body),
    );
  },
);
accountRouter.get(
  "/admin/users",
  requireAuth,
  requireAdmin,
  async (request, response) => {
    const page = Number(request.query.page ?? 1);
    if (!Number.isInteger(page) || page < 1 || page > 10000)
      throw new HttpError(400, "分页参数无效。");
    const db = getDb();
    const [total, items] = await db.$transaction([
      db.user.count(),
      db.user.findMany({
        skip: (page - 1) * 20,
        take: 20,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          username: true,
          displayName: true,
          grade: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);
    ok(response, { items, total, page, pageSize: 20 });
  },
);
accountRouter.patch(
  "/admin/users/:id/status",
  requireSameOrigin,
  requireAuth,
  requireAdmin,
  async (request, response) => {
    const auth = authenticated(request);
    const targetId = String(request.params.id);
    const { status } = parseInput(statusSchema, request.body);
    if (targetId === auth.user.id)
      throw new HttpError(400, "不能在此修改自己的账户状态。");
    const db = getDb();
    try {
      const result = await db.$transaction(
        async (tx) => {
          const actor = await tx.user.findUnique({
            where: { id: auth.user.id },
          });
          if (actor?.role !== "ADMIN" || actor.status !== "ACTIVE")
            throw new HttpError(403, "管理员权限已失效。");
          const target = await tx.user.findUnique({ where: { id: targetId } });
          if (!target) throw new HttpError(404, "用户不存在。");
          if (
            target.role === "ADMIN" &&
            target.status === "ACTIVE" &&
            status === "DISABLED" &&
            (await tx.user.count({
              where: { role: "ADMIN", status: "ACTIVE" },
            })) <= 1
          )
            throw new HttpError(400, "不能停用最后一个管理员。");
          await tx.user.update({ where: { id: targetId }, data: { status } });
          if (status === "DISABLED")
            await tx.authSession.updateMany({
              where: { userId: targetId, revokedAt: null },
              data: { revokedAt: new Date() },
            });
          await tx.adminAuditLog.create({
            data: {
              actorUserId: auth.user.id,
              targetUserId: targetId,
              action: `USER_STATUS_${status}`,
            },
          });
          return { id: targetId, status };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      ok(response, result);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034"
      )
        throw new HttpError(409, "账户状态正在更新，请稍后重试。");
      throw error;
    }
  },
);
