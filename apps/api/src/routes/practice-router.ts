import { Router } from "express";
import { z } from "zod";
import { parseInput } from "../auth/validation";
import { HttpError, ok } from "../lib/http";
import { questionReview } from "../repositories/practice-repository";
import { limiter } from "../lib/rate-limiter";
import {
  requireAdmin,
  requireAuth,
  requireSameOrigin,
} from "../auth/middleware";
import {
  answerQuestion,
  changeQuestionStatus,
  createQuestion,
  listAdminQuestions,
  listAttempts,
  listQuestions,
  listWrongQuestions,
  updateQuestion,
} from "../controllers/practice-controller";
export const practiceRouter = Router();
practiceRouter.get(
  "/admin/questions/:id/review",
  requireAuth,
  requireAdmin,
  async (req, res) => {
    const id = parseInput(z.string().min(1).max(100), req.params.id);
    const question = await questionReview(id);
    if (!question) throw new HttpError(404, "题目不存在。");
    ok(res, question);
  },
);
const writes = [requireSameOrigin, requireAuth, requireAdmin];
const answerLimit = limiter("practice", 120, 60000);
practiceRouter.get("/practice/questions", listQuestions);
practiceRouter.post(
  "/practice/questions/:id/attempts",
  requireSameOrigin,
  requireAuth,
  answerLimit,
  answerQuestion,
);
practiceRouter.get(
  "/practice/wrong-questions",
  requireAuth,
  listWrongQuestions,
);
practiceRouter.get("/practice/attempts", requireAuth, listAttempts);
practiceRouter.get(
  "/admin/questions",
  requireAuth,
  requireAdmin,
  listAdminQuestions,
);
practiceRouter.post("/admin/questions", ...writes, createQuestion);
practiceRouter.put("/admin/questions/:id", ...writes, updateQuestion);
practiceRouter.patch(
  "/admin/questions/:id/status",
  ...writes,
  changeQuestionStatus,
);
