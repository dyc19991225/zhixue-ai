import "../../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../../app";
import { register } from "../../auth/service";
import { getDb, disconnectDb } from "../../lib/db";
import { disconnectRedis } from "../../lib/rate-limiter";
import type { Role } from "@zhixue/shared";
process.env.RATE_LIMIT_NAMESPACE =
  "qa-analytics-" + randomBytes(6).toString("hex");
test(
  "analytics real totals and relationship isolation",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp(),
      prefix = "qa_analytics_" + randomBytes(5).toString("hex");
    const ids: string[] = [],
      classes: string[] = [],
      exams: string[] = [],
      homework: string[] = [],
      questions: string[] = [];
    t.after(async () => {
      await db.exam.deleteMany({ where: { id: { in: exams } } });
      await db.homework.deleteMany({ where: { id: { in: homework } } });
      await db.schoolClass.deleteMany({ where: { id: { in: classes } } });
      await db.questionAttempt.deleteMany({ where: { userId: { in: ids } } });
      await db.question.deleteMany({ where: { id: { in: questions } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(role: Role) {
      const r = await register({
        username: prefix + "_" + ids.length,
        passphrase: randomBytes(24).toString("hex"),
        displayName: "学情合成验收",
        grade: "G7",
      });
      ids.push(r.user.id);
      await db.user.update({ where: { id: r.user.id }, data: { role } });
      return { id: r.user.id, token: r.accessToken };
    }
    const student = await account("STUDENT"),
      other = await account("STUDENT"),
      teacher = await account("TEACHER"),
      stranger = await account("TEACHER"),
      parent = await account("PARENT"),
      admin = await account("ADMIN");
    const auth = (u: typeof student) => ({
      Authorization: `Bearer ${u.token}`,
    });
    const c = await db.schoolClass.create({
      data: {
        name: "合成班级学情",
        grade: "G7",
        teacherId: teacher.id,
        students: {
          create: [{ studentId: student.id }, { studentId: other.id }],
        },
      },
    });
    classes.push(c.id);
    await db.parentStudent.create({
      data: { parentId: parent.id, studentId: student.id },
    });
    const q = await db.question.create({
      data: {
        title: "合成练习",
        grade: "G7",
        subject: "math",
        options: ["1", "2", "3", "4"],
        answer: 0,
        explanation: "合成说明",
      },
    });
    questions.push(q.id);
    await db.questionAttempt.createMany({
      data: [true, false, true].map((correct) => ({
        userId: student.id,
        questionId: q.id,
        requestId: randomUUID(),
        selected: correct ? 0 : 1,
        correct,
        snapshot: { title: "合成题" },
      })),
    });
    for (const [score, maxScore] of [
      [2, 4],
      [6, 6],
    ] as const) {
      const h = await db.homework.create({
        data: {
          classId: c.id,
          teacherId: teacher.id,
          title: "合成作业",
          instructions: "测试",
          maxScore,
          dueAt: new Date(Date.now() + 60000),
          status: "PUBLISHED",
          publishedAt: new Date(),
          recipients: { create: { studentId: student.id } },
          submissions: {
            create: {
              studentId: student.id,
              answerText: "测试",
              requestId: randomUUID(),
              score,
              gradedAt: new Date(),
              graderId: teacher.id,
            },
          },
        },
      });
      homework.push(h.id);
    }
    const now = Date.now();
    for (const released of [false, true]) {
      const e = await db.exam.create({
        data: {
          classId: c.id,
          teacherId: teacher.id,
          title: "合成考试",
          status: released ? "CLOSED" : "PUBLISHED",
          opensAt: new Date(now - 60000),
          closesAt: new Date(now + 600000),
          durationMinutes: 1,
          questions: {
            create: {
              position: 0,
              title: "合成",
              options: ["1", "2", "3", "4"],
              answer: 0,
              explanation: "合成",
              points: 10,
            },
          },
          recipients: { create: { studentId: student.id } },
          attempts: {
            create: {
              studentId: student.id,
              expiresAt: new Date(now + 30000),
              answers: [],
              submittedAt: new Date(),
              score: released ? 5 : 10,
              correctCount: 0,
            },
          },
        },
      });
      exams.push(e.id);
    }
    await t.test("authentication and strict query validation", async () => {
      await request(app).get("/api/analytics/me").expect(401);
      await request(app)
        .get("/api/analytics/me?studentId=" + other.id)
        .set(auth(student))
        .expect(400);
      await request(app)
        .get(`/api/analytics/classes/${c.id}?page=0`)
        .set(auth(teacher))
        .expect(400);
    });
    await t.test(
      "student counts real attempts and weighted scores without early score leakage",
      async () => {
        const r = await request(app)
            .get("/api/analytics/me")
            .set(auth(student))
            .expect(200),
          d = r.body.data;
        assert.equal(d.learning.attempts, 3);
        assert.equal(d.learning.accuracyPercent, 66.67);
        assert.equal(d.assessments.homeworkAssigned, 2);
        assert.equal(d.assessments.homeworkScorePercent, 80);
        assert.equal(d.assessments.examsSubmitted, 2);
        assert.equal(d.assessments.examsReleased, 1);
        assert.equal(d.assessments.examScorePercent, 50);
        assert.ok(!JSON.stringify(d).includes("explanation"));
      },
    );
    await t.test(
      "empty student uses null rates rather than fabricated zero",
      async () => {
        const r = await request(app)
          .get("/api/analytics/me")
          .set(auth(other))
          .expect(200);
        assert.equal(r.body.data.learning.accuracyPercent, null);
        assert.equal(r.body.data.assessments.examScorePercent, null);
      },
    );
    await t.test(
      "lesson trend counts published first completions only",
      async () => {
        const course = await db.course.create({
          data: {
            slug: prefix + "-trend",
            title: "合成课时趋势",
            grade: "G7",
            subject: "math",
            status: "PUBLISHED",
            chapters: {
              create: {
                title: "合成",
                position: 0,
                lessons: {
                  create: [
                    { title: "发布课时", position: 0, publishedAt: new Date() },
                    { title: "草稿课时", position: 1 },
                  ],
                },
              },
            },
          },
          include: { chapters: { include: { lessons: true } } },
        });
        try {
          await db.enrollment.create({
            data: {
              userId: other.id,
              courseId: course.id,
              progress: {
                create: course.chapters[0].lessons.map((l) => ({
                  lessonId: l.id,
                  completedAt: new Date(Date.now() - 10000),
                  positionSeconds: 100,
                })),
              },
            },
          });
          const r = await request(app)
            .get("/api/analytics/me/trend")
            .set(auth(other))
            .expect(200);
          assert.equal(
            r.body.data.list.reduce(
              (n: number, d: { completedLessons: number }) =>
                n + d.completedLessons,
              0,
            ),
            1,
          );
          await db.course.update({
            where: { id: course.id },
            data: { status: "ARCHIVED" },
          });
          const archived = await request(app)
            .get("/api/analytics/me/trend")
            .set(auth(other))
            .expect(200);
          assert.equal(
            archived.body.data.list.reduce(
              (n: number, d: { completedLessons: number }) =>
                n + d.completedLessons,
              0,
            ),
            0,
          );
        } finally {
          await db.course.delete({ where: { id: course.id } });
        }
      },
    );
    await t.test(
      "trend validates windows and zero fills dates without inventing rates",
      async () => {
        await request(app).get("/api/analytics/me/trend").expect(401);
        await request(app)
          .get("/api/analytics/me/trend?days=365")
          .set(auth(student))
          .expect(400);
        await request(app)
          .get("/api/analytics/me/trend?studentId=" + other.id)
          .set(auth(student))
          .expect(400);
        const r = await request(app)
          .get("/api/analytics/me/trend")
          .set(auth(other))
          .expect(200);
        assert.equal(r.body.data.list.length, 7);
        assert.equal(r.body.data.timezone, "Asia/Shanghai");
        assert.ok(
          r.body.data.list.every(
            (d: { attempts: number; accuracyPercent: null }) =>
              d.attempts === 0 && d.accuracyPercent === null,
          ),
        );
      },
    );
    await t.test(
      "trend groups UTC timestamps into Shanghai days and respects 7 or 30 day window",
      async () => {
        const today = new Date(Date.now() + 8 * 3600000)
          .toISOString()
          .slice(0, 10);
        const boundary = new Date(
          new Date(today + "T00:00:00+08:00").getTime() - 86400000,
        );
        const old = new Date(boundary.getTime() - 10 * 86400000);
        await db.questionAttempt.createMany({
          data: [
            { at: new Date(boundary.getTime() - 1), correct: false },
            { at: boundary, correct: true },
            { at: old, correct: true },
            { at: new Date(Date.now() + 86400000), correct: true },
          ].map((v) => ({
            userId: other.id,
            questionId: q.id,
            requestId: randomUUID(),
            selected: 0,
            correct: v.correct,
            createdAt: v.at,
            snapshot: { title: "合成跨日" },
          })),
        });
        const r = await request(app)
          .get("/api/analytics/me/trend?days=7")
          .set(auth(other))
          .expect(200);
        const before = new Date(boundary.getTime() - 1 + 8 * 3600000)
            .toISOString()
            .slice(0, 10),
          after = new Date(boundary.getTime() + 8 * 3600000)
            .toISOString()
            .slice(0, 10);
        assert.equal(
          r.body.data.list.find((d: { date: string }) => d.date === before)
            .accuracyPercent,
          0,
        );
        assert.equal(
          r.body.data.list.find((d: { date: string }) => d.date === after)
            .accuracyPercent,
          100,
        );
        assert.equal(
          r.body.data.list.reduce(
            (n: number, d: { attempts: number }) => n + d.attempts,
            0,
          ),
          2,
        );
        const all = await request(app)
          .get("/api/analytics/me/trend?days=30")
          .set(auth(other))
          .expect(200);
        assert.equal(all.body.data.list.length, 30);
        assert.equal(
          all.body.data.list.reduce(
            (n: number, d: { attempts: number }) => n + d.attempts,
            0,
          ),
          3,
        );
      },
    );
    await t.test(
      "parent trend requires binding and teacher trend is class scoped without answers or scores",
      async () => {
        await request(app)
          .get(`/api/analytics/students/${student.id}/trend`)
          .set(auth(parent))
          .expect(200);
        await request(app)
          .get(`/api/analytics/students/${other.id}/trend`)
          .set(auth(parent))
          .expect(404);
        await request(app)
          .get(`/api/analytics/classes/${c.id}/trend`)
          .set(auth(stranger))
          .expect(403);
        const r = await request(app)
          .get(`/api/analytics/classes/${c.id}/trend`)
          .set(auth(teacher))
          .expect(200);
        assert.equal(r.body.data.scope, "class");
        assert.ok(
          r.body.data.list.every(
            (d: { attempts: number; completedLessons: number }) =>
              d.attempts === 0 && d.completedLessons === 0,
          ),
        );
        assert.equal(
          r.body.data.list.reduce(
            (n: number, d: { homeworkSubmitted: number }) =>
              n + d.homeworkSubmitted,
            0,
          ),
          2,
        );
        assert.equal(
          r.body.data.list.reduce(
            (n: number, d: { examsSubmitted: number }) => n + d.examsSubmitted,
            0,
          ),
          2,
        );
        assert.ok(!JSON.stringify(r.body.data).includes("score"));
      },
    );
    await t.test(
      "student CSV is UTF8 Excel compatible and includes full requested range",
      async () => {
        await request(app).get("/api/analytics/me/trend/export").expect(401);
        await request(app)
          .get("/api/analytics/me/trend/export?days=31")
          .set(auth(student))
          .expect(400);
        for (const days of [7, 30]) {
          const r = await request(app)
            .get(`/api/analytics/me/trend/export?days=${days}`)
            .set(auth(student))
            .expect(200);
          assert.equal(r.headers["cache-control"], "no-store");
          assert.equal(r.body.code, 0);
          const file = r.body.data;
          assert.equal(file.contentType, "text/csv;charset=utf-8");
          assert.equal(file.csv.charCodeAt(0), 0xfeff);
          assert.ok(file.fileName.endsWith(".csv"));
          const lines = file.csv.slice(1).trimEnd().split("\r\n");
          assert.equal(lines.length, days + 1);
          assert.equal(
            lines[0],
            '"日期（北京时间）","完成课时数","练习次数","正确次数","练习正确率（%）","作业提交次数","考试交卷次数"',
          );
          assert.ok(!file.csv.includes(student.id));
          assert.ok(!file.csv.includes("合成"));
          assert.ok(!file.csv.includes("score"));
        }
      },
    );
    await t.test(
      "class CSV excludes private metrics and refuses other teachers",
      async () => {
        await request(app)
          .get(`/api/analytics/classes/${c.id}/trend/export`)
          .set(auth(stranger))
          .expect(403);
        await request(app)
          .get(`/api/analytics/classes/${c.id}/trend/export`)
          .set(auth(student))
          .expect(403);
        const r = await request(app)
          .get(`/api/analytics/classes/${c.id}/trend/export?days=7`)
          .set(auth(teacher))
          .expect(200);
        const lines = r.body.data.csv.slice(1).trimEnd().split("\r\n");
        assert.equal(lines.length, 8);
        assert.equal(
          lines[0],
          '"日期（北京时间）","作业提交次数","考试交卷次数"',
        );
        assert.ok(lines.every((line: string) => line.split(",").length === 3));
        assert.ok(!r.body.data.csv.includes("正确"));
        assert.ok(!r.body.data.csv.includes("成绩"));
      },
    );
    await t.test(
      "parent CSV requires current binding and cannot export unrelated student",
      async () => {
        await request(app)
          .get(`/api/analytics/students/${student.id}/trend/export`)
          .set(auth(parent))
          .expect(200);
        await request(app)
          .get(`/api/analytics/students/${other.id}/trend/export`)
          .set(auth(parent))
          .expect(404);
        await request(app)
          .get(`/api/analytics/students/${student.id}/trend/export`)
          .set(auth(teacher))
          .expect(403);
      },
    );
    await t.test("parent only sees actively bound student", async () => {
      await request(app)
        .get(`/api/analytics/students/${student.id}`)
        .set(auth(parent))
        .expect(200);
      await request(app)
        .get(`/api/analytics/students/${other.id}`)
        .set(auth(parent))
        .expect(404);
      await request(app)
        .get(`/api/analytics/students/${other.id}`)
        .set(auth(student))
        .expect(403);
      await db.parentStudent.update({
        where: {
          parentId_studentId: { parentId: parent.id, studentId: student.id },
        },
        data: { revokedAt: new Date() },
      });
      await request(app)
        .get(`/api/analytics/students/${student.id}`)
        .set(auth(parent))
        .expect(404);
      await request(app)
        .get(`/api/analytics/students/${student.id}/trend`)
        .set(auth(parent))
        .expect(404);
      await request(app)
        .get(`/api/analytics/students/${student.id}/trend/export`)
        .set(auth(parent))
        .expect(404);
    });
    await t.test(
      "teacher class ownership and paginated roster without private practice",
      async () => {
        await request(app)
          .get(`/api/analytics/classes/${c.id}`)
          .set(auth(stranger))
          .expect(403);
        await request(app)
          .get(`/api/analytics/classes/${c.id}`)
          .set(auth(student))
          .expect(403);
        await request(app)
          .get(`/api/analytics/students/${student.id}`)
          .set(auth(teacher))
          .expect(403);
        const r = await request(app)
          .get(`/api/analytics/classes/${c.id}?page=1&pageSize=1`)
          .set(auth(teacher))
          .expect(200);
        assert.equal(r.body.data.total, 2);
        assert.equal(r.body.data.list.length, 1);
        assert.ok(!("learning" in r.body.data.list[0]));
        const p = await request(app)
          .get(`/api/analytics/classes/${c.id}?page=2&pageSize=1`)
          .set(auth(teacher))
          .expect(200);
        assert.notEqual(
          r.body.data.list[0].student.id,
          p.body.data.list[0].student.id,
        );
      },
    );
    await t.test("class totals exclude other class assessments", async () => {
      const foreign = await db.schoolClass.create({
        data: { name: "其他班合成", grade: "G7", teacherId: stranger.id },
      });
      classes.push(foreign.id);
      const h = await db.homework.create({
        data: {
          classId: foreign.id,
          teacherId: stranger.id,
          title: "跨班隔离",
          instructions: "合成",
          maxScore: 100,
          dueAt: new Date(),
          status: "PUBLISHED",
          recipients: { create: { studentId: student.id } },
          submissions: {
            create: {
              studentId: student.id,
              requestId: randomUUID(),
              answerText: "合成",
              score: 0,
              gradedAt: new Date(),
            },
          },
        },
      });
      homework.push(h.id);
      const r = await request(app)
        .get(`/api/analytics/classes/${c.id}`)
        .set(auth(teacher))
        .expect(200);
      const row = r.body.data.list.find(
        (v: { student: { id: string } }) => v.student.id === student.id,
      );
      assert.equal(row.assessments.homeworkAssigned, 2);
      assert.equal(row.assessments.homeworkScorePercent, 80);
      const scopedTrend = await request(app)
        .get(`/api/analytics/classes/${c.id}/trend`)
        .set(auth(teacher))
        .expect(200);
      assert.equal(
        scopedTrend.body.data.list.reduce(
          (n: number, d: { homeworkSubmitted: number }) =>
            n + d.homeworkSubmitted,
          0,
        ),
        2,
      );
      const mine = await request(app)
        .get("/api/analytics/me")
        .set(auth(student))
        .expect(200);
      assert.equal(mine.body.data.assessments.homeworkAssigned, 3);
    });
    await t.test(
      "global deadline releases only already graded attempts",
      async () => {
        await db.exam.update({
          where: { id: exams[0] },
          data: { closesAt: new Date(Date.now() - 1000) },
        });
        const r = await request(app)
          .get("/api/analytics/me")
          .set(auth(student))
          .expect(200);
        assert.equal(r.body.data.assessments.examsReleased, 2);
        assert.equal(r.body.data.assessments.examScorePercent, 75);
      },
    );
    await t.test(
      "removed members and archived classes no longer exposed",
      async () => {
        await db.homeworkSubmission.create({
          data: {
            homeworkId: homework[0],
            studentId: other.id,
            answerText: "退班合成提交",
            requestId: randomUUID(),
          },
        });
        const beforeRemoval = await request(app)
          .get(`/api/analytics/classes/${c.id}/trend`)
          .set(auth(teacher))
          .expect(200);
        assert.equal(
          beforeRemoval.body.data.list.reduce(
            (n: number, d: { homeworkSubmitted: number }) =>
              n + d.homeworkSubmitted,
            0,
          ),
          3,
        );
        await db.classStudent.update({
          where: { classId_studentId: { classId: c.id, studentId: other.id } },
          data: { revokedAt: new Date() },
        });
        const r = await request(app)
          .get(`/api/analytics/classes/${c.id}`)
          .set(auth(admin))
          .expect(200);
        assert.equal(r.body.data.total, 1);
        const trend = await request(app)
          .get(`/api/analytics/classes/${c.id}/trend`)
          .set(auth(teacher))
          .expect(200);
        assert.equal(
          trend.body.data.list.reduce(
            (n: number, d: { homeworkSubmitted: number }) =>
              n + d.homeworkSubmitted,
            0,
          ),
          2,
        );
        assert.ok(
          trend.body.data.list.every(
            (d: { attempts: number }) => d.attempts === 0,
          ),
        );
        await db.schoolClass.update({
          where: { id: c.id },
          data: { archivedAt: new Date() },
        });
        await request(app)
          .get(`/api/analytics/classes/${c.id}`)
          .set(auth(teacher))
          .expect(404);
        await request(app)
          .get(`/api/analytics/classes/${c.id}/trend`)
          .set(auth(teacher))
          .expect(404);
      },
    );
  },
);
