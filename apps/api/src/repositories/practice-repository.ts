import { getDb } from "../lib/db";
import type { Prisma } from "../generated/prisma/client";
export const publicQuestion = {
  id: true,
  title: true,
  grade: true,
  subject: true,
  knowledgePoint: true,
  difficulty: true,
  options: true,
  updatedAt: true,
  diagram: true,
} as const;
export async function questionReview(id: string) {
  return getDb().question.findUnique({
    where: { id },
    select: {
      ...publicQuestion,
      answer: true,
      explanation: true,
      status: true,
      restrictToLessons: true,
      _count: { select: { attempts: true } },
      lessonLinks: {
        orderBy: { lessonId: "asc" },
        select: {
          lessonId: true,
          lesson: {
            select: {
              title: true,
              publishedAt: true,
              chapter: {
                select: {
                  title: true,
                  course: {
                    select: { title: true, status: true, access: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}
export async function questionPage(
  where: Prisma.QuestionWhereInput,
  page: number,
  admin = false,
) {
  const db = getDb(),
    pageSize = 12;
  const [total, items] = await db.$transaction([
    db.question.count({ where }),
    db.question.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: admin
        ? {
            ...publicQuestion,
            answer: true,
            explanation: true,
            status: true,
            lessonLinks: { select: { lessonId: true } },
            _count: { select: { attempts: true } },
          }
        : publicQuestion,
    }),
  ]);
  return { items, total, page, pageSize };
}
export async function wrongPage(
  userId: string,
  where: Prisma.WrongQuestionWhereInput,
  page: number,
) {
  const db = getDb(),
    pageSize = 12,
    own = { ...where, userId };
  const [total, items] = await db.$transaction([
    db.wrongQuestion.count({ where: own }),
    db.wrongQuestion.findMany({
      where: own,
      orderBy: [{ lastWrongAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        wrongCount: true,
        lastWrongAt: true,
        resolvedAt: true,
        question: { select: publicQuestion },
      },
    }),
  ]);
  return { items, total, page, pageSize };
}
export async function attemptPage(userId: string, page: number) {
  const db = getDb(),
    pageSize = 12;
  const [total, items] = await db.$transaction([
    db.questionAttempt.count({ where: { userId } }),
    db.questionAttempt.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        questionId: true,
        selected: true,
        correct: true,
        snapshot: true,
        createdAt: true,
      },
    }),
  ]);
  return { items, total, page, pageSize };
}
