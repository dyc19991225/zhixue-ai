import { Prisma } from "../../generated/prisma/client";
import { userRepository } from "../user/user.repository";
import { outline } from "../../repositories/course-repository";
import type {
  ClassCreate,
  ParentLinksQuery,
  RelationPageQuery,
  TeacherRevision,
} from "./relations.dto";
import type { RelationTransaction as Tx } from "./relations.types";
const studentView = { id: true, displayName: true, grade: true } as const;
const classView = {
  id: true,
  name: true,
  grade: true,
  teacherId: true,
  createdAt: true,
} as const;
const activeStudent = { role: "STUDENT", status: "ACTIVE" } as const;
export const relationsRepository = {
  userByUsername(tx: Tx, username: string) {
    return tx.user.findUnique({ where: { username }, select: { id: true } });
  },
  async parentLinks(
    tx: Tx,
    { page, pageSize, parentId, studentId }: ParentLinksQuery,
  ) {
    const where = {
      revokedAt: null,
      ...(parentId ? { parentId } : {}),
      ...(studentId ? { studentId } : {}),
      parent: { role: "PARENT" as const, status: "ACTIVE" as const },
      student: activeStudent,
    };
    const select = { id: true, displayName: true, username: true } as const;
    const [total, list] = await Promise.all([
      tx.parentStudent.count({ where }),
      tx.parentStudent.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: [{ parentId: "asc" }, { studentId: "asc" }],
        select: {
          parentId: true,
          studentId: true,
          createdAt: true,
          parent: { select },
          student: { select },
        },
      }),
    ]);
    return { page, pageSize, total, list };
  },
  transaction: userRepository.transaction,
  lockUsers(tx: Tx, ids: string[]) {
    return tx.$queryRaw`SELECT id FROM "User" WHERE id IN (${Prisma.join([...new Set(ids)].sort())}) ORDER BY id FOR UPDATE`;
  },
  user(tx: Tx, id: string) {
    return tx.user.findUnique({
      where: { id },
      select: { id: true, role: true, status: true },
    });
  },
  course(tx: Tx, id: string) {
    return tx.course.findUnique({ where: { id }, include: outline });
  },
  lockCourse(tx: Tx, id: string) {
    return tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${id} FOR UPDATE`;
  },
  assignTeacher(tx: Tx, id: string, teacherId: string | null) {
    return tx.course.update({
      where: { id },
      data: { ownerTeacherId: teacherId },
      select: { id: true, ownerTeacherId: true, updatedAt: true },
    });
  },
  async teacherCourses(
    tx: Tx,
    teacherId: string,
    { page, pageSize }: RelationPageQuery,
  ) {
    const where = { ownerTeacherId: teacherId };
    const [total, list] = await Promise.all([
      tx.course.count({ where }),
      tx.course.findMany({
        where,
        include: outline,
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { page, pageSize, total, list };
  },
  teacherCourseDetail(tx: Tx, id: string) {
    return tx.course.findUniqueOrThrow({
      where: { id },
      include: {
        chapters: {
          orderBy: { position: "asc" },
          include: {
            lessons: {
              orderBy: { position: "asc" },
              select: { id: true, title: true, content: true, position: true },
            },
          },
        },
      },
    });
  },
  async reviseTeacherCourse(
    tx: Tx,
    id: string,
    input: TeacherRevision,
    updatedAt: Date,
  ) {
    const { chapters, ...metadata } = input;
    await tx.course.update({ where: { id }, data: { ...metadata, updatedAt } });
    for (const ch of chapters) {
      await tx.chapter.update({
        where: { id: ch.id },
        data: { title: ch.title },
      });
      for (const lesson of ch.lessons)
        await tx.lesson.update({
          where: { id: lesson.id },
          data: { title: lesson.title, content: lesson.content },
        });
    }
  },
  createClass(tx: Tx, input: ClassCreate, teacherId: string) {
    return tx.schoolClass.create({
      data: { name: input.name, grade: input.grade, teacherId },
      select: classView,
    });
  },
  schoolClass(tx: Tx, id: string) {
    return tx.schoolClass.findUnique({ where: { id } });
  },
  lockClass(tx: Tx, id: string) {
    return tx.$queryRaw`SELECT id FROM "school_classes" WHERE id = ${id} FOR UPDATE`;
  },
  async classes(
    tx: Tx,
    where: Prisma.SchoolClassWhereInput,
    { page, pageSize }: RelationPageQuery,
  ) {
    const [total, list] = await Promise.all([
      tx.schoolClass.count({ where }),
      tx.schoolClass.findMany({
        where,
        select: classView,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { page, pageSize, total, list };
  },
  async roster(tx: Tx, classId: string, { page, pageSize }: RelationPageQuery) {
    const where = { classId, revokedAt: null, student: activeStudent };
    const [total, memberships] = await Promise.all([
      tx.classStudent.count({ where }),
      tx.classStudent.findMany({
        where,
        select: { student: { select: studentView } },
        orderBy: { studentId: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { page, pageSize, total, list: memberships.map((m) => m.student) };
  },
  member(tx: Tx, classId: string, studentId: string) {
    return tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
    });
  },
  addMember(tx: Tx, classId: string, studentId: string) {
    return tx.classStudent.upsert({
      where: { classId_studentId: { classId, studentId } },
      create: { classId, studentId },
      update: { revokedAt: null, joinedAt: new Date() },
    });
  },
  removeMember(tx: Tx, classId: string, studentId: string) {
    return tx.classStudent.updateMany({
      where: { classId, studentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
  archiveClass(tx: Tx, id: string) {
    return tx.schoolClass.update({
      where: { id },
      data: { archivedAt: new Date() },
      select: { id: true, archivedAt: true },
    });
  },
  parentLink(tx: Tx, parentId: string, studentId: string) {
    return tx.parentStudent.findUnique({
      where: { parentId_studentId: { parentId, studentId } },
    });
  },
  bind(tx: Tx, parentId: string, studentId: string) {
    return tx.parentStudent.upsert({
      where: { parentId_studentId: { parentId, studentId } },
      create: { parentId, studentId },
      update: { revokedAt: null, createdAt: new Date() },
    });
  },
  unbind(tx: Tx, parentId: string, studentId: string) {
    return tx.parentStudent.updateMany({
      where: { parentId, studentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
  async children(
    tx: Tx,
    parentId: string,
    { page, pageSize }: RelationPageQuery,
  ) {
    const where = { parentId, revokedAt: null, student: activeStudent };
    const [total, links] = await Promise.all([
      tx.parentStudent.count({ where }),
      tx.parentStudent.findMany({
        where,
        select: { student: { select: studentView } },
        orderBy: { studentId: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return { page, pageSize, total, list: links.map((l) => l.student) };
  },
  async overview(tx: Tx, studentId: string) {
    const [
      student,
      courses,
      completedLessons,
      attempts,
      correctAttempts,
      unresolvedWrongQuestions,
    ] = await Promise.all([
      tx.user.findUniqueOrThrow({
        where: { id: studentId },
        select: studentView,
      }),
      tx.enrollment.count({
        where: { userId: studentId, course: { status: "PUBLISHED" } },
      }),
      tx.lessonProgress.count({
        where: {
          enrollment: { userId: studentId, course: { status: "PUBLISHED" } },
          completedAt: { not: null },
          lesson: { publishedAt: { not: null } },
        },
      }),
      tx.questionAttempt.count({ where: { userId: studentId } }),
      tx.questionAttempt.count({ where: { userId: studentId, correct: true } }),
      tx.wrongQuestion.count({
        where: { userId: studentId, resolvedAt: null },
      }),
    ]);
    return {
      student,
      courses,
      completedLessons,
      attempts,
      correctAttempts,
      unresolvedWrongQuestions,
    };
  },
  audit(tx: Tx, actorUserId: string, targetUserId: string, action: string) {
    return tx.adminAuditLog.create({
      data: { actorUserId, targetUserId, action },
    });
  },
};
