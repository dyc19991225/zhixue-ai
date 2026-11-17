import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";
import { disconnectRedis } from "../lib/rate-limiter";
process.env.RATE_LIMIT_NAMESPACE = "qa-readiness-" + randomUUID();
test("readiness aggregates actual state, distinguishes visibility and lesson gaps, and requires admin", async (t) => {
  const app = createApp(),
    db = getDb();
  const prefix = "qa_ready_" + randomUUID().slice(0, 8),
    subject = prefix;
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
  async function account(role: "ADMIN" | "TEACHER" | "PARENT" | "STUDENT") {
    const result = await request(app)
      .post("/api/auth/register")
      .set(headers)
      .send({
        username: "qa_r_" + randomUUID().replaceAll("-", "").slice(0, 10),
        displayName: "合成准备度验收",
        grade: "G7",
        passphrase: randomUUID() + randomUUID(),
      })
      .expect(200);
    users.push(result.body.data.user.id);
    await db.user.update({
      where: { id: result.body.data.user.id },
      data: { role },
    });
    return {
      ...headers,
      Authorization: `Bearer ${result.body.data.accessToken}`,
    };
  }
  const admin = await account("ADMIN");
  await request(app).get("/api/admin/content-readiness").expect(401);
  for (const role of ["TEACHER", "PARENT", "STUDENT"] as const)
    await request(app)
      .get("/api/admin/content-readiness")
      .set(await account(role))
      .expect(403);
  for (const [index, status, access, grade] of [
    [0, "PUBLISHED", "FREE", "G12"],
    [1, "PUBLISHED", "MEMBER", "G12"],
    [2, "DRAFT", "FREE", "G12"],
    [3, "ARCHIVED", "FREE", "G12"],
    [4, "PUBLISHED", "FREE", "G11"],
  ] as const) {
    const id = `${prefix}_course_${index}`;
    await db.course.create({
      data: {
        id,
        slug: id,
        title: "不应返回的课程标题",
        grade,
        subject,
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
          data: { courseId, title: "合成章", position: 0 },
        })
      ).id,
    );
  const lessons: string[] = [];
  for (const [index, chapter, published] of [
    [0, 0, true],
    [1, 0, true],
    [2, 0, true],
    [3, 0, false],
    [4, 1, true],
    [5, 1, true],
    [6, 2, true],
    [7, 3, true],
  ] as const) {
    lessons.push(
      (
        await db.lesson.create({
          data: {
            chapterId: chapters[chapter],
            title: "合成课时",
            position: index,
            content: "不应返回的课时正文",
            publishedAt: published ? new Date() : null,
          },
        })
      ).id,
    );
  }
  for (let i = 0; i < 10; i++) {
    const id = `${prefix}_q_${i}`;
    await db.question.create({
      data: {
        id,
        grade: "G12",
        subject,
        title: "不应返回的题干",
        options: ["选项甲", "选项乙"],
        answer: 1,
        explanation: "不应返回的解析",
        status: i === 7 ? "DRAFT" : i === 8 ? "ARCHIVED" : "PUBLISHED",
        restrictToLessons: i === 1,
      },
    });
    questions.push(id);
  }
  // Standalone public; restricted orphan; free open; free hidden; member open;
  // draft-course; archived-course; draft question; archived question; shared question.
  for (const [q, lesson] of [
    [2, 0],
    [3, 3],
    [4, 4],
    [5, 6],
    [6, 7],
    [7, 2],
    [9, 0],
    [9, 4],
  ])
    await db.lessonQuestion.create({
      data: { lessonId: lessons[lesson], questionId: questions[q] },
    });
  const r = await request(app)
    .get("/api/admin/content-readiness?grade=G12")
    .set(admin)
    .expect(200);
  const row = r.body.data.rows.find(
    (item: { subject: string }) => item.subject === subject,
  );
  assert.deepEqual(row, {
    subject,
    subjectLabel: subject,
    publishedCourses: 2,
    draftCourses: 1,
    publishedQuestions: 8,
    draftQuestions: 1,
    publicQuestions: 3,
    openLessons: 5,
    lessonsWithoutPractice: 3,
  });
  assert.equal(r.body.data.grade, "G12");
  const encoded = JSON.stringify(r.body.data);
  for (const secret of [
    "不应返回",
    "explanation",
    "answer",
    "ownerTeacherId",
    "snapshot",
  ])
    assert.equal(encoded.includes(secret), false);
  const other = await request(app)
    .get("/api/admin/content-readiness?grade=G11")
    .set(admin)
    .expect(200);
  const otherRow = other.body.data.rows.find(
    (item: { subject: string }) => item.subject === subject,
  );
  assert.equal(otherRow.publishedCourses, 1);
  assert.equal(otherRow.publishedQuestions, 0);
  assert.equal(otherRow.openLessons, 0);
  assert.ok(
    other.body.data.rows.some(
      (item: { subject: string }) => item.subject === "math",
    ),
  );
  await request(app)
    .get("/api/admin/content-readiness?grade=G1")
    .set(admin)
    .expect(400);
  await request(app)
    .get("/api/admin/content-readiness?userId=anything")
    .set(admin)
    .expect(400);
  assert.equal(
    await db.course.count({ where: { id: { in: courses }, status: "DRAFT" } }),
    1,
  );
});
