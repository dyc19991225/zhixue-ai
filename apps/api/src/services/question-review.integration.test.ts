import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";
import { disconnectRedis } from "../lib/rate-limiter";
process.env.RATE_LIMIT_NAMESPACE = "qa-qreview-" + randomUUID();
test("question review is admin-only, read-only, scoped, and retains optimistic publication", async (t) => {
  const db = getDb(),
    app = createApp(),
    users: string[] = [],
    courses: string[] = [];
  const questionIds: string[] = [];
  t.after(async () => {
    await db.question.deleteMany({ where: { id: { in: questionIds } } });
    await db.course.deleteMany({ where: { id: { in: courses } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await disconnectDb();
    await disconnectRedis();
  });
  const headers = { Origin: "http://127.0.0.1:3000", "X-Zhixue-Client": "web" };
  async function account(role: "ADMIN" | "TEACHER" | "STUDENT" | "PARENT") {
    const result = await request(app)
      .post("/api/auth/register")
      .set(headers)
      .send({
        username: "qa_qr_" + randomUUID().replaceAll("-", "").slice(0, 12),
        passphrase: randomUUID() + randomUUID(),
        displayName: "合成预览验收",
        grade: "G7",
      })
      .expect(200);
    const id: string = result.body.data.user.id;
    users.push(id);
    await db.user.update({ where: { id }, data: { role } });
    return {
      ...headers,
      Authorization: `Bearer ${result.body.data.accessToken}`,
    };
  }
  const admin = await account("ADMIN");
  const diagram = {
    kind: "rectangle",
    widthLabel: "x",
    heightLabel: "6",
    note: "仅合成题图",
    alt: "长为x宽为6的长方形",
  };
  const q = await db.question.create({
    data: {
      title: "合成长方形周长26，求x",
      grade: "G7",
      subject: "math",
      options: ["5", "6", "7", "8"],
      answer: 2,
      explanation: "合成解析：2(x+6)=26，x=7。",
      diagram,
      restrictToLessons: true,
    },
  });
  questionIds.push(q.id);
  for (const [status, access, opened] of [
    ["PUBLISHED", "FREE", true],
    ["PUBLISHED", "MEMBER", false],
    ["DRAFT", "FREE", true],
  ] as const) {
    const id = "qa_qreview_" + randomUUID();
    const course = await db.course.create({
      data: {
        id,
        slug: id,
        title: `合成课程 ${status} ${access}`,
        grade: "G7",
        subject: "math",
        status,
        access,
        description: "禁止出现在预览的课程说明",
        chapters: {
          create: {
            title: "合成章",
            position: 0,
            lessons: {
              create: {
                title: "合成课时",
                position: 0,
                content: "禁止出现在预览的课时正文",
                publishedAt: opened ? new Date() : null,
                questionLinks: { create: { questionId: q.id } },
              },
            },
          },
        },
      },
    });
    courses.push(course.id);
  }
  const path = `/api/admin/questions/${q.id}/review`;
  await request(app).get(path).expect(401);
  for (const role of ["TEACHER", "STUDENT", "PARENT"] as const)
    await request(app)
      .get(path)
      .set(await account(role))
      .expect(403);
  const view = await request(app).get(path).set(admin).expect(200);
  assert.equal(view.body.data.answer, 2);
  assert.equal(view.body.data.explanation, q.explanation);
  assert.deepEqual(view.body.data.diagram, diagram);
  assert.equal(view.body.data.lessonLinks.length, 3);
  assert.ok(
    view.body.data.lessonLinks.some(
      (link: { lesson: { publishedAt: string | null } }) =>
        link.lesson.publishedAt === null,
    ),
  );
  for (const field of [
    "禁止出现在预览",
    "ownerTeacherId",
    "recoveryCodeHash",
    "mediaId",
    "content",
  ])
    assert.equal(JSON.stringify(view.body.data).includes(field), false);
  assert.equal(
    (await db.question.findUniqueOrThrow({ where: { id: q.id } })).status,
    "DRAFT",
  );
  assert.equal(
    await db.questionAttempt.count({ where: { questionId: q.id } }),
    0,
  );
  await request(app)
    .get("/api/admin/questions/missing-question/review")
    .set(admin)
    .expect(404);
  await request(app)
    .get(`/api/admin/questions/${"x".repeat(101)}/review`)
    .set(admin)
    .expect(400);
  const edited = await db.question.update({
    where: { id: q.id },
    data: {
      explanation: "合成新版解析：x+6=13，x=7。",
      updatedAt: new Date(q.updatedAt.getTime() + 1000),
    },
  });
  await request(app)
    .patch(`/api/admin/questions/${q.id}/status`)
    .set(admin)
    .send({ status: "PUBLISHED", updatedAt: view.body.data.updatedAt })
    .expect(409);
  const fresh = await request(app).get(path).set(admin).expect(200);
  assert.equal(fresh.body.data.updatedAt, edited.updatedAt.toISOString());
  await request(app)
    .patch(`/api/admin/questions/${q.id}/status`)
    .set(admin)
    .send({ status: "PUBLISHED", updatedAt: fresh.body.data.updatedAt })
    .expect(200);
  const publicPage = await request(app)
    .get("/api/practice/questions")
    .query({ grade: "G7", q: "合成长方形周长26" })
    .expect(200);
  const publicQuestion = publicPage.body.data.items.find(
    (item: { id: string }) => item.id === q.id,
  );
  assert.ok(publicQuestion);
  assert.equal(publicQuestion.answer, undefined);
  assert.equal(publicQuestion.explanation, undefined);
  assert.equal(publicQuestion.lessonLinks, undefined);
});
