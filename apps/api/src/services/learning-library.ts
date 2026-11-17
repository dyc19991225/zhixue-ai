import { z } from "zod";
import type { LearningLibrary, LibraryState } from "@zhixue/shared";
import { Prisma } from "../generated/prisma/client";
import { getDb } from "../lib/db";
import { HttpError } from "../lib/http";
import { activeMembershipWhere } from "./entitlement-service";
import { courseListSchema } from "./course-list.dto";

export const learningLibrarySchema = courseListSchema
  .extend({
    pageSize: z.coerce.number().int().min(1).max(20).default(6),
    q: z.string().trim().max(120).default(""),
    state: z
      .enum(["ALL", "NOT_STARTED", "IN_PROGRESS", "COMPLETED"])
      .default("ALL"),
  })
  .strict();
type Query = z.infer<typeof learningLibrarySchema>;
type Row = {
  enrollmentId: string;
  courseId: string;
  title: string;
  grade: LearningLibrary["items"][number]["grade"];
  subject: string;
  access: "FREE" | "MEMBER";
  totalLessons: bigint;
  completedLessons: bigint;
  lastStudiedAt: Date | null;
  state: LibraryState;
};
export function learningLibrary(
  userId: string,
  query: Query,
): Promise<LearningLibrary> {
  return getDb().$transaction(
    async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { status: true },
      });
      if (!user || user.status !== "ACTIVE")
        throw new HttpError(401, "账号不可用，请重新登录。");
      const cte = Prisma.sql`WITH scoped AS (
      SELECT e.id AS "enrollmentId", c.id AS "courseId", c.title, c.grade, c.subject, c.access,
        e."createdAt" AS "enrolledAt", s.total AS "totalLessons", s.done AS "completedLessons",
        s.last_at AS "lastStudiedAt",
        CASE WHEN s.total > 0 AND s.done = s.total THEN 'COMPLETED'
             WHEN s.progress > 0 THEN 'IN_PROGRESS' ELSE 'NOT_STARTED' END AS state
      FROM "Enrollment" e JOIN "Course" c ON c.id = e."courseId"
      CROSS JOIN LATERAL (
        SELECT COUNT(l.id) AS total, COUNT(p.id) FILTER (WHERE p."completedAt" IS NOT NULL) AS done,
          COUNT(p.id) AS progress, MAX(p."updatedAt") AS last_at
        FROM "Chapter" ch JOIN "Lesson" l ON l."chapterId" = ch.id
        LEFT JOIN "LessonProgress" p ON p."lessonId" = l.id AND p."enrollmentId" = e.id
        WHERE ch."courseId" = c.id AND l."publishedAt" IS NOT NULL
      ) s
      WHERE e."userId" = ${userId} AND c.status = 'PUBLISHED'
        AND (${query.q} = '' OR POSITION(LOWER(${query.q}) IN LOWER(c.title)) > 0)
    )`;
      const stateWhere =
        query.state === "ALL"
          ? Prisma.sql`TRUE`
          : Prisma.sql`state = ${query.state}`;
      const [stats, totals, rows, membership] = await Promise.all([
        tx.$queryRaw<
          {
            all: bigint;
            notStarted: bigint;
            inProgress: bigint;
            completed: bigint;
          }[]
        >(Prisma.sql`${cte}
        SELECT COUNT(*) AS all, COUNT(*) FILTER (WHERE state='NOT_STARTED') AS "notStarted",
          COUNT(*) FILTER (WHERE state='IN_PROGRESS') AS "inProgress", COUNT(*) FILTER (WHERE state='COMPLETED') AS completed FROM scoped`),
        tx.$queryRaw<{ total: bigint }[]>(
          Prisma.sql`${cte} SELECT COUNT(*) AS total FROM scoped WHERE ${stateWhere}`,
        ),
        tx.$queryRaw<
          Row[]
        >(Prisma.sql`${cte} SELECT * FROM scoped WHERE ${stateWhere}
        ORDER BY "lastStudiedAt" DESC NULLS LAST, "enrolledAt" DESC, "enrollmentId" ASC
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`),
        tx.membership.findFirst({
          where: activeMembershipWhere(userId),
          select: { id: true },
        }),
      ]);
      const items: LearningLibrary["items"] = [];
      for (const row of rows) {
        const canStudy = row.access === "FREE" || !!membership;
        const lessons = canStudy
          ? await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
        SELECT l.id FROM "Chapter" ch JOIN "Lesson" l ON l."chapterId" = ch.id
        LEFT JOIN "LessonProgress" p ON p."lessonId" = l.id AND p."enrollmentId" = ${row.enrollmentId}
        WHERE ch."courseId" = ${row.courseId} AND l."publishedAt" IS NOT NULL
        ORDER BY (p."completedAt" IS NULL) DESC,
          CASE WHEN p."completedAt" IS NULL THEN p."updatedAt" END DESC NULLS LAST,
          ch.position ASC, l.position ASC, l.id ASC LIMIT 1`)
          : [];
        items.push({
          courseId: row.courseId,
          title: row.title,
          grade: row.grade,
          subject: row.subject,
          access: row.access,
          totalLessons: Number(row.totalLessons),
          completedLessons: Number(row.completedLessons),
          state: row.state,
          lastStudiedAt: row.lastStudiedAt?.toISOString() ?? null,
          nextLessonId: lessons[0]?.id ?? null,
          canStudy,
        });
      }
      return {
        page: query.page,
        pageSize: query.pageSize,
        total: Number(totals[0].total),
        counts: {
          all: Number(stats[0].all),
          notStarted: Number(stats[0].notStarted),
          inProgress: Number(stats[0].inProgress),
          completed: Number(stats[0].completed),
        },
        items,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}
