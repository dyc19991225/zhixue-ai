import type { TeacherTasks } from "@zhixue/shared";
import { AppError } from "../../lib/http";
import { analyticsRepository as repo } from "./analytics.repository";
import { teacherTaskRecords } from "./teacher-tasks.repository";

export function teacherTasks(actorId: string): Promise<TeacherTasks> {
  return repo.transaction(async (tx) => {
    const actor = await repo.user(tx, actorId);
    if (!actor || actor.status !== "ACTIVE" || actor.role !== "TEACHER")
      throw new AppError(403, "仅教师可查看自己的教学待办。");
    const r = await teacherTaskRecords(tx, actorId);
    return {
      generatedAt: new Date().toISOString(),
      grading: {
        total: r.total,
        homeworkTotal: r.homeworkTotal,
        items: r.groups.map((g) => {
          const h = r.metadata.find((h) => h.id === g.homeworkId)!;
          return {
            id: h.id,
            title: h.title,
            className: h.schoolClass.name,
            pendingCount: g._count._all,
            oldestSubmittedAt: g._min.submittedAt!.toISOString(),
          };
        }),
      },
      drafts: {
        total: r.draftTotal,
        items: r.courses.map((c) => ({
          id: c.id,
          title: c.title,
          updatedAt: c.updatedAt.toISOString(),
        })),
      },
    };
  });
}
