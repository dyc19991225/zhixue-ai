import { AppError } from "../../lib/http";
import type { Role } from "@zhixue/shared";
import type { Prisma, User } from "../../generated/prisma/client";
import type { HomeworkTransaction as Tx } from "./homework.types";
import type {
  HomeworkCreate,
  HomeworkGrade,
  HomeworkQuery,
  HomeworkStatusInput,
  HomeworkSubmit,
  HomeworkUpdate,
} from "./homework.dto";
import { homeworkRepository as repo } from "./homework.repository";
async function run<T>(
  actorId: string,
  allowed: readonly Role[],
  work: (tx: Tx, actor: User) => Promise<T>,
) {
  return repo.transaction(async (tx) => {
    await repo.lockActor(tx, actorId, actorId);
    const actor = await repo.actor(tx, actorId);
    if (!actor || actor.status !== "ACTIVE" || !allowed.includes(actor.role))
      throw new AppError(403, "当前账号无权操作作业。");
    return work(tx, actor);
  });
}
async function frame(tx: Tx, id: string) {
  const first = await repo.homework(tx, id);
  if (!first) throw new AppError(404, "作业不存在。");
  await repo.lockClass(tx, first.classId);
  await repo.lockHomework(tx, id);
  const homework = await repo.homework(tx, id);
  if (!homework) throw new AppError(404, "作业不存在。");
  return homework;
}
type Work = NonNullable<Awaited<ReturnType<typeof repo.homework>>>;
function manage(actor: User, homework: Work, write = false) {
  if (
    actor.role !== "ADMIN" &&
    (actor.role !== "TEACHER" ||
      homework.teacherId !== actor.id ||
      homework.schoolClass.teacherId !== actor.id ||
      homework.schoolClass.archivedAt)
  )
    throw new AppError(403, "无权管理该作业。");
  if (write && homework.schoolClass.archivedAt)
    throw new AppError(409, "班级已归档，不能更改作业。");
}
async function studentAccess(tx: Tx, actor: User, homework: Work) {
  const recipient = await repo.recipient(tx, homework.id, actor.id);
  const own = await repo.ownSubmission(tx, homework.id, actor.id);
  const membership = await repo.member(tx, homework.classId, actor.id);
  if (!recipient || homework.status === "DRAFT")
    throw new AppError(404, "作业不存在或未分配给你。");
  const activeClass =
    !homework.schoolClass.archivedAt &&
    homework.schoolClass.teacher.role === "TEACHER" &&
    homework.schoolClass.teacher.status === "ACTIVE" &&
    !!membership &&
    !membership.revokedAt;
  if (!own && (homework.status !== "PUBLISHED" || !activeClass))
    throw new AppError(403, "当前没有该作业的访问权限。");
  return { own, activeClass };
}
export function createHomework(actorId: string, input: HomeworkCreate) {
  return run(actorId, ["ADMIN", "TEACHER"], async (tx, actor) => {
    await repo.lockClass(tx, input.classId);
    const item = await repo.schoolClass(tx, input.classId);
    if (
      !item ||
      item.archivedAt ||
      item.teacher.role !== "TEACHER" ||
      item.teacher.status !== "ACTIVE"
    )
      throw new AppError(404, "班级不存在或不可用。");
    if (actor.role !== "ADMIN" && item.teacherId !== actor.id)
      throw new AppError(403, "只能为自己的班级布置作业。");
    const result = await repo.create(tx, item.teacherId, input);
    await repo.log(
      tx,
      actor.id,
      item.teacherId,
      `HOMEWORK_CREATE:${result.id}`,
    );
    return result;
  });
}
export function listHomework(actorId: string, query: HomeworkQuery) {
  return run(actorId, ["ADMIN", "TEACHER", "STUDENT"], (tx, actor) => {
    const activeClass = {
      archivedAt: null,
      teacher: { role: "TEACHER" as const, status: "ACTIVE" as const },
      students: { some: { studentId: actor.id, revokedAt: null } },
    };
    const where: Prisma.HomeworkWhereInput = {
      ...(query.classId ? { classId: query.classId } : {}),
      ...(actor.role === "TEACHER"
        ? {
            teacherId: actor.id,
            schoolClass: { teacherId: actor.id, archivedAt: null },
          }
        : actor.role === "STUDENT"
          ? {
              recipients: { some: { studentId: actor.id } },
              status: { not: "DRAFT" },
              OR: [
                { status: "PUBLISHED", schoolClass: activeClass },
                { submissions: { some: { studentId: actor.id } } },
              ],
            }
          : {}),
    };
    return repo.list(tx, where, actor.id, query);
  });
}
export function homeworkDetail(actorId: string, id: string) {
  return run(actorId, ["ADMIN", "TEACHER", "STUDENT"], async (tx, actor) => {
    const item = await frame(tx, id);
    let submission = null;
    if (actor.role === "STUDENT") {
      const access = await studentAccess(tx, actor, item);
      if (access.own)
        submission = await repo.submissionResult(tx, access.own.id);
    } else manage(actor, item);
    const { schoolClass, ...homework } = item;
    return {
      homework: { ...homework, className: schoolClass.name },
      submission,
    };
  });
}
export function updateHomework(
  actorId: string,
  id: string,
  input: HomeworkUpdate,
) {
  return run(actorId, ["ADMIN", "TEACHER"], async (tx, actor) => {
    const item = await frame(tx, id);
    manage(actor, item, true);
    if (item.updatedAt.toISOString() !== input.updatedAt)
      throw new AppError(409, "作业已变更，请刷新。");
    if (item.status !== "DRAFT")
      throw new AppError(409, "已发布或归档作业不能改写，请新建作业。");
    return repo.update(tx, id, input);
  });
}
export function changeHomeworkStatus(
  actorId: string,
  id: string,
  input: HomeworkStatusInput,
) {
  return run(actorId, ["ADMIN", "TEACHER"], async (tx, actor) => {
    const item = await frame(tx, id);
    manage(actor, item, true);
    if (item.updatedAt.toISOString() !== input.updatedAt)
      throw new AppError(409, "作业已变更，请刷新。");
    if (item.status === input.status) return item;
    if (
      item.status === "ARCHIVED" ||
      (item.status === "PUBLISHED" && input.status === "DRAFT")
    )
      throw new AppError(409, "已发布作业不能退回草稿，归档后不能恢复。");
    if (input.status === "PUBLISHED") {
      if (item.dueAt <= new Date())
        throw new AppError(400, "截止时间必须晚于当前时间。");
      const recipients = await repo.recipients(tx, item.classId);
      if (!recipients.length)
        throw new AppError(400, "班级没有有效学生，暂不能发布。");
      await repo.assign(tx, id, recipients);
    }
    const result = await repo.status(tx, id, input.status);
    await repo.log(
      tx,
      actor.id,
      item.teacherId,
      `HOMEWORK_${input.status}:${id}`,
    );
    return result;
  });
}
export function submitHomework(
  actorId: string,
  id: string,
  input: HomeworkSubmit,
) {
  return run(actorId, ["STUDENT"], async (tx, actor) => {
    const item = await frame(tx, id),
      access = await studentAccess(tx, actor, item);
    const prior = await repo.submitRequest(tx, actor.id, input.requestId);
    if (prior) {
      if (prior.homeworkId !== id || prior.answerText !== input.answerText)
        throw new AppError(409, "提交标识已被使用。");
      return repo.submissionResult(tx, prior.id);
    }
    if (access.own) throw new AppError(409, "已经提交，当前版本不支持重交。");
    if (
      !access.activeClass ||
      item.status !== "PUBLISHED" ||
      item.dueAt <= new Date()
    )
      throw new AppError(409, "作业已截止或停止接收提交。");
    const result = await repo.submit(tx, id, actor.id, input);
    return repo.submissionResult(tx, result.id);
  });
}
export function listSubmissions(
  actorId: string,
  id: string,
  page: HomeworkQuery,
) {
  return run(actorId, ["ADMIN", "TEACHER"], async (tx, actor) => {
    const item = await frame(tx, id);
    manage(actor, item);
    return repo.submissions(tx, id, page);
  });
}
export function gradeHomework(
  actorId: string,
  id: string,
  submissionId: string,
  input: HomeworkGrade,
) {
  return run(actorId, ["ADMIN", "TEACHER"], async (tx, actor) => {
    const item = await frame(tx, id);
    manage(actor, item, true);
    const submission = await repo.submission(tx, submissionId);
    if (!submission || submission.homeworkId !== id)
      throw new AppError(404, "提交记录不存在。");
    const prior = await repo.gradeRequest(tx, actor.id, input.requestId);
    if (prior) {
      if (
        prior.id !== submissionId ||
        prior.score !== input.score ||
        prior.feedback !== input.feedback
      )
        throw new AppError(409, "批改标识已被使用。");
      return repo.submissionResult(tx, prior.id);
    }
    if (item.status !== "PUBLISHED" || submission.gradedAt)
      throw new AppError(409, "作业已归档或已经批改，当前版本不支持改分。");
    if (submission.updatedAt.toISOString() !== input.updatedAt)
      throw new AppError(409, "提交记录已变更，请刷新。");
    if (input.score > item.maxScore)
      throw new AppError(400, "分数不能超过作业满分。");
    const result = await repo.grade(tx, submissionId, actor.id, input);
    await repo.log(
      tx,
      actor.id,
      submission.studentId,
      `HOMEWORK_GRADE:${submissionId}`,
    );
    return result;
  });
}
