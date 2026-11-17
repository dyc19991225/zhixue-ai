import "../../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../../app";
import { register } from "../../auth/service";
import { getDb, disconnectDb } from "../../lib/db";
import { disconnectRedis } from "../../lib/rate-limiter";
import type { Role, StudyTasks } from "@zhixue/shared";

process.env.RATE_LIMIT_NAMESPACE = "qa-tasks-" + randomBytes(6).toString("hex");
test(
  "student study tasks: deadlines, counts and isolation",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp();
    const prefix = "qa_tasks_" + randomBytes(5).toString("hex");
    const users: string[] = [],
      classes: string[] = [],
      homework: string[] = [],
      exams: string[] = [];
    t.after(async () => {
      await db.exam.deleteMany({ where: { id: { in: exams } } });
      await db.homework.deleteMany({ where: { id: { in: homework } } });
      await db.schoolClass.deleteMany({ where: { id: { in: classes } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(role: Role) {
      const r = await register({
        username: prefix + users.length,
        passphrase: randomBytes(24).toString("hex"),
        displayName: "待办合成验收",
        grade: "G7",
      });
      users.push(r.user.id);
      await db.user.update({ where: { id: r.user.id }, data: { role } });
      return { id: r.user.id, token: r.accessToken };
    }
    const student = await account("STUDENT"),
      other = await account("STUDENT"),
      teacher = await account("TEACHER"),
      parent = await account("PARENT"),
      admin = await account("ADMIN");
    const school = await db.schoolClass.create({
      data: {
        name: "待办合成班级",
        grade: "G7",
        teacherId: teacher.id,
        students: {
          create: [{ studentId: student.id }, { studentId: other.id }],
        },
      },
    });
    classes.push(school.id);
    const future = (minutes: number) => new Date(Date.now() + minutes * 60000);
    async function makeHomework(minutes: number, recipient = student.id) {
      const h = await db.homework.create({
        data: {
          classId: school.id,
          teacherId: teacher.id,
          title: "待办作业" + homework.length,
          instructions: "合成任务",
          maxScore: 10,
          dueAt: future(minutes),
          status: "PUBLISHED",
          recipients: { create: { studentId: recipient } },
        },
      });
      homework.push(h.id);
      return h;
    }
    async function makeExam(minutes: number, opens = -10) {
      const e = await db.exam.create({
        data: {
          classId: school.id,
          teacherId: teacher.id,
          title: "待办考试" + exams.length,
          opensAt: future(opens),
          closesAt: future(minutes),
          durationMinutes: 10,
          status: "PUBLISHED",
          recipients: { create: { studentId: student.id } },
        },
      });
      exams.push(e.id);
      return e;
    }
    const endpoint = "/api/analytics/me/tasks";
    async function tasks() {
      const r = await request(app)
        .get(endpoint)
        .auth(student.token, { type: "bearer" });
      assert.equal(r.status, 200);
      assert.equal(r.headers["cache-control"], "no-store");
      return r.body.data as StudyTasks;
    }
    await t.test(
      "requires student identity and rejects a supplied target",
      async () => {
        assert.equal((await request(app).get(endpoint)).status, 401);
        for (const u of [teacher, parent, admin])
          assert.equal(
            (await request(app).get(endpoint).auth(u.token, { type: "bearer" }))
              .status,
            403,
          );
        assert.equal(
          (
            await request(app)
              .get(endpoint + "?studentId=" + other.id)
              .auth(student.token, { type: "bearer" })
          ).status,
          400,
        );
        assert.equal((await tasks()).homework.total, 0);
      },
    );
    const pending: Awaited<ReturnType<typeof makeHomework>>[] = [];
    // Insert latest deadlines first to prove ordering is not creation order.
    for (let i = 8; i >= 1; i--) pending.push(await makeHomework(i * 10));
    const submitted = await makeHomework(2);
    await db.homeworkSubmission.create({
      data: {
        homeworkId: submitted.id,
        studentId: student.id,
        answerText: "已交",
        requestId: randomUUID(),
      },
    });
    await makeHomework(-5);
    await makeHomework(2, other.id);
    const draft = await makeHomework(3);
    await db.homework.update({
      where: { id: draft.id },
      data: { status: "DRAFT" },
    });
    const archived = await makeHomework(4);
    await db.homework.update({
      where: { id: archived.id },
      data: { status: "ARCHIVED" },
    });
    await t.test(
      "counts all pending homework, returns nearest five without answers",
      async () => {
        const r = await tasks();
        assert.equal(r.homework.total, 8);
        assert.equal(r.homework.items.length, 5);
        assert.deepEqual(
          r.homework.items.map((h) => h.id),
          [...pending]
            .reverse()
            .slice(0, 5)
            .map((h) => h.id),
        );
        assert.equal(JSON.stringify(r).includes("answerText"), false);
        assert.equal(JSON.stringify(r).includes("instructions"), false);
        const stranger = await request(app)
          .get(endpoint)
          .auth(other.token, { type: "bearer" });
        assert.equal(stranger.body.data.homework.total, 1);
        assert.equal(
          stranger.body.data.homework.items.some((h: { id: string }) =>
            pending.some((p) => p.id === h.id),
          ),
          false,
        );
      },
    );
    const upcoming = await makeExam(200, 100),
      ready = await makeExam(90),
      active = await makeExam(100);
    await db.examAttempt.create({
      data: {
        examId: active.id,
        studentId: student.id,
        expiresAt: future(5),
        answers: [],
      },
    });
    const timedOut = await makeExam(120),
      done = await makeExam(130);
    await db.examAttempt.create({
      data: {
        examId: timedOut.id,
        studentId: student.id,
        expiresAt: future(-1),
        answers: [],
      },
    });
    await db.examAttempt.create({
      data: {
        examId: done.id,
        studentId: student.id,
        expiresAt: future(5),
        submittedAt: new Date(),
        answers: [],
        score: 10,
      },
    });
    await makeExam(-1);
    const closed = await makeExam(150);
    await db.exam.update({
      where: { id: closed.id },
      data: { status: "CLOSED" },
    });
    await t.test(
      "uses personal exam deadline, distinguishes upcoming, excludes timeout and submitted",
      async () => {
        const r = await tasks();
        assert.equal(r.exams.total, 3);
        assert.deepEqual(
          r.exams.items.map((e) => e.id),
          [active.id, ready.id, upcoming.id],
        );
        assert.deepEqual(
          r.exams.items.map((e) => e.state),
          ["IN_PROGRESS", "PENDING", "UPCOMING"],
        );
        assert.ok(
          Date.parse(r.exams.items[0].deadline) < active.closesAt.getTime(),
        );
        assert.equal(JSON.stringify(r).includes("score"), false);
        assert.equal(
          await db.examAttempt.count({ where: { studentId: student.id } }),
          3,
        );
        assert.equal(
          (
            await db.examAttempt.findUniqueOrThrow({
              where: {
                examId_studentId: {
                  examId: timedOut.id,
                  studentId: student.id,
                },
              },
            })
          ).submittedAt,
          null,
        );
      },
    );
    const childPath = (id: string) => `/api/analytics/students/${id}/tasks`;
    const childRequest = (id = student.id) =>
      request(app).get(childPath(id)).auth(parent.token, { type: "bearer" });
    await t.test(
      "parent tasks require an active binding and do not expose private answers",
      async () => {
        assert.equal(
          (await request(app).get(childPath(student.id))).status,
          401,
        );
        for (const u of [student, teacher, admin])
          assert.equal(
            (
              await request(app)
                .get(childPath(student.id))
                .auth(u.token, { type: "bearer" })
            ).status,
            403,
          );
        assert.equal((await childRequest()).status, 404);
        await db.parentStudent.create({
          data: { parentId: parent.id, studentId: student.id },
        });
        const r = await childRequest(),
          own = await tasks();
        assert.equal(r.status, 200);
        assert.equal(r.headers["cache-control"], "no-store");
        assert.deepEqual(r.body.data.homework, own.homework);
        assert.deepEqual(r.body.data.exams, own.exams);
        for (const field of [
          "score",
          "answerText",
          "feedback",
          "answers",
          "explanation",
          "instructions",
        ])
          assert.equal(JSON.stringify(r.body.data).includes(field), false);
        assert.equal(
          (
            await request(app)
              .get(childPath(student.id) + "?studentId=" + other.id)
              .auth(parent.token, { type: "bearer" })
          ).status,
          400,
        );
        assert.equal((await childRequest("missing-student")).status, 404);
      },
    );
    await t.test(
      "parent can switch only between bound children and cannot submit or start exams",
      async () => {
        assert.equal((await childRequest(other.id)).status, 404);
        await db.parentStudent.create({
          data: { parentId: parent.id, studentId: other.id },
        });
        const second = await childRequest(other.id);
        assert.equal(second.status, 200);
        assert.equal(second.body.data.homework.total, 1);
        assert.equal(second.body.data.exams.total, 0);
        assert.equal((await childRequest()).body.data.homework.total, 8);
        const otherParent = await account("PARENT");
        assert.equal(
          (
            await request(app)
              .get(childPath(student.id))
              .auth(otherParent.token, { type: "bearer" })
          ).status,
          404,
        );
        const headers = {
          "X-Zhixue-Client": "web",
          Origin: "http://127.0.0.1:3000",
        };
        assert.equal(
          (
            await request(app)
              .post(`/api/homework/${pending[0].id}/submissions`)
              .set(headers)
              .auth(parent.token, { type: "bearer" })
              .send({ answerText: "禁止代交", requestId: randomUUID() })
          ).status,
          403,
        );
        assert.equal(
          (
            await request(app)
              .post(`/api/exams/${ready.id}/attempt/start`)
              .set(headers)
              .auth(parent.token, { type: "bearer" })
              .send({})
          ).status,
          403,
        );
        assert.equal(
          await db.examAttempt.count({ where: { studentId: student.id } }),
          3,
        );
      },
    );
    await t.test(
      "unbind, disabled child and changed roles revoke parent task access",
      async () => {
        const where = {
          parentId_studentId: { parentId: parent.id, studentId: student.id },
        };
        await db.parentStudent.update({
          where,
          data: { revokedAt: new Date() },
        });
        assert.equal((await childRequest()).status, 404);
        await db.parentStudent.update({ where, data: { revokedAt: null } });
        await db.user.update({
          where: { id: student.id },
          data: { status: "DISABLED" },
        });
        assert.equal((await childRequest()).status, 404);
        await db.user.update({
          where: { id: student.id },
          data: { status: "ACTIVE", role: "TEACHER" },
        });
        assert.equal((await childRequest()).status, 404);
        await db.user.update({
          where: { id: student.id },
          data: { role: "STUDENT" },
        });
        await db.user.update({
          where: { id: parent.id },
          data: { role: "STUDENT" },
        });
        assert.equal((await childRequest()).status, 403);
        await db.user.update({
          where: { id: parent.id },
          data: { role: "PARENT" },
        });
        assert.equal((await childRequest()).status, 200);
      },
    );
    await t.test("submission removes task immediately", async () => {
      await db.homeworkSubmission.create({
        data: {
          homeworkId: pending[7].id,
          studentId: student.id,
          answerText: "完成",
          requestId: randomUUID(),
        },
      });
      assert.equal((await tasks()).homework.total, 7);
    });
    await t.test(
      "revoked membership, archived class and unavailable teacher hide pending tasks",
      async () => {
        await db.classStudent.update({
          where: {
            classId_studentId: { classId: school.id, studentId: student.id },
          },
          data: { revokedAt: new Date() },
        });
        assert.equal((await tasks()).exams.total, 0);
        assert.equal((await tasks()).homework.total, 0);
        await db.classStudent.update({
          where: {
            classId_studentId: { classId: school.id, studentId: student.id },
          },
          data: { revokedAt: null },
        });
        await db.schoolClass.update({
          where: { id: school.id },
          data: { archivedAt: new Date() },
        });
        assert.equal((await tasks()).homework.total, 0);
        await db.schoolClass.update({
          where: { id: school.id },
          data: { archivedAt: null },
        });
        await db.user.update({
          where: { id: teacher.id },
          data: { role: "PARENT" },
        });
        assert.equal((await tasks()).exams.total, 0);
      },
    );
  },
);
