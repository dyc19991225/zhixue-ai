import { Router } from "express";
import { z } from "zod";
import {
  authenticated,
  requireAuth,
  requireSameOrigin,
} from "../auth/middleware";
import { parseInput } from "../auth/validation";
import { getDb } from "../lib/db";
import { ok, HttpError } from "../lib/http";
import { aiConfigured, askTeacher } from "../services/ai-service";
import { limiter } from "../lib/rate-limiter";
export const aiRouter = Router();
aiRouter.get("/ai/status", (_req, res) =>
  ok(res, {
    enabled: aiConfigured(),
    imagesEnabled: aiConfigured() && process.env.AI_IMAGE_ENABLED === "true",
    historyRetention: "手动删除",
    mode: "single-question",
  }),
);
aiRouter.get("/ai/history", requireAuth, async (req, res) =>
  ok(res, {
    items: await getDb().aiTurn.findMany({
      where: { userId: authenticated(req).user.id },
      select: {
        id: true,
        question: true,
        answer: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
  }),
);
aiRouter.post(
  "/ai/questions",
  requireSameOrigin,
  requireAuth,
  limiter("ai", 10, 60000),
  async (req, res) => {
    const turn = await askTeacher(authenticated(req).user.id, req.body);
    ok(res, {
      id: turn.id,
      question: turn.question,
      answer: turn.answer,
      status: turn.status,
      createdAt: turn.createdAt,
    });
  },
);
aiRouter.get("/ai/questions/:requestId", requireAuth, async (req, res) => {
  const requestId = parseInput(z.uuid(), req.params.requestId);
  const turn = await getDb().aiTurn.findUnique({
    where: {
      userId_requestId: { userId: authenticated(req).user.id, requestId },
    },
    select: {
      id: true,
      question: true,
      answer: true,
      status: true,
      createdAt: true,
    },
  });
  if (!turn)
    throw new HttpError(404, "尚未找到本次提问，请保留原问题稍后重试。");
  ok(res, turn);
});
aiRouter.delete(
  "/ai/history",
  requireSameOrigin,
  requireAuth,
  async (req, res) => {
    parseInput(z.object({ confirm: z.literal(true) }).strict(), req.body);
    await getDb().aiTurn.deleteMany({
      where: { userId: authenticated(req).user.id, status: { not: "PENDING" } },
    });
    ok(res, null);
  },
);
