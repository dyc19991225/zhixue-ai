import "../../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../../app";
import { register } from "../../auth/service";
import { getDb, disconnectDb } from "../../lib/db";
import { disconnectRedis } from "../../lib/rate-limiter";
import type { Role, TeacherTasks } from "@zhixue/shared";

process.env.RATE_LIMIT_NAMESPACE =
  "qa-teacher-tasks-" + randomBytes(6).toString("hex");
test(
  "teacher tasks: grading priority, ownership and read-only summaries",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp(),
      prefix = "qa_teacher_tasks_" + randomBytes(5).toString("hex");
    const users: string[] = [],
      classes: string[] = [],
      homework: string[] = [],
      courses: string[] = [];
    t.after(async () => {
      await db.homework.deleteMany({ where: { id: { in: homework } } });
      await db.course.deleteMany({ where: { id: { in: courses } } });
      await db.schoolClass.deleteMany({ where: { id: { in: classes } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(role: Role) {
      const r = await register({
        username: prefix + users.length,
        passphrase: randomBytes(24).toString("hex"),
        displayName: "教学待办合成验收",
        grade: "G7",
      });
      users.push(r.user.id);
      await db.user.update({ where: { id: r.user.id }, data: { role } });
      return { id: r.user.id, token: r.accessToken };
    }
    const teacher = await account("TEACHER"),
      other = await account("TEACHER"),
      student = await account("STUDENT"),
      parent = await account("PARENT"),
      admin = await account("ADMIN");
    async function school(teacherId: string) {
      const c = await db.schoolClass.create({
        data: { name: "教学待办测试班级", grade: "G7", teacherId },
      });
      classes.push(c.id);
      return c;
    }
    const ownClass = await school(teacher.id),
      otherClass = await school(other.id);
    const now = Date.now();
    async function task(
      index: number,
      teacherId = teacher.id,
      classId = ownClass.id,
    ) {
      const h = await db.homework.create({
        data: {
          title: "批改任务" + index,
          classId,
          teacherId,
          instructions: "合成内容",
          maxScore: 10,
          status: "PUBLISHED",
          dueAt: new Date(now - 1000),
          submissions: {
            create: {
              studentId: student.id,
              answerText: "不应出现在待办摘要的私人作答",
              requestId: randomUUID(),
              submittedAt: new Date(now - index * 60000),
            },
          },
        },
      });
      homework.push(h.id);
      return h;
    }
    const pending: Awaited<ReturnType<typeof task>>[] = [];
    for (let i = 1; i <= 8; i++) pending.push(await task(i));
    await task(20, other.id, otherClass.id);
    // Invalid ownership pair must not be treated as the original teacher's task.
    await task(21, teacher.id, otherClass.id);
    const archived = await task(22);
    await db.homework.update({
      where: { id: archived.id },
      data: { status: "ARCHIVED" },
    });
    const draft = await task(23);
    await db.homework.update({
      where: { id: draft.id },
      data: { status: "DRAFT" },
    });
    const graded = await task(24);
    await db.homeworkSubmission.update({
      where: {
        homeworkId_studentId: { homeworkId: graded.id, studentId: student.id },
      },
      data: { gradedAt: new Date(), score: 10, feedback: "私人教师反馈" },
    });
    for (let i = 0; i < 7; i++) {
      const c = await db.course.create({
        data: {
          slug: prefix + "course" + i,
          title: "待办课程" + i,
          grade: "G7",
          subject: "math",
          ownerTeacherId: teacher.id,
          updatedAt: new Date(now - i * 60000),
        },
      });
      courses.push(c.id);
    }
    const hiddenCourse = await db.course.create({
      data: {
        slug: prefix + "other",
        title: "另一教师的草稿",
        grade: "G7",
        subject: "math",
        ownerTeacherId: other.id,
      },
    });
    courses.push(hiddenCourse.id);
    const endpoint = "/api/analytics/teacher/tasks";
    async function read(who = teacher) {
      const r = await request(app)
        .get(endpoint)
        .auth(who.token, { type: "bearer" });
      assert.equal(r.status, 200);
      assert.equal(r.headers["cache-control"], "no-store");
      return r.body.data as TeacherTasks;
    }
    await t.test(
      "teacher-only endpoint rejects impersonation query",
      async () => {
        assert.equal((await request(app).get(endpoint)).status, 401);
        for (const u of [student, parent, admin])
          assert.equal(
            (await request(app).get(endpoint).auth(u.token, { type: "bearer" }))
              .status,
            403,
          );
        assert.equal(
          (
            await request(app)
              .get(endpoint + "?teacherId=" + other.id)
              .auth(teacher.token, { type: "bearer" })
          ).status,
          400,
        );
      },
    );
    await t.test(
      "SQL counts all tasks, prioritizes oldest pending and limits cards",
      async () => {
        const r = await read();
        assert.equal(r.grading.total, 8);
        assert.equal(r.grading.homeworkTotal, 8);
        assert.deepEqual(
          r.grading.items.map((h) => h.id),
          [...pending]
            .reverse()
            .slice(0, 5)
            .map((h) => h.id),
        );
        assert.ok(r.grading.items.every((h) => h.pendingCount === 1));
        assert.equal(r.drafts.total, 7);
        assert.deepEqual(
          r.drafts.items.map((c) => c.id),
          courses.slice(0, 5),
        );
        for (const field of [
          "answerText",
          "score",
          "feedback",
          "studentId",
          "passphrase",
        ])
          assert.equal(JSON.stringify(r).includes(field), false);
        const stranger = await read(other);
        assert.equal(stranger.grading.total, 1);
        assert.equal(stranger.drafts.total, 1);
        assert.equal(
          stranger.grading.items.some((h) =>
            pending.some((p) => p.id === h.id),
          ),
          false,
        );
        assert.equal(
          await db.homeworkSubmission.count({
            where: { homeworkId: { in: homework }, gradedAt: { not: null } },
          }),
          1,
        );
      },
    );
    await t.test(
      "pending submissions appear before graded records in the grading screen",
      async () => {
        // Use additional synthetic accounts to put 11 older graded records before a pending record.
        for (let i = 0; i < 11; i++) {
          const u = await account("STUDENT");
          await db.homeworkSubmission.create({
            data: {
              homeworkId: pending[0].id,
              studentId: u.id,
              requestId: randomUUID(),
              answerText: "合成已批改",
              submittedAt: new Date(now - 3600000),
              gradedAt: new Date(),
              score: 0,
            },
          });
        }
        const r = await request(app)
          .get(`/api/homework/${pending[0].id}/submissions?page=1&pageSize=10`)
          .auth(teacher.token, { type: "bearer" });
        assert.equal(r.status, 200);
        assert.equal(r.body.data.total, 12);
        assert.equal(r.body.data.list[0].studentId, student.id);
        assert.equal(r.body.data.list[0].gradedAt, null);
        assert.equal((await read()).grading.total, 8);
      },
    );
    await t.test(
      "grading completion and course publication remove tasks",
      async () => {
        await db.homeworkSubmission.update({
          where: {
            homeworkId_studentId: {
              homeworkId: pending[0].id,
              studentId: student.id,
            },
          },
          data: { gradedAt: new Date(), score: 0 },
        });
        await db.course.update({
          where: { id: courses[0] },
          data: { status: "PUBLISHED" },
        });
        assert.equal((await read()).grading.total, 7);
        assert.equal((await read()).drafts.total, 6);
      },
    );
    await t.test(
      "class archive and transfer revoke grading summary; course reassignment revokes draft",
      async () => {
        await db.schoolClass.update({
          where: { id: ownClass.id },
          data: { archivedAt: new Date() },
        });
        assert.equal((await read()).grading.total, 0);
        await db.schoolClass.update({
          where: { id: ownClass.id },
          data: { archivedAt: null, teacherId: other.id },
        });
        assert.equal((await read()).grading.total, 0);
        await db.course.update({
          where: { id: courses[1] },
          data: { ownerTeacherId: other.id },
        });
        assert.equal((await read()).drafts.total, 5);
        const forbidden = await request(app)
          .get(`/api/teacher/courses/${courses[1]}`)
          .auth(teacher.token, { type: "bearer" });
        assert.equal(forbidden.status, 404);
      },
    );
    await t.test(
      "role changes are checked against current database identity",
      async () => {
        await db.user.update({
          where: { id: teacher.id },
          data: { role: "PARENT" },
        });
        assert.equal(
          (
            await request(app)
              .get(endpoint)
              .auth(teacher.token, { type: "bearer" })
          ).status,
          403,
        );
      },
    );
  },
);
