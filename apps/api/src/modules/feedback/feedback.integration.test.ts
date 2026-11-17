import "../../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../../app";
import { getDb, disconnectDb } from "../../lib/db";
import { disconnectRedis } from "../../lib/rate-limiter";
process.env.RATE_LIMIT_NAMESPACE = "qa-feedback-" + randomUUID();
test("feedback ownership, idempotency, pagination and audited conflict-safe processing", async (t) => {
  const db = getDb(),
    app = createApp(),
    ids: string[] = [];
  const origin = { Origin: "http://127.0.0.1:3000", "X-Zhixue-Client": "web" };
  t.after(async () => {
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await disconnectDb();
    await disconnectRedis();
  });
  async function account(role: "STUDENT" | "ADMIN" | "TEACHER") {
    const r = await request(app)
      .post("/api/auth/register")
      .set(origin)
      .send({
        username: "qa_fb_" + randomUUID().replaceAll("-", "").slice(0, 12),
        displayName: "合成反馈验收",
        grade: "G7",
        passphrase: randomUUID() + randomUUID(),
      })
      .expect(200);
    ids.push(r.body.data.user.id);
    if (role !== "STUDENT")
      await db.user.update({
        where: { id: r.body.data.user.id },
        data: { role },
      });
    return { ...origin, Authorization: `Bearer ${r.body.data.accessToken}` };
  }
  const student = await account("STUDENT"),
    other = await account("TEACHER"),
    admin = await account("ADMIN");
  const input = {
    requestId: randomUUID(),
    area: "照片识别",
    severity: "影响使用",
    detail: "合成问题：照片裁剪后请检查符号。<script>不执行</script>",
  };
  await request(app).post("/api/feedback").set(origin).send(input).expect(401);
  await request(app)
    .post("/api/feedback")
    .set(student)
    .set("Origin", "https://invalid.example")
    .send(input)
    .expect(403);
  await request(app)
    .post("/api/feedback")
    .set(student)
    .send({ ...input, userId: ids[1] })
    .expect(400);
  await request(app)
    .post("/api/feedback")
    .set(student)
    .send({ ...input, detail: "太短" })
    .expect(400);
  const concurrent = await Promise.all(
    [1, 2].map(() =>
      request(app).post("/api/feedback").set(student).send(input).expect(200),
    ),
  );
  const record = concurrent[0].body.data;
  assert.equal(record.id, concurrent[1].body.data.id);
  assert.equal(record.status, "NEW");
  for (const field of ["userId", "requestId", "changes"])
    assert.equal(record[field], undefined);
  assert.equal(await db.trialFeedback.count({ where: { userId: ids[0] } }), 1);
  await request(app)
    .post("/api/feedback")
    .set(student)
    .send({ ...input, detail: "同标识但修改内容的合成描述" })
    .expect(409);
  const own = await request(app).get("/api/feedback").set(student).expect(200);
  assert.equal(own.body.data.total, 1);
  assert.equal(own.body.data.items[0].detail, input.detail);
  const isolated = await request(app)
    .get("/api/feedback")
    .set(other)
    .expect(200);
  assert.equal(isolated.body.data.total, 0);
  await request(app)
    .get("/api/feedback?userId=" + ids[0])
    .set(other)
    .expect(400);
  await request(app).get("/api/admin/feedback").set(student).expect(403);
  await request(app).get("/api/admin/feedback").set(other).expect(403);
  const update = {
    revision: 0,
    status: "IN_PROGRESS",
    reply: "合成处理：正在核对裁剪后的题干。",
  };
  await request(app)
    .patch(`/api/admin/feedback/${record.id}`)
    .set(student)
    .send(update)
    .expect(403);
  await request(app)
    .patch(`/api/admin/feedback/${record.id}`)
    .set(admin)
    .set("Origin", "https://invalid.example")
    .send(update)
    .expect(403);
  await request(app)
    .patch(`/api/admin/feedback/${record.id}`)
    .set(admin)
    .send({ ...update, reply: "短" })
    .expect(400);
  const race = await Promise.all(
    [1, 2].map(() =>
      request(app)
        .patch(`/api/admin/feedback/${record.id}`)
        .set(admin)
        .send(update),
    ),
  );
  assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    await db.feedbackChange.count({ where: { feedbackId: record.id } }),
    1,
  );
  await request(app)
    .patch(`/api/admin/feedback/${record.id}`)
    .set(admin)
    .send({
      ...update,
      revision: 1,
      status: "RESOLVED",
      reply: "合成处理：已核对并完成修复验证。",
    })
    .expect(200);
  const resolved = await request(app)
    .get("/api/feedback?status=RESOLVED")
    .set(student)
    .expect(200);
  assert.equal(resolved.body.data.items[0].revision, 2);
  assert.equal(
    resolved.body.data.items[0].reply,
    "合成处理：已核对并完成修复验证。",
  );
  const audit = await db.feedbackChange.findMany({
    where: { feedbackId: record.id },
    orderBy: { revision: "asc" },
  });
  assert.equal(audit.length, 2);
  assert.equal(audit[0].actorUserId, ids[2]);
  assert.equal(audit[0].reply, update.reply);
  await request(app).get("/api/feedback?page=0").set(student).expect(400);
  await request(app)
    .get("/api/admin/feedback?status=INVALID")
    .set(admin)
    .expect(400);
  await db.trialFeedback.createMany({
    data: Array.from({ length: 21 }, (_, i) => ({
      userId: ids[0],
      requestId: randomUUID(),
      area: "课程与内容",
      severity: "一般问题",
      detail: `合成分页记录 ${i}`,
    })),
  });
  const page1 = await request(app)
    .get("/api/feedback?page=1")
    .set(student)
    .expect(200);
  const page2 = await request(app)
    .get("/api/feedback?page=2")
    .set(student)
    .expect(200);
  assert.equal(page1.body.data.total, 22);
  assert.equal(page1.body.data.items.length, 20);
  assert.equal(page2.body.data.items.length, 2);
  const firstIds = new Set(
    page1.body.data.items.map((item: { id: string }) => item.id),
  );
  assert.ok(
    page2.body.data.items.every(
      (item: { id: string }) => !firstIds.has(item.id),
    ),
  );
  const adminList = await request(app)
    .get("/api/admin/feedback?status=RESOLVED")
    .set(admin)
    .expect(200);
  assert.ok(
    adminList.body.data.items.some(
      (item: { id: string }) => item.id === record.id,
    ),
  );
  for (let i = 0; i < 5; i++)
    await request(app).post("/api/feedback").set(student).send(input);
  await request(app).post("/api/feedback").set(student).send(input).expect(429);
});
