import { AppError } from "../../lib/http";
import type { Role } from "@zhixue/shared";
import type {
  ClassCreate,
  ParentLinkInput,
  ParentLinksQuery,
  RelationPageQuery,
  TeacherAssignment,
  TeacherRevision,
} from "./relations.dto";
import type {
  RelationActor,
  RelationTransaction as Tx,
} from "./relations.types";
import { relationsRepository as repo } from "./relations.repository";
export function parentLinks(actorId: string, page: ParentLinksQuery) {
  return run(actorId, ["ADMIN"], [], (tx) => repo.parentLinks(tx, page));
}
export function addMemberByUsername(
  actorId: string,
  classId: string,
  username: string,
) {
  return run(actorId, ["ADMIN", "TEACHER"], [], async (tx, actor) => {
    await requireClass(tx, actor, classId);
    const student = await repo.userByUsername(tx, username);
    if (!student) throw new AppError(400, "学生账号不存在或不可用。");
    await repo.lockUsers(tx, [student.id]);
    await requireUser(tx, student.id, "STUDENT");
    const existing = await repo.member(tx, classId, student.id);
    if (existing && !existing.revokedAt) return null;
    await repo.addMember(tx, classId, student.id);
    await repo.audit(tx, actor.id, student.id, `CLASS_STUDENT_ADD:${classId}`);
    return null;
  });
}

