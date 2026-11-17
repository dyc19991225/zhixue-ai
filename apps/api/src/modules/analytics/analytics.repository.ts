import { getDb } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { relationsRepository } from "../relations/relations.repository";
import type { AnalyticsTransaction as Tx } from "./analytics.types";
import type { AnalyticsQuery } from "./analytics.dto";
export const analyticsRepository = {
  transaction<T>(work: (tx: Tx) => Promise<T>) {
    return getDb().$transaction(work, {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    });
  },
  user(tx: Tx, id: string) {
    return tx.user.findUnique({
      where: { id },
      select: {
        id: true,
        displayName: true,
        grade: true,
        role: true,
        status: true,
      },
    });
  },
  link(tx: Tx, parentId: string, studentId: string) {
    return tx.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
  },
  schoolClass(tx: Tx, id: string) {
    return tx.schoolClass.findUnique({
      where: { id },
      include: { teacher: { select: { role: true, status: true } } },
    });
  },
  overview: relationsRepository.overview,
  async roster(tx: Tx, classId: string, q: AnalyticsQuery) {
    const where = {
      classId,
      revokedAt: null,
      student: { role: "STUDENT" as const, status: "ACTIVE" as const },
    };
    const [total, list] = await Promise.all([
      tx.classStudent.count({ where }),
      tx.classStudent.findMany({
        where,
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        orderBy: { studentId: "asc" },
        select: {
          student: { select: { id: true, displayName: true, grade: true } },
        },
      }),
    ]);
    return { total, list };
  },
  async assessmentData(tx: Tx, studentId: string, now: Date, classId?: string) {
    const homework: Prisma.HomeworkWhereInput = {
      status: { not: "DRAFT" },
      ...(classId ? { classId } : {}),
    };
    const exam: Prisma.ExamWhereInput = {
      status: { not: "DRAFT" },
      ...(classId ? { classId } : {}),
    };
    const released: Prisma.ExamWhereInput = {
      ...exam,
      OR: [
        { closesAt: { lte: now } },
        { status: { in: ["CLOSED", "ARCHIVED"] } },
      ],
    };
    const [
      homeworkAssigned,
      homeworkSubmitted,
      homeworkGraded,
      homeworkMax,
      examsAssigned,
      examsSubmitted,
      examsReleased,
      examMax,
    ] = await Promise.all([
      tx.homeworkRecipient.count({ where: { studentId, homework } }),
      tx.homeworkSubmission.count({ where: { studentId, homework } }),
      tx.homeworkSubmission.aggregate({
        where: {
          studentId,
          homework,
          gradedAt: { not: null },
          score: { not: null },
        },
        _count: true,
        _sum: { score: true },
      }),
      tx.homework.aggregate({
        where: {
          ...homework,
          submissions: {
            some: { studentId, gradedAt: { not: null }, score: { not: null } },
          },
        },
        _sum: { maxScore: true },
      }),
      tx.examRecipient.count({ where: { studentId, exam } }),
      tx.examAttempt.count({
        where: { studentId, exam, submittedAt: { not: null } },
      }),
      tx.examAttempt.aggregate({
        where: {
          studentId,
          exam: released,
          submittedAt: { not: null },
          score: { not: null },
        },
        _count: true,
        _sum: { score: true },
      }),
      tx.examQuestion.aggregate({
        where: {
          exam: {
            ...released,
            attempts: {
              some: {
                studentId,
                submittedAt: { not: null },
                score: { not: null },
              },
            },
          },
        },
        _sum: { points: true },
      }),
    ]);
    return {
      homeworkAssigned,
      homeworkSubmitted,
      homeworkGraded,
      homeworkMax,
      examsAssigned,
      examsSubmitted,
      examsReleased,
      examMax,
    };
  },
};
