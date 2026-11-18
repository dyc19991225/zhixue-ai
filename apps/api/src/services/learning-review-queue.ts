import { z } from "zod";
import type { LearningReviewNext, LearningReviewQueue } from "@zhixue/shared";
import { Prisma } from "../generated/prisma/client";
import { getDb } from "../lib/db";
import { HttpError } from "../lib/http";
import { activeMembershipWhere } from "./entitlement-service";
import { courseListSchema } from "./course-list.dto";

export const learningReviewQueueSchema = courseListSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(20).default(6),
});

type Query = z.infer<typeof learningReviewQueueSchema>;

async function pendingReviewLinks(
  tx: Prisma.TransactionClient,
  userId: string,
  roundId?: string,
) {
  const membership = await tx.membership.findFirst({
    where: activeMembershipWhere(userId),
    select: { id: true },
  });
  return Prisma.sql`
    WITH pending AS (
      SELECT ch."courseId", lq."lessonId", w."questionId", w."lastWrongAt"
      FROM "WrongQuestion" w
      JOIN "Question" q ON q.id = w."questionId"
      JOIN "LessonQuestion" lq ON lq."questionId" = q.id
      JOIN "Lesson" l ON l.id = lq."lessonId"
      JOIN "Chapter" ch ON ch.id = l."chapterId"
      JOIN "Course" c ON c.id = ch."courseId"
      JOIN "Enrollment" e ON e."courseId" = c.id AND e."userId" = w."userId"
      WHERE w."userId" = ${userId} AND w."resolvedAt" IS NULL
        AND q.status = 'PUBLISHED' AND l."publishedAt" IS NOT NULL
        AND c.status = 'PUBLISHED' AND (c.access = 'FREE' OR ${!!membership})
        ${roundId ? Prisma.sql`AND EXISTS (SELECT 1 FROM "LearningReviewRoundItem" ri WHERE ri."roundId" = ${roundId} AND ri."questionId" = q.id AND ri."correctAt" IS NULL)` : Prisma.empty}
    )
  `;
}

