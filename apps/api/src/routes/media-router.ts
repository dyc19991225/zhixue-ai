import { Router } from "express";
import { z } from "zod";
import {
  authenticated,
  requireAdmin,
  requireAuth,
  requireSameOrigin,
} from "../auth/middleware";
import { parseInput } from "../auth/validation";
import { getDb } from "../lib/db";
import { HttpError, ok } from "../lib/http";
import {
  issuePlayback,
  streamMedia,
  uploadMedia,
} from "../services/media-service";
import { learning } from "../services/learning-service";
export const mediaRouter = Router();
mediaRouter.post(
  "/admin/media",
  requireSameOrigin,
  requireAuth,
  requireAdmin,
  async (req, res) => ok(res, await uploadMedia(req)),
);
mediaRouter.get("/admin/media", requireAuth, requireAdmin, async (_req, res) =>
  ok(res, {
    items: await getDb().mediaAsset.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, filename: true, size: true, createdAt: true },
    }),
  }),
);
mediaRouter.post(
  "/learning/:id/lessons/:lessonId/playback",
  requireSameOrigin,
  requireAuth,
  async (req, res) =>
    ok(
      res,
      await issuePlayback(
        authenticated(req).user.id,
        authenticated(req).sessionId,
        String(req.params.id),
        String(req.params.lessonId),
        res,
      ),
    ),
);
mediaRouter.get("/media/:id/content", streamMedia);
mediaRouter.put(
  "/learning/:id/lessons/:lessonId/position",
  requireSameOrigin,
  requireAuth,
  async (req, res) => {
    const { positionSeconds } = parseInput(
      z
        .object({ positionSeconds: z.number().finite().min(0).max(86400) })
        .strict(),
      req.body,
    );
    const userId = authenticated(req).user.id,
      courseId = String(req.params.id),
      lessonId = String(req.params.lessonId);
    await learning(userId, courseId);
    const lesson = await getDb().lesson.findFirst({
      where: {
        id: lessonId,
        chapter: { courseId },
        mediaId: { not: null },
        publishedAt: { not: null },
      },
    });
    if (!lesson) throw new HttpError(404, "视频课时不存在。");
    const enrollment = await getDb().enrollment.findUniqueOrThrow({
      where: { userId_courseId: { userId, courseId } },
    });
    await getDb().lessonProgress.upsert({
      where: {
        enrollmentId_lessonId: { enrollmentId: enrollment.id, lessonId },
      },
      create: { enrollmentId: enrollment.id, lessonId, positionSeconds },
      update: { positionSeconds },
    });
    ok(res, { positionSeconds });
  },
);
