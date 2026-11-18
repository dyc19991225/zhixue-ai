import { z } from "zod";
import type { LearningReviewNext, LearningReviewQueue } from "@zhixue/shared";
import { Prisma } from "../generated/prisma/client";
import { getDb } from "../lib/db";
import { activeMembershipWhere } from "./entitlement-service";
import { courseListSchema } from "./course-list.dto";

export const learningReviewQueueSchema = courseListSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(20).default(6),
});

type Query = z.infer<typeof learningReviewQueueSchema>;

async function pendingReviewLinks(
  tx: Prisma.TransactionClient,
  userId: string,
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
  })
  .refine(
    ({ courseId, lessonId }) => Boolean(courseId) === Boolean(lessonId),
    "课程和课时需同时提供。",
  );

export function learningReviewNext(
  userId: string,
  { courseId, lessonId }: z.infer<typeof learningReviewNextSchema>,
): Promise<LearningReviewNext> {
  return getDb().$transaction(
    async (tx) => {
      const links = await pendingReviewLinks(tx, userId);
      const [result] = await tx.$queryRaw<
        { remaining: bigint; next: LearningReviewNext["next"] }[]
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
        SELECT remaining, (
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
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
