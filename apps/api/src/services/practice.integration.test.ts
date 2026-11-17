import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { disconnectRedis } from "../lib/rate-limiter";
process.env.RATE_LIMIT_NAMESPACE =
  "qa-practice-" + randomBytes(8).toString("hex");
import request from "supertest";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";
test(
  "PostgreSQL practice grading, ownership and wrong-book lifecycle",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp(),
      prefix = `qa_p_${randomBytes(5).toString("hex")}`,
      users: string[] = [],
      questions: string[] = [];
    const headers = {
      "X-Zhixue-Client": "web",
      Origin: "http://127.0.0.1:3000",
    };
    t.after(async () => {
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.question.deleteMany({ where: { id: { in: questions } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(suffix: string) {
      const r = await request(app)
        .post("/api/auth/register")
        .set(headers)
        .send({
          username: `${prefix}_${suffix}`,
          passphrase: randomBytes(24).toString("hex"),
          displayName: "练习测试",
          grade: "G7",
        })
        .expect(200);
      users.push(r.body.data.user.id);
      return { ...headers, Authorization: `Bearer ${r.body.data.accessToken}` };
    }
    const admin = await account("a"),
      student = await account("s"),
      other = await account("o");
    await db.user.update({ where: { id: users[0] }, data: { role: "ADMIN" } });
    const draft = {
      title: prefix + " 合成验证题，不作教学内容",
      grade: "G7",
      subject: "math",
      knowledgePoint: prefix,
      difficulty: "EASY",
      options: ["选项一", "选项二", "选项三", "选项四"],
      answer: 1,
      explanation: "合成测试解析。",
    };
    let id = "",
      version = "",
      wrongRequest = "";
    await t.test(
      "only admins write; strict schema and draft visibility",
      async () => {
        await request(app)
          .post("/api/admin/questions")
          .set(student)
          .send(draft)
          .expect(403);
        await request(app).post("/api/admin/questions").send(draft).expect(403);
        await request(app)
          .post("/api/admin/questions")
          .set(admin)
          .send({ ...draft, options: ["a", "b"] })
          .expect(400);
        await request(app)
          .post("/api/admin/questions")
          .set(admin)
          .send({ ...draft, answer: 5 })
          .expect(400);
        await request(app)
          .post("/api/admin/questions")
          .set(admin)
          .send({ ...draft, options: ["a", "a", "c", "d"] })
          .expect(400);
        const r = await request(app)
          .post("/api/admin/questions")
          .set(admin)
          .send(draft)
          .expect(200);
        id = r.body.data.id;
        version = r.body.data.updatedAt;
        questions.push(id);
        const list = await request(app)
          .get(`/api/practice/questions?knowledgePoint=${prefix}`)
          .expect(200);
        assert.equal(list.body.data.total, 0);
        await request(app)
          .post(`/api/practice/questions/${id}/attempts`)
          .set(student)
          .send({ selected: 0, requestId: randomUUID(), updatedAt: version })
          .expect(404);
        await request(app)
          .get("/api/practice/questions?grade=G7&grade=G8")
          .expect(400);
        await request(app).get("/api/practice/wrong-questions").expect(401);
        await request(app).get("/api/admin/questions").set(student).expect(403);
      },
    );
    await t.test(
      "publication checks explanation and timestamps; public projection never includes keys",
      async () => {
        const empty = await request(app)
          .put(`/api/admin/questions/${id}`)
          .set(admin)
          .send({ ...draft, explanation: "", updatedAt: version })
          .expect(200);
        version = empty.body.data.updatedAt;
        await request(app)
          .patch(`/api/admin/questions/${id}/status`)
          .set(admin)
          .send({ status: "PUBLISHED", updatedAt: version })
          .expect(400);
        const edited = await request(app)
          .put(`/api/admin/questions/${id}`)
          .set(admin)
          .send({ ...draft, updatedAt: version })
          .expect(200);
        version = edited.body.data.updatedAt;
        await request(app)
          .patch(`/api/admin/questions/${id}/status`)
          .set(admin)
          .send({ status: "PUBLISHED", updatedAt: "2020-01-01T00:00:00.000Z" })
          .expect(409);
        const r = await request(app)
          .patch(`/api/admin/questions/${id}/status`)
          .set(admin)
          .send({ status: "PUBLISHED", updatedAt: version })
          .expect(200);
        version = r.body.data.updatedAt;
        const list = await request(app)
          .get(
            `/api/practice/questions?knowledgePoint=${prefix}&grade=G7&subject=math&difficulty=EASY`,
          )
          .expect(200);
        assert.equal(list.body.data.total, 1);
        assert.equal(list.body.data.items[0].answer, undefined);
        assert.equal(list.body.data.items[0].explanation, undefined);
        await request(app)
          .put(`/api/admin/questions/${id}`)
          .set(admin)
          .send({ ...draft, updatedAt: version })
          .expect(409);
      },
    );
    await t.test(
      "server grades, writes own history and deduplicates concurrent retries",
      async () => {
        wrongRequest = randomUUID();
        const body = {
          selected: 0,
          requestId: wrongRequest,
          updatedAt: version,
        };
        await request(app)
          .post(`/api/practice/questions/${id}/attempts`)
          .send(body)
          .expect(403);
        await request(app)
          .post(`/api/practice/questions/${id}/attempts`)
          .set(student)
          .send({ ...body, userId: users[2], correct: true })
          .expect(400);
        await request(app)
          .post(`/api/practice/questions/${id}/attempts`)
          .set(student)
          .send({ ...body, updatedAt: "2020-01-01T00:00:00.000Z" })
          .expect(409);
        const [a, b] = await Promise.all([
          request(app)
            .post(`/api/practice/questions/${id}/attempts`)
            .set(student)
            .send(body)
            .expect(200),
          request(app)
            .post(`/api/practice/questions/${id}/attempts`)
            .set(student)
            .send(body)
            .expect(200),
        ]);
        assert.equal(a.body.data.id, b.body.data.id);
        assert.equal(a.body.data.correct, false);
        assert.equal(a.body.data.snapshot.answer, 1);
        assert.equal(
          (
            await db.wrongQuestion.findUniqueOrThrow({
              where: {
                userId_questionId: { userId: users[1], questionId: id },
              },
            })
          ).wrongCount,
          1,
        );
        await request(app)
          .post(`/api/practice/questions/${id}/attempts`)
          .set(student)
          .send({ ...body, selected: 1 })
          .expect(409);
        const mine = await request(app)
          .get("/api/practice/wrong-questions")
          .set(student)
          .expect(200);
        assert.equal(mine.body.data.total, 1);
        assert.equal(mine.body.data.items[0].question.answer, undefined);
        const theirs = await request(app)
          .get("/api/practice/wrong-questions")
          .set(other)
          .expect(200);
        assert.equal(theirs.body.data.total, 0);
        const history = await request(app)
          .get("/api/practice/attempts")
          .set(other)
          .expect(200);
        assert.equal(history.body.data.total, 0);
        await request(app)
          .get(`/api/practice/attempts?userId=${users[1]}`)
          .set(other)
          .expect(400);
      },
    );
    await t.test(
      "correct review resolves; later wrong answers reopen; old replay never changes state",
      async () => {
        const submit = (selected: number, requestId: string = randomUUID()) =>
          request(app)
            .post(`/api/practice/questions/${id}/attempts`)
            .set(student)
            .send({ selected, requestId, updatedAt: version })
            .expect(200);
        await submit(1);
        const active = await request(app)
          .get("/api/practice/wrong-questions")
          .set(student)
          .expect(200);
        assert.equal(active.body.data.total, 0);
        const resolved = await request(app)
          .get("/api/practice/wrong-questions?state=resolved")
          .set(student)
          .expect(200);
        assert.equal(resolved.body.data.total, 1);
        await submit(0, wrongRequest);
        assert.ok(
          (
            await db.wrongQuestion.findUniqueOrThrow({
              where: {
                userId_questionId: { userId: users[1], questionId: id },
              },
            })
          ).resolvedAt,
        );
        await submit(2);
        const reopened = await db.wrongQuestion.findUniqueOrThrow({
          where: { userId_questionId: { userId: users[1], questionId: id } },
        });
        assert.equal(reopened.resolvedAt, null);
        assert.equal(reopened.wrongCount, 2);
        const history = await request(app)
          .get("/api/practice/attempts")
          .set(student)
          .expect(200);
        assert.equal(history.body.data.total, 3);
      },
    );
    await t.test(
      "answered question is immutable; archive hides practice and preserves own snapshots",
      async () => {
        const r = await request(app)
          .patch(`/api/admin/questions/${id}/status`)
          .set(admin)
          .send({ status: "DRAFT", updatedAt: version })
          .expect(200);
        version = r.body.data.updatedAt;
        await request(app)
          .put(`/api/admin/questions/${id}`)
          .set(admin)
          .send({ ...draft, updatedAt: version })
          .expect(409);
        await request(app)
          .patch(`/api/admin/questions/${id}/status`)
          .set(admin)
          .send({ status: "ARCHIVED", updatedAt: version })
          .expect(200);
        await request(app)
          .post(`/api/practice/questions/${id}/attempts`)
          .set(student)
          .send({ selected: 0, requestId: randomUUID(), updatedAt: version })
          .expect(404);
        const wrongs = await request(app)
          .get("/api/practice/wrong-questions")
          .set(student)
          .expect(200);
        assert.equal(wrongs.body.data.total, 0);
        const history = await request(app)
          .get("/api/practice/attempts")
          .set(student)
          .expect(200);
        assert.equal(history.body.data.total, 3);
        assert.equal(
          history.body.data.items[0].snapshot.explanation,
          draft.explanation,
        );
      },
    );
  },
);
