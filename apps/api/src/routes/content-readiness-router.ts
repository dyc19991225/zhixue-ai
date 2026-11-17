import { Router } from "express";
import { z } from "zod";
import { requireAdmin, requireAuth } from "../auth/middleware";
import { parseInput } from "../auth/validation";
import { ok } from "../lib/http";
import { contentReadiness } from "../services/content-readiness";
import {
  lessonReadiness,
  lessonReadinessQuery,
} from "../services/lesson-readiness";
export const contentReadinessRouter = Router();
contentReadinessRouter.get(
  "/admin/lesson-readiness",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    ok(res, await lessonReadiness(parseInput(lessonReadinessQuery, req.query)));
  },
);
contentReadinessRouter.get(
  "/admin/content-readiness",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const { grade } = parseInput(
      z
        .object({
          grade: z.enum(["G7", "G8", "G9", "G10", "G11", "G12"]).default("G7"),
        })
        .strict(),
      req.query,
    );
    ok(res, await contentReadiness(grade));
  },
);
