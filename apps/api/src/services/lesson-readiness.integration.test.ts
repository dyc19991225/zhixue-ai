import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";
import { disconnectRedis } from "../lib/rate-limiter";
process.env.RATE_LIMIT_NAMESPACE = "qa-lesson-ready-" + randomUUID();
test("lesson gaps paginate, preserve boundaries and link only admin-scoped question filters", async (t) => {
  const db = getDb(),
    app = createApp(),
    prefix = "qa_lready_" + randomUUID().slice(0, 8);
  const users: string[] = [],
    courses: string[] = [],
    questions: string[] = [];
  t.after(async () => {
    await db.course.deleteMany({ where: { id: { in: courses } } });
    await db.question.deleteMany({ where: { id: { in: questions } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await disconnectDb();
    await disconnectRedis();
  });
  const headers = { Origin: "http://127.0.0.1:3000", "X-Zhixue-Client": "web" };
  async function account(admin: boolean) {
    const r = await request(app)
      .post("/api/auth/register")
      .set(headers)
      .send({
        username: "qa_lr_" + randomUUID().replaceAll("-", "").slice(0, 10),
        passphrase: randomUUID() + randomUUID(),
        displayName: "合成配套检查",
        grade: "G7",
      })
      .expect(200);
    users.push(r.body.data.user.id);
    if (admin)
      await db.user.update({
        where: { id: r.body.data.user.id },
        data: { role: "ADMIN" },
      });
    return { ...headers, Authorization: `Bearer ${r.body.data.accessToken}` };
  }
  const admin = await account(true),
    student = await account(false);
  await request(app).get("/api/admin/lesson-readiness").expect(401);
  await request(app)
    .get("/api/admin/lesson-readiness")
    .set(student)
    .expect(403);
  for (const [i, status, grade, access] of [
    [0, "PUBLISHED", "G12", "MEMBER"],
    [1, "DRAFT", "G12", "FREE"],
    [2, "ARCHIVED", "G12", "FREE"],
    [3, "PUBLISHED", "G11", "FREE"],
  ] as const) {
    const id = `${prefix}_c${i}`;
    await db.course.create({
      data: {
        id,
        slug: id,
        title: "合成课程",
        grade,
        subject: "math",
        status,
        access,
      },
    });
    courses.push(id);
  }
  const chapters: string[] = [];
  for (const courseId of courses)
    chapters.push(
      (
        await db.chapter.create({
          data: { courseId, title: "合成章节", position: 0 },
        })
      ).id,
    );
  const lessons: string[] = [];
  for (let i = 0; i < 24; i++) {
    const id = `${prefix}_l${i}`;
    await db.lesson.create({
      data: {
        id,
        chapterId: chapters[0],
        title: "课时" + i,
        position: i,
        publishedAt: i === 23 ? null : new Date(),
        content: "禁止返回的课时正文",
      },
    });
    lessons.push(id);
  }
  for (const chapterId of chapters.slice(1))
    await db.lesson.create({
      data: {
        chapterId,
        title: "不属于目标年级或发布状态",
        position: 0,
        publishedAt: new Date(),
      },
    });
  for (let i = 0; i < 5; i++) {
    const id = `${prefix}_q${i}`;
    await db.question.create({
      data: {
        id,
        title: "合成题" + i,
        grade: "G12",
        subject: "math",
        options: ["甲", "乙", "丙", "丁"],
        answer: 0,
        explanation: "禁止从检查清单返回的解析",
        status:
          i === 1 || i === 3 ? "DRAFT" : i === 2 ? "ARCHIVED" : "PUBLISHED",
      },
    });
    questions.push(id);
  }
  for (const [q, lesson] of [
    [0, 0],
    [0, 4],
    [1, 1],
    [2, 2],
    [3, 1],
  ])
    await db.lessonQuestion.create({
      data: { lessonId: lessons[lesson], questionId: questions[q] },
    });
  const query = { grade: "G12", courseId: courses[0] };
  const first = await request(app)
    .get("/api/admin/lesson-readiness")
    .query(query)
    .set(admin)
    .expect(200);
  const second = await request(app)
    .get("/api/admin/lesson-readiness")
    .query({ ...query, page: 2 })
    .set(admin)
    .expect(200);
  assert.equal(first.body.data.total, 21);
  assert.equal(first.body.data.items.length, 20);
  assert.equal(second.body.data.items.length, 1);
  assert.equal(first.body.data.items[0].id, lessons[1]);
  assert.equal(first.body.data.items[0].draftQuestions, 2);
  assert.equal(first.body.data.items[0].publishedQuestions, 0);
  assert.equal(first.body.data.items[1].archivedQuestions, 1);
  assert.equal(first.body.data.items[0].access, "MEMBER");
  const ids = new Set(
    first.body.data.items.map((row: { id: string }) => row.id),
  );
  assert.ok(!ids.has(second.body.data.items[0].id));
  assert.equal(JSON.stringify(first.body.data).includes("禁止"), false);
  const all = await request(app)
    .get("/api/admin/lesson-readiness")
    .query({ ...query, missingOnly: "false" })
    .set(admin)
    .expect(200);
  assert.equal(all.body.data.total, 23);
  assert.equal(all.body.data.items[0].publishedQuestions, 1);
  const hiddenCourse = await request(app)
    .get("/api/admin/lesson-readiness")
    .query({ grade: "G12", courseId: courses[1] })
    .set(admin)
    .expect(200);
  assert.equal(hiddenCourse.body.data.total, 0);
  for (const invalid of [
    { grade: "G1" },
    { page: 0 },
    { missingOnly: "1" },
    { userId: users[0] },
  ])
    await request(app)
      .get("/api/admin/lesson-readiness")
      .query(invalid)
      .set(admin)
      .expect(400);
  const draft = await request(app)
    .get("/api/admin/questions")
    .query({ lessonId: lessons[1], status: "DRAFT" })
    .set(admin)
    .expect(200);
  assert.equal(draft.body.data.total, 2);
  assert.deepEqual(
    new Set(draft.body.data.items.map((q: { id: string }) => q.id)),
    new Set([questions[1], questions[3]]),
  );
  await request(app)
    .get("/api/admin/questions")
    .query({ lessonId: lessons[1] })
    .set(student)
    .expect(403);
  await request(app)
    .get("/api/practice/questions")
    .query({ lessonId: lessons[1] })
    .expect(400);
  await request(app).get("/api/practice/questions?status=DRAFT").expect(400);
  await request(app)
    .get("/api/admin/questions?status=INVALID")
    .set(admin)
    .expect(400);
  await request(app)
    .get("/api/admin/questions")
    .query({ lessonId: "x".repeat(101) })
    .set(admin)
    .expect(400);
  const pinned = "zzzzzz_" + prefix;
  await db.lesson.createMany({
    data: Array.from({ length: 302 }, (_, i) => ({
      id: i === 301 ? pinned : "zzzz_" + prefix + i,
      chapterId: chapters[0],
      title: "隐藏合成课时",
      position: 1000 + i,
    })),
  });
  const baseOptions = await request(app)
    .get("/api/admin/lesson-options")
    .set(admin)
    .expect(200);
  assert.equal(baseOptions.body.data.items.length, 300);
  assert.ok(
    !baseOptions.body.data.items.some(
      (row: { id: string }) => row.id === pinned,
    ),
  );
  const pinnedOptions = await request(app)
    .get("/api/admin/lesson-options")
    .query({ includeId: pinned })
    .set(admin)
    .expect(200);
  assert.equal(pinnedOptions.body.data.items.length, 301);
  assert.ok(
    pinnedOptions.body.data.items.some(
      (row: { id: string }) => row.id === pinned,
    ),
  );
  assert.equal(JSON.stringify(pinnedOptions.body.data).includes("禁止"), false);
  await request(app)
    .get("/api/admin/lesson-options")
    .query({ includeId: pinned })
    .set(student)
    .expect(403);
});
