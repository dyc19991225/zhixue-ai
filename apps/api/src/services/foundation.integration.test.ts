import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { once } from "node:events";
import { unlink } from "node:fs/promises";
import { resolve } from "node:path";
import express from "express";
import request from "supertest";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";
import { checkRedis, disconnectRedis, limiter } from "../lib/rate-limiter";
import { mediaDirectory } from "./media-service";
process.env.RATE_LIMIT_NAMESPACE =
  "qa-foundation-" + randomBytes(8).toString("hex");
test(
  "Media, memberships, Redis and AI adapter integration",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp(),
      prefix = "qa_f_" + randomBytes(5).toString("hex"),
      userIds: string[] = [],
      courseIds: string[] = [],
      mediaIds: string[] = [];
    const headers = {
      "X-Zhixue-Client": "web",
      Origin: "http://127.0.0.1:3000",
    };
    process.env.AI_QUOTA_NAMESPACE = "qa-global-" + prefix;
    const previousManualPlan = await db.membershipPlan.findUnique({
      where: { code: "LOCAL_MANUAL" },
    });
    let providerCalls = 0,
      providerFails = false,
      captured = "";
    const provider = createServer(async (req, res) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      captured = body;
      providerCalls++;
      res.setHeader("Content-Type", "application/json");
      if (providerFails) {
        res.statusCode = 500;
        res.end("{}");
      } else
        res.end(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    "本地模拟模型：先想一想等式两边同时减去相同的数会发生什么。",
                },
              },
            ],
          }),
        );
    });
    provider.listen(0, "127.0.0.1");
    await once(provider, "listening");
    const address = provider.address();
    assert.ok(address && typeof address !== "string");
    t.after(async () => {
      provider.close();
      await db.aiTurn.deleteMany({ where: { userId: { in: userIds } } });
      await db.aiUsage.deleteMany({
        where: {
          principal: { in: [...userIds, process.env.AI_QUOTA_NAMESPACE!] },
        },
      });
      await db.adminAuditLog.deleteMany({
        where: { actorUserId: { in: userIds } },
      });
      await db.course.deleteMany({ where: { id: { in: courseIds } } });
      const media = await db.mediaAsset.findMany({
        where: { id: { in: mediaIds } },
      });
      await db.mediaAsset.deleteMany({ where: { id: { in: mediaIds } } });
      for (const m of media)
        await unlink(resolve(mediaDirectory(), m.storageKey)).catch(() => {});
      await db.aiUsage.deleteMany({ where: { principal: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      if (!previousManualPlan)
        await db.membershipPlan.deleteMany({
          where: { code: "LOCAL_MANUAL", memberships: { none: {} } },
        });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(suffix: string) {
      const r = await request(app)
        .post("/api/auth/register")
        .set(headers)
        .send({
          username: prefix + "_" + suffix,
          passphrase: randomBytes(24).toString("hex"),
          displayName: "基础验收",
          grade: "G7",
        })
        .expect(200);
      userIds.push(r.body.data.user.id);
      return { ...headers, Authorization: `Bearer ${r.body.data.accessToken}` };
    }
    const admin = await account("a"),
      student = await account("s"),
      other = await account("o");
    await db.user.update({
      where: { id: userIds[0] },
      data: { role: "ADMIN" },
    });
    let mediaId = "",
      courseId = "",
      lessonId = "",
      playCookie = "",
      membershipId = "";
    await t.test(
      "admin raw MP4 upload and authenticated range streaming",
      async () => {
        const bytes = Buffer.concat([
          Buffer.from(
            "000000186674797069736f6d0000020069736f6d69736f32",
            "hex",
          ),
          Buffer.alloc(100, 1),
        ]);
        await request(app)
          .post("/api/admin/media")
          .set(student)
          .set("Content-Type", "video/mp4")
          .send(bytes)
          .expect(403);
        await request(app)
          .post("/api/admin/media")
          .set(admin)
          .set("Content-Type", "video/mp4")
          .send(Buffer.from("invalid"))
          .expect(415);
        const uploaded = await request(app)
          .post("/api/admin/media")
          .set(admin)
          .set("Content-Type", "video/mp4")
          .set("X-File-Name", encodeURIComponent("C:\\private\\数学复习.mp4"))
          .send(bytes)
          .expect(200);
        mediaId = uploaded.body.data.id;
        mediaIds.push(mediaId);
        assert.equal(uploaded.body.data.storageKey, undefined);
        assert.equal(uploaded.body.data.filename, "数学复习.mp4");
        await request(app)
          .post("/api/admin/media")
          .set(admin)
          .set("Content-Type", "video/mp4")
          .set("X-File-Name", "%ZZ")
          .send(bytes)
          .expect(400);
        const c = await db.course.create({
          data: {
            slug: prefix.replaceAll("_", "-"),
            title: "临时媒体课",
            grade: "G7",
            subject: "math",
            description: "QA",
            status: "PUBLISHED",
            chapters: {
              create: {
                title: "章",
                position: 0,
                lessons: {
                  create: {
                    title: "课",
                    position: 0,
                    mediaId,
                    publishedAt: new Date(),
                  },
                },
              },
            },
          },
          include: { chapters: { include: { lessons: true } } },
        });
        courseId = c.id;
        courseIds.push(c.id);
        lessonId = c.chapters[0].lessons[0].id;
        await request(app).get(`/api/media/${mediaId}/content`).expect(401);
        await request(app)
          .post(`/api/learning/${courseId}/lessons/${lessonId}/playback`)
          .set(student)
          .expect(403);
        await request(app)
          .post(`/api/course/${courseId}/enroll`)
          .set(student)
          .expect(200);
        const issued = await request(app)
          .post(`/api/learning/${courseId}/lessons/${lessonId}/playback`)
          .set(student)
          .expect(200);
        const cookies = issued.headers["set-cookie"] as unknown as string[];
        assert.match(cookies[0], /HttpOnly/);
        assert.equal(issued.body.data.url, `/api/media/${mediaId}/content`);
        playCookie = cookies[0].split(";")[0];
        const range = await request(app)
          .get(issued.body.data.url)
          .set("Cookie", playCookie)
          .set("Range", "bytes=0-11")
          .expect(206);
        assert.equal(range.headers["content-length"], "12");
        assert.equal(
          range.headers["content-range"],
          `bytes 0-11/${bytes.length}`,
        );
        await request(app)
          .get(issued.body.data.url)
          .set("Cookie", playCookie)
          .set("Range", "bytes=900-999")
          .expect(416);
        await request(app)
          .put(`/api/learning/${courseId}/lessons/${lessonId}/position`)
          .set(student)
          .send({ positionSeconds: 12.5 })
          .expect(200);
        const view = await request(app)
          .get(`/api/learning/${courseId}`)
          .set(student)
          .expect(200);
        assert.equal(view.body.data.positions[lessonId], 12.5);
        const completionUrl = `/api/learning/${courseId}/lessons/${lessonId}/completion`;
        const completed = await Promise.all([
          request(app).put(completionUrl).set(student).send({}).expect(200),
          request(app).put(completionUrl).set(student).send({}).expect(200),
        ]);
        const completedAt = completed[0].body.data.completedAt;
        assert.ok(completedAt);
        assert.equal(completed[1].body.data.completedAt, completedAt);
        const retry = await request(app)
          .put(completionUrl)
          .set(student)
          .send({})
          .expect(200);
        assert.equal(retry.body.data.completedAt, completedAt);
        const finished = await request(app)
          .get(`/api/learning/${courseId}`)
          .set(student)
          .expect(200);
        assert.ok(finished.body.data.completedIds.includes(lessonId));
        assert.equal(finished.body.data.positions[lessonId], 12.5);
        await request(app)
          .put(`/api/learning/${courseId}/lessons/${lessonId}/position`)
          .set(other)
          .send({ positionSeconds: 10 })
          .expect(403);
        await request(app)
          .put(`/api/learning/${courseId}/lessons/${lessonId}/position`)
          .set(student)
          .send({ positionSeconds: -1 })
          .expect(400);
      },
    );
    await t.test(
      "member grants, expiry and revoke protect text, progress and video",
      async () => {
        await db.course.update({
          where: { id: courseId },
          data: { access: "MEMBER" },
        });
        await request(app)
          .get(`/api/media/${mediaId}/content`)
          .set("Cookie", playCookie)
          .expect(403);
        await request(app)
          .post("/api/admin/memberships")
          .set(student)
          .send({ username: prefix + "_s", days: 7 })
          .expect(403);
        const granted = await request(app)
          .post("/api/admin/memberships")
          .set(admin)
          .send({ username: prefix + "_s", days: 7 })
          .expect(200);
        membershipId = granted.body.data.id;
        await request(app)
          .get(`/api/learning/${courseId}`)
          .set(student)
          .expect(200);
        await request(app)
          .get(`/api/media/${mediaId}/content`)
          .set("Cookie", playCookie)
          .set("Range", "bytes=-12")
          .expect(206);
        await db.membership.update({
          where: { id: membershipId },
          data: { expiresAt: new Date(Date.now() - 1) },
        });
        await request(app)
          .get(`/api/learning/${courseId}`)
          .set(student)
          .expect(403);
        await db.membership.update({
          where: { id: membershipId },
          data: { expiresAt: new Date(Date.now() + 86400000) },
        });
        await request(app)
          .delete(`/api/admin/memberships/${membershipId}`)
          .set(admin)
          .expect(200);
        await request(app)
          .get(`/api/media/${mediaId}/content`)
          .set("Cookie", playCookie)
          .expect(403);
        await db.course.update({
          where: { id: courseId },
          data: { access: "FREE" },
        });
        await db.authSession.updateMany({
          where: { userId: userIds[1] },
          data: { revokedAt: new Date() },
        });
        await request(app)
          .get(`/api/media/${mediaId}/content`)
          .set("Cookie", playCookie)
          .expect(401);
      },
    );
    await t.test(
      "AI disabled is honest; simulated provider, quota and own history work",
      async () => {
        process.env.AI_ENABLED = "false";
        await request(app)
          .post("/api/ai/questions")
          .set(other)
          .send({ question: "方程如何移项？", requestId: randomUUID() })
          .expect(503);
        assert.equal(providerCalls, 0);
        process.env.AI_ENABLED = "true";
        process.env.AI_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
        process.env.AI_API_KEY = "local-test-only";
        process.env.AI_MODEL = "local-fixture";
        process.env.AI_USER_DAILY_LIMIT = "2";
        const body = { question: "方程如何移项？", requestId: randomUUID() };
        const answer = await request(app)
          .post("/api/ai/questions")
          .set(other)
          .send(body)
          .expect(200);
        assert.match(answer.body.data.answer, /本地模拟/);
        assert.equal(providerCalls, 1);
        assert.equal(captured.includes(prefix), false);
        await request(app)
          .post("/api/ai/questions")
          .set(other)
          .send(body)
          .expect(200);
        assert.equal(providerCalls, 1);
        await request(app)
          .post("/api/ai/questions")
          .set(other)
          .send({ ...body, question: "另一个问题" })
          .expect(409);
        const empty = await request(app)
          .get("/api/ai/history")
          .set(admin)
          .expect(200);
        assert.equal(empty.body.data.items.length, 0);
        process.env.AI_USER_DAILY_LIMIT = "1";
        const simultaneous = {
          question: "如何理解等式？",
          requestId: randomUUID(),
        };
        const duplicate = await Promise.all([
          request(app)
            .post("/api/ai/questions")
            .set(admin)
            .send(simultaneous)
            .expect(200),
          request(app)
            .post("/api/ai/questions")
            .set(admin)
            .send(simultaneous)
            .expect(200),
        ]);
        assert.equal(duplicate[0].body.data.id, duplicate[1].body.data.id);
        assert.equal(providerCalls, 2);
        process.env.AI_USER_DAILY_LIMIT = "2";
        providerFails = true;
        await request(app)
          .post("/api/ai/questions")
          .set(other)
          .send({ question: "函数是什么？", requestId: randomUUID() })
          .expect(503);
        providerFails = false;
        await request(app)
          .post("/api/ai/questions")
          .set(other)
          .send({ question: "函数是什么？", requestId: randomUUID() })
          .expect(200);
        await request(app)
          .post("/api/ai/questions")
          .set(other)
          .send({ question: "第三次问题？", requestId: randomUUID() })
          .expect(429);
        process.env.AI_GLOBAL_DAILY_LIMIT = "4";
        await request(app)
          .post("/api/ai/questions")
          .set(admin)
          .send({ question: "全局限额验证？", requestId: randomUUID() })
          .expect(429);
        assert.equal(providerCalls, 4);
        await request(app)
          .delete("/api/ai/history")
          .set(other)
          .send({ confirm: true })
          .expect(200);
        const mine = await request(app)
          .get("/api/ai/history")
          .set(other)
          .expect(200);
        assert.equal(mine.body.data.items.length, 0);
      },
    );
    await t.test("real Redis atomically limits requests", async () => {
      if (!process.env.REDIS_URL) {
        t.diagnostic("Redis absent; local memory fallback tested instead.");
      } else assert.equal(await checkRedis(), "PONG");
      const limited = express();
      limited.get("/probe", limiter("integration", 2, 60000), (_req, res) =>
        res.json({ ok: true }),
      );
      const results = await Promise.all(
        Array.from({ length: 4 }, () => request(limited).get("/probe")),
      );
      assert.equal(results.filter((r) => r.status === 200).length, 2);
      assert.equal(results.filter((r) => r.status === 429).length, 2);
    });
  },
);
