import type { Prisma } from "../../generated/prisma/client";
import type { AnalyticsTransaction as Tx } from "./analytics.types";

export async function teacherTaskRecords(tx: Tx, teacherId: string) {
  const homework: Prisma.HomeworkWhereInput = {
    teacherId,
    status: "PUBLISHED",
    schoolClass: { teacherId, archivedAt: null },
  };
  const pending: Prisma.HomeworkSubmissionWhereInput = {
    gradedAt: null,
    homework,
  };
  const drafts: Prisma.CourseWhereInput = {
    ownerTeacherId: teacherId,
    status: "DRAFT",
  };
  const [total, homeworkTotal, groups, draftTotal, courses] = await Promise.all(
    [
      tx.homeworkSubmission.count({ where: pending }),
      tx.homework.count({
        where: { ...homework, submissions: { some: { gradedAt: null } } },
      }),
      tx.homeworkSubmission.groupBy({
        by: ["homeworkId"],
        where: pending,
        take: 5,
        _count: { _all: true },
        _min: { submittedAt: true },
        orderBy: [{ _min: { submittedAt: "asc" } }, { homeworkId: "asc" }],
      }),
      tx.course.count({ where: drafts }),
      tx.course.findMany({
        where: drafts,
        take: 5,
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        select: { id: true, title: true, updatedAt: true },
      }),
    ],
  );
  const metadata = await tx.homework.findMany({
    where: { ...homework, id: { in: groups.map((g) => g.homeworkId) } },
    select: { id: true, title: true, schoolClass: { select: { name: true } } },
  });
  return { total, homeworkTotal, groups, draftTotal, courses, metadata };
}
