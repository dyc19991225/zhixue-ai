import type { RequestHandler } from "express";
import { authenticated } from "../auth/middleware";
import { parseInput } from "../auth/validation";
import { ok } from "../lib/http";
import { questionVisibility } from "../services/question-access";
import {
  attemptPage,
  questionPage,
  wrongPage,
} from "../repositories/practice-repository";
import {
  pageSchema,
  adminQuestionQuerySchema,
  practiceQuerySchema,
  wrongQuerySchema,
} from "../services/practice-validation";
import {
  questionStatus,
  saveQuestion,
  submitAnswer,
} from "../services/practice-service";
export const listQuestions: RequestHandler = async (req, res) => {
  const { page, knowledgePoint, q, ...filter } = parseInput(
    practiceQuerySchema,
    req.query,
  );
  ok(
    res,
    await questionPage(
      {
        ...filter,
        ...(q
          ? {
              title: {
                contains: q.replace(/[\\%_]/g, "\\$&"),
                mode: "insensitive" as const,
              },
            }
          : {}),
        status: "PUBLISHED",
        ...(await questionVisibility()),
        ...(knowledgePoint
          ? {
              knowledgePoint: { contains: knowledgePoint, mode: "insensitive" },
            }
          : {}),
      },
      page,
    ),
  );
};
export const listAdminQuestions: RequestHandler = async (req, res) => {
  const { page, knowledgePoint, q, lessonId, ...filter } = parseInput(
    adminQuestionQuerySchema,
    req.query,
  );
  ok(
    res,
    await questionPage(
      {
        ...filter,
        ...(lessonId ? { lessonLinks: { some: { lessonId } } } : {}),
        ...(q
          ? {
              title: {
                contains: q.replace(/[\\%_]/g, "\\$&"),
                mode: "insensitive" as const,
              },
            }
          : {}),
        ...(knowledgePoint
          ? {
              knowledgePoint: {
                contains: knowledgePoint.replace(/[\\%_]/g, "\\$&"),
                mode: "insensitive",
              },
            }
          : {}),
      },
      page,
      true,
    ),
  );
};
export const listWrongQuestions: RequestHandler = async (req, res) => {
  const { page, state, ...filter } = parseInput(wrongQuerySchema, req.query);
  ok(
    res,
    await wrongPage(
      authenticated(req).user.id,
      {
        resolvedAt: state === "active" ? null : { not: null },
        question: {
          status: "PUBLISHED",
          ...filter,
          ...(await questionVisibility(authenticated(req).user.id)),
        },
      },
      page,
    ),
  );
};
export const listAttempts: RequestHandler = async (req, res) =>
  ok(
    res,
    await attemptPage(
      authenticated(req).user.id,
      parseInput(pageSchema, req.query).page,
    ),
  );
export const answerQuestion: RequestHandler = async (req, res) => {
  const attempt = await submitAnswer(
    authenticated(req).user.id,
    String(req.params.id),
    req.body,
  );
  ok(res, {
    id: attempt.id,
    questionId: attempt.questionId,
    selected: attempt.selected,
    correct: attempt.correct,
    snapshot: attempt.snapshot,
    createdAt: attempt.createdAt,
  });
};
export const createQuestion: RequestHandler = async (req, res) =>
  ok(res, await saveQuestion(null, req.body));
export const updateQuestion: RequestHandler = async (req, res) =>
  ok(res, await saveQuestion(String(req.params.id), req.body));
export const changeQuestionStatus: RequestHandler = async (req, res) =>
  ok(res, await questionStatus(String(req.params.id), req.body));
