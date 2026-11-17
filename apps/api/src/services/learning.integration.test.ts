import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { disconnectRedis } from "../lib/rate-limiter";
process.env.RATE_LIMIT_NAMESPACE =
  "qa-learning-" + randomBytes(8).toString("hex");
import request from "supertest";
import { createApp } from "../app";
import { getDb, disconnectDb } from "../lib/db";
import { approveSyntheticCourse } from "../test-utils/course-review";
test(
  "PostgreSQL course lifecycle and learning ownership",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp(),
      prefix = `qa_c_${randomBytes(5).toString("hex")}`;
    const users: string[] = [],
      courses: string[] = [];
    const headers = {
      "X-Zhixue-Client": "web",
      Origin: "http://127.0.0.1:3000",
    };
    t.after(async () => {
      await db.course.deleteMany({ where: { id: { in: courses } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(suffix: string) {
      const res = await request(app)
        .post("/api/auth/register")
        .set(headers)
        .send({
          username: `${prefix}_${suffix}`,
          passphrase: randomBytes(24).toString("hex"),
          displayName: "课程测试",
          grade: "G7",
        })
        .expect(200);
      users.push(res.body.data.user.id);
      return res.body.data.accessToken as string;
    }
    const admin = await account("admin"),
      student = await account("student"),
      other = await account("other");
    await db.user.update({ where: { id: users[0] }, data: { role: "ADMIN" } });
    const auth = (token: string) => ({
      ...headers,
      Authorization: `Bearer ${token}`,
    });
    const draft = {
      title: "合成测试课程",
      slug: prefix.replaceAll("_", "-"),
      grade: "G7",
      subject: "math",
      description: "仅用于自动验证，不是真实教学内容。",
      access: "FREE",
      chapters: [
        {
          title: "测试章",
          lessons: [
            {
              title: "测试课一",
              content: "验证纯文本 <script>alert(1)</script>",
            },
            { title: "测试课二", content: "第二课正文" },
          ],
        },
      ],
    };
    await request(app)
      .post("/api/admin/courses")
      .set(auth(student))
      .send(draft)
      .expect(403);
    await request(app).post("/api/admin/courses").send(draft).expect(403);
    const created = await request(app)
      .post("/api/admin/courses")
      .set(auth(admin))
      .send(draft)
      .expect(200);
    const id = created.body.data.id;
    courses.push(id);
    const chapter = created.body.data.chapters[0],
      lesson = chapter.lessons[0];
    await t.test(
      "admin course pagination reaches beyond 100 and validates query and permissions",
      async () => {
        const fixtureIds = Array.from(
          { length: 101 },
          (_, i) => `${prefix}_page_${i}`,
        );
        courses.push(...fixtureIds);
        await db.course.createMany({
          data: fixtureIds.map((fixtureId, i) => ({
            id: fixtureId,
            slug: `${draft.slug}-page-${i}`,
            title: "分页合成课程",
            grade: "G7" as const,
            subject: "math",
          })),
        });
        await request(app).get("/api/admin/courses").expect(401);
        await request(app)
          .get("/api/admin/courses")
          .set(auth(student))
          .expect(403);
        for (const query of [
          "page=0",
          "page=1.5",
          "pageSize=101",
          "pageSize=0",
          "page=1&page=2",
          "extra=1",
        ])
          await request(app)
            .get(`/api/admin/courses?${query}`)
            .set(auth(admin))
            .expect(400);
        const total = await db.course.count();
        const seen = new Set<string>();
        for (let page = 1; page <= Math.ceil(total / 100); page++) {
          const response = await request(app)
            .get(`/api/admin/courses?page=${page}&pageSize=100`)
            .set(auth(admin))
            .expect(200);
          const data = response.body.data;
          assert.deepEqual(Object.keys(data).sort(), [
            "list",
            "page",
            "pageSize",
            "total",
          ]);
          assert.equal(data.page, page);
          assert.equal(data.pageSize, 100);
          assert.equal(data.total, total);
          for (const course of data.list as { id: string }[]) {
            assert.equal(seen.has(course.id), false);
            seen.add(course.id);
          }
        }
        assert.equal(seen.size, total);
        for (const fixtureId of fixtureIds) assert.ok(seen.has(fixtureId));
        const empty = await request(app)
          .get(`/api/admin/courses?page=10000`)
          .set(auth(admin))
          .expect(200);
        assert.deepEqual(empty.body.data.list, []);
        await db.course.deleteMany({ where: { id: { in: fixtureIds } } });
      },
    );
    await request(app).get(`/api/course/${id}`).expect(404);
    await request(app)
      .post(`/api/course/${id}/enroll`)
      .set(auth(student))
      .expect(404);
    await t.test(
      "publishing requires lesson content and only admins can publish",
      async () => {
        await approveSyntheticCourse(app, auth(admin), id);
        await request(app)
          .patch(`/api/admin/courses/${id}/status`)
          .set(auth(student))
          .send({ status: "PUBLISHED" })
          .expect(403);
        await request(app)
          .patch(`/api/admin/courses/${id}/status`)
          .set(auth(admin))
          .send({ status: "PUBLISHED" })
          .expect(200);
        await request(app)
          .put(`/api/admin/courses/${id}`)
          .set(auth(admin))
          .send(draft)
          .expect(409);
        const detail = await request(app).get(`/api/course/${id}`).expect(200);
        assert.equal(
          detail.body.data.chapters[0].lessons[0].content,
          undefined,
        );
      },
    );
    await t.test(
      "enrollment, lesson content and completion are bound to current student",
      async () => {
        await request(app)
          .get(`/api/learning/${id}/lessons/${lesson.id}`)
          .expect(401);
        await request(app)
          .get(`/api/learning/${id}/lessons/${lesson.id}`)
          .set(auth(student))
          .expect(403);
        await request(app)
          .post(`/api/course/${id}/enroll`)
          .set(auth(student))
          .expect(200);
        await request(app)
          .post(`/api/course/${id}/enroll`)
          .set(auth(student))
          .expect(200);
        assert.equal(
          await db.enrollment.count({
            where: { userId: users[1], courseId: id },
          }),
          1,
        );
        const text = await request(app)
          .get(`/api/learning/${id}/lessons/${lesson.id}`)
          .set(auth(student))
          .expect(200);
        assert.equal(
          text.body.data.content,
          draft.chapters[0].lessons[0].content,
        );
        await request(app)
          .put(`/api/learning/${id}/lessons/${lesson.id}/completion`)
          .set(auth(other))
          .send({})
          .expect(403);
        for (let i = 0; i < 2; i++)
          await request(app)
            .put(`/api/learning/${id}/lessons/${lesson.id}/completion`)
            .set(auth(student))
            .send({})
            .expect(200);
        const progress = await request(app)
          .get(`/api/learning/${id}`)
          .set(auth(student))
          .expect(200);
        assert.deepEqual(progress.body.data.completedIds, [lesson.id]);
        const otherList = await request(app)
          .get("/api/learning")
          .set(auth(other))
          .expect(200);
        assert.equal(otherList.body.data.items.length, 0);
      },
    );
    await t.test("cross-course and member content are denied", async () => {
      const second = await request(app)
        .post("/api/admin/courses")
        .set(auth(admin))
        .send({ ...draft, slug: `${draft.slug}-other`, access: "MEMBER" })
        .expect(200);
      const id2 = second.body.data.id;
      courses.push(id2);
      const lesson2 = second.body.data.chapters[0].lessons[0];
      await request(app)
        .get(`/api/learning/${id}/lessons/${lesson2.id}`)
        .set(auth(student))
        .expect(404);
      await request(app)
        .put(`/api/learning/${id}/lessons/${lesson2.id}/completion`)
        .set(auth(student))
        .send({})
        .expect(404);
      await approveSyntheticCourse(app, auth(admin), id2);
      await request(app)
        .patch(`/api/admin/courses/${id2}/status`)
        .set(auth(admin))
        .send({ status: "PUBLISHED" })
        .expect(200);
      await request(app)
        .post(`/api/course/${id2}/enroll`)
        .set(auth(student))
        .expect(403);
      await db.enrollment.create({ data: { userId: users[1], courseId: id2 } });
      await request(app)
        .get(`/api/learning/${id2}/lessons/${lesson2.id}`)
        .set(auth(student))
        .expect(403);
    });
    await t.test(
      "draft editing preserves IDs and progress; rejects foreign IDs; incomplete publish fails",
      async () => {
        await request(app)
          .patch(`/api/admin/courses/${id}/status`)
          .set(auth(admin))
          .send({ status: "DRAFT" })
          .expect(200);
        await request(app)
          .get(`/api/learning/${id}`)
          .set(auth(student))
          .expect(404);
        const edit = {
          ...draft,
          chapters: [
            {
              id: chapter.id,
              title: "新章名",
              lessons: chapter.lessons
                .map((l: { id: string; title: string }) => ({
                  id: l.id,
                  title: l.title,
                  content: "修改后的正文",
                }))
                .reverse(),
            },
          ],
        };
        await request(app)
          .put(`/api/admin/courses/${id}`)
          .set(auth(admin))
          .send({ ...edit, chapters: [{ ...edit.chapters[0], id: "foreign" }] })
          .expect(400);
        await request(app)
          .put(`/api/admin/courses/${id}`)
          .set(auth(admin))
          .send(edit)
          .expect(200);
        await approveSyntheticCourse(app, auth(admin), id);
        await request(app)
          .patch(`/api/admin/courses/${id}/status`)
          .set(auth(admin))
          .send({ status: "PUBLISHED" })
          .expect(200);
        const progress = await request(app)
          .get(`/api/learning/${id}`)
          .set(auth(student))
          .expect(200);
        assert.deepEqual(progress.body.data.completedIds, [lesson.id]);
        await request(app)
          .patch(`/api/admin/courses/${id}/status`)
          .set(auth(admin))
          .send({ status: "ARCHIVED" })
          .expect(200);
        await request(app).get(`/api/course/${id}`).expect(404);
        await request(app)
          .put(`/api/admin/courses/${id}`)
          .set(auth(admin))
          .send({ ...draft, chapters: [] })
          .expect(200);
        await request(app)
          .patch(`/api/admin/courses/${id}/status`)
          .set(auth(admin))
          .send({ status: "PUBLISHED" })
          .expect(400);
      },
    );
  },
);
