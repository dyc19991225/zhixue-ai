import type { StudyTask, StudyTasks } from "@zhixue/shared";
import { AppError } from "../../lib/http";
import { analyticsRepository as repo } from "./analytics.repository";
import { studyTaskRecords } from "./study-tasks.repository";
import type { AnalyticsTransaction as Tx } from "./analytics.types";

export function studentTasks(actorId: string): Promise<StudyTasks> {
  return repo.transaction(async (tx) => {
    const actor = await repo.user(tx, actorId);
    if (!actor || actor.status !== "ACTIVE" || actor.role !== "STUDENT")
      throw new AppError(403, "仅学生可查看自己的学习待办。");
    return taskSummary(tx, actorId);
  });
}

export function parentTasks(
  actorId: string,
  studentId: string,
): Promise<StudyTasks> {
  return repo.transaction(async (tx) => {
    const actor = await repo.user(tx, actorId);
    if (!actor || actor.status !== "ACTIVE" || actor.role !== "PARENT")
      throw new AppError(403, "仅家长可查看已绑定孩子的待办。");
    const link = await repo.link(tx, actorId, studentId);
    const student = await repo.user(tx, studentId);
    if (
      !link ||
      link.revokedAt ||
      !student ||
      student.status !== "ACTIVE" ||
      student.role !== "STUDENT"
    )
      throw new AppError(404, "未绑定该学生或学生不可用。");
    return taskSummary(tx, studentId);
  });
}

async function taskSummary(tx: Tx, studentId: string): Promise<StudyTasks> {
  const now = new Date();
  const r = await studyTaskRecords(tx, studentId, now);
  const exams: StudyTask[] = [
    ...r.exams.map((e): StudyTask => ({
      id: e.id,
      title: e.title,
      className: e.schoolClass.name,
      opensAt: e.opensAt.toISOString(),
      deadline: e.closesAt.toISOString(),
      state: e.opensAt > now ? "UPCOMING" : "PENDING",
    })),
    ...r.attempts.map((a): StudyTask => ({
      id: a.exam.id,
      title: a.exam.title,
      className: a.exam.schoolClass.name,
      opensAt: a.exam.opensAt.toISOString(),
      deadline: new Date(
        Math.min(a.expiresAt.getTime(), a.exam.closesAt.getTime()),
      ).toISOString(),
      state: "IN_PROGRESS",
    })),
  ];
  exams.sort(
    (a, b) => a.deadline.localeCompare(b.deadline) || a.id.localeCompare(b.id),
  );
  return {
    generatedAt: now.toISOString(),
    homework: {
      total: r.homeworkTotal,
      items: r.homeworkItems.map((h) => ({
        id: h.id,
        title: h.title,
        className: h.schoolClass.name,
        deadline: h.dueAt.toISOString(),
        state: "PENDING",
      })),
    },
    exams: {
      total: r.unstartedTotal + r.startedTotal,
      items: exams.slice(0, 5),
    },
  };
}
