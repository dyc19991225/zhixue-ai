import { createHash } from "node:crypto";
import type { Prisma, User, ExamAttempt } from "../../generated/prisma/client";
import type { Role, ExamTemplatePreview } from "@zhixue/shared";
import { AppError } from "../../lib/http";
import { questionVisibility } from "../../services/question-access";
import { diagramSchema } from "../../services/diagram-validation";
import {
  answerPairsSchema,
  type BankQuery,
  type ExamCreate,
  type ExamQuery,
  type ExamStatusInput,
  type ExamUpdate,
  type ExamTemplate,
  type SaveAnswers,
  type SubmitExam,
} from "./exam.dto";
import type { ExamTransaction as Tx, PaperQuestion } from "./exam.types";
import { examRepository as repo } from "./exam.repository";

export function previewTemplate(input: ExamTemplate): ExamTemplatePreview {
  return {
    ...input.payload,
    totalPoints: input.payload.questions.reduce((sum, q) => sum + q.points, 0),
  };
}
type Paper = NonNullable<Awaited<ReturnType<typeof repo.exam>>>;
async function run<T>(
  actorId: string,
  roles: readonly Role[],
  work: (tx: Tx, actor: User) => Promise<T>,
) {
  return repo.transaction(async (tx) => {
    await repo.lockActor(tx, actorId, actorId);
    const actor = await repo.actor(tx, actorId);
    if (!actor || actor.status !== "ACTIVE" || !roles.includes(actor.role))
      throw new AppError(403, "当前账号无权操作考试。");
    return work(tx, actor);
  });
}
async function classScope(tx: Tx, actor: User, id: string) {
  await repo.lockClass(tx, id);
  const item = await repo.schoolClass(tx, id);
  if (
    !item ||
    item.archivedAt ||
    item.teacher.role !== "TEACHER" ||
    item.teacher.status !== "ACTIVE"
  )
    throw new AppError(404, "班级不存在或不可用。");
  if (actor.role !== "ADMIN" && item.teacherId !== actor.id)
    throw new AppError(403, "无权管理该班级。");
  return item;
}
async function frame(tx: Tx, id: string) {
  const first = await repo.exam(tx, id);
  if (!first) throw new AppError(404, "考试不存在。");
  await repo.lockClass(tx, first.classId);
  await repo.lockExam(tx, id);
  const exam = await repo.exam(tx, id);
  if (!exam) throw new AppError(404, "考试不存在。");
  return exam;
}
function manage(actor: User, exam: Paper, write = false) {
  if (
    actor.role !== "ADMIN" &&
    (actor.role !== "TEACHER" ||
      exam.teacherId !== actor.id ||
      exam.schoolClass.teacherId !== actor.id ||
      exam.schoolClass.archivedAt)
  )
    throw new AppError(403, "无权管理该考试。");
  if (write && exam.schoolClass.archivedAt)
    throw new AppError(409, "班级已归档。");
}
async function resolveQuestions(
  tx: Tx,
  input: ExamCreate["questions"],
  grade: Paper["schoolClass"]["grade"],
) {
  const ids = input.flatMap((q) => (q.source === "BANK" ? [q.questionId] : []));
  if (new Set(ids).size !== ids.length)
    throw new AppError(400, "题库题目不能重复。");
  const bank = ids.length
    ? await repo.bank(tx, {
        id: { in: ids },
        grade,
        status: "PUBLISHED",
        ...(await questionVisibility()),
      })
    : [];
  if (bank.length !== ids.length)
    throw new AppError(400, "部分题目未发布、年级不符或不允许用于此试卷。");
  return input.map((q) => {
    if (q.source === "MANUAL")
      return {
        title: q.title,
        options: q.options,
        answer: q.answer,
        explanation: q.explanation,
        diagram: q.diagram,
        points: q.points,
      } satisfies PaperQuestion;
    const original = bank.find((b) => b.id === q.questionId)!;
    return {
      title: original.title,
      options: original.options,
      answer: original.answer,
      explanation: original.explanation,
      diagram: original.diagram ? diagramSchema.parse(original.diagram) : null,
      points: q.points,
      sourceQuestionId: original.id,
    } satisfies PaperQuestion;
  });
}
function metadata(exam: Paper) {
  return {
    id: exam.id,
    classId: exam.classId,
    className: exam.schoolClass.name,
    title: exam.title,
    opensAt: exam.opensAt,
    closesAt: exam.closesAt,
    durationMinutes: exam.durationMinutes,
    status: exam.status,
    updatedAt: exam.updatedAt,
    questionCount: exam.questions.length,
    totalPoints: exam.questions.reduce((n, q) => n + q.points, 0),
  };
}
async function studentContext(tx: Tx, actor: User, exam: Paper) {
  const recipient = await repo.recipient(tx, exam.id, actor.id),
    attempt = await repo.attempt(tx, exam.id, actor.id);
  if (!recipient || exam.status === "DRAFT")
    throw new AppError(404, "考试不存在或未分配给你。");
  const member = await repo.member(tx, exam.classId, actor.id);
  const active =
    !exam.schoolClass.archivedAt &&
    exam.schoolClass.teacher.role === "TEACHER" &&
    exam.schoolClass.teacher.status === "ACTIVE" &&
    !!member &&
    !member.revokedAt;
  if (!active && !attempt)
    throw new AppError(403, "不再具有该考试的访问权限。");
  return { attempt, active };
}
function ended(exam: Paper) {
  return (
    exam.status === "CLOSED" ||
    exam.status === "ARCHIVED" ||
    exam.closesAt <= new Date()
  );
}
async function finish(
  tx: Tx,
  attempt: ExamAttempt,
  exam: Paper,
  reason: string,
  requestId?: string,
) {
  if (attempt.submittedAt) return attempt;
  const answers = new Map(
    answerPairsSchema
      .parse(attempt.answers)
      .map((a) => [a.questionId, a.selected]),
  );
  let score = 0,
    correctCount = 0;
  for (const question of exam.questions)
    if (answers.get(question.id) === question.answer) {
      score += question.points;
      correctCount++;
    }
  return repo.finalize(
    tx,
    attempt.id,
    score,
    correctCount,
    reason,
    reason === "TIMEOUT" ? attempt.expiresAt : new Date(),
    requestId,
  );
}
async function settle(
  tx: Tx,
  attempt: ExamAttempt,
  exam: Paper,
  active = true,
) {
  if (attempt.submittedAt) return attempt;
  if (attempt.expiresAt <= new Date())
    return finish(tx, attempt, exam, "TIMEOUT");
  if (exam.status === "CLOSED" || exam.status === "ARCHIVED")
    return finish(tx, attempt, exam, "CLOSED");
  if (
    !active ||
    exam.schoolClass.archivedAt ||
    exam.schoolClass.teacher.role !== "TEACHER" ||
    exam.schoolClass.teacher.status !== "ACTIVE"
  )
    return finish(tx, attempt, exam, "ACCESS_REVOKED");
  return attempt;
}
function attemptView(attempt: ExamAttempt, exam: Paper) {
  const released = !!attempt.submittedAt && ended(exam);
  return {
    id: attempt.id,
    examId: exam.id,
    title: exam.title,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt,
    serverNow: new Date(),
    revision: attempt.revision,
    submittedAt: attempt.submittedAt,
    submissionReason: attempt.submissionReason,
    released,
    totalPoints: exam.questions.reduce((n, q) => n + q.points, 0),
    score: released ? attempt.score : null,
    correctCount: released ? attempt.correctCount : null,
    answers: answerPairsSchema.parse(attempt.answers),
    questions: exam.questions.map((q) => ({
      id: q.id,
      title: q.title,
      options: q.options,
      points: q.points,
      diagram: q.diagram,
      ...(released ? { answer: q.answer, explanation: q.explanation } : {}),
    })),
  };
}
export function bankOptions(actorId: string, query: BankQuery) {
  return run(actorId, ["ADMIN", "TEACHER"], async (tx, actor) => {
    const c = await classScope(tx, actor, query.classId);
    return repo.bankPage(
      tx,
      {
        grade: c.grade,
        status: "PUBLISHED",
        ...(await questionVisibility()),
        ...(query.q
          ? { title: { contains: query.q, mode: "insensitive" } }
          : {}),
      },
      query,
    );
  });
}
export function createExam(actorId: string, input: ExamCreate) {
  return run(actorId, ["ADMIN", "TEACHER"], async (tx, actor) => {
    const c = await classScope(tx, actor, input.classId);
    const result = await repo.create(
      tx,
      input,
      c.teacherId,
      await resolveQuestions(tx, input.questions, c.grade),
    );
    await repo.log(tx, actor.id, c.teacherId, `EXAM_CREATE:${result.id}`);
    return { ...metadata(result), questions: result.questions };
  });
}
export function updateExam(actorId: string, id: string, input: ExamUpdate) {
  return run(actorId, ["ADMIN", "TEACHER"], async (tx, actor) => {
    const exam = await frame(tx, id);
    manage(actor, exam, true);
    if (
      exam.status !== "DRAFT" ||
      exam.updatedAt.toISOString() !== input.updatedAt
    )
      throw new AppError(409, "试卷已发布或版本过期。");
    return metadata(
      await repo.update(
        tx,
        id,
        input,
        await resolveQuestions(tx, input.questions, exam.schoolClass.grade),
      ),
    );
  });
}
export function listExams(actorId: string, query: ExamQuery) {
  return run(actorId, ["ADMIN", "TEACHER", "STUDENT"], async (tx, actor) => {
    const where: Prisma.ExamWhereInput = {
      ...(query.classId ? { classId: query.classId } : {}),
      ...(actor.role === "TEACHER"
        ? {
            teacherId: actor.id,
            schoolClass: { teacherId: actor.id, archivedAt: null },
          }
        : actor.role === "STUDENT"
          ? {
              status: { not: "DRAFT" },
              recipients: { some: { studentId: actor.id } },
              OR: [
                {
                  schoolClass: {
                    archivedAt: null,
                    teacher: { role: "TEACHER", status: "ACTIVE" },
                    students: {
                      some: { studentId: actor.id, revokedAt: null },
                    },
                  },
                },
                { attempts: { some: { studentId: actor.id } } },
              ],
            }
          : {}),
    };
    const result = await repo.list(tx, where, actor.id, query);
    return {
      ...result,
      list: result.list.map((e) => ({
        id: e.id,
        classId: e.classId,
        className: e.schoolClass.name,
        title: e.title,
        opensAt: e.opensAt,
        closesAt: e.closesAt,
        durationMinutes: e.durationMinutes,
        status: e.status,
        updatedAt: e.updatedAt,
        questionCount: e.questions.length,
        totalPoints: e.questions.reduce((n, q) => n + q.points, 0),
        attemptState: e.attempts[0]
          ? e.attempts[0].submittedAt
            ? ("SUBMITTED" as const)
            : ("STARTED" as const)
          : ("NOT_STARTED" as const),
      })),
    };
  });
}
export function examDetail(actorId: string, id: string) {
  return run(actorId, ["ADMIN", "TEACHER", "STUDENT"], async (tx, actor) => {
    const exam = await frame(tx, id);
    if (actor.role === "STUDENT") {
      const context = await studentContext(tx, actor, exam);
      return {
        ...metadata(exam),
        attemptState: context.attempt
          ? context.attempt.submittedAt
            ? "SUBMITTED"
            : "STARTED"
          : "NOT_STARTED",
      };
    }
    manage(actor, exam);
    return { ...metadata(exam), questions: exam.questions };
  });
}
export function changeExamStatus(
  actorId: string,
  id: string,
  input: ExamStatusInput,
) {
  return run(actorId, ["ADMIN", "TEACHER"], async (tx, actor) => {
    const exam = await frame(tx, id);
    manage(actor, exam, true);
    if (exam.updatedAt.toISOString() !== input.updatedAt)
      throw new AppError(409, "考试已变更，请刷新。");
    if (exam.status === input.status) return metadata(exam);
    if (
      exam.status === "ARCHIVED" ||
      (exam.status !== "DRAFT" && input.status === "PUBLISHED") ||
      (exam.status === "DRAFT" && input.status === "CLOSED")
    )
      throw new AppError(409, "不允许的考试状态变更。");
    if (input.status === "PUBLISHED") {
      if (exam.closesAt <= new Date())
        throw new AppError(400, "考试结束时间必须晚于当前时间。");
      const recipients = await repo.recipients(tx, exam.classId);
      if (!recipients.length) throw new AppError(400, "班级没有有效学生。");
      await repo.assign(tx, id, recipients);
    }
    await repo.status(tx, id, input.status);
    await repo.log(tx, actor.id, exam.teacherId, `EXAM_${input.status}:${id}`);
    return metadata((await repo.exam(tx, id))!);
  });
}
export function startAttempt(actorId: string, id: string) {
  return run(actorId, ["STUDENT"], async (tx, actor) => {
    const exam = await frame(tx, id),
      context = await studentContext(tx, actor, exam);
    if (context.attempt) {
      await repo.lockAttempt(tx, context.attempt.id);
      const current = (await repo.attempt(tx, id, actor.id))!;
      return attemptView(await settle(tx, current, exam, context.active), exam);
    }
    const now = new Date();
    if (
      !context.active ||
      exam.status !== "PUBLISHED" ||
      now < exam.opensAt ||
      now >= exam.closesAt
    )
      throw new AppError(409, "考试尚未开始、已经结束或当前不可参加。");
    return attemptView(
      await repo.start(
        tx,
        id,
        actor.id,
        new Date(
          Math.min(
            now.getTime() + exam.durationMinutes * 60000,
            exam.closesAt.getTime(),
          ),
        ),
      ),
      exam,
    );
  });
}
async function activeAttempt(tx: Tx, actor: User, id: string) {
  const exam = await frame(tx, id),
    context = await studentContext(tx, actor, exam);
  if (!context.attempt) throw new AppError(404, "尚未开始该考试。");
  await repo.lockAttempt(tx, context.attempt.id);
  return {
    exam,
    attempt: await settle(
      tx,
      (await repo.attempt(tx, id, actor.id))!,
      exam,
      context.active,
    ),
  };
}
export function getAttempt(actorId: string, id: string) {
  return run(actorId, ["STUDENT"], async (tx, actor) => {
    const { exam, attempt } = await activeAttempt(tx, actor, id);
    return attemptView(attempt, exam);
  });
}
export function saveAnswers(actorId: string, id: string, input: SaveAnswers) {
  return run(actorId, ["STUDENT"], async (tx, actor) => {
    const { exam, attempt } = await activeAttempt(tx, actor, id);
    if (attempt.submittedAt) return attemptView(attempt, exam);
    if (
      input.answers.some(
        (a) => !exam.questions.some((q) => q.id === a.questionId),
      )
    )
      throw new AppError(400, "作答包含其他试卷的题目。");
    const canonical = [...input.answers].sort((a, b) =>
      a.questionId.localeCompare(b.questionId),
    );
    const hash = createHash("sha256")
      .update(JSON.stringify(canonical))
      .digest("hex");
    if (attempt.lastSaveRequestId === input.requestId) {
      if (attempt.lastSaveHash !== hash)
        throw new AppError(409, "保存标识已被使用。");
      return attemptView(attempt, exam);
    }
    if (attempt.revision !== input.revision)
      throw new AppError(409, "作答版本已变更，请重新加载已保存答案。");
    return attemptView(
      await repo.save(tx, attempt.id, { ...input, answers: canonical }, hash),
      exam,
    );
  });
}
export function submitAttempt(actorId: string, id: string, input: SubmitExam) {
  return run(actorId, ["STUDENT"], async (tx, actor) => {
    const { exam, attempt } = await activeAttempt(tx, actor, id);
    if (attempt.submittedAt) return attemptView(attempt, exam);
    const used = await repo.submittedRequest(tx, actor.id, input.requestId);
    if (used && used.id !== attempt.id)
      throw new AppError(409, "交卷标识已被使用。");
    if (attempt.revision !== input.revision)
      throw new AppError(409, "请先同步最新作答再交卷。");
    return attemptView(
      await finish(tx, attempt, exam, "MANUAL", input.requestId),
      exam,
    );
  });
}
export function examResults(actorId: string, id: string, page: ExamQuery) {
  return run(actorId, ["ADMIN", "TEACHER"], async (tx, actor) => {
    const exam = await frame(tx, id);
    manage(actor, exam);
    for (const candidate of await repo.examDueAttempts(
      tx,
      id,
      new Date(),
      exam.status === "CLOSED" || exam.status === "ARCHIVED",
    )) {
      await repo.lockAttempt(tx, candidate.id);
      const attempt = await repo.attemptById(tx, candidate.id);
      if (attempt) await settle(tx, attempt, exam);
    }
    const result = await repo.results(tx, id, page);
    const scores = result.submitted.map((s) => s.score ?? 0);
    return {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      recipientCount: result.recipientCount,
      submittedCount: result.submitted.length,
      averageScore: scores.length
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : null,
      highestScore: scores.length ? Math.max(...scores) : null,
      lowestScore: scores.length ? Math.min(...scores) : null,
      list: result.list,
      questionStats: exam.questions.map((q) => {
        let answered = 0,
          correct = 0;
        for (const s of result.submitted) {
          const selected = answerPairsSchema
            .parse(s.answers)
            .find((a) => a.questionId === q.id)?.selected;
          if (selected != null) answered++;
          if (selected === q.answer) correct++;
        }
        return {
          questionId: q.id,
          title: q.title,
          answered,
          correct,
          total: result.submitted.length,
        };
      }),
    };
  });
}
export async function expireExamAttempts() {
  const candidates = await repo.dueAttempts(new Date());
  for (const candidate of candidates) {
    try {
      await repo.transaction(async (tx) => {
        await repo.lockAttempt(tx, candidate.id);
        const attempt = await repo.attemptById(tx, candidate.id);
        if (attempt)
          await settle(
            tx,
            attempt,
            attempt.exam,
            attempt.student.role === "STUDENT" &&
              attempt.student.status === "ACTIVE",
          );
      });
    } catch (error) {
      if (!(error instanceof AppError && error.status === 409)) throw error;
    }
  }
  return candidates.length;
}
