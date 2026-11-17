import "../../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import type { Role, CourseReviewQueue } from "@zhixue/shared";
import { createApp } from "../../app";
import { register } from "../../auth/service";
import { getDb, disconnectDb } from "../../lib/db";
import { disconnectRedis } from "../../lib/rate-limiter";
import { submitReview, decideReview } from "./course-review.service";
process.env.RATE_LIMIT_NAMESPACE = "qa-queue-" + randomBytes(6).toString("hex");

test(
  "review queue: latest version, pagination and independent reviewers",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp(),
      prefix = "qa_queue_" + randomBytes(5).toString("hex");
    const users: string[] = [],
      courses: string[] = [];
    t.after(async () => {
      await db.course.deleteMany({ where: { id: { in: courses } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(role: Role) {
      const r = await register({
        username: prefix + users.length,
        passphrase: randomBytes(24).toString("hex"),
        displayName: "审核队列合成验收",
        grade: "G7",
      });
      users.push(r.user.id);
      await db.user.update({ where: { id: r.user.id }, data: { role } });
      return { id: r.user.id, token: r.accessToken };
    }
    const admin = await account("ADMIN"),
      teacher = await account("TEACHER"),
      student = await account("STUDENT"),
      parent = await account("PARENT");
    const endpoint = "/api/admin/course-review-queue";
    async function queue(page = 1, pageSize = 20) {
      const r = await request(app)
        .get(`${endpoint}?page=${page}&pageSize=${pageSize}`)
        .auth(admin.token, { type: "bearer" });
      assert.equal(r.status, 200);
      assert.equal(r.headers["cache-control"], "no-store");
      return r.body.data as CourseReviewQueue;
    }
    const baseline = await queue();
    const anchor = baseline.list.length
      ? Date.parse(baseline.list[0].submittedAt) - 86400000
      : Date.now() - 86400000;
    const checks = {
      accuracy: true,
      alignment: true,
      rights: true,
      readability: true,
    } as const;
    async function version(id: string) {
      return (
        await db.course.findUniqueOrThrow({ where: { id } })
      ).updatedAt.toISOString();
    }
    async function makeCourse(index: number, submitter = teacher) {
      const c = await db.course.create({
        data: {
          slug: prefix + index,
          title: "队列课程" + index,
          grade: "G7",
          subject: "math",
          ownerTeacherId: teacher.id,
          description: "合成内容，仅供流程测试",
          chapters: {
            create: {
              title: "第一章",
              position: 0,
              lessons: {
                create: {
                  title: "第一课",
                  content: "合成课程正文",
                  position: 0,
                },
              },
            },
          },
        },
      });
      courses.push(c.id);
      const review = await submitReview(submitter.id, c.id, {
        updatedAt: await version(c.id),
      });
      await db.courseReview.update({
        where: { id: review.id },
        data: { submittedAt: new Date(anchor - index * 60000) },
      });
      return { c, review };
    }
    const pending: Awaited<ReturnType<typeof makeCourse>>[] = [];
    for (let i = 0; i < 8; i++) pending.push(await makeCourse(i));
    const stale = await makeCourse(8);
    await db.course.update({
      where: { id: stale.c.id },
      data: { description: "送审后已修改，必须重新送审。" },
    });
    const own = await makeCourse(9, admin);
    const archived = await makeCourse(10),
      published = await makeCourse(11);
    await db.course.update({
      where: { id: archived.c.id },
      data: { status: "ARCHIVED" },
    });
    await db.course.update({
      where: { id: published.c.id },
      data: { status: "PUBLISHED" },
    });
    // Simulate multiple submissions using the actual submission/decision service.
    for (const status of ["RETURNED", "APPROVED"] as const) {
      const item = await makeCourse(status === "RETURNED" ? 12 : 13);
      await db.course.update({
        where: { id: item.c.id },
        data: { title: item.c.title + "新版" },
      });
      const latest = await submitReview(teacher.id, item.c.id, {
        updatedAt: await version(item.c.id),
      });
      await decideReview(admin.id, item.c.id, {
        reviewId: latest.id,
        updatedAt: await version(item.c.id),
        feedback: "仅为合成协议验收，不代表真实教研审核结论。",
        ...(status === "APPROVED" ? { status, checks } : { status }),
      });
    }
    await t.test(
      "only administrators can read; pagination parameters are strict",
      async () => {
        assert.equal((await request(app).get(endpoint)).status, 401);
        for (const u of [teacher, student, parent])
          assert.equal(
            (await request(app).get(endpoint).auth(u.token, { type: "bearer" }))
              .status,
            403,
          );
        for (const query of ["page=0", "pageSize=21", "actorId=" + teacher.id])
          assert.equal(
            (
              await request(app)
                .get(endpoint + "?" + query)
                .auth(admin.token, { type: "bearer" })
            ).status,
            400,
          );
      },
    );
    await t.test(
      "counts latest pending drafts once and orders oldest submissions first",
      async () => {
        const r = await queue(1, 3);
        assert.equal(r.total, baseline.total + 10);
        assert.equal(r.list.length, 3);
        assert.deepEqual(
          r.list.map((row) => row.courseId),
          [own.c.id, stale.c.id, pending[7].c.id],
        );
        const next = await queue(2, 3);
        assert.deepEqual(
          next.list.map((row) => row.courseId),
          [pending[6].c.id, pending[5].c.id, pending[4].c.id],
        );
        const last = await queue(10000, 3);
        assert.equal(last.total, r.total);
        assert.equal(last.list.length, 0);
      },
    );
    await t.test(
      "stale and self submissions are visible but not actionable; summary excludes body",
      async () => {
        const r = await queue(1, 3);
        assert.equal(r.list[0].submittedBySelf, true);
        assert.equal(r.list[0].versionCurrent, true);
        assert.equal(r.list[0].canDecide, false);
        assert.equal(r.list[1].versionCurrent, false);
        assert.equal(r.list[1].canDecide, false);
        assert.equal(r.list[2].canDecide, true);
        for (const key of [
          "snapshot",
          "contentHash",
          "chapters",
          "lessons",
          "content",
          "feedback",
        ])
          assert.equal(Object.keys(r.list[0]).includes(key), false);
        for (const [item, expected] of [
          [own, 403],
          [stale, 409],
        ] as const) {
          const result = await request(app)
            .post(`/api/courses/${item.c.id}/reviews/decision`)
            .auth(admin.token, { type: "bearer" })
            .set({ "X-Zhixue-Client": "web", Origin: "http://127.0.0.1:3000" })
            .send({
              reviewId: item.review.id,
              updatedAt: await version(item.c.id),
              feedback: "合成验证，不应允许此版本直接通过。",
              status: "APPROVED",
              checks,
            });
          assert.equal(result.status, expected);
        }
        assert.equal(
          (
            await db.courseReview.findUniqueOrThrow({
              where: { id: stale.review.id },
            })
          ).status,
          "PENDING",
        );
      },
    );
    await t.test(
      "a newer pending submission replaces stale history and decisions remove queue entries",
      async () => {
        const latest = await submitReview(teacher.id, stale.c.id, {
          updatedAt: await version(stale.c.id),
        });
        assert.equal((await queue()).total, baseline.total + 10);
        await decideReview(admin.id, stale.c.id, {
          reviewId: latest.id,
          updatedAt: await version(stale.c.id),
          feedback: "合成退回意见，用于验证待审队列移除记录。",
          status: "RETURNED",
        });
        assert.equal((await queue()).total, baseline.total + 9);
        assert.equal(
          (
            await db.courseReview.findUniqueOrThrow({
              where: { id: stale.review.id },
            })
          ).status,
          "PENDING",
        );
        await db.course.update({
          where: { id: own.c.id },
          data: { status: "ARCHIVED" },
        });
        assert.equal((await queue()).total, baseline.total + 8);
      },
    );
    await t.test("current administrator role is rechecked", async () => {
      await db.user.update({
        where: { id: admin.id },
        data: { role: "PARENT" },
      });
      assert.equal(
        (await request(app).get(endpoint).auth(admin.token, { type: "bearer" }))
          .status,
        403,
      );
    });
  },
);
