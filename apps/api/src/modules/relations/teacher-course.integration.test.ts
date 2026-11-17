import "../../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import request from "supertest";
import type {
  Role,
  TeacherCourseDetail,
  TeacherCourseRevision,
} from "@zhixue/shared";
import { createApp } from "../../app";
import { register } from "../../auth/service";
import { getDb, disconnectDb } from "../../lib/db";
import { disconnectRedis } from "../../lib/rate-limiter";
import { approveSyntheticCourse } from "../../test-utils/course-review";
process.env.RATE_LIMIT_NAMESPACE =
  "qa-teacher-edit-" + randomBytes(6).toString("hex");

test(
  "teacher draft revision preserves structure and history with versioned ownership",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp(),
      prefix = "qa-teacher-edit-" + randomBytes(5).toString("hex");
    const users: string[] = [],
      courses: string[] = [],
      media: string[] = [];
    t.after(async () => {
      await db.course.deleteMany({ where: { id: { in: courses } } });
      await db.mediaAsset.deleteMany({ where: { id: { in: media } } });
      await db.adminAuditLog.deleteMany({
        where: { actorUserId: { in: users } },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(role: Role) {
      const r = await register({
        username: prefix.replaceAll("-", "_") + "_" + users.length,
        passphrase: randomBytes(24).toString("hex"),
        displayName: "合成教师改稿验收",
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
      teacher = await account("TEACHER"),
      other = await account("TEACHER"),
      student = await account("STUDENT"),
      parent = await account("PARENT");
    const asset = await db.mediaAsset.create({
      data: { filename: "合成占位.mp4", storageKey: prefix, size: 1 },
    });
    media.push(asset.id);
    const course = await db.course.create({
      data: {
        title: "合成改稿课程",
        slug: prefix,
        grade: "G7",
        subject: "math",
        access: "MEMBER",
        description: "仅用于测试，非正式课程。",
        ownerTeacherId: teacher.id,
        chapters: {
          create: {
            title: "原章节",
            position: 0,
            lessons: {
              create: [
                {
                  title: "原课时一",
                  content: "x+1=3，x=2。",
                  position: 0,
                  mediaId: asset.id,
                },
                { title: "原课时二", content: "x-1=3，x=4。", position: 1 },
              ],
            },
          },
        },
      },
      include: {
        chapters: { include: { lessons: { orderBy: { position: "asc" } } } },
      },
    });
    courses.push(course.id);
    const lessonId = course.chapters[0].lessons[0].id;
    const enrollment = await db.enrollment.create({
      data: { userId: student.id, courseId: course.id },
    });
    const progress = await db.lessonProgress.create({
      data: {
        enrollmentId: enrollment.id,
        lessonId,
        completedAt: new Date(),
        positionSeconds: 12,
      },
    });
    const url = `/api/teacher/courses/${course.id}/content`;
    async function input(): Promise<TeacherCourseRevision> {
      const d = (
        await request(app)
          .get(`/api/teacher/courses/${course.id}`)
          .set(teacher.headers)
          .expect(200)
      ).body.data as TeacherCourseDetail;
      return {
        title: d.title,
        description: d.description ?? "",
        updatedAt: d.updatedAt,
        region: d.region ?? null,
        textbookEdition: d.textbookEdition ?? null,
        term: d.term ?? null,
        chapters: d.chapters.map((ch) => ({
          id: ch.id,
          title: ch.title,
          lessons: ch.lessons.map((l) => ({
            id: l.id,
            title: l.title,
            content: l.content ?? "",
          })),
        })),
      };
    }
    await t.test(
      "only current teacher edits and strict input rejects privilege and media changes",
      async () => {
        const body = await input();
        await request(app).put(url).send(body).expect(403);
        for (const actor of [admin, student, parent])
          await request(app).put(url).set(actor.headers).send(body).expect(403);
        await request(app).put(url).set(other.headers).send(body).expect(404);
        await request(app)
          .put("/api/teacher/courses/missing/content")
          .set(teacher.headers)
          .send(body)
          .expect(404);
        for (const extra of [
          { access: "FREE" },
          { status: "PUBLISHED" },
          { ownerTeacherId: other.id },
        ])
          await request(app)
            .put(url)
            .set(teacher.headers)
            .send({ ...body, ...extra })
            .expect(400);
        await request(app)
          .put(url)
          .set(teacher.headers)
          .send({
            ...body,
            chapters: [
              {
                ...body.chapters[0],
                lessons: [
                  { ...body.chapters[0].lessons[0], mediaId: asset.id },
                ],
              },
            ],
          })
          .expect(400);
      },
    );
    await t.test(
      "rejects omitted, foreign and duplicate lesson IDs without partial writes",
      async () => {
        const body = await input();
        for (const chapters of [
          [],
          [{ ...body.chapters[0], id: "foreign" }],
          [{ ...body.chapters[0], lessons: [] }],
          [
            {
              ...body.chapters[0],
              lessons: [
                body.chapters[0].lessons[0],
                body.chapters[0].lessons[0],
              ],
            },
          ],
          [
            {
              ...body.chapters[0],
              lessons: [
                { ...body.chapters[0].lessons[0], id: "foreign" },
                body.chapters[0].lessons[1],
              ],
            },
          ],
        ])
          await request(app)
            .put(url)
            .set(teacher.headers)
            .send({ ...body, title: "不应保存", chapters })
            .expect(400);
        assert.equal(
          (await db.course.findUniqueOrThrow({ where: { id: course.id } }))
            .title,
          body.title,
        );
        assert.equal(
          await db.adminAuditLog.count({
            where: { action: `COURSE_TEXT_REVISE:${course.id}` },
          }),
          0,
        );
      },
    );
    await t.test(
      "concurrent edits cannot overwrite each other and preserve progress, media and order",
      async () => {
        const body = await input();
        const responses = await Promise.all(
          ["甲", "乙"].map((s) =>
            request(app)
              .put(url)
              .set(teacher.headers)
              .send({
                ...body,
                title: "合成修订" + s,
                chapters: [
                  {
                    ...body.chapters[0],
                    title: "修订章",
                    lessons: body.chapters[0].lessons
                      .map((l) => ({
                        ...l,
                        content: l.content + "代入检验成立。",
                      }))
                      .reverse(),
                  },
                ],
              }),
          ),
        );
        assert.deepEqual(responses.map((r) => r.status).sort(), [200, 409]);
        const updated = await db.course.findUniqueOrThrow({
          where: { id: course.id },
          include: {
            chapters: {
              include: { lessons: { orderBy: { position: "asc" } } },
            },
          },
        });
        assert.deepEqual(
          updated.chapters[0].lessons.map((l) => l.id),
          course.chapters[0].lessons.map((l) => l.id),
        );
        assert.equal(updated.chapters[0].lessons[0].mediaId, asset.id);
        assert.equal(updated.access, "MEMBER");
        assert.equal(updated.slug, prefix);
        assert.deepEqual(
          await db.lessonProgress.findUniqueOrThrow({
            where: { id: progress.id },
          }),
          progress,
        );
        assert.equal(
          await db.adminAuditLog.count({
            where: { action: `COURSE_TEXT_REVISE:${course.id}` },
          }),
          1,
        );
        await request(app).put(url).set(teacher.headers).send(body).expect(409);
      },
    );
    await t.test(
      "changing approved content invalidates approval and requires resubmission",
      async () => {
        await approveSyntheticCourse(app, admin.headers, course.id);
        const before = await db.courseReview.findFirstOrThrow({
          where: { courseId: course.id },
        });
        const body = await input();
        await request(app)
          .put(url)
          .set(teacher.headers)
          .send({
            ...body,
            textbookEdition: "合成版本依据，不代表真实教材选用",
            description: "新的合成说明，必须重新审核。",
          })
          .expect(200);
        const reviews = await request(app)
          .get(`/api/courses/${course.id}/reviews`)
          .set(teacher.headers)
          .expect(200);
        assert.equal(reviews.body.data.current.state, "STALE");
        assert.deepEqual(
          await db.courseReview.findUniqueOrThrow({ where: { id: before.id } }),
          before,
        );
        await request(app)
          .patch(`/api/admin/courses/${course.id}/status`)
          .set(admin.headers)
          .send({ status: "PUBLISHED" })
          .expect(409);
        const next = await input();
        await request(app)
          .post(`/api/courses/${course.id}/reviews`)
          .set(teacher.headers)
          .send({ updatedAt: next.updatedAt })
          .expect(200);
        assert.equal(
          await db.courseReview.count({ where: { courseId: course.id } }),
          2,
        );
      },
    );
    await t.test(
      "published/archived courses, reassigned ownership and demoted accounts cannot edit",
      async () => {
        const body = await input();
        for (const status of ["PUBLISHED", "ARCHIVED"] as const) {
          await db.course.update({
            where: { id: course.id },
            data: { status },
          });
          await request(app)
            .put(url)
            .set(teacher.headers)
            .send(body)
            .expect(409);
        }
        await db.course.update({
          where: { id: course.id },
          data: { status: "DRAFT", ownerTeacherId: other.id },
        });
        await request(app).put(url).set(teacher.headers).send(body).expect(404);
        await db.course.update({
          where: { id: course.id },
          data: { ownerTeacherId: teacher.id },
        });
        await db.user.update({
          where: { id: teacher.id },
          data: { role: "STUDENT" },
        });
        await request(app).put(url).set(teacher.headers).send(body).expect(403);
      },
    );
  },
);
