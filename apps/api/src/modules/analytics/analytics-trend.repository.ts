import { Prisma } from "../../generated/prisma/client";
import type { AnalyticsTransaction as Tx } from "./analytics.types";
export type DailyCount = { date: string; count: number; correct: number };
export async function trendRecords(
  tx: Tx,
  from: Date,
  until: Date,
  scope: { studentId: string } | { classId: string },
) {
  const start = from.toISOString(),
    end = until.toISOString();
  const member =
    "classId" in scope
      ? Prisma.sql`AND EXISTS (SELECT 1 FROM class_students m JOIN "User" u ON u.id=m.student_id WHERE m.class_id=${scope.classId} AND m.student_id=s.student_id AND m.revoked_at IS NULL AND u.role='STUDENT' AND u.status='ACTIVE')`
      : Prisma.empty;
  const student =
    "studentId" in scope
      ? Prisma.sql`AND s.student_id=${scope.studentId}`
      : Prisma.empty;
  const homeworkScope =
    "classId" in scope
      ? Prisma.sql`AND h.class_id=${scope.classId}`
      : Prisma.empty;
  const examScope =
    "classId" in scope
      ? Prisma.sql`AND h.class_id=${scope.classId}`
      : Prisma.empty;
  const homework = await tx.$queryRaw<DailyCount[]>(Prisma.sql`
    SELECT to_char(s.submitted_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS date,count(*)::int AS count,0::int AS correct
    FROM homework_submissions s JOIN homework h ON h.id=s.homework_id
    WHERE h.status!='DRAFT' AND s.submitted_at>=${start}::timestamptz AND s.submitted_at<${end}::timestamptz ${student} ${homeworkScope} ${member}
    GROUP BY 1 ORDER BY 1`);
  const exams = await tx.$queryRaw<DailyCount[]>(Prisma.sql`
    SELECT to_char(s.submitted_at AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS date,count(*)::int AS count,0::int AS correct
    FROM exam_attempts s JOIN exams h ON h.id=s.exam_id
    WHERE h.status!='DRAFT' AND s.submitted_at>=${start}::timestamptz AND s.submitted_at<${end}::timestamptz ${student} ${examScope} ${member}
    GROUP BY 1 ORDER BY 1`);
  if ("classId" in scope) return { homework, exams, practice: [], lessons: [] };
  const practice = await tx.$queryRaw<DailyCount[]>(Prisma.sql`
    SELECT to_char(("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS date,count(*)::int AS count,count(*) FILTER (WHERE correct)::int AS correct
    FROM "QuestionAttempt" WHERE "userId"=${scope.studentId}
    AND "createdAt">=(${start}::timestamptz AT TIME ZONE 'UTC') AND "createdAt"<(${end}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1 ORDER BY 1`);
  const lessons = await tx.$queryRaw<DailyCount[]>(Prisma.sql`
    SELECT to_char((p."completedAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Shanghai','YYYY-MM-DD') AS date,count(*)::int AS count,0::int AS correct
    FROM "LessonProgress" p JOIN "Enrollment" e ON e.id=p."enrollmentId" JOIN "Course" c ON c.id=e."courseId" JOIN "Lesson" l ON l.id=p."lessonId"
    WHERE e."userId"=${scope.studentId} AND c.status='PUBLISHED' AND l."publishedAt" IS NOT NULL
    AND p."completedAt">=(${start}::timestamptz AT TIME ZONE 'UTC') AND p."completedAt"<(${end}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1 ORDER BY 1`);
  return { homework, exams, practice, lessons };
}