export function learningReviewQueue(
  userId: string,
  { page, pageSize }: Query,
): Promise<LearningReviewQueue> {
  return getDb().$transaction(
    async (tx) => {
      const links = await pendingReviewLinks(tx, userId);
      const [result] = await tx.$queryRaw<
        { total: bigint; items: LearningReviewQueue["items"] }[]
      >(Prisma.sql`
        ${links},
        courses AS (
          SELECT "courseId", COUNT(DISTINCT "questionId") AS "wrongCount",
            MAX("lastWrongAt") AS "lastWrongAt"
          FROM pending GROUP BY "courseId"
        ),
        course_page AS (
          SELECT * FROM courses ORDER BY "lastWrongAt" DESC, "courseId"
          LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
        ),
        lessons AS (
          SELECT p."courseId", p."lessonId", COUNT(*) AS "wrongCount"
          FROM pending p JOIN course_page cp ON cp."courseId" = p."courseId"
          GROUP BY p."courseId", p."lessonId"
        )
        SELECT (SELECT COUNT(*) FROM courses) AS total,
          COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'courseId', c.id,
              'title', c.title,
              'grade', c.grade,
              'subject', c.subject,
              'wrongCount', cp."wrongCount",
              'lessons', (
                SELECT jsonb_agg(jsonb_build_object(
                  'lessonId', l.id, 'title', l.title, 'wrongCount', lc."wrongCount"
                ) ORDER BY ch.position, l.position, l.id)
                FROM lessons lc
                JOIN "Lesson" l ON l.id = lc."lessonId"
                JOIN "Chapter" ch ON ch.id = l."chapterId"
                WHERE lc."courseId" = cp."courseId"
              )
            ) ORDER BY cp."lastWrongAt" DESC, c.id)
            FROM course_page cp JOIN "Course" c ON c.id = cp."courseId"
          ), '[]'::jsonb) AS items
      `);
      return {
        page,
        pageSize,
        total: Number(result.total),
        items: result.items,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export const learningReviewNextSchema = z
  .strictObject({
    courseId: z.string().min(1).max(100).optional(),
    lessonId: z.string().min(1).max(100).optional(),
    roundId: z.uuid().optional(),
  })
  .refine(
    ({ courseId, lessonId }) => Boolean(courseId) === Boolean(lessonId),
    "课程和课时需同时提供。",
  );

export function learningReviewNext(
  userId: string,
  { courseId, lessonId, roundId }: z.infer<typeof learningReviewNextSchema>,
): Promise<LearningReviewNext> {
  return getDb().$transaction(
    async (tx) => {
      const round = roundId
        ? await ownedReviewRound(tx, userId, roundId)
        : undefined;
      if (round?.finishedAt)
        return {
          currentPending: courseId ? 0 : null,
          next: null,
          round: {
            id: round.id,
            total: round.total,
            correct: round.correct,
            remaining: 0,
            skipped: round.total - round.correct,
          },
        };
      const links = await pendingReviewLinks(tx, userId, roundId);
      const [result] = await tx.$queryRaw<
        {
          remaining: bigint;
          roundRemaining: bigint;
          next: LearningReviewNext["next"];
        }[]
      >(Prisma.sql`
        ${links},
        current_lesson AS (
          SELECT COUNT(*) AS remaining FROM pending
          WHERE "courseId" = ${courseId ?? null} AND "lessonId" = ${lessonId ?? null}
        ),
        candidate_lessons AS (
          SELECT "courseId", "lessonId", COUNT(*) AS "wrongCount",
            MAX(MAX("lastWrongAt")) OVER (PARTITION BY "courseId") AS "courseLastWrongAt"
          FROM pending
          WHERE (SELECT remaining FROM current_lesson) = 0
          GROUP BY "courseId", "lessonId"
        )
        SELECT remaining, (SELECT COUNT(DISTINCT "questionId") FROM pending) AS "roundRemaining", (
          SELECT jsonb_build_object(
            'courseId', c.id, 'lessonId', l.id, 'courseTitle', c.title,
            'lessonTitle', l.title, 'wrongCount', candidate."wrongCount"
          )
          FROM candidate_lessons candidate
          JOIN "Lesson" l ON l.id = candidate."lessonId"
          JOIN "Chapter" ch ON ch.id = l."chapterId"
          JOIN "Course" c ON c.id = candidate."courseId"
          ORDER BY (c.id = ${courseId ?? null}) DESC NULLS LAST,
            candidate."courseLastWrongAt" DESC, c.id, ch.position, l.position, l.id
          LIMIT 1
        ) AS next
        FROM current_lesson
      `);
      return {
        currentPending: courseId ? Number(result.remaining) : null,
        next: result.next,
        ...(round
          ? {
              round: {
                id: round.id,
                total: round.total,
                correct: round.correct,
                remaining: Number(result.roundRemaining),
                skipped:
                  round.total - round.correct - Number(result.roundRemaining),
              },
            }
          : {}),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export const startLearningReviewRoundSchema = z.strictObject({
  roundId: z.uuid(),
});

export async function ownedReviewRound(
  tx: Prisma.TransactionClient,
  userId: string,
  roundId: string,
) {
  const round = await tx.learningReviewRound.findFirst({
    where: { id: roundId, userId, user: { role: "STUDENT", status: "ACTIVE" } },
  });
  if (!round) throw new HttpError(404, "复练记录不存在。");
  return round;
}

export async function startLearningReviewRound(
  userId: string,
  roundId: string,
): Promise<LearningReviewNext> {
  const db = getDb();
  try {
    await db.$transaction(
      async (tx) => {
        const existing = await tx.learningReviewRound.findUnique({
          where: { id: roundId },
        });
        if (existing) {
          await ownedReviewRound(tx, userId, roundId);
          return;
        }
        const links = await pendingReviewLinks(tx, userId);
        const questions = await tx.$queryRaw<{ questionId: string }[]>(
          Prisma.sql`${links} SELECT DISTINCT "questionId" FROM pending`,
        );
        await tx.learningReviewRound.create({
          data: {
            id: roundId,
            userId,
            total: questions.length,
            finishedAt: questions.length ? null : new Date(),
            ...(questions.length
              ? { items: { createMany: { data: questions } } }
              : {}),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  } catch (cause) {
    if (
      !(cause instanceof Prisma.PrismaClientKnownRequestError) ||
      cause.code !== "P2002"
    )
      throw cause;
    await ownedReviewRound(db, userId, roundId);
  }
  return learningReviewNext(userId, { roundId });
}

export async function requirePendingRoundQuestion(
  tx: Prisma.TransactionClient,
  userId: string,
  roundId: string,
  questionId: string,
) {
  // Serialize corrections and completion within a round, independently of question order.
  await tx.$queryRaw`SELECT id FROM "LearningReviewRound" WHERE id = ${roundId} AND "userId" = ${userId} FOR UPDATE`;
  const round = await ownedReviewRound(tx, userId, roundId);
  const links = await pendingReviewLinks(tx, userId, roundId);
  const [status] = await tx.$queryRaw<{ available: boolean }[]>(
    Prisma.sql`${links} SELECT EXISTS (SELECT 1 FROM pending WHERE "questionId" = ${questionId}) AS available`,
  );
  if (round.finishedAt || !status.available)
    throw new HttpError(409, "这道题已不在本轮待复练中，请刷新列表。");
}

export async function markRoundQuestionCorrect(
  tx: Prisma.TransactionClient,
  userId: string,
  roundId: string,
  questionId: string,
) {
  await tx.learningReviewRoundItem.update({
    where: { roundId_questionId: { roundId, questionId } },
    data: { correctAt: new Date() },
  });
  const links = await pendingReviewLinks(tx, userId, roundId);
  const [status] = await tx.$queryRaw<{ hasPending: boolean }[]>(
    Prisma.sql`${links} SELECT EXISTS (SELECT 1 FROM pending) AS "hasPending"`,
  );
  await tx.learningReviewRound.update({
    where: { id: roundId },
    data: {
      correct: { increment: 1 },
      ...(!status.hasPending ? { finishedAt: new Date() } : {}),
    },
  });
}
