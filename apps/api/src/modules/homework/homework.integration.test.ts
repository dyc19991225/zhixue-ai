import "../../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import type { Role } from "@zhixue/shared";
import { createApp } from "../../app";
import { getDb, disconnectDb } from "../../lib/db";
import { disconnectRedis } from "../../lib/rate-limiter";
process.env.RATE_LIMIT_NAMESPACE =
  "qa-homework-" + randomBytes(8).toString("hex");
test(
  "homework publication, immutable submissions and teacher grading",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const app = createApp(),
      db = getDb(),
      prefix = "qa_hw_" + randomBytes(5).toString("hex"),
      users: string[] = [],
      classIds: string[] = [],
      homeworkIds: string[] = [];
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
      await db.homework.deleteMany({ where: { id: { in: homeworkIds } } });
      await db.schoolClass.deleteMany({ where: { id: { in: classIds } } });
      await db.adminAuditLog.deleteMany({
        where: { actorUserId: { in: users } },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(suffix: string, role: Role): Promise<Account> {
      const res = await request(app)
        .post("/api/auth/register")
        .set(origin)
        .send({
          username: prefix + "_" + suffix,
          passphrase: randomBytes(24).toString("hex"),
          displayName: "作业合成测试",
          grade: "G7",
        })
        .expect(200);
      const id = res.body.data.user.id as string;
      users.push(id);
      await db.user.update({ where: { id }, data: { role } });
      return { id, token: res.body.data.accessToken as string };
    }
    const admin = await account("a", "ADMIN"),
      teacher = await account("t", "TEACHER"),
      teacherB = await account("b", "TEACHER"),
      student = await account("s", "STUDENT"),
      outsider = await account("o", "STUDENT"),
      late = await account("l", "STUDENT"),
      parent = await account("p", "PARENT");
    for (const owner of [teacher, teacherB]) {
      const c = await db.schoolClass.create({
        data: { name: "合成作业班", grade: "G7", teacherId: owner.id },
      });
      classIds.push(c.id);
    }
    const classId = classIds[0];
    await db.classStudent.create({ data: { classId, studentId: student.id } });
    const draft = {
      classId,
      title: "一元一次方程练习",
      instructions: "解2x+3=11，并写出检验过程。",
      maxScore: 10,
      dueAt: new Date(Date.now() + 3600000).toISOString(),
    };
    async function create(input = draft, actor = teacher) {
      const res = await request(app)
        .post("/api/homework")
        .set(auth(actor))
        .send(input)
        .expect(200);
      homeworkIds.push(res.body.data.id as string);
      return res.body.data.id as string;
    }
    async function status(
      id: string,
      next: "PUBLISHED" | "ARCHIVED" | "DRAFT",
    ) {
      const row = await db.homework.findUniqueOrThrow({ where: { id } });
      return request(app)
        .patch(`/api/homework/${id}/status`)
        .set(auth(teacher))
        .send({ status: next, updatedAt: row.updatedAt.toISOString() });
    }
    const id = await create();
    let submissionId = "",
      gradeVersion = "";
    const submissionRequest = randomUUID(),
      gradeRequest = randomUUID();
    await t.test(
      "drafts are private and input/teacher scope are enforced",
      async () => {
        await request(app).get("/api/homework").expect(401);
        await request(app).get("/api/homework").set(auth(parent)).expect(403);
        await request(app)
          .post("/api/homework")
          .set(auth(teacherB))
          .send(draft)
          .expect(403);
        await request(app)
          .post("/api/homework")
          .set(auth(student))
          .send(draft)
          .expect(403);
        await request(app)
          .post("/api/homework")
          .set(auth(teacher))
          .send({ ...draft, teacherId: teacherB.id })
          .expect(400);
        await request(app)
          .post("/api/homework")
          .set(auth(teacher))
          .send({ ...draft, maxScore: 0 })
          .expect(400);
        await request(app)
          .get(`/api/homework/${id}`)
          .set(auth(student))
          .expect(404);
        assert.equal(
          (
            await request(app)
              .get(`/api/homework?classId=${classId}`)
              .set(auth(student))
              .expect(200)
          ).body.data.total,
          0,
        );
        await request(app)
          .get("/api/homework?page=0")
          .set(auth(student))
          .expect(400);
      },
    );
    await t.test(
      "draft edits use versions; publication requires valid deadline and roster",
      async () => {
        const row = await db.homework.findUniqueOrThrow({ where: { id } });
        const edit = {
          title: draft.title,
          instructions: draft.instructions,
          maxScore: draft.maxScore,
          dueAt: draft.dueAt,
        };
        await request(app)
          .put(`/api/homework/${id}`)
          .set(auth(teacher))
          .send({
            ...edit,
            title: "方程作业（修订）",
            updatedAt: row.updatedAt.toISOString(),
          })
          .expect(200);
        await request(app)
          .put(`/api/homework/${id}`)
          .set(auth(teacher))
          .send({ ...edit, updatedAt: "1970-01-01T00:00:00.000Z" })
          .expect(409);
        const empty = await create(
          { ...draft, classId: classIds[1] },
          teacherB,
        );
        const emptyRow = await db.homework.findUniqueOrThrow({
          where: { id: empty },
        });
        await request(app)
          .patch(`/api/homework/${empty}/status`)
          .set(auth(teacherB))
          .send({
            status: "PUBLISHED",
            updatedAt: emptyRow.updatedAt.toISOString(),
          })
          .expect(400);
        const past = await create({
          ...draft,
          dueAt: "2020-01-01T00:00:00.000Z",
        });
        assert.equal((await status(past, "PUBLISHED")).status, 400);
        assert.equal((await status(id, "PUBLISHED")).status, 200);
        assert.equal(
          await db.homeworkRecipient.count({ where: { homeworkId: id } }),
          1,
        );
        await db.classStudent.create({ data: { classId, studentId: late.id } });
      },
    );
    await t.test(
      "published roster is a snapshot and published content cannot change",
      async () => {
        await request(app)
          .get(`/api/homework/${id}`)
          .set(auth(student))
          .expect(200);
        for (const a of [outsider, late])
          await request(app)
            .get(`/api/homework/${id}`)
            .set(auth(a))
            .expect(404);
        await request(app)
          .get(`/api/homework/${id}`)
          .set(auth(teacherB))
          .expect(403);
        await request(app)
          .get(`/api/homework/${id}/submissions`)
          .set(auth(student))
          .expect(403);
        assert.equal((await status(id, "DRAFT")).status, 409);
        const row = await db.homework.findUniqueOrThrow({ where: { id } });
        const edit = {
          title: draft.title,
          instructions: draft.instructions,
          maxScore: draft.maxScore,
          dueAt: draft.dueAt,
        };
        await request(app)
          .put(`/api/homework/${id}`)
          .set(auth(teacher))
          .send({ ...edit, updatedAt: row.updatedAt.toISOString() })
          .expect(409);
      },
    );
    await t.test(
      "student submission is owned, immutable and safely replayed",
      async () => {
        const url = `/api/homework/${id}/submissions`,
          input = {
            answerText: "2x=8，x=4；2×4+3=11。",
            requestId: submissionRequest,
          };
        await request(app)
          .post(url)
          .set(auth(outsider))
          .send(input)
          .expect(404);
        await request(app)
          .post(url)
          .set(auth(student))
          .send({ ...input, score: 10 })
          .expect(400);
        const submitted = await request(app)
          .post(url)
          .set(auth(student))
          .send(input)
          .expect(200);
        submissionId = submitted.body.data.id as string;
        gradeVersion = submitted.body.data.updatedAt as string;
        assert.equal(submitted.body.data.score, null);
        const replay = await request(app)
          .post(url)
          .set(auth(student))
          .send(input)
          .expect(200);
        assert.equal(replay.body.data.id, submissionId);
        await request(app)
          .post(url)
          .set(auth(student))
          .send({ ...input, answerText: "改写" })
          .expect(409);
        await request(app)
          .post(url)
          .set(auth(student))
          .send({ ...input, requestId: randomUUID() })
          .expect(409);
        assert.equal(
          await db.homeworkSubmission.count({ where: { homeworkId: id } }),
          1,
        );
      },
    );
    await t.test(
      "teacher roster counts and student isolation match stored submissions",
      async () => {
        const res = await request(app)
          .get(`/api/homework/${id}/submissions`)
          .set(auth(teacher))
          .expect(200);
        assert.equal(res.body.data.recipientCount, 1);
        assert.equal(res.body.data.total, 1);
        assert.equal(res.body.data.gradedCount, 0);
        assert.equal(res.body.data.list[0].studentId, student.id);
        await request(app)
          .get(`/api/homework/${id}/submissions`)
          .set(auth(teacherB))
          .expect(403);
        const personal = await request(app)
          .get(`/api/homework/${id}`)
          .set(auth(student))
          .expect(200);
        assert.equal(personal.body.data.submission.id, submissionId);
      },
    );
    await t.test(
      "only owning teacher/admin grade; score bounds and versions are checked",
      async () => {
        const url = `/api/homework/${id}/submissions/${submissionId}/grade`,
          input = {
            score: 0,
            feedback: "请补充移项依据。",
            updatedAt: gradeVersion,
            requestId: gradeRequest,
          };
        for (const a of [student, parent, teacherB])
          await request(app).post(url).set(auth(a)).send(input).expect(403);
        await request(app)
          .post(url)
          .set(auth(teacher))
          .send({ ...input, score: 11 })
          .expect(400);
        await request(app)
          .post(url)
          .set(auth(teacher))
          .send({ ...input, updatedAt: "1970-01-01T00:00:00.000Z" })
          .expect(409);
        const graded = await request(app)
          .post(url)
          .set(auth(teacher))
          .send(input)
          .expect(200);
        assert.equal(graded.body.data.score, 0);
        assert.ok(graded.body.data.gradedAt);
        await request(app).post(url).set(auth(teacher)).send(input).expect(200);
        await request(app)
          .post(url)
          .set(auth(teacher))
          .send({ ...input, feedback: "覆盖旧反馈" })
          .expect(409);
        await request(app)
          .post(url)
          .set(auth(teacher))
          .send({ ...input, requestId: randomUUID() })
          .expect(409);
        assert.equal(
          await db.adminAuditLog.count({
            where: { action: `HOMEWORK_GRADE:${submissionId}` },
          }),
          1,
        );
      },
    );
    await t.test(
      "deadline is server-enforced while accepted retries remain valid",
      async () => {
        await db.homework.update({
          where: { id },
          data: { dueAt: new Date(Date.now() - 1000) },
        });
        await request(app)
          .post(`/api/homework/${id}/submissions`)
          .set(auth(student))
          .send({
            answerText: "2x=8，x=4；2×4+3=11。",
            requestId: submissionRequest,
          })
          .expect(200);
        const expired = await create();
        assert.equal((await status(expired, "PUBLISHED")).status, 200);
        await db.homework.update({
          where: { id: expired },
          data: { dueAt: new Date(Date.now() - 1000) },
        });
        await request(app)
          .post(`/api/homework/${expired}/submissions`)
          .set(auth(late))
          .send({ answerText: "截止后提交", requestId: randomUUID() })
          .expect(409);
        assert.equal(
          await db.homeworkSubmission.count({ where: { homeworkId: expired } }),
          0,
        );
      },
    );
    await t.test(
      "concurrent identical submissions never duplicate or produce 500",
      async () => {
        const concurrent = await create();
        assert.equal((await status(concurrent, "PUBLISHED")).status, 200);
        const input = { answerText: "并发提交", requestId: randomUUID() };
        const results = await Promise.all(
          [1, 2].map(() =>
            request(app)
              .post(`/api/homework/${concurrent}/submissions`)
              .set(auth(student))
              .send(input),
          ),
        );
        assert.ok(results.some((r) => r.status === 200));
        assert.ok(results.every((r) => [200, 409].includes(r.status)));
        assert.equal(
          await db.homeworkSubmission.count({
            where: { homeworkId: concurrent, studentId: student.id },
          }),
          1,
        );
      },
    );
    await t.test(
      "archived/removed class members retain only their own submitted history",
      async () => {
        assert.equal((await status(id, "ARCHIVED")).status, 200);
        await db.classStudent.update({
          where: { classId_studentId: { classId, studentId: student.id } },
          data: { revokedAt: new Date() },
        });
        const personal = await request(app)
          .get(`/api/homework/${id}`)
          .set(auth(student))
          .expect(200);
        assert.equal(
          personal.body.data.submission.feedback,
          "请补充移项依据。",
        );
        assert.equal(personal.body.data.submission.score, 0);
        assert.equal((await status(id, "PUBLISHED")).status, 409);
        const row = await db.user.findUniqueOrThrow({
          where: { id: teacher.id },
        });
        await request(app)
          .patch(`/api/admin/users/${teacher.id}/role`)
          .set(auth(admin))
          .send({ role: "STUDENT", updatedAt: row.updatedAt.toISOString() })
          .expect(200);
        await request(app)
          .get(`/api/homework/${id}`)
          .set(auth(student))
          .expect(200);
        await request(app)
          .get(`/api/homework/${id}/submissions`)
          .set(auth(teacher))
          .expect(401);
      },
    );
  },
);
