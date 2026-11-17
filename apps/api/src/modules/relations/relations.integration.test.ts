import "../../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import request from "supertest";
import type { Role } from "@zhixue/shared";
import { createApp } from "../../app";
import { getDb, disconnectDb } from "../../lib/db";
import { disconnectRedis } from "../../lib/rate-limiter";

process.env.RATE_LIMIT_NAMESPACE =
  "qa-relations-" + randomBytes(8).toString("hex");
test(
  "teacher ownership, classes and parent links",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const app = createApp(),
      db = getDb(),
      prefix = "qa_rel_" + randomBytes(5).toString("hex");
    const ids: string[] = [],
      classIds: string[] = [],
      courseIds: string[] = [],
      questionIds: string[] = [];
    const headers = {
      "X-Zhixue-Client": "web",
      Origin: "http://127.0.0.1:3000",
    };
    type Account = {
      id: string;
      username: string;
      passphrase: string;
      token: string;
    };
    const auth = (a: Account) => ({
      ...headers,
      Authorization: `Bearer ${a.token}`,
    });
    t.after(async () => {
      await db.questionAttempt.deleteMany({
        where: { questionId: { in: questionIds } },
      });
      await db.question.deleteMany({ where: { id: { in: questionIds } } });
      await db.course.deleteMany({ where: { id: { in: courseIds } } });
      await db.schoolClass.deleteMany({ where: { id: { in: classIds } } });
      await db.adminAuditLog.deleteMany({
        where: { actorUserId: { in: ids } },
      });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await disconnectDb();
      await disconnectRedis();
    });
    async function account(suffix: string, role: Role): Promise<Account> {
      const username = prefix + "_" + suffix,
        passphrase = randomBytes(24).toString("hex");
      const res = await request(app)
        .post("/api/auth/register")
        .set(headers)
        .send({
          username,
          passphrase,
          displayName: "关系合成测试",
          grade: "G7",
        })
        .expect(200);
      const id = res.body.data.user.id as string;
      ids.push(id);
      await db.user.update({ where: { id }, data: { role } });
      return {
        id,
        username,
        passphrase,
        token: res.body.data.accessToken as string,
      };
    }
    async function login(a: Account) {
      const res = await request(app)
        .post("/api/auth/login")
        .set(headers)
        .send({ username: a.username, passphrase: a.passphrase })
        .expect(200);
      a.token = res.body.data.accessToken as string;
    }
    const admin = await account("admin", "ADMIN"),
      teacher = await account("ta", "TEACHER"),
      teacherB = await account("tb", "TEACHER"),
      student = await account("sa", "STUDENT"),
      studentB = await account("sb", "STUDENT"),
      parent = await account("pa", "PARENT"),
      parentB = await account("pb", "PARENT");
    const course = await db.course.create({
      data: {
        slug: prefix.replaceAll("_", "-"),
        title: "归属合成课程",
        grade: "G7",
        subject: "math",
        status: "PUBLISHED",
        chapters: {
          create: {
            title: "章",
            position: 0,
            lessons: {
              create: {
                title: "课",
                content: "合成课时内容",
                position: 0,
                publishedAt: new Date(),
              },
            },
          },
        },
      },
      include: { chapters: { include: { lessons: true } } },
    });
    courseIds.push(course.id);
    const assign = async (teacherId: string | null) => {
      const row = await db.course.findUniqueOrThrow({
        where: { id: course.id },
      });
      return request(app)
        .put(`/api/admin/courses/${course.id}/teacher`)
        .set(auth(admin))
        .send({ teacherId, updatedAt: row.updatedAt.toISOString() });
    };
    const setRole = async (a: Account, role: Role) => {
      const row = await db.user.findUniqueOrThrow({ where: { id: a.id } });
      await request(app)
        .patch(`/api/admin/users/${a.id}/role`)
        .set(auth(admin))
        .send({ role, updatedAt: row.updatedAt.toISOString() })
        .expect(200);
    };
    const bind = (p: Account, s: Account) =>
      request(app)
        .post("/api/admin/parent-links")
        .set(auth(admin))
        .send({ parentId: p.id, studentId: s.id });
    async function newClass(a: Account, teacherId?: string) {
      const res = await request(app)
        .post("/api/classes")
        .set(auth(a))
        .send({
          name: "合成七年级班",
          grade: "G7",
          ...(teacherId ? { teacherId } : {}),
        })
        .expect(200);
      classIds.push(res.body.data.id as string);
      return res.body.data.id as string;
    }
    let classA = "",
      classB = "";
    await t.test(
      "account pickers are admin-only and expose minimal matching records",
      async () => {
        for (const a of [teacher, student, parent])
          await request(app)
            .get("/api/admin/user-options?role=TEACHER")
            .set(auth(a))
            .expect(403);
        const result = await request(app)
          .get(`/api/admin/user-options?role=TEACHER&q=${teacher.username}`)
          .set(auth(admin))
          .expect(200);
        assert.equal(result.body.data.total, 1);
        assert.deepEqual(result.body.data.list, [
          {
            id: teacher.id,
            displayName: "关系合成测试",
            username: teacher.username,
            role: "TEACHER",
          },
        ]);
        await request(app)
          .get("/api/admin/user-options?role=OWNER")
          .set(auth(admin))
          .expect(400);
        const selected = await request(app)
          .get(`/api/admin/user-options?role=TEACHER&id=${teacher.id}`)
          .set(auth(admin))
          .expect(200);
        assert.equal(selected.body.data.list[0].id, teacher.id);
      },
    );

    await t.test(
      "teacher assignment is admin-only, versioned and scoped to active teachers",
      async () => {
        await request(app).get("/api/teacher/courses").expect(401);
        const original = await db.course.findUniqueOrThrow({
          where: { id: course.id },
        });
        for (const a of [teacher, student, parent])
          await request(app)
            .put(`/api/admin/courses/${course.id}/teacher`)
            .set(auth(a))
            .send({
              teacherId: teacher.id,
              updatedAt: original.updatedAt.toISOString(),
            })
            .expect(403);
        assert.equal((await assign(student.id)).status, 400);
        assert.equal((await assign(teacher.id)).status, 200);
        const mine = await request(app)
          .get("/api/teacher/courses?pageSize=1")
          .set(auth(teacher))
          .expect(200);
        assert.equal(mine.body.data.total, 1);
        assert.equal(mine.body.data.list[0].id, course.id);
        await request(app)
          .get(`/api/teacher/courses/${course.id}`)
          .set(auth(teacher))
          .expect(200);
        await request(app)
          .get(`/api/teacher/courses/${course.id}`)
          .set(auth(teacherB))
          .expect(404);
        await request(app)
          .get("/api/teacher/courses")
          .set(auth(parent))
          .expect(403);
        assert.equal((await assign(teacherB.id)).status, 200);
        await request(app)
          .get(`/api/teacher/courses/${course.id}`)
          .set(auth(teacher))
          .expect(404);
        await request(app)
          .get(`/api/teacher/courses/${course.id}`)
          .set(auth(teacherB))
          .expect(200);
        await request(app)
          .put(`/api/admin/courses/${course.id}/teacher`)
          .set(auth(admin))
          .send({
            teacherId: teacher.id,
            updatedAt: "1970-01-01T00:00:00.000Z",
          })
          .expect(409);
        assert.equal((await assign(null)).status, 200);
        assert.equal((await assign(teacher.id)).status, 200);
      },
    );
    await t.test(
      "class creation cannot impersonate teachers and lists enforce role scope",
      async () => {
        classA = await newClass(teacher);
        classB = await newClass(admin, teacherB.id);
        await request(app)
          .post("/api/classes")
          .set(auth(admin))
          .send({ name: "班", grade: "G7" })
          .expect(400);
        await request(app)
          .post("/api/classes")
          .set(auth(teacher))
          .send({ name: "班", grade: "G7", teacherId: teacherB.id })
          .expect(403);
        await request(app)
          .post("/api/classes")
          .set(auth(parent))
          .send({ name: "班", grade: "G7" })
          .expect(403);
        await request(app)
          .post("/api/classes")
          .set(auth(teacher))
          .send({ name: "班", grade: "G7", ownerId: teacher.id })
          .expect(400);
        const mine = await request(app)
          .get("/api/classes")
          .set(auth(teacher))
          .expect(200);
        assert.deepEqual(
          mine.body.data.list.map((v: { id: string }) => v.id),
          [classA],
        );
        const studentClasses = await request(app)
          .get("/api/classes")
          .set(auth(student))
          .expect(200);
        assert.equal(studentClasses.body.data.total, 0);
        await request(app).get("/api/classes").set(auth(parent)).expect(403);
        await request(app)
          .get("/api/classes?page=0")
          .set(auth(teacher))
          .expect(400);
      },
    );
    await t.test(
      "class roster supports idempotent add/remove with cross-class isolation",
      async () => {
        const url = `/api/classes/${classA}/students/${student.id}`;
        await request(app)
          .post(`/api/classes/${classA}/students`)
          .set(auth(teacher))
          .send({ username: student.username.toUpperCase() })
          .expect(200);
        await request(app)
          .post(`/api/classes/${classA}/students`)
          .set(auth(teacherB))
          .send({ username: studentB.username })
          .expect(403);
        await request(app)
          .post(`/api/classes/${classA}/students`)
          .set(auth(parent))
          .send({ username: studentB.username })
          .expect(403);
        await request(app)
          .post(`/api/classes/${classA}/students`)
          .set(auth(teacher))
          .send({ username: "missing_student" })
          .expect(400);
        for (let i = 0; i < 2; i++)
          await request(app).put(url).set(auth(teacher)).send({}).expect(200);
        await request(app)
          .put(`/api/classes/${classA}/students/${studentB.id}`)
          .set(auth(teacher))
          .send({})
          .expect(200);
        for (const a of [teacherB, student, parent])
          await request(app).put(url).set(auth(a)).send({}).expect(403);
        await request(app)
          .get(`/api/classes/${classA}/students`)
          .set(auth(teacherB))
          .expect(403);
        await request(app)
          .put(`/api/classes/${classA}/students/${parent.id}`)
          .set(auth(teacher))
          .send({})
          .expect(400);
        const roster = await request(app)
          .get(`/api/classes/${classA}/students?pageSize=1`)
          .set(auth(teacher))
          .expect(200);
        assert.equal(roster.body.data.total, 2);
        assert.equal(roster.body.data.list.length, 1);
        assert.deepEqual(Object.keys(roster.body.data.list[0]).sort(), [
          "displayName",
          "grade",
          "id",
        ]);
        const joined = await request(app)
          .get("/api/classes")
          .set(auth(student))
          .expect(200);
        assert.equal(joined.body.data.list[0].id, classA);
        for (let i = 0; i < 2; i++)
          await request(app).delete(url).set(auth(teacher)).expect(200);
        assert.equal(
          (
            await request(app)
              .get("/api/classes")
              .set(auth(student))
              .expect(200)
          ).body.data.total,
          0,
        );
        assert.equal(
          await db.adminAuditLog.count({
            where: {
              actorUserId: teacher.id,
              targetUserId: student.id,
              action: `CLASS_STUDENT_REMOVE:${classA}`,
            },
          }),
          1,
        );
        await request(app).put(url).set(auth(teacher)).send({}).expect(200);
      },
    );
    await t.test(
      "only admins bind parents and parents cannot query unbound students",
      async () => {
        for (const a of [teacher, student, parent])
          await request(app)
            .post("/api/admin/parent-links")
            .set(auth(a))
            .send({ parentId: parent.id, studentId: student.id })
            .expect(403);
        await bind(parent, student).expect(200);
        await bind(parent, student).expect(200);
        await bind(parentB, studentB).expect(200);
        assert.equal(
          await db.parentStudent.count({
            where: { parentId: parent.id, studentId: student.id },
          }),
          1,
        );
        const children = await request(app)
          .get("/api/parent/students")
          .set(auth(parent))
          .expect(200);
        assert.deepEqual(
          children.body.data.list.map((v: { id: string }) => v.id),
          [student.id],
        );
        await request(app)
          .get(`/api/parent/students/${studentB.id}/overview`)
          .set(auth(parent))
          .expect(404);
        await request(app)
          .get("/api/parent/students?parentId=forged")
          .set(auth(parent))
          .expect(400);
        await request(app)
          .get("/api/parent/students")
          .set(auth(teacher))
          .expect(403);
        await request(app)
          .post("/api/admin/parent-links")
          .set(auth(admin))
          .send({ parentId: teacher.id, studentId: student.id })
          .expect(400);
      },
    );
    await t.test(
      "admin binding list validates pagination and refuses non-admin access",
      async () => {
        for (const a of [parent, teacher, student])
          await request(app)
            .get("/api/admin/parent-links")
            .set(auth(a))
            .expect(403);
        const result = await request(app)
          .get(`/api/admin/parent-links?parentId=${parent.id}&pageSize=1`)
          .set(auth(admin))
          .expect(200);
        assert.equal(result.body.data.total, 1);
        assert.equal(result.body.data.list[0].studentId, student.id);
        assert.deepEqual(Object.keys(result.body.data.list[0].parent).sort(), [
          "displayName",
          "id",
          "username",
        ]);
        await request(app)
          .get("/api/admin/parent-links?pageSize=0")
          .set(auth(admin))
          .expect(400);
      },
    );
    await t.test(
      "parent overview reflects owned records without exposing content or answers",
      async () => {
        const enrollment = await db.enrollment.create({
          data: { userId: student.id, courseId: course.id },
        });
        await db.lessonProgress.create({
          data: {
            enrollmentId: enrollment.id,
            lessonId: course.chapters[0].lessons[0].id,
            completedAt: new Date(),
          },
        });
        const q = await db.question.create({
          data: {
            title: "合成题",
            grade: "G7",
            subject: "math",
            options: ["1", "2", "3", "4"],
            answer: 1,
            explanation: "合成解析",
          },
        });
        questionIds.push(q.id);
        await db.questionAttempt.createMany({
          data: [false, true].map((correct) => ({
            userId: student.id,
            questionId: q.id,
            requestId: randomUUID(),
            selected: correct ? 1 : 0,
            correct,
            snapshot: { title: "合成题" },
          })),
        });
        await db.wrongQuestion.create({
          data: { userId: student.id, questionId: q.id },
        });
        const overview = await request(app)
          .get(`/api/parent/students/${student.id}/overview`)
          .set(auth(parent))
          .expect(200);
        assert.deepEqual(overview.body.data, {
          student: { id: student.id, displayName: "关系合成测试", grade: "G7" },
          courses: 1,
          completedLessons: 1,
          attempts: 2,
          correctAttempts: 1,
          unresolvedWrongQuestions: 1,
        });
      },
    );
    await t.test(
      "unbinding immediately removes access and leaves learning records intact",
      async () => {
        await request(app)
          .delete(`/api/admin/parent-links/${parent.id}/${student.id}`)
          .set(auth(parent))
          .expect(403);
        await request(app)
          .delete(`/api/admin/parent-links/${parent.id}/${student.id}`)
          .set(auth(admin))
          .expect(200);
        await request(app)
          .get(`/api/parent/students/${student.id}/overview`)
          .set(auth(parent))
          .expect(404);
        assert.equal(
          await db.enrollment.count({ where: { userId: student.id } }),
          1,
        );
        await bind(parent, student).expect(200);
      },
    );
    await t.test(
      "leaving student role revokes class and parent links without revival on return",
      async () => {
        await setRole(student, "TEACHER");
        assert.ok(
          (
            await db.classStudent.findUniqueOrThrow({
              where: {
                classId_studentId: { classId: classA, studentId: student.id },
              },
            })
          ).revokedAt,
        );
        assert.equal(
          (
            await request(app)
              .get("/api/parent/students")
              .set(auth(parent))
              .expect(200)
          ).body.data.total,
          0,
        );
        await setRole(student, "STUDENT");
        await login(student);
        assert.equal(
          (
            await request(app)
              .get("/api/classes")
              .set(auth(student))
              .expect(200)
          ).body.data.total,
          0,
        );
        await request(app)
          .get(`/api/parent/students/${student.id}/overview`)
          .set(auth(parent))
          .expect(404);
        await request(app)
          .put(`/api/classes/${classA}/students/${student.id}`)
          .set(auth(teacher))
          .send({})
          .expect(200);
        await bind(parent, student).expect(200);
      },
    );
    await t.test(
      "leaving parent role invalidates bindings even after role is restored",
      async () => {
        await setRole(parent, "STUDENT");
        await setRole(parent, "PARENT");
        await login(parent);
        await request(app)
          .get(`/api/parent/students/${student.id}/overview`)
          .set(auth(parent))
          .expect(404);
        await bind(parent, student).expect(200);
      },
    );
    await t.test(
      "teacher role changes clear ownership and archive classes without deleting courses",
      async () => {
        await setRole(teacher, "STUDENT");
        assert.equal(
          (await db.course.findUniqueOrThrow({ where: { id: course.id } }))
            .ownerTeacherId,
          null,
        );
        assert.ok(
          (await db.schoolClass.findUniqueOrThrow({ where: { id: classA } }))
            .archivedAt,
        );
        await setRole(teacher, "TEACHER");
        await login(teacher);
        await request(app)
          .get(`/api/teacher/courses/${course.id}`)
          .set(auth(teacher))
          .expect(404);
        await request(app)
          .get(`/api/classes/${classA}/students`)
          .set(auth(teacher))
          .expect(404);
        await request(app).get(`/api/course/${course.id}`).expect(200);
      },
    );
    await t.test(
      "class archive is soft and blocks roster modifications",
      async () => {
        await request(app)
          .put(`/api/classes/${classB}/students/${studentB.id}`)
          .set(auth(teacherB))
          .send({})
          .expect(200);
        await request(app)
          .delete(`/api/classes/${classB}`)
          .set(auth(teacher))
          .expect(403);
        await request(app)
          .delete(`/api/classes/${classB}`)
          .set(auth(teacherB))
          .expect(200);
        assert.ok(
          (await db.schoolClass.findUniqueOrThrow({ where: { id: classB } }))
            .archivedAt,
        );
        await request(app)
          .put(`/api/classes/${classB}/students/${studentB.id}`)
          .set(auth(teacherB))
          .send({})
          .expect(404);
        assert.equal(
          (
            await request(app)
              .get("/api/classes")
              .set(auth(studentB))
              .expect(200)
          ).body.data.total,
          0,
        );
      },
    );
    await t.test(
      "concurrent course assignments have only one winner",
      async () => {
        const row = await db.course.findUniqueOrThrow({
          where: { id: course.id },
        });
        const results = await Promise.all(
          [teacher, teacherB].map((a) =>
            request(app)
              .put(`/api/admin/courses/${course.id}/teacher`)
              .set(auth(admin))
              .send({
                teacherId: a.id,
                updatedAt: row.updatedAt.toISOString(),
              }),
          ),
        );
        assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
      },
    );
    await t.test(
      "disabled related students disappear and cannot be newly linked",
      async () => {
        await db.user.update({
          where: { id: studentB.id },
          data: { status: "DISABLED" },
        });
        assert.equal(
          (
            await request(app)
              .get("/api/parent/students")
              .set(auth(parentB))
              .expect(200)
          ).body.data.total,
          0,
        );
        await bind(parent, studentB).expect(400);
        await request(app)
          .get(`/api/parent/students/${studentB.id}/overview`)
          .set(auth(parentB))
          .expect(400);
      },
    );
  },
);
