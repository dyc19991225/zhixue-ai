import { userRepository } from "../user/user.repository";
import { Prisma, type HomeworkStatus } from "../../generated/prisma/client";
import { AppError } from "../../lib/http";
import type { HomeworkTransaction as Tx } from "./homework.types";
import type {
  HomeworkCreate,
  HomeworkGrade,
  HomeworkQuery,
  HomeworkSubmit,
  HomeworkUpdate,
} from "./homework.dto";
const classInclude = {
  teacher: { select: { id: true, role: true, status: true } },
} as const;
const studentView = { id: true, displayName: true, grade: true } as const;
const submissionView = {
  id: true,
  homeworkId: true,
  studentId: true,
  answerText: true,
  submittedAt: true,
  score: true,
  feedback: true,
  gradedAt: true,
  updatedAt: true,
  student: { select: studentView },
} as const;
export const homeworkRepository = {
  async transaction<T>(work: (tx: Tx) => Promise<T>) {
    try {
      return await userRepository.transaction(work);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new AppError(409, "提交已被处理，请刷新后查看结果。");
      throw error;
    }
  },
  lockActor: userRepository.lock,
  actor: userRepository.find,
  schoolClass(tx: Tx, id: string) {
    return tx.schoolClass.findUnique({ where: { id }, include: classInclude });
  },
  lockClass(tx: Tx, id: string) {
    return tx.$queryRaw`SELECT id FROM "school_classes" WHERE id = ${id} FOR UPDATE`;
  },
  homework(tx: Tx, id: string) {
    return tx.homework.findUnique({
      where: { id },
      include: { schoolClass: { include: classInclude } },
    });
  },
  lockHomework(tx: Tx, id: string) {
    return tx.$queryRaw`SELECT id FROM "homework" WHERE id = ${id} FOR UPDATE`;
  },
  member(tx: Tx, classId: string, studentId: string) {
    return tx.classStudent.findUnique({
      where: { classId_studentId: { classId, studentId } },
    });
  },
  recipient(tx: Tx, homeworkId: string, studentId: string) {
    return tx.homeworkRecipient.findUnique({
      where: { homeworkId_studentId: { homeworkId, studentId } },
    });
  },
  recipients(tx: Tx, classId: string) {
    return tx.classStudent.findMany({
      where: {
        classId,
        revokedAt: null,
        student: { role: "STUDENT", status: "ACTIVE" },
      },
      select: { studentId: true },
    });
  },
  create(tx: Tx, teacherId: string, input: HomeworkCreate) {
    return tx.homework.create({
      data: { ...input, teacherId, dueAt: new Date(input.dueAt) },
    });
  },
  update(tx: Tx, id: string, input: HomeworkUpdate) {
    return tx.homework.update({
      where: { id },
      data: {
        title: input.title,
        instructions: input.instructions,
        maxScore: input.maxScore,
        dueAt: new Date(input.dueAt),
      },
    });
  },
  status(tx: Tx, id: string, status: HomeworkStatus) {
    return tx.homework.update({
      where: { id },
      data: {
        status,
        ...(status === "PUBLISHED" ? { publishedAt: new Date() } : {}),
      },
    });
  },
  assign(tx: Tx, homeworkId: string, students: { studentId: string }[]) {
    return tx.homeworkRecipient.createMany({
      data: students.map((s) => ({ homeworkId, studentId: s.studentId })),
    });
  },
  async list(
    tx: Tx,
    where: Prisma.HomeworkWhereInput,
    actorId: string,
    { page, pageSize }: HomeworkQuery,
  ) {
    const total = await tx.homework.count({ where });
    const rows = await tx.homework.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        schoolClass: { select: { name: true } },
        submissions: {
          where: { studentId: actorId },
          select: { gradedAt: true },
        },
      },
    });
    return {
      page,
      pageSize,
      total,
      list: rows.map((r) => ({
        id: r.id,
        classId: r.classId,
        className: r.schoolClass.name,
        title: r.title,
        status: r.status,
        dueAt: r.dueAt,
        maxScore: r.maxScore,
        updatedAt: r.updatedAt,
        submissionState: r.submissions[0]
          ? r.submissions[0].gradedAt
            ? ("GRADED" as const)
            : ("SUBMITTED" as const)
          : ("NOT_SUBMITTED" as const),
      })),
    };
  },
  ownSubmission(tx: Tx, homeworkId: string, studentId: string) {
    return tx.homeworkSubmission.findUnique({
      where: { homeworkId_studentId: { homeworkId, studentId } },
    });
  },
  submitRequest(tx: Tx, studentId: string, requestId: string) {
    return tx.homeworkSubmission.findUnique({
      where: { studentId_requestId: { studentId, requestId } },
    });
  },
  submit(tx: Tx, homeworkId: string, studentId: string, input: HomeworkSubmit) {
    return tx.homeworkSubmission.create({
      data: { homeworkId, studentId, ...input },
    });
  },
  submission(tx: Tx, id: string) {
    return tx.homeworkSubmission.findUnique({ where: { id } });
  },
  submissionResult(tx: Tx, id: string) {
    return tx.homeworkSubmission.findUniqueOrThrow({
      where: { id },
      select: submissionView,
    });
  },
  gradeRequest(tx: Tx, graderId: string, gradeRequestId: string) {
    return tx.homeworkSubmission.findUnique({
      where: { graderId_gradeRequestId: { graderId, gradeRequestId } },
    });
  },
  grade(tx: Tx, id: string, graderId: string, input: HomeworkGrade) {
    return tx.homeworkSubmission.update({
      where: { id },
      data: {
        score: input.score,
        feedback: input.feedback,
        graderId,
        gradeRequestId: input.requestId,
        gradedAt: new Date(),
      },
      select: submissionView,
    });
  },
  async submissions(
    tx: Tx,
    homeworkId: string,
    { page, pageSize }: HomeworkQuery,
  ) {
    const where = { homeworkId };
    const total = await tx.homeworkSubmission.count({ where });
    const recipientCount = await tx.homeworkRecipient.count({ where });
    const gradedCount = await tx.homeworkSubmission.count({
      where: { homeworkId, gradedAt: { not: null } },
    });
    const list = await tx.homeworkSubmission.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [
        { gradedAt: { sort: "asc", nulls: "first" } },
        { submittedAt: "asc" },
        { id: "asc" },
      ],
      select: submissionView,
    });
    return { page, pageSize, total, recipientCount, gradedCount, list };
  },
  audit: userRepository.audit,
  log(tx: Tx, actorUserId: string, targetUserId: string, action: string) {
    return tx.adminAuditLog.create({
      data: { actorUserId, targetUserId, action },
    });
  },
};
