import "../../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import request from "supertest";
import type { Role } from "@zhixue/shared";
import { createApp } from "../../app";
import { getDb, disconnectDb } from "../../lib/db";
import { disconnectRedis } from "../../lib/rate-limiter";
import { expireExamAttempts } from "./exam.service";
process.env.RATE_LIMIT_NAMESPACE = "qa-exam-" + randomBytes(8).toString("hex");

test(
  "exam snapshots, server timing, automatic submission and result privacy",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const app = createApp(),
      db = getDb(),
      prefix = "qa_exam_" + randomBytes(4).toString("hex"),
      userIds: string[] = [],
      classIds: string[] = [],
      examIds: string[] = [],
      questionIds: string[] = [];
    const origin = {
      "X-Zhixue-Client": "web",
      Origin: "http://127.0.0.1:3000",
    };
    type Account = { id: string; token: string };
    const auth = (a: Account) => ({
      ...origin,
      Authorization: `Bearer ${a.token}`,
    });
    t.after(async () => {
      await db.exam.deleteMany({ where: { id: { in: examIds } } });
      await db.schoolClass.deleteMany({ where: { id: { in: classIds } } });
      await db.question.deleteMany({ where: { id: { in: questionIds } } });
      await db.adminAuditLog.deleteMany({
        where: { actorUserId: { in: userIds } },
      });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(suffix: string, role: Role): Promise<Account> {
      const r = await request(app)
        .post("/api/auth/register")
        .set(origin)
        .send({
          username: prefix + "_" + suffix,
          passphrase: randomBytes(24).toString("hex"),
          displayName: "考试合成测试",
          grade: "G7",
        })
        .expect(200);
      const id = r.body.data.user.id as string;
      userIds.push(id);
      await db.user.update({ where: { id }, data: { role } });
      return { id, token: r.body.data.accessToken as string };
    }
    const admin = await account("a", "ADMIN"),
      teacher = await account("t", "TEACHER"),
      otherTeacher = await account("u", "TEACHER"),
      student = await account("s", "STUDENT"),
      studentB = await account("b", "STUDENT"),
      outsider = await account("o", "STUDENT"),
      late = await account("l", "STUDENT"),
      parent = await account("p", "PARENT");
    for (const owner of [teacher, otherTeacher]) {
      const c = await db.schoolClass.create({
        data: { name: "考试合成班", grade: "G7", teacherId: owner.id },
      });
      classIds.push(c.id);
    }
    const classId = classIds[0];
    await db.classStudent.createMany({
      data: [student, studentB].map((s) => ({ classId, studentId: s.id })),
    });
    const bank = await db.question.create({
      data: {
        title: "合成题库题",
        grade: "G7",
        subject: "math",
        status: "PUBLISHED",
        options: ["1", "2", "3", "4"],
        answer: 1,
        explanation: "合成来源与许可说明应保留。",
        diagram: {
          kind: "segment",
          leftLabel: "x",
          rightLabel: "1",
          totalLabel: "3",
          note: "合成示意图",
          alt: "一条合成线段示意图",
        },
      },
    });
    questionIds.push(bank.id);
    const blocked = await db.question.create({
      data: {
        title: "受限孤立题",
        grade: "G7",
        subject: "math",
        status: "PUBLISHED",
        restrictToLessons: true,
        options: ["1", "2", "3", "4"],
        answer: 0,
        explanation: "不应被导入",
      },
    });
    questionIds.push(blocked.id);
    const manual = {
      source: "MANUAL",
      title: "x+5=12，x等于多少？",
      options: ["7", "5", "12", "17"],
      answer: 0,
      explanation: "两边同时减去5，得7。",
      points: 2,
    };
    const draft = {
      classId,
      title: "合成单选考试",
      opensAt: new Date(Date.now() - 10000).toISOString(),
      closesAt: new Date(Date.now() + 3600000).toISOString(),
      durationMinutes: 1,
      questions: [manual, { source: "BANK", questionId: bank.id, points: 3 }],
    };
    await t.test(
      "template preview validates without creating or publishing exams",
      async () => {
        const content: unknown = JSON.parse(
          await readFile(
            "content/assessments/g7-math-linear-unit.v1.json",
            "utf8",
          ),
        );
        const { validateContentPackage } =
          await import("../../services/content-package");
        const pkg = validateContentPackage(content);
        const template = {
          status: "UNBOUND_DRAFT_TEMPLATE",
          requiredBeforeUse: ["classId", "opensAt", "closesAt"],
          payload: {
            title: pkg.course.title,
            durationMinutes: 40,
            questions: pkg.questions.map((q) => ({
              source: "MANUAL",
              title: q.title,
              options: q.options,
              answer: q.answer,
              explanation: q.explanation,
              points: 5,
              diagram: q.diagram ?? null,
            })),
          },
        };
        const before = await db.exam.count({
          where: { teacherId: teacher.id },
        });
        await request(app)
          .post("/api/exams/template-preview")
          .send(template)
          .expect(403);
        for (const actor of [student, parent])
          await request(app)
            .post("/api/exams/template-preview")
            .set(auth(actor))
            .send(template)
            .expect(403);
        for (const actor of [teacher, admin]) {
          const preview = await request(app)
            .post("/api/exams/template-preview")
            .set(auth(actor))
            .send(template)
            .expect(200);
          assert.equal(preview.body.data.totalPoints, 100);
          assert.equal(preview.body.data.questions.length, 20);
          assert.deepEqual(
            preview.body.data.questions,
            template.payload.questions,
          );
        }
        const invalid = [
          { ...template, status: "PUBLISHED" },
          { ...template, classId },
          { ...template, payload: { ...template.payload, classId } },
          { ...template, payload: { ...template.payload, questions: [] } },
          {
            ...template,
            payload: {
              ...template.payload,
              questions: Array(51).fill(template.payload.questions[0]),
            },
          },
          ...[
            { ...template.payload.questions[0], answer: 4 },
            {
              ...template.payload.questions[0],
              diagram: { kind: "svg", html: "<script>bad</script>" },
            },
            { ...template.payload.questions[0], options: ["1", "1", "2", "3"] },
            { source: "BANK", questionId: bank.id, points: 5 },
          ].map((q) => ({
            ...template,
            payload: { ...template.payload, questions: [q] },
          })),
        ];
        for (const input of invalid)
          await request(app)
            .post("/api/exams/template-preview")
            .set(auth(teacher))
            .send(input)
            .expect(400);
        await request(app)
          .post("/api/exams")
          .set(auth(teacher))
          .send(template)
          .expect(400);
        assert.equal(
          await db.exam.count({ where: { teacherId: teacher.id } }),
          before,
        );
      },
    );
    async function create(input = draft) {
      const r = await request(app)
        .post("/api/exams")
        .set(auth(teacher))
        .send(input)
        .expect(200);
      examIds.push(r.body.data.id as string);
      return r.body.data.id as string;
    }
    async function status(
      id: string,
      next: "PUBLISHED" | "CLOSED" | "ARCHIVED",
    ) {
      const row = await db.exam.findUniqueOrThrow({ where: { id } });
      return request(app)
        .patch(`/api/exams/${id}/status`)
        .set(auth(teacher))
        .send({ status: next, updatedAt: row.updatedAt.toISOString() });
    }
    async function publish(input = draft) {
      const id = await create(input);
      assert.equal((await status(id, "PUBLISHED")).status, 200);
      return id;
    }
    const id = await create();
    let paper: { id: string; answer?: number; explanation?: string }[] = [],
      attemptId = "",
      revision = 0;
    const saveId = randomUUID(),
      submitId = randomUUID();
    await t.test(
      "draft and question bank enforce roles, class scope and input shape",
      async () => {
        await request(app).get("/api/exams").expect(401);
        await request(app).get("/api/exams").set(auth(parent)).expect(403);
        await request(app)
          .post("/api/exams")
          .set(auth(student))
          .send(draft)
          .expect(403);
        await request(app)
          .post("/api/exams")
          .set(auth(otherTeacher))
          .send(draft)
          .expect(403);
        await request(app)
          .post("/api/exams")
          .set(auth(teacher))
          .send({ ...draft, questions: [{ ...manual, answer: 4 }] })
          .expect(400);
        await request(app)
          .post("/api/exams")
          .set(auth(teacher))
          .send({
            ...draft,
            questions: [{ source: "BANK", questionId: blocked.id, points: 2 }],
          })
          .expect(400);
        await request(app)
          .get(`/api/exams/question-options?classId=${classId}`)
          .set(auth(student))
          .expect(403);
        await request(app)
          .get(`/api/exams/question-options?classId=${classId}`)
          .set(auth(otherTeacher))
          .expect(403);
        const options = await request(app)
          .get(`/api/exams/question-options?classId=${classId}&q=合成题库题`)
          .set(auth(teacher))
          .expect(200);
        assert.ok(
          options.body.data.list.some((q: { id: string }) => q.id === bank.id),
        );
        assert.equal(options.body.data.list[0].answer, undefined);
        await request(app)
          .get(`/api/exams/${id}`)
          .set(auth(student))
          .expect(404);
        await request(app)
          .get(`/api/exams/${id}`)
          .set(auth(otherTeacher))
          .expect(403);
      },
    );
    await t.test(
      "publish snapshots current roster and paper, not live question bank",
      async () => {
        await db.question.update({
          where: { id: bank.id },
          data: { answer: 3, explanation: "源题已变化" },
        });
        assert.equal((await status(id, "PUBLISHED")).status, 200);
        assert.equal(
          await db.examRecipient.count({ where: { examId: id } }),
          2,
        );
        await db.classStudent.create({ data: { classId, studentId: late.id } });
        await request(app).get(`/api/exams/${id}`).set(auth(late)).expect(404);
        const preview = await request(app)
          .get(`/api/exams/${id}`)
          .set(auth(teacher))
          .expect(200);
        assert.equal(preview.body.data.questions[1].answer, 1);
        assert.match(preview.body.data.questions[1].explanation, /许可说明/);
        assert.equal(preview.body.data.questions[1].diagram.kind, "segment");
        const metadata = await request(app)
          .get(`/api/exams/${id}`)
          .set(auth(student))
          .expect(200);
        assert.equal(metadata.body.data.questions, undefined);
        const row = await db.exam.findUniqueOrThrow({ where: { id } });
        const { classId: unused, ...fields } = draft;
        assert.equal(unused, classId);
        await request(app)
          .put(`/api/exams/${id}`)
          .set(auth(teacher))
          .send({ ...fields, updatedAt: row.updatedAt.toISOString() })
          .expect(409);
      },
    );
    await t.test(
      "future windows cannot start and publication rejects past closing time",
      async () => {
        const future = await publish({
          ...draft,
          opensAt: new Date(Date.now() + 60000).toISOString(),
        });
        await request(app)
          .post(`/api/exams/${future}/attempt/start`)
          .set(auth(student))
          .send({})
          .expect(409);
        const past = await create({
          ...draft,
          opensAt: "2020-01-01T00:00:00.000Z",
          closesAt: "2020-01-02T00:00:00.000Z",
        });
        assert.equal((await status(past, "PUBLISHED")).status, 400);
      },
    );
    await t.test(
      "start is one-attempt-only and deadline is server-computed without solutions",
      async () => {
        await request(app)
          .post(`/api/exams/${id}/attempt/start`)
          .set(auth(outsider))
          .send({})
          .expect(404);
        const first = await request(app)
          .post(`/api/exams/${id}/attempt/start`)
          .set(auth(student))
          .send({})
          .expect(200);
        attemptId = first.body.data.id as string;
        paper = first.body.data.questions;
        assert.equal(paper.length, 2);
        assert.ok(
          paper.every(
            (q) => q.answer === undefined && q.explanation === undefined,
          ),
        );
        assert.equal(first.body.data.score, null);
        assert.equal(first.body.data.released, false);
        assert.ok(
          Date.parse(first.body.data.expiresAt) -
            Date.parse(first.body.data.startedAt) <=
            60000,
        );
        const resumed = await request(app)
          .post(`/api/exams/${id}/attempt/start`)
          .set(auth(student))
          .send({})
          .expect(200);
        assert.equal(resumed.body.data.id, attemptId);
        assert.equal(resumed.body.data.expiresAt, first.body.data.expiresAt);
      },
    );
    await t.test(
      "answer saves reject foreign questions, stale revisions and nonce reuse",
      async () => {
        const url = `/api/exams/${id}/attempt/answers`,
          answers = [
            { questionId: paper[0].id, selected: 0 },
            { questionId: paper[1].id, selected: 0 },
          ];
        await request(app)
          .put(url)
          .set(auth(student))
          .send({
            revision: 0,
            requestId: saveId,
            answers: [{ questionId: "foreign", selected: 0 }],
          })
          .expect(400);
        await request(app)
          .put(url)
          .set(auth(student))
          .send({ revision: 0, requestId: saveId, answers, score: 5 })
          .expect(400);
        const saved = await request(app)
          .put(url)
          .set(auth(student))
          .send({ revision: 0, requestId: saveId, answers })
          .expect(200);
        revision = saved.body.data.revision as number;
        assert.equal(revision, 1);
        const retry = await request(app)
          .put(url)
          .set(auth(student))
          .send({ revision: 0, requestId: saveId, answers })
          .expect(200);
        assert.equal(retry.body.data.revision, revision);
        await request(app)
          .put(url)
          .set(auth(student))
          .send({ revision: 0, requestId: randomUUID(), answers })
          .expect(409);
        await request(app)
          .put(url)
          .set(auth(student))
          .send({ revision, requestId: saveId, answers: [] })
          .expect(409);
        assert.ok(
          saved.body.data.questions.every(
            (q: { answer?: number }) => q.answer === undefined,
          ),
        );
      },
    );
    await t.test(
      "manual grading uses saved answers and withholds score/keys until exam ends",
      async () => {
        await request(app)
          .post(`/api/exams/${id}/attempt/submit`)
          .set(auth(student))
          .send({ revision: 0, requestId: submitId })
          .expect(409);
        const submitted = await request(app)
          .post(`/api/exams/${id}/attempt/submit`)
          .set(auth(student))
          .send({ revision, requestId: submitId })
          .expect(200);
        assert.ok(submitted.body.data.submittedAt);
        assert.equal(submitted.body.data.score, null);
        assert.equal(submitted.body.data.questions[0].answer, undefined);
        await request(app)
          .post(`/api/exams/${id}/attempt/submit`)
          .set(auth(student))
          .send({ revision, requestId: submitId })
          .expect(200);
        const stored = await db.examAttempt.findUniqueOrThrow({
          where: { id: attemptId },
        });
        assert.equal(stored.score, 2);
        assert.equal(stored.correctCount, 1);
        const ignored = await request(app)
          .put(`/api/exams/${id}/attempt/answers`)
          .set(auth(student))
          .send({
            revision,
            requestId: randomUUID(),
            answers: [{ questionId: paper[1].id, selected: 1 }],
          })
          .expect(200);
        assert.equal(
          ignored.body.data.submittedAt,
          submitted.body.data.submittedAt,
        );
        await request(app)
          .get(`/api/exams/${id}/results`)
          .set(auth(student))
          .expect(403);
      },
    );
    await t.test(
      "ending the exam releases immutable results and accurate teacher statistics",
      async () => {
        assert.equal((await status(id, "CLOSED")).status, 200);
        const result = await request(app)
          .get(`/api/exams/${id}/attempt`)
          .set(auth(student))
          .expect(200);
        assert.equal(result.body.data.released, true);
        assert.equal(result.body.data.score, 2);
        assert.equal(result.body.data.totalPoints, 5);
        assert.equal(result.body.data.questions[1].answer, 1);
        const stats = await request(app)
          .get(`/api/exams/${id}/results`)
          .set(auth(teacher))
          .expect(200);
        assert.equal(stats.body.data.recipientCount, 2);
        assert.equal(stats.body.data.submittedCount, 1);
        assert.equal(stats.body.data.averageScore, 2);
        assert.equal(stats.body.data.questionStats[0].correct, 1);
        assert.equal(stats.body.data.questionStats[1].correct, 0);
        await request(app)
          .get(`/api/exams/${id}/results`)
          .set(auth(otherTeacher))
          .expect(403);
        await request(app)
          .get(`/api/exams/${id}/results`)
          .set(auth(admin))
          .expect(200);
        assert.equal((await status(id, "PUBLISHED")).status, 409);
      },
    );
    await t.test(
      "late saves finalize only previously saved selections",
      async () => {
        const expired = await publish();
        const started = await request(app)
          .post(`/api/exams/${expired}/attempt/start`)
          .set(auth(student))
          .send({})
          .expect(200);
        const q = started.body.data.questions as { id: string }[];
        const saved = await request(app)
          .put(`/api/exams/${expired}/attempt/answers`)
          .set(auth(student))
          .send({
            revision: 0,
            requestId: randomUUID(),
            answers: [{ questionId: q[0].id, selected: 0 }],
          })
          .expect(200);
        await db.examAttempt.update({
          where: { id: started.body.data.id as string },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        const lateSave = await request(app)
          .put(`/api/exams/${expired}/attempt/answers`)
          .set(auth(student))
          .send({
            revision: saved.body.data.revision,
            requestId: randomUUID(),
            answers: [{ questionId: q[1].id, selected: 3 }],
          });
        assert.ok([200, 409].includes(lateSave.status));
        const settled = await request(app)
          .get(`/api/exams/${expired}/attempt`)
          .set(auth(student))
          .expect(200);
        assert.equal(settled.body.data.submissionReason, "TIMEOUT");
        const stored = await db.examAttempt.findUniqueOrThrow({
          where: { id: started.body.data.id as string },
        });
        assert.equal(stored.score, 2);
        assert.equal(
          (stored.answers as { questionId: string }[])[0].questionId,
          q[0].id,
        );
      },
    );
    await t.test(
      "background sweeper finalizes closed-tab attempts without student requests",
      async () => {
        const background = await publish();
        const started = await request(app)
          .post(`/api/exams/${background}/attempt/start`)
          .set(auth(studentB))
          .send({})
          .expect(200);
        await db.examAttempt.update({
          where: { id: started.body.data.id as string },
          data: { expiresAt: new Date(Date.now() - 1000) },
        });
        await expireExamAttempts();
        await expireExamAttempts();
        const stored = await db.examAttempt.findUniqueOrThrow({
          where: { id: started.body.data.id as string },
        });
        assert.ok(stored.submittedAt);
        assert.equal(stored.score, 0);
        assert.equal(stored.submissionReason, "TIMEOUT");
      },
    );
    await t.test(
      "concurrent starts do not reset time or create multiple attempts",
      async () => {
        const concurrent = await publish();
        const results = await Promise.all(
          [1, 2].map(() =>
            request(app)
              .post(`/api/exams/${concurrent}/attempt/start`)
              .set(auth(student))
              .send({}),
          ),
        );
        assert.ok(results.some((r) => r.status === 200));
        assert.ok(results.every((r) => [200, 409].includes(r.status)));
        assert.equal(
          await db.examAttempt.count({
            where: { examId: concurrent, studentId: student.id },
          }),
          1,
        );
        const started = await request(app)
          .get(`/api/exams/${concurrent}/attempt`)
          .set(auth(student))
          .expect(200);
        await db.examAttempt.update({
          where: { id: started.body.data.id as string },
          data: { expiresAt: new Date(Date.now() + 86400000) },
        });
        assert.equal((await status(concurrent, "CLOSED")).status, 200);
        const closed = await request(app)
          .get(`/api/exams/${concurrent}/attempt`)
          .set(auth(student))
          .expect(200);
        assert.ok(closed.body.data.submittedAt);
        assert.equal(closed.body.data.submissionReason, "CLOSED");
        assert.equal(closed.body.data.score, 0);
      },
    );
    await t.test(
      "revoked membership cannot continue writing but owns its submitted history",
      async () => {
        const current = await publish();
        const started = await request(app)
          .post(`/api/exams/${current}/attempt/start`)
          .set(auth(student))
          .send({})
          .expect(200);
        await db.classStudent.update({
          where: { classId_studentId: { classId, studentId: student.id } },
          data: { revokedAt: new Date() },
        });
        const blockedSave = await request(app)
          .put(`/api/exams/${current}/attempt/answers`)
          .set(auth(student))
          .send({
            revision: 0,
            requestId: randomUUID(),
            answers: [
              { questionId: started.body.data.questions[0].id, selected: 0 },
            ],
          })
          .expect(200);
        assert.equal(blockedSave.body.data.submissionReason, "ACCESS_REVOKED");
        assert.equal(blockedSave.body.data.score, null);
        await request(app)
          .get(`/api/exams/${id}/attempt`)
          .set(auth(student))
          .expect(200);
        await request(app)
          .get(`/api/exams/${current}/attempt`)
          .set(auth(outsider))
          .expect(404);
      },
    );
  },
);
