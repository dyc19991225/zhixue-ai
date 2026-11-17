import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";
import { disconnectRedis } from "../lib/rate-limiter";
import { askTeacher } from "./ai-service";

test("explicit image requests, validation, isolation and idempotency", async (t) => {
  const saved = { ...process.env };
  const namespace = "qa-image-" + randomUUID();
  process.env.RATE_LIMIT_NAMESPACE = namespace;
  Object.assign(process.env, {
    AI_ENABLED: "true",
    AI_IMAGE_ENABLED: "true",
    AI_API_KEY: "mock-only",
    AI_MODEL: "mock-image",
    AI_QUOTA_NAMESPACE: namespace,
    AI_USER_DAILY_LIMIT: "20",
    AI_GLOBAL_DAILY_LIMIT: "20",
  });
  let calls = 0;
  let captured = "";
  let providerFails = false;
  let truncated = false;
  const provider = createServer(async (req, res) => {
    captured = "";
    for await (const chunk of req) captured += chunk;
    calls++;
    res.setHeader("Content-Type", "application/json");
    if (providerFails) {
      res.statusCode = 500;
      res.end("{}");
      return;
    }
    res.end(
      JSON.stringify({
        choices: [
          {
            message: { content: "模拟提示：先找已知条件。" },
            finish_reason: truncated ? "length" : "stop",
          },
        ],
      }),
    );
  });
  provider.listen(0, "127.0.0.1");
  await once(provider, "listening");
  const address = provider.address();
  assert.ok(address && typeof address !== "string");
  process.env.AI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  const db = getDb(),
    app = createApp();
  const fixture: { userId?: string; otherId?: string } = {};
  t.after(async () => {
    provider.close();
    const userId = fixture.userId;
    if (userId) {
      await db.aiTurn.deleteMany({ where: { userId } });
      await db.aiUsage.deleteMany({
        where: { principal: { in: [userId, namespace] } },
      });
      await db.user.delete({ where: { id: userId } });
    }
    if (fixture.otherId)
      await db.user.delete({ where: { id: fixture.otherId } });
    for (const key of Object.keys(process.env))
      if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    await disconnectDb();
    await disconnectRedis();
  });
  const origin = { Origin: "http://127.0.0.1:3000", "X-Zhixue-Client": "web" };
  const registered = await request(app)
    .post("/api/auth/register")
    .set(origin)
    .send({
      username: "qa_img_" + randomUUID().replaceAll("-", "").slice(0, 12),
      passphrase: randomUUID() + randomUUID(),
      displayName: "合成图片验收",
      grade: "G7",
    })
    .expect(200);
  const userId: string = registered.body.data.user.id;
  fixture.userId = userId;
  const auth = {
    ...origin,
    Authorization: `Bearer ${registered.body.data.accessToken}`,
  };
  const imageBytes = await readFile("apps/web/test-fixtures/ocr-printed.png");
  const image = "data:image/png;base64," + imageBytes.toString("base64");
  const input = {
    question: "请解释照片里的题目",
    requestId: randomUUID(),
    image,
  };
  await request(app)
    .post("/api/ai/questions")
    .set(origin)
    .send(input)
    .expect(401);
  await request(app)
    .post("/api/ai/questions")
    .set(auth)
    .set("Origin", "https://invalid.example")
    .send(input)
    .expect(403);
  const result = await request(app)
    .post("/api/ai/questions")
    .set(auth)
    .send(input)
    .expect(200);
  assert.equal(result.body.data.status, "SUCCEEDED");
  assert.equal(result.body.data.imageDigest, undefined);
  const body = JSON.parse(captured);
  assert.equal(body.messages[1].content[1].image_url.url, image);
  assert.equal(body.model, "mock-image");
  assert.equal(body.max_tokens, 1200);
  assert.ok(body.messages[0].content.includes("不得仅凭画得像"));
  const statusLookup = await request(app)
    .get(`/api/ai/questions/${input.requestId}`)
    .set(auth)
    .expect(200);
  assert.equal(statusLookup.body.data.id, result.body.data.id);
  assert.equal(statusLookup.body.data.imageDigest, undefined);
  const other = await request(app)
    .post("/api/auth/register")
    .set(origin)
    .send({
      username: "qa_img_" + randomUUID().replaceAll("-", "").slice(0, 12),
      passphrase: randomUUID() + randomUUID(),
      displayName: "合成其他账号",
      grade: "G7",
    })
    .expect(200);
  fixture.otherId = other.body.data.user.id;
  await request(app)
    .get(`/api/ai/questions/${input.requestId}`)
    .set({ ...origin, Authorization: `Bearer ${other.body.data.accessToken}` })
    .expect(404);
  await request(app).get(`/api/ai/questions/${input.requestId}`).expect(401);
  await request(app)
    .get(`/api/ai/questions/${randomUUID()}`)
    .set(auth)
    .expect(404);
  await request(app).get("/api/ai/questions/not-a-uuid").set(auth).expect(400);
  assert.equal(captured.includes(userId!), false);
  assert.equal(captured.includes("合成图片验收"), false);
  await request(app)
    .post("/api/ai/questions")
    .set(auth)
    .send(input)
    .expect(200);
  assert.equal(calls, 1);
  await request(app)
    .post("/api/ai/questions")
    .set(auth)
    .send({ ...input, image: undefined })
    .expect(409);
  const record = await db.aiTurn.findUniqueOrThrow({
    where: { id: result.body.data.id },
  });
  assert.match(record.imageDigest!, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(record).includes(image), false);
  const history = await request(app)
    .get("/api/ai/history")
    .set(auth)
    .expect(200);
  assert.equal(JSON.stringify(history.body).includes("imageDigest"), false);
  assert.equal(JSON.stringify(history.body).includes(image), false);
  for (const invalid of [
    "https://example.com/photo.png",
    "data:image/svg+xml;base64,PHN2Zz4=",
    "data:image/png;base64,YWJj",
    "data:image/png;base64," + Buffer.alloc(512001).toString("base64"),
  ]) {
    await assert.rejects(
      askTeacher(userId!, {
        ...input,
        requestId: randomUUID(),
        image: invalid,
      }),
      { status: 400 },
    );
  }
  process.env.AI_IMAGE_ENABLED = "false";
  await assert.rejects(
    askTeacher(userId!, { ...input, requestId: randomUUID() }),
    { status: 503 },
  );
  const status = await request(app).get("/api/ai/status").expect(200);
  assert.equal(status.body.data.imagesEnabled, false);
  const text = await askTeacher(userId!, {
    question: "如何解方程",
    requestId: randomUUID(),
  });
  assert.equal(text.status, "SUCCEEDED");
  assert.equal(typeof JSON.parse(captured).messages[1].content, "string");
  assert.equal(calls, 2);
  process.env.AI_IMAGE_ENABLED = "true";
  providerFails = true;
  const failedInput = { ...input, requestId: randomUUID() };
  await assert.rejects(askTeacher(userId, failedInput), { status: 503 });
  const failed = await request(app)
    .get(`/api/ai/questions/${failedInput.requestId}`)
    .set(auth)
    .expect(200);
  assert.equal(failed.body.data.status, "FAILED");
  assert.equal((await askTeacher(userId, failedInput)).status, "FAILED");
  assert.equal(calls, 3, "retrying the failed id must not resubmit");
  providerFails = false;
  truncated = true;
  const retried = await askTeacher(userId, {
    ...input,
    requestId: randomUUID(),
  });
  assert.equal(retried.status, "SUCCEEDED");
  assert.ok(retried.answer?.includes("回答达到长度上限"));
  assert.equal(calls, 4);
});
