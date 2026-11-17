import type {
  AssessmentSummary,
  LearningAnalytics,
  ClassAnalytics,
  AnalyticsTrend,
  TrendDay,
} from "@zhixue/shared";
import { AppError } from "../../lib/http";
import { analyticsRepository as repo } from "./analytics.repository";
import type { AnalyticsTransaction as Tx } from "./analytics.types";
import type { AnalyticsQuery, TrendQuery } from "./analytics.dto";
import { trendRecords } from "./analytics-trend.repository";
const percent = (score: number | null, total: number | null) =>
  total ? Math.round(((score ?? 0) * 10000) / total) / 100 : null;
async function actor(tx: Tx, id: string) {
  const u = await repo.user(tx, id);
  if (!u || u.status !== "ACTIVE") throw new AppError(403, "账号不可用。");
  return u;
}
async function summary(
  tx: Tx,
  studentId: string,
  now: Date,
  classId?: string,
): Promise<AssessmentSummary> {
  const r = await repo.assessmentData(tx, studentId, now, classId);
  return {
    homeworkAssigned: r.homeworkAssigned,
    homeworkSubmitted: r.homeworkSubmitted,
    homeworkGraded: r.homeworkGraded._count,
    homeworkScorePercent: percent(
      r.homeworkGraded._sum.score,
      r.homeworkMax._sum.maxScore,
    ),
    examsAssigned: r.examsAssigned,
    examsSubmitted: r.examsSubmitted,
    examsReleased: r.examsReleased._count,
    examScorePercent: percent(
      r.examsReleased._sum.score,
      r.examMax._sum.points,
    ),
  };
}
export function studentAnalytics(
  actorId: string,
  studentId?: string,
): Promise<LearningAnalytics> {
  return repo.transaction(async (tx) => {
    const target = await requireStudent(tx, actorId, studentId);
    const now = new Date(),
      o = await repo.overview(tx, target);
    return {
      student: o.student,
      generatedAt: now.toISOString(),
      learning: {
        courses: o.courses,
        completedLessons: o.completedLessons,
        attempts: o.attempts,
        correctAttempts: o.correctAttempts,
        unresolvedWrongQuestions: o.unresolvedWrongQuestions,
        accuracyPercent: percent(o.correctAttempts, o.attempts),
      },
      assessments: await summary(tx, target, now),
    };
  });
}
export function classAnalytics(
  actorId: string,
  classId: string,
  q: AnalyticsQuery,
): Promise<ClassAnalytics> {
  return repo.transaction(async (tx) => {
    const c = await requireClass(tx, actorId, classId);
    const now = new Date(),
      roster = await repo.roster(tx, classId, q);
    const list = [];
    for (const row of roster.list)
      list.push({
        student: row.student,
        assessments: await summary(tx, row.student.id, now, classId),
      });
    return {
      ...q,
      total: roster.total,
      list,
      className: c.name,
      generatedAt: now.toISOString(),
    };
  });
}
async function requireStudent(tx: Tx, actorId: string, studentId?: string) {
  const a = await actor(tx, actorId),
    target = studentId ?? actorId;
  if (a.role === "STUDENT" && target !== a.id)
    throw new AppError(403, "只能查看本人学情。");
  if (a.role === "TEACHER") throw new AppError(403, "请使用班级学情入口。");
  if (a.role === "PARENT") {
    const link = await repo.link(tx, a.id, target);
    if (!link || link.revokedAt) throw new AppError(404, "未绑定该学生。");
  }
  const s = await repo.user(tx, target);
  if (!s || s.role !== "STUDENT" || s.status !== "ACTIVE")
    throw new AppError(404, "学生不存在或不可用。");
  return target;
}
async function requireClass(tx: Tx, actorId: string, classId: string) {
  const a = await actor(tx, actorId),
    c = await repo.schoolClass(tx, classId);
  if (!["ADMIN", "TEACHER"].includes(a.role))
    throw new AppError(403, "无权查看班级学情。");
  if (
    !c ||
    c.archivedAt ||
    c.teacher.role !== "TEACHER" ||
    c.teacher.status !== "ACTIVE"
  )
    throw new AppError(404, "班级不可用。");
  if (a.role === "TEACHER" && c.teacherId !== a.id)
    throw new AppError(403, "无权查看其他教师的班级。");
  return c;
}
async function trend(
  tx: Tx,
  q: TrendQuery,
  scope: { studentId: string } | { classId: string },
): Promise<AnalyticsTrend> {
  const now = new Date(),
    today = new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10);
  const midnight = new Date(today + "T00:00:00+08:00"),
    start = new Date(midnight.getTime() - (q.days - 1) * 86400000);
  const data = await trendRecords(tx, start, now, scope);
  const maps = Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      new Map(v.map((r) => [r.date, r])),
    ]),
  );
  const list: TrendDay[] = Array.from({ length: q.days }, (_, i) => {
    const date = new Date(start.getTime() + i * 86400000 + 8 * 3600000)
      .toISOString()
      .slice(0, 10);
    const attempts = maps.practice.get(date)?.count ?? 0,
      correctAttempts = maps.practice.get(date)?.correct ?? 0;
    return {
      date,
      attempts,
      correctAttempts,
      completedLessons: maps.lessons.get(date)?.count ?? 0,
      homeworkSubmitted: maps.homework.get(date)?.count ?? 0,
      examsSubmitted: maps.exams.get(date)?.count ?? 0,
      accuracyPercent: percent(correctAttempts, attempts),
    };
  });
  return {
    days: q.days,
    timezone: "Asia/Shanghai",
    generatedAt: now.toISOString(),
    scope: "classId" in scope ? "class" : "student",
    list,
  };
}
export function studentTrend(
  actorId: string,
  q: TrendQuery,
  studentId?: string,
) {
  return repo.transaction(async (tx) =>
    trend(tx, q, { studentId: await requireStudent(tx, actorId, studentId) }),
  );
}
export function classTrend(actorId: string, classId: string, q: TrendQuery) {
  return repo.transaction(async (tx) => {
    await requireClass(tx, actorId, classId);
    return trend(tx, q, { classId });
  });
}
