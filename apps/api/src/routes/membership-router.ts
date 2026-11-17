import { Router } from "express";
import { z } from "zod";
import {
  authenticated,
  requireAuth,
  requireAdmin,
  requireSameOrigin,
} from "../auth/middleware";
import { parseInput } from "../auth/validation";
import { getDb } from "../lib/db";
import { HttpError, ok } from "../lib/http";
import { activeMembershipWhere } from "../services/entitlement-service";
export const membershipRouter = Router();
membershipRouter.get("/membership", requireAuth, async (req, res) => {
  const items = await getDb().membership.findMany({
    where: activeMembershipWhere(authenticated(req).user.id),
    select: {
      id: true,
      startsAt: true,
      expiresAt: true,
      plan: { select: { name: true } },
    },
    orderBy: { expiresAt: "desc" },
  });
  ok(res, { active: !!items.length, items });
});
membershipRouter.get(
  "/admin/memberships",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { page } = parseInput(
      z
        .object({ page: z.coerce.number().int().min(1).max(10000).default(1) })
        .strict(),
      req.query,
    );
    const db = getDb();
    const [total, items] = await db.$transaction([
      db.membership.count(),
      db.membership.findMany({
        orderBy: { startsAt: "desc" },
        skip: (page - 1) * 20,
        take: 20,
        include: {
          user: { select: { username: true, displayName: true } },
          plan: { select: { name: true } },
        },
      }),
    ]);
    ok(res, { items, total, page, pageSize: 20 });
  },
);
membershipRouter.post(
  "/admin/memberships",
  requireSameOrigin,
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { username, days } = parseInput(
      z
        .object({
          username: z
            .string()
            .trim()
            .toLowerCase()
            .regex(/^[a-z0-9_]{4,32}$/),
          days: z.number().int().min(1).max(365),
        })
        .strict(),
      req.body,
    );
    const result = await getDb().$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { username } });
      if (!user || user.status !== "ACTIVE")
        throw new HttpError(404, "未找到可用账号。");
      const plan = await tx.membershipPlan.upsert({
        where: { code: "LOCAL_MANUAL" },
        create: {
          code: "LOCAL_MANUAL",
          name: "手动授予学习权益",
          active: true,
        },
        update: {},
      });
      if (!plan.active) throw new HttpError(409, "手动权益计划已停用。");
      const membership = await tx.membership.create({
        data: {
          userId: user.id,
          planId: plan.id,
          startsAt: new Date(),
          expiresAt: new Date(Date.now() + days * 86400000),
        },
      });
      await tx.adminAuditLog.create({
        data: {
          actorUserId: authenticated(req).user.id,
          targetUserId: user.id,
          action: `MEMBERSHIP_GRANT:${membership.id}:${days}`,
        },
      });
      return membership;
    });
    ok(res, result);
  },
);
membershipRouter.delete(
  "/admin/memberships/:id",
  requireSameOrigin,
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const result = await getDb().$transaction(async (tx) => {
      const item = await tx.membership.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!item) throw new HttpError(404, "权益记录不存在。");
      if (!item.revokedAt) {
        await tx.membership.update({
          where: { id: item.id },
          data: { revokedAt: new Date() },
        });
        await tx.adminAuditLog.create({
          data: {
            actorUserId: authenticated(req).user.id,
            targetUserId: item.userId,
            action: `MEMBERSHIP_REVOKE:${item.id}`,
          },
        });
      }
      return { id: item.id };
    });
    ok(res, result);
  },
);
