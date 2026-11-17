import "../../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import type { Role, CourseReviewPage } from "@zhixue/shared";
import { createApp } from "../../app";
import { register } from "../../auth/service";
import { getDb, disconnectDb } from "../../lib/db";
import { disconnectRedis } from "../../lib/rate-limiter";
process.env.RATE_LIMIT_NAMESPACE =
  "qa-review-" + randomBytes(8).toString("hex");

test(
  "course review ownership, immutable snapshots and publication gate",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp(),
      prefix = "qa-review-" + randomBytes(5).toString("hex");
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
        username: prefix.replaceAll("-", "_") + "_" + users.length,
        passphrase: randomBytes(24).toString("hex"),
        displayName: "合成审核验收",
        grade: "G7",
      });
      users.push(r.user.id);
      await db.user.update({ where: { id: r.user.id }, data: { role } });
      return {
        id: r.user.id,
        headers: {
          Authorization: `Bearer ${r.accessToken}`,
          "X-Zhixue-Client": "web",
          Origin: "http://127.0.0.1:3000",
        },
      };
    }
    const admin = await account("ADMIN"),
      reviewer = await account("ADMIN"),
      teacher = await account("TEACHER"),
      other = await account("TEACHER"),
      student = await account("STUDENT"),
      parent = await account("PARENT");
    const draft = {
      title: "合成审核课程",
      slug: prefix,
      grade: "G7",
      subject: "math",
      description: "仅验证审核协议，不作真实教研结论。",
      access: "FREE",
      chapters: [
        {
          title: "第一章",
          lessons: [{ title: "第一课", content: "原始正文x+1=3，x=2。" }],
        },
      ],
    };
    const created = await request(app)
      .post("/api/admin/courses")
      .set(admin.headers)
      .send(draft)
      .expect(200);
    const id = created.body.data.id as string;
    courses.push(id);
    await db.course.update({
      where: { id },
      data: { ownerTeacherId: teacher.id },
    });
    const url = `/api/courses/${id}/reviews`,
      decisionUrl = `${url}/decision`,
      statusUrl = `/api/admin/courses/${id}/status`;
    const version = async () =>
      (
        await db.course.findUniqueOrThrow({ where: { id } })
      ).updatedAt.toISOString();
    const history = async (actor = admin, page = 1) =>
      (
        await request(app)
          .get(`${url}?page=${page}&pageSize=1`)
          .set(actor.headers)
          .expect(200)
      ).body.data as CourseReviewPage;
    const checks = {
      accuracy: true,
      alignment: true,
      rights: true,
      readability: true,
    };
    const edit = async (content: string) => {
      const row = await db.course.findUniqueOrThrow({
        where: { id },
        include: { chapters: { include: { lessons: true } } },
      });
      await request(app)
        .put(`/api/admin/courses/${id}`)
        .set(admin.headers)
        .send({
          ...draft,
          chapters: [
            {
              id: row.chapters[0].id,
              title: "第一章",
              lessons: [
                { id: row.chapters[0].lessons[0].id, title: "第一课", content },
              ],
            },
          ],
        })
        .expect(200);
    };
    let firstId = "",
      pendingId = "",
      approvedId = "";
    await t.test(
      "only admins and current owning teachers can see or submit reviews",
      async () => {
        await request(app).get(url).expect(401);
        for (const actor of [student, parent, other]) {
          await request(app).get(url).set(actor.headers).expect(403);
          await request(app)
            .post(url)
            .set(actor.headers)
            .send({ updatedAt: await version() })
            .expect(403);
        }
        assert.equal((await history(teacher)).current.state, "NOT_SUBMITTED");
        await request(app).get(`${url}?page=0`).set(admin.headers).expect(400);
        await request(app)
          .post(url)
          .set(teacher.headers)
          .send({ updatedAt: await version(), status: "APPROVED" })
          .expect(400);
        await request(app)
          .post(url)
          .set(teacher.headers)
          .send({ updatedAt: "2020-01-01T00:00:00.000Z" })
          .expect(409);
        await request(app)
          .patch(statusUrl)
          .set(admin.headers)
          .send({ status: "PUBLISHED" })
          .expect(409);
        await request(app).get(`/api/course/${id}`).expect(404);
      },
    );
    await t.test(
      "concurrent submission snapshots once and duplicate retries cannot add records",
      async () => {
        const input = { updatedAt: await version() };
        const results = await Promise.all(
          [0, 1].map(() =>
            request(app).post(url).set(teacher.headers).send(input),
          ),
        );
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        const h = await history();
        firstId = h.current.latest!.id;
        assert.equal(h.total, 1);
        assert.equal(h.current.state, "PENDING");
        assert.equal(
          h.list[0].snapshot.chapters[0].lessons[0].content,
          draft.chapters[0].lessons[0].content,
        );
        await request(app)
          .patch(statusUrl)
          .set(admin.headers)
          .send({ status: "PUBLISHED" })
          .expect(409);
      },
    );
    await t.test(
      "decision requires admin, complete attestations and meaningful feedback",
      async () => {
        const input = {
          reviewId: firstId,
          updatedAt: await version(),
          status: "APPROVED",
          checks,
          feedback: "仅合成验收审核意见，不代表真实教学质量。",
        };
        await request(app)
          .post(decisionUrl)
          .set(teacher.headers)
          .send(input)
          .expect(403);
        for (const invalid of [
          { ...input, checks: { ...checks, rights: false } },
          { ...input, checks: undefined },
          { ...input, feedback: "短" },
        ])
          await request(app)
            .post(decisionUrl)
            .set(admin.headers)
            .send(invalid)
            .expect(400);
        await request(app)
          .post(decisionUrl)
          .set(admin.headers)
          .send({
            reviewId: firstId,
            updatedAt: await version(),
            status: "RETURNED",
            feedback: "合成退回：请在正文中补充代入检验过程。",
          })
          .expect(200);
        const h = await history(teacher);
        assert.equal(h.current.state, "RETURNED");
        assert.match(h.current.latest!.feedback!, /补充代入/);
        await request(app)
          .post(decisionUrl)
          .set(admin.headers)
          .send(input)
          .expect(409);
      },
    );
    await t.test(
      "edits stale pending submissions; previous snapshot and return feedback stay intact",
      async () => {
        await edit("第一次修订：x+1=3，x=2，代入2+1=3。");
        const submitted = await request(app)
          .post(url)
          .set(teacher.headers)
          .send({ updatedAt: await version() })
          .expect(200);
        pendingId = submitted.body.data.id as string;
        const priorVersion = await version();
        await edit("第二次修订：设未知数x，x+1=3，x=2；代入2+1=3成立。");
        assert.equal((await history()).current.state, "STALE");
        for (const updatedAt of [priorVersion, await version()])
          await request(app)
            .post(decisionUrl)
            .set(admin.headers)
            .send({
              reviewId: pendingId,
              updatedAt,
              status: "APPROVED",
              checks,
              feedback: "合成测试不得审批发生变化的旧内容。",
            })
            .expect(409);
        const h = await history(admin, 2);
        assert.equal(h.list[0].id, firstId);
        assert.equal(
          h.list[0].snapshot.chapters[0].lessons[0].content,
          draft.chapters[0].lessons[0].content,
        );
        assert.equal(h.list[0].status, "RETURNED");
      },
    );
    await t.test(
      "self review is blocked and concurrent decisions produce one immutable outcome",
      async () => {
        const submitted = await request(app)
          .post(url)
          .set(admin.headers)
          .send({ updatedAt: await version() })
          .expect(200);
        approvedId = submitted.body.data.id as string;
        const input = {
          reviewId: approvedId,
          updatedAt: await version(),
          status: "APPROVED",
          checks,
          feedback: "合成独立审批，只验证人工确认记录的保存。",
        };
        await request(app)
          .post(decisionUrl)
          .set(admin.headers)
          .send(input)
          .expect(403);
        await request(app)
          .post(decisionUrl)
          .set(reviewer.headers)
          .send({ ...input, reviewId: pendingId })
          .expect(409);
        const results = await Promise.all(
          ["第一次意见", "第二次意见"].map((s) =>
            request(app)
              .post(decisionUrl)
              .set(reviewer.headers)
              .send({ ...input, feedback: input.feedback + s }),
          ),
        );
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
        assert.equal((await history()).current.state, "APPROVED");
      },
    );
    await t.test(
      "only approved exact content publishes; a later content change closes the gate",
      async () => {
        await request(app)
          .patch(statusUrl)
          .set(admin.headers)
          .send({ status: "PUBLISHED" })
          .expect(200);
        await request(app).get(`/api/course/${id}`).expect(200);
        await request(app)
          .post(url)
          .set(teacher.headers)
          .send({ updatedAt: await version() })
          .expect(409);
        await request(app)
          .put(`/api/admin/courses/${id}`)
          .set(admin.headers)
          .send(draft)
          .expect(409);
        await request(app)
          .patch(statusUrl)
          .set(admin.headers)
          .send({ status: "DRAFT" })
          .expect(200);
        await edit("审核后发生变化的内容必须重新审核。");
        await request(app)
          .patch(statusUrl)
          .set(admin.headers)
          .send({ status: "PUBLISHED" })
          .expect(409);
        assert.equal(
          await db.lesson.count({
            where: { chapter: { courseId: id }, publishedAt: { not: null } },
          }),
          0,
        );
        const h = await history();
        assert.equal(h.current.state, "STALE");
        assert.equal(h.current.latest!.id, approvedId);
        assert.equal(h.current.latest!.status, "APPROVED");
        assert.notEqual(
          h.current.latest!.snapshot.chapters[0].lessons[0].content,
          h.current.snapshot.chapters[0].lessons[0].content,
        );
      },
    );
    await t.test(
      "teacher reassignment immediately changes review visibility and incomplete content cannot submit",
      async () => {
        await db.course.update({
          where: { id },
          data: { ownerTeacherId: other.id },
        });
        await request(app).get(url).set(teacher.headers).expect(403);
        assert.equal((await history(other)).current.state, "STALE");
        await request(app)
          .put(`/api/admin/courses/${id}`)
          .set(admin.headers)
          .send({ ...draft, chapters: [] })
          .expect(200);
        await request(app)
          .post(url)
          .set(other.headers)
          .send({ updatedAt: await version() })
          .expect(400);
        await request(app)
          .patch(statusUrl)
          .set(admin.headers)
          .send({ status: "PUBLISHED" })
          .expect(400);
      },
    );
  },
);
