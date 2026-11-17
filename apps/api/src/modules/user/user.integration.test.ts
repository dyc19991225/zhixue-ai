import "../../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import express from "express";
import request from "supertest";
import { roles, type Role } from "@zhixue/shared";
import { createApp } from "../../app";
import { rbac, requireAuth } from "../../auth/middleware";
import { getDb, disconnectDb } from "../../lib/db";
import { disconnectRedis } from "../../lib/rate-limiter";
import { ok } from "../../lib/http";
import { errorHandler } from "../../middleware/error-handler";

process.env.RATE_LIMIT_NAMESPACE = "qa-rbac-" + randomBytes(8).toString("hex");

test(
  "four-role RBAC and administrative role lifecycle",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const app = express();
    for (const role of roles)
      app.get(`/qa/role/${role}`, requireAuth, rbac([role]), (_req, res) =>
        ok(res, { role }),
      );
    app.use(createApp());
    app.use(errorHandler);
    const db = getDb(),
      prefix = "qa_rbac_" + randomBytes(5).toString("hex"),
      ids: string[] = [];
    const headers = {
      "X-Zhixue-Client": "web",
      Origin: "http://127.0.0.1:3000",
    };
    type Account = {
      id: string;
      username: string;
      passphrase: string;
      token: string;
      cookie: string;
    };
    const auth = (account: Account) => ({
      ...headers,
      Authorization: `Bearer ${account.token}`,
    });
    t.after(async () => {
      await db.adminAuditLog.deleteMany({
        where: { targetUserId: { in: ids } },
      });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(suffix: string, role: Role): Promise<Account> {
      const username = `${prefix}_${suffix}`,
        passphrase = randomBytes(24).toString("hex");
      const res = await request(app)
        .post("/api/auth/register")
        .set(headers)
        .send({
          username,
          passphrase,
          displayName: "权限合成测试",
          grade: "G7",
        })
        .expect(200);
      const id = res.body.data.user.id as string;
      ids.push(id);
      assert.equal(res.body.data.user.role, "STUDENT");
      await db.user.update({ where: { id }, data: { role } });
      const cookie = (res.headers["set-cookie"] as unknown as string[])
        .find((v) => v.startsWith("zhixue_refresh="))!
        .split(";")[0];
      return {
        id,
        username,
        passphrase,
        token: res.body.data.accessToken as string,
        cookie,
      };
    }
    async function login(user: Account) {
      const res = await request(app)
        .post("/api/auth/login")
        .set(headers)
        .send({ username: user.username, passphrase: user.passphrase })
        .expect(200);
      user.token = res.body.data.accessToken as string;
      user.cookie = (res.headers["set-cookie"] as unknown as string[])
        .find((v) => v.startsWith("zhixue_refresh="))!
        .split(";")[0];
      return res.body.data.user.role as Role;
    }
    async function update(actor: Account, target: Account, role: Role) {
      const row = await db.user.findUniqueOrThrow({ where: { id: target.id } });
      return request(app)
        .patch(`/api/admin/users/${target.id}/role`)
        .set(auth(actor))
        .send({ role, updatedAt: row.updatedAt.toISOString() });
    }
    const admin = await account("admin", "ADMIN");
    const members = new Map<Role, Account>([["ADMIN", admin]]);
    for (const role of ["TEACHER", "STUDENT", "PARENT"] as const)
      members.set(role, await account(role.toLowerCase(), role));
    const target = members.get("STUDENT")!;

    await t.test(
      "all four roles enforce route allowlists and cannot gain admin rights through input",
      async () => {
        for (const role of roles) {
          const member = members.get(role)!;
          for (const allowed of roles)
            await request(app)
              .get(`/qa/role/${allowed}`)
              .set(auth(member))
              .expect(role === allowed ? 200 : 403);
          await request(app)
            .get("/api/admin/users")
            .set(auth(member))
            .expect(role === "ADMIN" ? 200 : 403);
          if (role !== "ADMIN")
            assert.equal((await update(member, target, "ADMIN")).status, 403);
          await request(app)
            .patch("/api/users/me")
            .set(auth(member))
            .send({ displayName: "不能自提权", grade: "G7", role: "ADMIN" })
            .expect(400);
        }
        await request(app).get("/qa/role/TEACHER").expect(401);
        for (const role of roles)
          await request(app)
            .post("/api/auth/register")
            .set(headers)
            .send({
              username: prefix + "_inject",
              passphrase: randomBytes(24).toString("hex"),
              displayName: "不能选角色",
              grade: "G7",
              role,
            })
            .expect(400);
      },
    );

    await t.test(
      "role changes persist, revoke access and refresh sessions, and write from/to audit",
      async () => {
        let previousRole: Role = "STUDENT";
        for (const role of ["TEACHER", "PARENT", "ADMIN"] as const) {
          const oldCookie = target.cookie;
          const changed = await update(admin, target, role);
          assert.equal(changed.status, 200);
          assert.equal(changed.body.data.role, role);
          assert.equal(changed.body.data.passwordHash, undefined);
          await request(app).get("/api/users/me").set(auth(target)).expect(401);
          await request(app)
            .post("/api/auth/refresh")
            .set(headers)
            .set("Cookie", oldCookie)
            .expect(401);
          assert.equal(await login(target), role);
          const audit: number = await db.adminAuditLog.count({
            where: {
              actorUserId: admin.id,
              targetUserId: target.id,
              action: `USER_ROLE_${previousRole}_TO_${role}`,
            },
          });
          assert.equal(audit, 1);
          previousRole = role;
        }
      },
    );

    await t.test(
      "stale and invalid changes fail, self-demotion is forbidden, unchanged role preserves session",
      async () => {
        assert.equal((await update(admin, admin, "STUDENT")).status, 400);
        const url = `/api/admin/users/${target.id}/role`;
        const row = await db.user.findUniqueOrThrow({
          where: { id: target.id },
        });
        for (const body of [
          { role: "OWNER", updatedAt: row.updatedAt.toISOString() },
          { role: "TEACHER" },
          {
            role: "TEACHER",
            updatedAt: row.updatedAt.toISOString(),
            status: "DISABLED",
          },
        ])
          await request(app).patch(url).set(auth(admin)).send(body).expect(400);
        await request(app)
          .patch(url)
          .set(auth(admin))
          .send({ role: "PARENT", updatedAt: "1970-01-01T00:00:00.000Z" })
          .expect(409);
        await request(app)
          .patch(url)
          .send({ role: "PARENT", updatedAt: row.updatedAt.toISOString() })
          .expect(403);
        await request(app)
          .patch("/api/admin/users/missing/role")
          .set(auth(admin))
          .send({ role: "PARENT", updatedAt: row.updatedAt.toISOString() })
          .expect(404);
        const before = await db.adminAuditLog.count({
          where: { targetUserId: target.id },
        });
        assert.equal((await update(admin, target, "ADMIN")).status, 200);
        assert.equal(
          await db.adminAuditLog.count({ where: { targetUserId: target.id } }),
          before,
        );
        await request(app).get("/api/users/me").set(auth(target)).expect(200);
      },
    );

    await t.test("disabled users are rejected regardless of role", async () => {
      const parent = members.get("PARENT")!;
      await db.user.update({
        where: { id: parent.id },
        data: { status: "DISABLED" },
      });
      await request(app).get("/qa/role/PARENT").set(auth(parent)).expect(401);
    });

    await t.test(
      "concurrent administrators cannot both remove each other's authority",
      async () => {
        const rows = await db.user.findMany({
          where: { id: { in: [admin.id, target.id] } },
        });
        const [first, second] = await Promise.all([
          request(app)
            .patch(`/api/admin/users/${target.id}/role`)
            .set(auth(admin))
            .send({
              role: "TEACHER",
              updatedAt: rows
                .find((v) => v.id === target.id)!
                .updatedAt.toISOString(),
            }),
          request(app)
            .patch(`/api/admin/users/${admin.id}/role`)
            .set(auth(target))
            .send({
              role: "PARENT",
              updatedAt: rows
                .find((v) => v.id === admin.id)!
                .updatedAt.toISOString(),
            }),
        ]);
        assert.equal([first, second].filter((v) => v.status === 200).length, 1);
        assert.ok(
          [first, second].every((v) => [200, 401, 403, 409].includes(v.status)),
        );
        assert.equal(
          await db.user.count({
            where: {
              id: { in: [admin.id, target.id] },
              role: "ADMIN",
              status: "ACTIVE",
            },
          }),
          1,
        );
      },
    );
  },
);
