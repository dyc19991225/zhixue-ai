import { z } from "zod";
import type { LearningReviewQueue } from "@zhixue/shared";
import { Prisma } from "../generated/prisma/client";
import { getDb } from "../lib/db";
import { activeMembershipWhere } from "./entitlement-service";
import { courseListSchema } from "./course-list.dto";

export const learningReviewQueueSchema = courseListSchema.extend({
  pageSize: z.coerce.number().int().min(1).max(20).default(6),
});

type Query = z.infer<typeof learningReviewQueueSchema>;

export function learningReviewQueue(
  userId: string,
  { page, pageSize }: Query,
): Promise<LearningReviewQueue> {
  return getDb().$transaction(
    async (tx) => {
      const membership = await tx.membership.findFirst({
        where: activeMembershipWhere(userId),
        select: { id: true },
      });
      const [result] = await tx.$queryRaw<
        { total: bigint; items: LearningReviewQueue["items"] }[]
      >(Prisma.sql`
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
        ),
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
