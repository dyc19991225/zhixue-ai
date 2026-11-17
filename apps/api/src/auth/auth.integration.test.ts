import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { disconnectRedis } from "../lib/rate-limiter";
process.env.RATE_LIMIT_NAMESPACE = "qa-auth-" + randomBytes(8).toString("hex");
import request, { type Response } from "supertest";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";

function cookie(response: Response): string {
  const values = response.headers["set-cookie"] as unknown as string[];
  assert.ok(values?.length);
  const result = values.find((value) => value.startsWith("zhixue_refresh="));
  assert.ok(result);
  assert.match(result, /HttpOnly/i);
  assert.match(result, /SameSite=Strict/i);
  assert.match(result, /Path=\/api\/auth/i);
  return result.split(";")[0];
}
test(
  "PostgreSQL authentication and ownership integration",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const app = createApp();
    const db = getDb();
    const prefix = `qa_${randomBytes(5).toString("hex")}`;
    const accountA = `${prefix}_a`,
      accountB = `${prefix}_b`;
    const passphrase = randomBytes(24).toString("base64url");
    const newPassphrase = randomBytes(24).toString("base64url");
    const recoveredPassphrase = randomBytes(24).toString("base64url");
    const headers = {
      "X-Zhixue-Client": "web",
      Origin: "http://127.0.0.1:3000",
    };
    let accessA = "",
      accessB = "",
      cookieA = "",
      cookieB = "",
      idA = "",
      idB = "",
      recoveryA = "";
    t.after(async () => {
      const users = await db.user.findMany({
        where: { username: { in: [accountA, accountB] } },
        select: { id: true },
      });
      await db.adminAuditLog.deleteMany({
        where: { targetUserId: { in: users.map((u) => u.id) } },
      });
      await db.user.deleteMany({
        where: { id: { in: users.map((u) => u.id) } },
      });
      await disconnectDb();
      await disconnectRedis();
    });
    await t.test(
      "reject cross-site writes, invalid JSON, and privilege injection",
      async () => {
        await request(app).post("/api/auth/register").send({}).expect(403);
        await request(app)
          .post("/api/auth/register")
          .set(headers)
          .set("Origin", "https://example.com")
          .send({})
          .expect(403);
        await request(app)
          .post("/api/auth/register")
          .set(headers)
          .send({
            username: accountA,
            passphrase,
            displayName: "测试甲",
            grade: "G7",
            role: "ADMIN",
          })
          .expect(400);
        await request(app)
          .post("/api/auth/login")
          .set(headers)
          .set("Content-Type", "application/json")
          .send("{")
          .expect(400);
        await request(app).get("/api/users/me").expect(401);
        await request(app)
          .get("/api/users/me")
          .set("Authorization", "Bearer not.a.jwt")
          .expect(401);
      },
    );
    await t.test(
      "register two students with hashed credentials and private cookies",
      async () => {
        const a = await request(app)
          .post("/api/auth/register")
          .set(headers)
          .send({
            username: accountA,
            passphrase,
            displayName: "测试甲",
            grade: "G7",
          })
          .expect(200);
        accessA = a.body.data.accessToken;
        idA = a.body.data.user.id;
        recoveryA = a.body.data.recoveryCode;
        cookieA = cookie(a);
        assert.equal(a.body.data.user.role, "STUDENT");
        assert.equal(a.body.data.refreshToken, undefined);
        assert.equal(a.body.data.user.passwordHash, undefined);
        const stored = await db.user.findUniqueOrThrow({ where: { id: idA } });
        assert.notEqual(stored.passwordHash, passphrase);
        assert.match(stored.passwordHash, /^\$2[ab]\$12\$/);
        assert.notEqual(stored.recoveryCodeHash, recoveryA);
        await request(app)
          .post("/api/auth/register")
          .set(headers)
          .send({
            username: accountA,
            passphrase,
            displayName: "测试甲",
            grade: "G7",
          })
          .expect(409);
        const b = await request(app)
          .post("/api/auth/register")
          .set(headers)
          .send({
            username: accountB,
            passphrase,
            displayName: "测试乙",
            grade: "G8",
          })
          .expect(200);
        accessB = b.body.data.accessToken;
        idB = b.body.data.user.id;
        cookieB = cookie(b);
        await request(app)
          .get("/api/users/me")
          .set("Authorization", `Bearer ${accessA}`)
          .expect(200);
      },
    );
    await t.test(
      "refresh rotates tokens and replay revokes the entire session",
      async () => {
        const rotated = await request(app)
          .post("/api/auth/refresh")
          .set(headers)
          .set("Cookie", cookieA)
          .expect(200);
        assert.notEqual(cookie(rotated), cookieA);
        await request(app)
          .post("/api/auth/refresh")
          .set(headers)
          .set("Cookie", `zhixue_refresh=${accessA}`)
          .expect(401);
        await request(app)
          .post("/api/auth/refresh")
          .set(headers)
          .set("Cookie", cookieA)
          .expect(401);
        await request(app)
          .get("/api/users/me")
          .set("Authorization", `Bearer ${rotated.body.data.accessToken}`)
          .expect(401);
        const login = await request(app)
          .post("/api/auth/login")
          .set(headers)
          .send({ username: accountA, passphrase })
          .expect(200);
        accessA = login.body.data.accessToken;
        cookieA = cookie(login);
      },
    );
    await t.test(
      "profile and session ownership cannot cross accounts",
      async () => {
        const profile = await request(app)
          .patch("/api/users/me")
          .set(headers)
          .set("Authorization", `Bearer ${accessA}`)
          .send({ displayName: "测试新昵称", grade: "G10" })
          .expect(200);
        assert.equal(profile.body.data.id, idA);
        assert.equal(profile.body.data.grade, "G10");
        assert.equal(
          (await db.user.findUniqueOrThrow({ where: { id: idB } })).displayName,
          "测试乙",
        );
        await request(app)
          .patch("/api/users/me")
          .set(headers)
          .set("Authorization", `Bearer ${accessA}`)
          .send({ displayName: "测试甲", grade: "G7", role: "ADMIN" })
          .expect(400);
        const sessions = await request(app)
          .get("/api/auth/sessions")
          .set("Authorization", `Bearer ${accessB}`)
          .expect(200);
        await request(app)
          .delete(`/api/auth/sessions/${sessions.body.data.items[0].id}`)
          .set(headers)
          .set("Authorization", `Bearer ${accessA}`)
          .expect(404);
        await request(app)
          .get("/api/users/me")
          .set("Authorization", `Bearer ${accessB}`)
          .expect(200);
        await request(app)
          .get("/api/admin/users")
          .set("Authorization", `Bearer ${accessA}`)
          .expect(403);
      },
    );
    await t.test(
      "administrator permission comes from database; disable revokes access",
      async () => {
        await db.user.update({ where: { id: idB }, data: { role: "ADMIN" } });
        const listing = await request(app)
          .get("/api/admin/users")
          .set("Authorization", `Bearer ${accessB}`)
          .expect(200);
        assert.ok(
          listing.body.data.items.every(
            (u: Record<string, unknown>) =>
              !("passwordHash" in u) && !("recoveryCodeHash" in u),
          ),
        );
        await request(app)
          .patch(`/api/admin/users/${idB}/status`)
          .set(headers)
          .set("Authorization", `Bearer ${accessB}`)
          .send({ status: "DISABLED" })
          .expect(400);
        await request(app)
          .patch(`/api/admin/users/${idA}/status`)
          .set(headers)
          .set("Authorization", `Bearer ${accessB}`)
          .send({ status: "DISABLED" })
          .expect(200);
        await request(app)
          .get("/api/users/me")
          .set("Authorization", `Bearer ${accessA}`)
          .expect(401);
        await request(app)
          .post("/api/auth/login")
          .set(headers)
          .send({ username: accountA, passphrase })
          .expect(401);
        await request(app)
          .patch(`/api/admin/users/${idA}/status`)
          .set(headers)
          .set("Authorization", `Bearer ${accessB}`)
          .send({ status: "ACTIVE" })
          .expect(200);
        assert.equal(
          await db.adminAuditLog.count({ where: { targetUserId: idA } }),
          2,
        );
        const login = await request(app)
          .post("/api/auth/login")
          .set(headers)
          .send({ username: accountA, passphrase })
          .expect(200);
        accessA = login.body.data.accessToken;
        cookieA = cookie(login);
      },
    );
    await t.test(
      "credential change and one-time recovery revoke previous sessions",
      async () => {
        await request(app)
          .post("/api/auth/credentials/change")
          .set(headers)
          .set("Authorization", `Bearer ${accessA}`)
          .send({ currentPassword: passphrase, newPassword: newPassphrase })
          .expect(200);
        await request(app)
          .get("/api/users/me")
          .set("Authorization", `Bearer ${accessA}`)
          .expect(401);
        await request(app)
          .post("/api/auth/login")
          .set(headers)
          .send({ username: accountA, passphrase })
          .expect(401);
        const login = await request(app)
          .post("/api/auth/login")
          .set(headers)
          .send({ username: accountA, passphrase: newPassphrase })
          .expect(200);
        accessA = login.body.data.accessToken;
        const recovered = await request(app)
          .post("/api/auth/recover")
          .set(headers)
          .send({
            username: accountA,
            recoveryCode: recoveryA,
            newPassword: recoveredPassphrase,
          })
          .expect(200);
        assert.notEqual(recovered.body.data.recoveryCode, recoveryA);
        await request(app)
          .post("/api/auth/recover")
          .set(headers)
          .send({
            username: accountA,
            recoveryCode: recoveryA,
            newPassword: passphrase,
          })
          .expect(400);
        await request(app)
          .get("/api/users/me")
          .set("Authorization", `Bearer ${accessA}`)
          .expect(401);
        const fresh = await request(app)
          .post("/api/auth/login")
          .set(headers)
          .send({ username: accountA, passphrase: recoveredPassphrase })
          .expect(200);
        accessA = fresh.body.data.accessToken;
        cookieA = cookie(fresh);
      },
    );
    await t.test(
      "logout and logout-all immediately invalidate access JWTs",
      async () => {
        await request(app)
          .post("/api/auth/logout")
          .set(headers)
          .set("Cookie", cookieB)
          .expect(200);
        await request(app)
          .get("/api/users/me")
          .set("Authorization", `Bearer ${accessB}`)
          .expect(401);
        await request(app)
          .post("/api/auth/logout-all")
          .set(headers)
          .set("Authorization", `Bearer ${accessA}`)
          .expect(200);
        await request(app)
          .get("/api/users/me")
          .set("Authorization", `Bearer ${accessA}`)
          .expect(401);
        await request(app)
          .post("/api/auth/refresh")
          .set(headers)
          .set("Cookie", cookieA)
          .expect(401);
      },
    );
    await t.test(
      "login rate limiting returns the uniform 429 format",
      async () => {
        let limited = false;
        for (let i = 0; i < 25; i++) {
          const response = await request(app)
            .post("/api/auth/login")
            .set(headers)
            .send({});
          if (response.status === 429) {
            assert.equal(response.body.code, 429);
            assert.equal(response.body.data, null);
            limited = true;
            break;
          }
        }
        assert.equal(limited, true);
      },
    );
  },
);
