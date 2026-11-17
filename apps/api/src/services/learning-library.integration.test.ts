import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import { createApp } from "../app";
import { register } from "../auth/service";
import { getDb, disconnectDb } from "../lib/db";
import { disconnectRedis } from "../lib/rate-limiter";
import type { LearningLibrary } from "@zhixue/shared";
process.env.RATE_LIMIT_NAMESPACE =
  "qa-library-" + randomBytes(6).toString("hex");

test(
  "learning library: saved progress, membership and owner pagination",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp(),
      prefix = "qa_library_" + randomBytes(5).toString("hex");
    const users: string[] = [],
      courses: string[] = [],
      plans: string[] = [];
    t.after(async () => {
      await db.course.deleteMany({ where: { id: { in: courses } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.membershipPlan.deleteMany({ where: { id: { in: plans } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account() {
      const r = await register({
        username: prefix + users.length,
        passphrase: randomBytes(24).toString("hex"),
        displayName: "学习记录合成验收",
        grade: "G7",
      });
      users.push(r.user.id);
      return { id: r.user.id, token: r.accessToken };
    }
    const student = await account(),
      other = await account();
    async function course(
      name: string,
      open = 2,
      access: "FREE" | "MEMBER" = "FREE",
      owner = student.id,
    ) {
      const c = await db.course.create({
        data: {
          slug: (prefix + courses.length).replaceAll("_", "-"),
          title: name,
          grade: "G7",
          subject: "math",
          access,
          status: "PUBLISHED",
          chapters: {
            create: {
              title: "合成章",
              position: 0,
              lessons: {
                create: Array.from({ length: open }, (_, i) => ({
                  title: "合成课" + i,
                  content: "私有课时正文",
                  publishedAt: new Date(),
                  position: i,
                })),
              },
            },
          },
        },
        include: {
          chapters: { include: { lessons: { orderBy: { position: "asc" } } } },
        },
      });
      courses.push(c.id);
      const enrollment = await db.enrollment.create({
        data: { userId: owner, courseId: c.id },
      });
      return { c, enrollment, lessons: c.chapters[0].lessons };
    }
    const empty = await course("待开放示例", 0),
      untouched = await course("初次学习示例"),
      partial = await course("MiXeD方程学习", 3),
      done = await course("已完成示例"),
      member = await course("会员进度保留示例", 2, "MEMBER");
    const archived = await course("已归档示例"),
      draft = await course("草稿示例"),
      stranger = await course("其他学生的课程", 1, "FREE", other.id);
    await db.course.update({
      where: { id: archived.c.id },
      data: { status: "ARCHIVED" },
    });
    await db.course.update({
      where: { id: draft.c.id },
      data: { status: "DRAFT" },
    });
    const hidden = await db.lesson.create({
      data: {
        chapterId: partial.c.chapters[0].id,
        title: "尚未开放的课时",
        content: "不应返回",
        position: 3,
      },
    });
    const now = Date.now();
    for (const [index, completed] of [
      [0, true],
      [1, false],
      [2, false],
    ] as const) {
      await db.lessonProgress.create({
        data: {
          enrollmentId: partial.enrollment.id,
          lessonId: partial.lessons[index].id,
          completedAt: completed ? new Date(now - 300000) : null,
          positionSeconds: completed ? 10 : 25,
          updatedAt: new Date(now - (3 - index) * 60000),
        },
      });
    }
    for (const lesson of done.lessons)
      await db.lessonProgress.create({
        data: {
          enrollmentId: done.enrollment.id,
          lessonId: lesson.id,
          completedAt: new Date(now - 600000),
          updatedAt: new Date(now - 600000),
        },
      });
    await db.lessonProgress.create({
      data: {
        enrollmentId: member.enrollment.id,
        lessonId: member.lessons[0].id,
        completedAt: new Date(now - 1200000),
        updatedAt: new Date(now - 1200000),
      },
    });
    // Foreign-course and unpublished progress must not inflate totals or recent activity.
    for (const id of [hidden.id, stranger.lessons[0].id])
      await db.lessonProgress.create({
        data: {
          enrollmentId: partial.enrollment.id,
          lessonId: id,
          completedAt: new Date(),
          updatedAt: new Date(now + 60000),
        },
      });
    const endpoint = "/api/learning-library";
    async function library(
      filters: Record<string, string | number> = {},
      who = student,
    ) {
      const r = await request(app)
        .get(endpoint)
        .query({ pageSize: 20, ...filters })
        .auth(who.token, { type: "bearer" });
      assert.equal(r.status, 200);
      assert.equal(r.headers["cache-control"], "no-store");
      return r.body.data as LearningLibrary;
    }
    await t.test(
      "reports correct states and recent unfinished lesson without exposing body",
      async () => {
        const r = await library();
        assert.equal(r.total, 5);
        assert.deepEqual(r.counts, {
          all: 5,
          notStarted: 2,
          inProgress: 2,
          completed: 1,
        });
        assert.equal(r.items[0].courseId, partial.c.id);
        const p = r.items[0];
        assert.equal(p.totalLessons, 3);
        assert.equal(p.completedLessons, 1);
        assert.equal(p.nextLessonId, partial.lessons[2].id);
        const e = r.items.find((c) => c.courseId === empty.c.id)!;
        assert.equal(e.state, "NOT_STARTED");
        assert.equal(e.nextLessonId, null);
        assert.equal(
          r.items.find((c) => c.courseId === untouched.c.id)!.nextLessonId,
          untouched.lessons[0].id,
        );
        assert.equal(
          r.items.find((c) => c.courseId === done.c.id)!.nextLessonId,
          done.lessons[0].id,
        );
        for (const key of [
          "content",
          "positions",
          "enrollmentId",
          "userId",
          "chapters",
        ])
          assert.equal(Object.keys(p).includes(key), false);
      },
    );
    await t.test(
      "filters progress and literal title search independently of current page",
      async () => {
        assert.equal((await library({ state: "IN_PROGRESS" })).total, 2);
        assert.equal(
          (await library({ state: "COMPLETED" })).items[0].courseId,
          done.c.id,
        );
        assert.equal((await library({ state: "NOT_STARTED" })).total, 2);
        assert.equal(
          (await library({ q: "mixed" })).items[0].courseId,
          partial.c.id,
        );
        assert.equal((await library({ q: "%" })).total, 0);
        assert.equal((await library({ page: 10000 })).total, 5);
      },
    );
    await t.test(
      "expired member courses keep summaries while content remains protected",
      async () => {
        let item = (await library()).items.find(
          (c) => c.courseId === member.c.id,
        )!;
        assert.equal(item.completedLessons, 1);
        assert.equal(item.canStudy, false);
        assert.equal(item.nextLessonId, null);
        assert.equal(
          (
            await request(app)
              .get(`/api/learning/${member.c.id}`)
              .auth(student.token, { type: "bearer" })
          ).status,
          403,
        );
        const plan = await db.membershipPlan.create({
          data: { code: prefix, name: "合成权益", active: true },
        });
        plans.push(plan.id);
        const grant = await db.membership.create({
          data: {
            userId: student.id,
            planId: plan.id,
            startsAt: new Date(now - 60000),
            expiresAt: new Date(now + 86400000),
          },
        });
        item = (await library()).items.find((c) => c.courseId === member.c.id)!;
        assert.equal(item.canStudy, true);
        assert.equal(item.nextLessonId, member.lessons[1].id);
        await db.membership.update({
          where: { id: grant.id },
          data: { revokedAt: new Date() },
        });
        assert.equal(
          (await library()).items.find((c) => c.courseId === member.c.id)!
            .canStudy,
          false,
        );
        await db.membership.update({
          where: { id: grant.id },
          data: { revokedAt: null, expiresAt: new Date(now - 1) },
        });
        assert.equal(
          (await library()).items.find((c) => c.courseId === member.c.id)!
            .canStudy,
          false,
        );
      },
    );
    await t.test(
      "unpublished lessons are excluded from both course outline and learning navigation",
      async () => {
        for (const path of [
          `/api/course/${partial.c.id}`,
          `/api/learning/${partial.c.id}`,
        ]) {
          const r = await request(app)
            .get(path)
            .auth(student.token, { type: "bearer" });
          assert.equal(r.status, 200);
          assert.equal(
            JSON.stringify(r.body.data).includes("尚未开放的课时"),
            false,
          );
          if (path.includes("/learning/")) {
            assert.equal(r.body.data.total, 3);
            assert.deepEqual(r.body.data.completedIds, [partial.lessons[0].id]);
          }
        }
        assert.equal(
          (
            await request(app)
              .get(`/api/learning/${partial.c.id}/lessons/${hidden.id}`)
              .auth(student.token, { type: "bearer" })
          ).status,
          404,
        );
      },
    );
    await t.test(
      "one user's list never contains another user's enrollments",
      async () => {
        const r = await library({}, other);
        assert.equal(r.total, 1);
        assert.equal(r.items[0].courseId, stranger.c.id);
        assert.equal((await request(app).get(endpoint)).status, 401);
        for (const query of [
          "userId=" + other.id,
          "state=BAD",
          "page=0",
          "pageSize=21",
          "q=" + "a".repeat(121),
        ])
          assert.equal(
            (
              await request(app)
                .get(endpoint + "?" + query)
                .auth(student.token, { type: "bearer" })
            ).status,
            400,
          );
      },
    );
    await t.test(
      "more than one hundred enrollments remain searchable and pageable",
      async () => {
        const ids = Array.from(
          { length: 101 },
          (_, i) => prefix + "_batch_" + String(i).padStart(3, "0"),
        );
        courses.push(...ids);
        await db.course.createMany({
          data: ids.map((id) => ({
            id,
            slug: id.replaceAll("_", "-"),
            title: id,
            grade: "G7",
            subject: "math",
            status: "PUBLISHED",
          })),
        });
        await db.enrollment.createMany({
          data: ids.map((id, i) => ({
            id: prefix + "_enroll_" + String(i).padStart(3, "0"),
            userId: student.id,
            courseId: id,
            createdAt: new Date(now + i * 1000),
          })),
        });
        const r = await library({
          q: prefix + "_batch_",
          page: 6,
          pageSize: 20,
        });
        assert.equal(r.total, 101);
        assert.equal(r.items.length, 1);
        assert.equal(r.items[0].courseId, ids[0]);
        assert.equal((await library({ q: ids[100] })).total, 1);
      },
    );
  },
);
