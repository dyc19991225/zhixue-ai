import { getDb } from "../../lib/db";
import { Prisma, type ExamStatus } from "../../generated/prisma/client";
import { userRepository } from "../user/user.repository";
import { homeworkRepository } from "../homework/homework.repository";
import type { ExamTransaction as Tx, PaperQuestion } from "./exam.types";
import type {
  ExamCreate,
  ExamQuery,
  ExamUpdate,
  SaveAnswers,
} from "./exam.dto";
const classInclude = {
  teacher: { select: { id: true, role: true, status: true } },
} as const;
const examInclude = {
  schoolClass: { include: classInclude },
  questions: { orderBy: { position: "asc" as const } },
} as const;
const questionData = (questions: PaperQuestion[]) =>
  questions.map((q, position) => ({
    title: q.title,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation,
    points: q.points,
    sourceQuestionId: q.sourceQuestionId,
    position,
    diagram: q.diagram ?? Prisma.DbNull,
  }));
export const examRepository = {
  transaction: homeworkRepository.transaction,
  lockActor: userRepository.lock,
  actor: userRepository.find,
  schoolClass(tx: Tx, id: string) {
    return tx.schoolClass.findUnique({ where: { id }, include: classInclude });
  },
  lockClass: homeworkRepository.lockClass,
  member: homeworkRepository.member,
  recipients: homeworkRepository.recipients,
  log: homeworkRepository.log,
  exam(tx: Tx, id: string) {
    return tx.exam.findUnique({ where: { id }, include: examInclude });
  },
  lockExam(tx: Tx, id: string) {
    return tx.$queryRaw`SELECT id FROM "exams" WHERE id = ${id} FOR UPDATE`;
  },
  bank(tx: Tx, where: Prisma.QuestionWhereInput) {
    return tx.question.findMany({ where, orderBy: { id: "asc" } });
  },
  async bankPage(
    tx: Tx,
    where: Prisma.QuestionWhereInput,
    { page, pageSize }: ExamQuery,
  ) {
    const total = await tx.question.count({ where });
    const list = await tx.question.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { id: "asc" },
      select: {
        id: true,
        title: true,
        options: true,
        diagram: true,
        knowledgePoint: true,
      },
    });
    return { page, pageSize, total, list };
  },
  create(
    tx: Tx,
    input: ExamCreate,
    teacherId: string,
    questions: PaperQuestion[],
  ) {
    return tx.exam.create({
      data: {
        classId: input.classId,
        teacherId,
        title: input.title,
        opensAt: new Date(input.opensAt),
        closesAt: new Date(input.closesAt),
        durationMinutes: input.durationMinutes,
        questions: { create: questionData(questions) },
      },
      include: examInclude,
    });
  },
  async update(
    tx: Tx,
    id: string,
    input: ExamUpdate,
    questions: PaperQuestion[],
  ) {
    await tx.examQuestion.deleteMany({ where: { examId: id } });
    return tx.exam.update({
      where: { id },
      data: {
        title: input.title,
        opensAt: new Date(input.opensAt),
        closesAt: new Date(input.closesAt),
        durationMinutes: input.durationMinutes,
        questions: { create: questionData(questions) },
      },
      include: examInclude,
    });
  },
  status(tx: Tx, id: string, status: ExamStatus) {
    return tx.exam.update({ where: { id }, data: { status } });
  },
  assign(tx: Tx, examId: string, students: { studentId: string }[]) {
    return tx.examRecipient.createMany({
      data: students.map((s) => ({ examId, studentId: s.studentId })),
    });
  },
  recipient(tx: Tx, examId: string, studentId: string) {
    return tx.examRecipient.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });
  },
  async list(
    tx: Tx,
    where: Prisma.ExamWhereInput,
    studentId: string,
    { page, pageSize }: ExamQuery,
  ) {
    const total = await tx.exam.count({ where });
    const list = await tx.exam.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: {
        schoolClass: { select: { name: true } },
        questions: { select: { points: true } },
        attempts: {
          where: { studentId },
          select: { id: true, submittedAt: true },
        },
      },
    });
    return { page, pageSize, total, list };
  },
  attempt(tx: Tx, examId: string, studentId: string) {
    return tx.examAttempt.findUnique({
      where: { examId_studentId: { examId, studentId } },
    });
  },
  attemptById(tx: Tx, id: string) {
    return tx.examAttempt.findUnique({
      where: { id },
      include: {
        exam: { include: examInclude },
        student: { select: { role: true, status: true } },
      },
    });
  },
  lockAttempt(tx: Tx, id: string) {
    return tx.$queryRaw`SELECT id FROM "exam_attempts" WHERE id = ${id} FOR UPDATE`;
  },
  start(tx: Tx, examId: string, studentId: string, expiresAt: Date) {
    return tx.examAttempt.create({
      data: { examId, studentId, expiresAt, answers: [] },
    });
  },
  save(tx: Tx, id: string, input: SaveAnswers, hash: string) {
    return tx.examAttempt.update({
      where: { id },
      data: {
        answers: input.answers,
        revision: { increment: 1 },
        lastSaveRequestId: input.requestId,
        lastSaveHash: hash,
      },
    });
  },
  finalize(
    tx: Tx,
    id: string,
    score: number,
    correctCount: number,
    submissionReason: string,
    submittedAt: Date,
    submitRequestId?: string,
  ) {
    return tx.examAttempt.update({
      where: { id },
      data: {
        score,
        correctCount,
        submissionReason,
        submittedAt,
        submitRequestId,
        revision: { increment: 1 },
      },
    });
  },
  submittedRequest(tx: Tx, studentId: string, submitRequestId: string) {
    return tx.examAttempt.findUnique({
      where: { studentId_submitRequestId: { studentId, submitRequestId } },
    });
  },
  async results(tx: Tx, examId: string, { page, pageSize }: ExamQuery) {
    const where = { examId };
    const total = await tx.examAttempt.count({ where });
    const recipientCount = await tx.examRecipient.count({ where });
    const submitted = await tx.examAttempt.findMany({
      where: { examId, submittedAt: { not: null } },
      select: { score: true, answers: true },
    });
    const list = await tx.examAttempt.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        student: { select: { id: true, displayName: true } },
        startedAt: true,
        submittedAt: true,
        score: true,
        correctCount: true,
        submissionReason: true,
      },
    });
    return { page, pageSize, total, recipientCount, submitted, list };
  },
  dueAttempts(now: Date) {
    return getDb().examAttempt.findMany({
      where: {
        submittedAt: null,
        OR: [
          { expiresAt: { lte: now } },
          { exam: { status: { in: ["CLOSED", "ARCHIVED"] } } },
          { exam: { schoolClass: { archivedAt: { not: null } } } },
          {
            student: {
              OR: [{ status: "DISABLED" }, { role: { not: "STUDENT" } }],
            },
          },
          {
            exam: {
              schoolClass: {
                teacher: {
                  OR: [{ role: { not: "TEACHER" } }, { status: "DISABLED" }],
                },
              },
            },
          },
        ],
      },
      select: { id: true },
      orderBy: { expiresAt: "asc" },
      take: 50,
    });
  },
  examDueAttempts(tx: Tx, examId: string, now: Date, closed: boolean) {
    return tx.examAttempt.findMany({
      where: {
        examId,
        submittedAt: null,
        ...(closed ? {} : { expiresAt: { lte: now } }),
      },
      select: { id: true },
      take: 50,
      orderBy: { id: "asc" },
    });
  },
};
