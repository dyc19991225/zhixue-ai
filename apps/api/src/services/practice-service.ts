import { getDb } from "../lib/db";
import { HttpError } from "../lib/http";
import { parseInput } from "../auth/validation";
import { Prisma } from "../generated/prisma/client";
import { questionVisibility } from "./question-access";
import {
  attemptSchema,
  questionSchema,
  questionUpdateSchema,
  questionStatusSchema,
} from "./practice-validation";
export async function saveQuestion(id: string | null, input: unknown) {
  const parsed = id
    ? parseInput(questionUpdateSchema, input)
    : { ...parseInput(questionSchema, input), updatedAt: undefined };
  const { updatedAt, lessonIds, diagram, ...data } = parsed;
  return getDb().$transaction(async (tx) => {
    if (id)
      await tx.$queryRaw`SELECT id FROM "Question" WHERE id = ${id} FOR UPDATE`;
    const question = id
      ? await tx.question.findUnique({
          where: { id },
          include: { _count: { select: { attempts: true } } },
        })
      : null;
    if (id && !question) throw new HttpError(404, "题目不存在。");
    if (question && question.updatedAt.toISOString() !== updatedAt)
      throw new HttpError(409, "题目已更新，请刷新后再编辑。");
    if (question?.status === "PUBLISHED")
      throw new HttpError(409, "请先将题目转为草稿。");
    if (question?._count.attempts)
      throw new HttpError(
        409,
        "已有作答记录的题目不能改写，请归档后创建新题，以保留原始记录。",
      );
    if (
      lessonIds &&
      (await tx.lesson.count({ where: { id: { in: lessonIds } } })) !==
        lessonIds.length
    )
      throw new HttpError(400, "关联课时不存在。");
    const values = {
      ...data,
      ...(diagram !== undefined ? { diagram: diagram ?? Prisma.DbNull } : {}),
      ...(lessonIds ? { restrictToLessons: lessonIds.length > 0 } : {}),
    };
    const result = id
      ? await tx.question.update({ where: { id }, data: values })
      : await tx.question.create({ data: values });
    if (lessonIds) {
      await tx.lessonQuestion.deleteMany({ where: { questionId: result.id } });
      await tx.lessonQuestion.createMany({
        data: lessonIds.map((lessonId) => ({
          lessonId,
          questionId: result.id,
        })),
      });
    }
    return result;
  });
}
export async function questionStatus(id: string, input: unknown) {
  const { status, updatedAt } = parseInput(questionStatusSchema, input);
  return getDb().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Question" WHERE id = ${id} FOR UPDATE`;
    const question = await tx.question.findUnique({ where: { id } });
    if (!question) throw new HttpError(404, "题目不存在。");
    if (question.updatedAt.toISOString() !== updatedAt)
      throw new HttpError(409, "题目已更新，请刷新列表。");
    if (status === "PUBLISHED" && !question.explanation.trim())
      throw new HttpError(400, "发布前请填写答案解析。");
    return tx.question.update({ where: { id }, data: { status } });
  });
}
export async function submitAnswer(
  userId: string,
  questionId: string,
  input: unknown,
) {
  const { selected, requestId, updatedAt } = parseInput(attemptSchema, input);
  const db = getDb();
  const visibility = await questionVisibility(userId);
  function replay<T extends { questionId: string; selected: number }>(
    attempt: T,
  ) {
    if (attempt.questionId !== questionId || attempt.selected !== selected)
      throw new HttpError(409, "本次提交标识已被使用，请重新作答。");
    return attempt;
  }
  try {
    return await db.$transaction(async (tx) => {
      // A shared question lock orders answer submissions against edits and publication.
      await tx.$queryRaw`SELECT id FROM "Question" WHERE id = ${questionId} FOR UPDATE`;
      const prior = await tx.questionAttempt.findUnique({
        where: { userId_requestId: { userId, requestId } },
      });
      if (prior) return replay(prior);
      const question = await tx.question.findFirst({
        where: { id: questionId, ...visibility },
      });
      if (!question || question.status !== "PUBLISHED")
        throw new HttpError(404, "题目不存在或已下架。");
      if (question.updatedAt.toISOString() !== updatedAt)
        throw new HttpError(409, "题目已更新，请刷新后重新作答。");
      const correct = selected === question.answer;
      const attempt = await tx.questionAttempt.create({
        data: {
          userId,
          questionId,
          requestId,
          selected,
          correct,
          snapshot: {
            title: question.title,
            options: question.options,
            answer: question.answer,
            explanation: question.explanation,
            ...(question.diagram ? { diagram: question.diagram } : {}),
          },
        },
      });
      if (correct)
        await tx.wrongQuestion.updateMany({
          where: { userId, questionId, resolvedAt: null },
          data: { resolvedAt: new Date() },
        });
      else
        await tx.wrongQuestion.upsert({
          where: { userId_questionId: { userId, questionId } },
          create: { userId, questionId },
          update: {
            wrongCount: { increment: 1 },
            lastWrongAt: new Date(),
            resolvedAt: null,
          },
        });
      return attempt;
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const prior = await db.questionAttempt.findUnique({
        where: { userId_requestId: { userId, requestId } },
      });
      if (prior) return replay(prior);
    }
    throw error;
  }
}