async function run<T>(
  actorId: string,
  allowed: readonly Role[],
  ids: string[],
  work: (tx: Tx, actor: RelationActor) => Promise<T>,
) {
  return repo.transaction(async (tx) => {
    await repo.lockUsers(tx, [actorId, ...ids]);
    const actor = await repo.user(tx, actorId);
    if (!actor || actor.status !== "ACTIVE" || !allowed.includes(actor.role))
      throw new AppError(403, "当前账号无权操作。");
    return work(tx, actor);
  });
}
async function requireUser(tx: Tx, id: string, role: Role) {
  const user = await repo.user(tx, id);
  if (!user || user.status !== "ACTIVE" || user.role !== role)
    throw new AppError(400, "关联账号不存在、已停用或角色不符。");
  return user;
}
async function requireClass(tx: Tx, actor: RelationActor, classId: string) {
  await repo.lockClass(tx, classId);
  const item = await repo.schoolClass(tx, classId);
  if (!item || item.archivedAt) throw new AppError(404, "班级不存在或已归档。");
  if (actor.role !== "ADMIN" && item.teacherId !== actor.id)
    throw new AppError(403, "无权管理其他教师的班级。");
  return item;
}
export function assignTeacher(
  actorId: string,
  courseId: string,
  input: TeacherAssignment,
) {
  return run(
    actorId,
    ["ADMIN"],
    input.teacherId ? [input.teacherId] : [],
    async (tx, actor) => {
      if (input.teacherId) await requireUser(tx, input.teacherId, "TEACHER");
      await repo.lockCourse(tx, courseId);
      const course = await repo.course(tx, courseId);
      if (!course) throw new AppError(404, "课程不存在。");
      if (course.updatedAt.toISOString() !== input.updatedAt)
        throw new AppError(409, "课程已变更，请刷新后重试。");
      if (course.ownerTeacherId === input.teacherId)
        return {
          id: course.id,
          ownerTeacherId: course.ownerTeacherId,
          updatedAt: course.updatedAt,
        };
      const result = await repo.assignTeacher(tx, courseId, input.teacherId);
      await repo.audit(
        tx,
        actor.id,
        input.teacherId ?? course.ownerTeacherId ?? actor.id,
        `COURSE_TEACHER_ASSIGN:${courseId}`,
      );
      return result;
    },
  );
}
export function teacherCourses(actorId: string, page: RelationPageQuery) {
  return run(actorId, ["TEACHER"], [], (tx) =>
    repo.teacherCourses(tx, actorId, page),
  );
}
export function teacherCourse(actorId: string, courseId: string) {
  return run(actorId, ["TEACHER"], [], async (tx) => {
    const course = await repo.course(tx, courseId);
    if (!course || course.ownerTeacherId !== actorId)
      throw new AppError(404, "课程不存在或不属于当前教师。");
    return repo.teacherCourseDetail(tx, courseId);
  });
}
export function reviseTeacherCourse(
  actorId: string,
  courseId: string,
  input: TeacherRevision,
) {
  return run(actorId, ["TEACHER"], [], async (tx) => {
    await repo.lockCourse(tx, courseId);
    const owned = await repo.course(tx, courseId);
    if (!owned || owned.ownerTeacherId !== actorId)
      throw new AppError(404, "课程不存在或不属于当前教师。");
    const course = await repo.teacherCourseDetail(tx, courseId);
    if (course.ownerTeacherId !== actorId)
      throw new AppError(404, "课程不存在或不属于当前教师。");
    if (course.status !== "DRAFT")
      throw new AppError(409, "教师只能修改草稿，请联系管理员先转为草稿。");
    if (course.updatedAt.toISOString() !== input.updatedAt)
      throw new AppError(
        409,
        "课程已被更新，请关闭编辑器并重新载入，避免覆盖他人修改。",
      );
    if (
      input.chapters.length !== course.chapters.length ||
      input.chapters.some((ch) => {
        const old = course.chapters.find((c) => c.id === ch.id);
        return (
          !old ||
          ch.lessons.length !== old.lessons.length ||
          ch.lessons.some((l) => !old.lessons.some((item) => item.id === l.id))
        );
      })
    )
      throw new AppError(
        400,
        "教师改稿须保留全部现有章节和课时，增删结构请联系管理员。",
      );
    await repo.reviseTeacherCourse(
      tx,
      courseId,
      input,
      new Date(Math.max(Date.now(), course.updatedAt.getTime() + 1)),
    );
    await repo.audit(tx, actorId, actorId, `COURSE_TEXT_REVISE:${courseId}`);
    return repo.teacherCourseDetail(tx, courseId);
  });
}
export function createClass(actorId: string, input: ClassCreate) {
  return run(
    actorId,
    ["ADMIN", "TEACHER"],
    input.teacherId ? [input.teacherId] : [],
    async (tx, actor) => {
      const teacherId = actor.role === "TEACHER" ? actor.id : input.teacherId;
      if (!teacherId) throw new AppError(400, "管理员创建班级必须指定教师。");
      if (
        actor.role === "TEACHER" &&
        input.teacherId &&
        input.teacherId !== actor.id
      )
        throw new AppError(403, "不能指定其他教师。");
      await requireUser(tx, teacherId, "TEACHER");
      const result = await repo.createClass(tx, input, teacherId);
      await repo.audit(tx, actor.id, teacherId, `CLASS_CREATE:${result.id}`);
      return result;
    },
  );
}
export function classes(actorId: string, page: RelationPageQuery) {
  return run(actorId, ["ADMIN", "TEACHER", "STUDENT"], [], (tx, actor) =>
    repo.classes(
      tx,
      {
        archivedAt: null,
        ...(actor.role === "TEACHER"
          ? { teacherId: actor.id }
          : actor.role === "STUDENT"
            ? {
                students: { some: { studentId: actor.id, revokedAt: null } },
                teacher: { role: "TEACHER", status: "ACTIVE" },
              }
            : {}),
      },
      page,
    ),
  );
}
export function roster(
  actorId: string,
  classId: string,
  page: RelationPageQuery,
) {
  return run(actorId, ["ADMIN", "TEACHER"], [], async (tx, actor) => {
    await requireClass(tx, actor, classId);
    return repo.roster(tx, classId, page);
  });
}
export function changeMember(
  actorId: string,
  classId: string,
  studentId: string,
  add: boolean,
) {
  return run(actorId, ["ADMIN", "TEACHER"], [studentId], async (tx, actor) => {
    await requireClass(tx, actor, classId);
    if (add) {
      await requireUser(tx, studentId, "STUDENT");
      const previous = await repo.member(tx, classId, studentId);
      if (previous && !previous.revokedAt) return null;
      await repo.addMember(tx, classId, studentId);
    } else if (!(await repo.removeMember(tx, classId, studentId)).count)
      return null;
    await repo.audit(
      tx,
      actor.id,
      studentId,
      `CLASS_STUDENT_${add ? "ADD" : "REMOVE"}:${classId}`,
    );
    return null;
  });
}
export function archiveClass(actorId: string, classId: string) {
  return run(actorId, ["ADMIN", "TEACHER"], [], async (tx, actor) => {
    const item = await requireClass(tx, actor, classId);
    const result = await repo.archiveClass(tx, classId);
    await repo.audit(tx, actor.id, item.teacherId, `CLASS_ARCHIVE:${classId}`);
    return result;
  });
}
export function changeParentLink(
  actorId: string,
  input: ParentLinkInput,
  add: boolean,
) {
  return run(
    actorId,
    ["ADMIN"],
    [input.parentId, input.studentId],
    async (tx, actor) => {
      if (add) {
        await requireUser(tx, input.parentId, "PARENT");
        await requireUser(tx, input.studentId, "STUDENT");
        const previous = await repo.parentLink(
          tx,
          input.parentId,
          input.studentId,
        );
        if (previous && !previous.revokedAt) return null;
        await repo.bind(tx, input.parentId, input.studentId);
      } else if (
        !(await repo.unbind(tx, input.parentId, input.studentId)).count
      )
        return null;
      await repo.audit(
        tx,
        actor.id,
        input.studentId,
        `PARENT_${add ? "BIND" : "UNBIND"}:${input.parentId}`,
      );
      return null;
    },
  );
}
export function children(actorId: string, page: RelationPageQuery) {
  return run(actorId, ["PARENT"], [], (tx) => repo.children(tx, actorId, page));
}
export function childOverview(actorId: string, studentId: string) {
  return run(actorId, ["PARENT"], [studentId], async (tx) => {
    const link = await repo.parentLink(tx, actorId, studentId);
    if (!link || link.revokedAt) throw new AppError(404, "未绑定该学生。");
    await requireUser(tx, studentId, "STUDENT");
    return repo.overview(tx, studentId);
  });
}
