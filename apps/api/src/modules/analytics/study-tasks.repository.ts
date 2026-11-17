import type { Prisma } from "../../generated/prisma/client";
import type { AnalyticsTransaction as Tx } from "./analytics.types";

// Bound every result in SQL; counts still cover the entire authorized set.
export async function studyTaskRecords(tx: Tx, studentId: string, now: Date) {
  const schoolClass: Prisma.SchoolClassWhereInput = {
    archivedAt: null,
    teacher: { role: "TEACHER", status: "ACTIVE" },
    students: { some: { studentId, revokedAt: null } },
  };
  const homework: Prisma.HomeworkWhereInput = {
    schoolClass,
    status: "PUBLISHED",
    dueAt: { gt: now },
    recipients: { some: { studentId } },
    submissions: { none: { studentId } },
  };
  const exam: Prisma.ExamWhereInput = {
    schoolClass,
    status: "PUBLISHED",
    closesAt: { gt: now },
    recipients: { some: { studentId } },
  };
  const unstarted: Prisma.ExamWhereInput = {
    ...exam,
    attempts: { none: { studentId } },
  };
  const started: Prisma.ExamAttemptWhereInput = {
    studentId,
    submittedAt: null,
    expiresAt: { gt: now },
    exam,
  };
  const metadata = {
    id: true,
    title: true,
    schoolClass: { select: { name: true } },
  } as const;
  const [
    homeworkTotal,
    homeworkItems,
    unstartedTotal,
    exams,
    startedTotal,
    attempts,
  ] = await Promise.all([
    tx.homework.count({ where: homework }),
    tx.homework.findMany({
      where: homework,
      take: 5,
      orderBy: [{ dueAt: "asc" }, { id: "asc" }],
      select: { ...metadata, dueAt: true },
    }),
    tx.exam.count({ where: unstarted }),
    tx.exam.findMany({
      where: unstarted,
      take: 5,
      orderBy: [{ closesAt: "asc" }, { id: "asc" }],
      select: { ...metadata, closesAt: true, opensAt: true },
    }),
    tx.examAttempt.count({ where: started }),
    tx.examAttempt.findMany({
      where: started,
      take: 5,
      orderBy: [{ expiresAt: "asc" }, { examId: "asc" }],
      select: {
        expiresAt: true,
        exam: { select: { ...metadata, closesAt: true, opensAt: true } },
      },
    }),
  ]);
  return {
    homeworkTotal,
    homeworkItems,
    unstartedTotal,
    exams,
    startedTotal,
    attempts,
  };
}
