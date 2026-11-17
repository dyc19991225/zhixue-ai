import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";
import { disconnectRedis } from "../lib/rate-limiter";

process.env.RATE_LIMIT_NAMESPACE = "qa-admin-search-" + randomUUID();
test("admin search combines literal filters, scope, pagination and authorization", async (t) => {
  const db = getDb(),
    app = createApp(),
    prefix = "qa_as_" + randomUUID().slice(0, 8);
  const users: string[] = [],
    ids: string[] = [];
  const courseId = prefix + "_course",
    lessonId = prefix + "_lesson";
  t.after(async () => {
    await db.course.deleteMany({ where: { id: courseId } });
    await db.question.deleteMany({ where: { id: { in: ids } } });
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
        username: "qa_as_" + randomUUID().replaceAll("-", "").slice(0, 10),
        passphrase: randomUUID() + randomUUID(),
        displayName: "合成检索验收",
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
  await request(app).get("/api/admin/questions").expect(401);
  await request(app).get("/api/admin/questions").set(student).expect(403);
  await db.course.create({
    data: {
      id: courseId,
      slug: courseId,
      title: "合成检索课程",
      grade: "G12",
      subject: "math",
      chapters: {
        create: {
          title: "合成章节",
          position: 0,
          lessons: { create: { id: lessonId, title: "合成课时", position: 0 } },
        },
      },
    },
  });
  for (let i = 0; i < 21; i++) {
    const id = `${prefix}_${i}`;
    ids.push(id);
    await db.question.create({
      data: {
        id,
        title: `${prefix} Study %_\\ Literal ${i}`,
        grade: i === 13 ? "G11" : "G12",
        subject: i === 14 ? "english" : "math",
        difficulty: i === 15 ? "EASY" : "MEDIUM",
        status: i === 16 ? "ARCHIVED" : "DRAFT",
        knowledgePoint: i === 17 ? "Unit AX50more Path" : "Unit A_50%\\ Path",
        options: ["1", "2", "3", "4"],
        answer: 0,
        explanation: "Synthetic explanation",
        ...(i !== 18 ? { lessonLinks: { create: { lessonId } } } : {}),
      },
    });
  }
  // These distractors share the title prefix but have no literal SQL wildcard characters.
  await db.question.update({
    where: { id: ids[19] },
    data: { title: `${prefix} Study XX Literal` },
  });
  await db.question.update({
    where: { id: ids[20] },
    data: { title: `${prefix} Study Other`, knowledgePoint: "Unit A_50% Path" },
  });
  const filters = {
    q: `${prefix.toUpperCase()} STUDY %_\\`,
    knowledgePoint: "unit a_50%\\",
    grade: "G12",
    subject: "math",
    difficulty: "MEDIUM",
    status: "DRAFT",
    lessonId,
  };
  const get = (query: Record<string, unknown>) =>
    request(app).get("/api/admin/questions").set(admin).query(query);
  const first = await get({ ...filters, page: 1 }).expect(200);
  const second = await get({ ...filters, page: 2 }).expect(200);
  assert.equal(first.body.data.total, 13);
  assert.equal(first.body.data.items.length, 12);
  assert.equal(second.body.data.total, 13);
  assert.equal(second.body.data.items.length, 1);
  assert.deepEqual(
    new Set(
      [...first.body.data.items, ...second.body.data.items].map((q) => q.id),
    ),
    new Set(ids.slice(0, 13)),
  );
  for (const literal of ["a_50", "50%", "%\\"]) {
    const r = await get({ q: prefix, knowledgePoint: literal }).expect(200);
    assert.equal(
      r.body.data.total,
      literal === "a_50" || literal === "50%" ? 20 : 19,
    );
  }
  const answerOnly = await get({ q: "Synthetic explanation", lessonId }).expect(
    200,
  );
  assert.equal(answerOnly.body.data.total, 0);
  const archived = await get({ q: prefix, status: "ARCHIVED" }).expect(200);
  assert.deepEqual(
    archived.body.data.items.map((q: { id: string }) => q.id),
    [ids[16]],
  );
  for (const query of [
    { q: "a" },
    { q: "x".repeat(121) },
    { knowledgePoint: "x".repeat(81) },
    { difficulty: "INVALID" },
    { status: "INVALID" },
    { page: 0 },
    { includeAnswers: true },
  ])
    await get(query).expect(400);
  await request(app)
    .get("/api/practice/questions")
    .query({ lessonId })
    .expect(400);
});
