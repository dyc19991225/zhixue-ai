import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import { renderDiagramSvg } from "@zhixue/shared";
import { diagramSchema } from "./diagram-validation";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";
import { disconnectRedis } from "../lib/rate-limiter";
process.env.RATE_LIMIT_NAMESPACE =
  "qa-diagrams-" + randomBytes(8).toString("hex");
const diagram = {
  kind: "rectangle" as const,
  widthLabel: "x 厘米",
  heightLabel: "6 厘米",
  note: "周长26厘米；示意图不按比例",
  alt: "长方形的长为x厘米，宽6厘米，周长26厘米。",
};
test("figure templates escape labels and reject arbitrary SVG", () => {
  const safe = renderDiagramSvg({
    ...diagram,
    widthLabel: "<script>alert(1)</script>",
  });
  assert.ok(!safe.includes("<script>"));
  assert.ok(safe.includes("&lt;script&gt;"));
  assert.equal(
    diagramSchema.safeParse({ ...diagram, svg: '<svg onload="evil()" />' })
      .success,
    false,
  );
  assert.equal(
    diagramSchema.safeParse({
      kind: "adjacent-angles",
      knownAngle: 0,
      unknownLabel: "x",
      alt: "相邻角测试描述",
      note: "",
    }).success,
    false,
  );
});
test(
  "lesson diagrams, answer snapshots and member visibility",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp(),
      prefix = "qa_fig_" + randomBytes(5).toString("hex"),
      users: string[] = [],
      courses: string[] = [],
      questions: string[] = [];
    let planId = "";
    const headers = {
      "X-Zhixue-Client": "web",
      Origin: "http://127.0.0.1:3000",
    };
    t.after(async () => {
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.question.deleteMany({ where: { id: { in: questions } } });
      await db.course.deleteMany({ where: { id: { in: courses } } });
      if (planId) await db.membershipPlan.delete({ where: { id: planId } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(s: string) {
      const r = await request(app)
        .post("/api/auth/register")
        .set(headers)
        .send({
          username: prefix + "_" + s,
          passphrase: randomBytes(24).toString("hex"),
          displayName: "图形验收",
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
    async function course(s: string) {
      const c = await db.course.create({
        data: {
          title: prefix + s,
          slug: prefix.replaceAll("_", "-") + s,
          grade: "G7",
          subject: "math",
          description: "合成测试课",
          status: "PUBLISHED",
          chapters: {
            create: {
              title: "测试章",
              position: 0,
              lessons: {
                create: {
                  title: "测试课",
                  position: 0,
                  content: "测试正文",
                  publishedAt: new Date(),
                },
              },
            },
          },
        },
        include: { chapters: { include: { lessons: true } } },
      });
      courses.push(c.id);
      return { id: c.id, lessonId: c.chapters[0].lessons[0].id };
    }
    const own = await course("one"),
      foreign = await course("two");
    const body = {
      title: "图中矩形长x厘米、宽6厘米、周长26厘米。求x。",
      grade: "G7",
      subject: "math",
      knowledgePoint: prefix,
      difficulty: "MEDIUM",
      options: ["7", "8", "9", "10"],
      answer: 0,
      explanation: "2(x+6)=26，解得x=7。",
      diagram,
      lessonIds: [own.lessonId],
    };
    await request(app)
      .post("/api/admin/questions")
      .set(admin)
      .send({ ...body, lessonIds: ["missing"] })
      .expect(400);
    await request(app)
      .post("/api/admin/questions")
      .set(student)
      .send(body)
      .expect(403);
    await request(app)
      .post("/api/admin/questions")
      .set(admin)
      .send({ ...body, diagram: { ...diagram, href: "https://example.com" } })
      .expect(400);
    const created = await request(app)
      .post("/api/admin/questions")
      .set(admin)
      .send(body)
      .expect(200);
    const id = created.body.data.id;
    questions.push(id);
    const published = await request(app)
      .patch(`/api/admin/questions/${id}/status`)
      .set(admin)
      .send({ status: "PUBLISHED", updatedAt: created.body.data.updatedAt })
      .expect(200);
    const updatedAt = published.body.data.updatedAt;
    await request(app)
      .get(`/api/learning/${own.id}/lessons/${own.lessonId}/questions`)
      .expect(401);
    await request(app)
      .get(`/api/learning/${own.id}/lessons/${own.lessonId}/questions`)
      .set(student)
      .expect(403);
    await request(app)
      .post(`/api/course/${own.id}/enroll`)
      .set(student)
      .expect(200);
    await request(app)
      .get(`/api/learning/${own.id}/lessons/${foreign.lessonId}/questions`)
      .set(student)
      .expect(404);
    const list = await request(app)
      .get(`/api/learning/${own.id}/lessons/${own.lessonId}/questions`)
      .set(student)
      .expect(200);
    assert.equal(list.body.data.items.length, 1);
    assert.deepEqual(list.body.data.items[0].diagram, diagram);
    assert.equal(list.body.data.items[0].answer, undefined);
    const answered = await request(app)
      .post(`/api/practice/questions/${id}/attempts`)
      .set(student)
      .send({ selected: 1, requestId: randomUUID(), updatedAt })
      .expect(200);
    assert.deepEqual(answered.body.data.snapshot.diagram, diagram);
    await db.course.update({
      where: { id: own.id },
      data: { access: "MEMBER" },
    });
    const publicList = await request(app)
      .get(`/api/practice/questions?knowledgePoint=${prefix}`)
      .expect(200);
    assert.equal(publicList.body.data.total, 0);
    const hiddenWrong = await request(app)
      .get("/api/practice/wrong-questions")
      .set(student)
      .expect(200);
    assert.equal(hiddenWrong.body.data.total, 0);
    await request(app)
      .get(`/api/learning/${own.id}/lessons/${own.lessonId}/questions`)
      .set(student)
      .expect(403);
    await request(app)
      .post(`/api/practice/questions/${id}/attempts`)
      .set(other)
      .send({ selected: 0, requestId: randomUUID(), updatedAt })
      .expect(404);
    const plan = await db.membershipPlan.create({
      data: { code: prefix, active: true, name: "合成测试权益" },
    });
    planId = plan.id;
    await db.membership.create({
      data: {
        userId: users[1],
        planId,
        startsAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      },
    });
    await request(app)
      .get(`/api/learning/${own.id}/lessons/${own.lessonId}/questions`)
      .set(student)
      .expect(200);
    const visibleWrong = await request(app)
      .get("/api/practice/wrong-questions")
      .set(student)
      .expect(200);
    assert.deepEqual(visibleWrong.body.data.items[0].question.diagram, diagram);
    await db.lesson.delete({ where: { id: own.lessonId } });
    const orphan = await request(app)
      .get(`/api/practice/questions?knowledgePoint=${prefix}`)
      .expect(200);
    assert.equal(orphan.body.data.total, 0);
    await request(app)
      .post(`/api/practice/questions/${id}/attempts`)
      .set(student)
      .send({ selected: 0, requestId: randomUUID(), updatedAt })
      .expect(404);
    const history = await request(app)
      .get("/api/practice/attempts")
      .set(student)
      .expect(200);
    assert.deepEqual(history.body.data.items[0].snapshot.diagram, diagram);
    const others = await request(app)
      .get("/api/practice/attempts")
      .set(other)
      .expect(200);
    assert.equal(others.body.data.total, 0);
  },
);
