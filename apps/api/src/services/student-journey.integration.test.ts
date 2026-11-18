import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import request from "supertest";
import { z } from "zod";
import type {
  AnalyticsTrend,
  ClassAnalytics,
  ExamAttemptView,
  LearningAnalytics,
  LearningReviewNext,
  LearningReviewQueue,
  Role,
} from "@zhixue/shared";
import { createApp } from "../app";
import { register } from "../auth/service";
import { getDb, disconnectDb } from "../lib/db";
import { disconnectRedis } from "../lib/rate-limiter";
import {
  validateContentPackage,
  contentId,
  importContentPackage,
} from "./content-package";
import { approveSyntheticCourse } from "../test-utils/course-review";

process.env.RATE_LIMIT_NAMESPACE =
  "qa-journey-" + randomBytes(8).toString("hex");

test(
  "isolated student journey across learning, practice, homework, exam and analytics",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      app = createApp();
    const prefix = "qa_journey_" + randomBytes(5).toString("hex");
    const users: string[] = [],
      courses: string[] = [],
      questions: string[] = [],
      classes: string[] = [],
      homework: string[] = [],
      exams: string[] = [];
    t.after(async () => {
      try {
        await db.exam.deleteMany({ where: { id: { in: exams } } });
        await db.homework.deleteMany({ where: { id: { in: homework } } });
        await db.schoolClass.deleteMany({ where: { id: { in: classes } } });
        await db.questionAttempt.deleteMany({
          where: { userId: { in: users } },
        });
        await db.question.deleteMany({ where: { id: { in: questions } } });
        await db.course.deleteMany({ where: { id: { in: courses } } });
        await db.adminAuditLog.deleteMany({
          where: { actorUserId: { in: users } },
        });
        await db.user.deleteMany({ where: { id: { in: users } } });
        assert.equal(await db.user.count({ where: { id: { in: users } } }), 0);
      } finally {
        await disconnectDb();
        await disconnectRedis();
      }
    });
    async function account(role: Role) {
      const result = await register({
        username: `${prefix}_${users.length}`,
        passphrase: randomBytes(24).toString("hex"),
        displayName: "合成全流程验收",
        grade: "G7",
      });
      users.push(result.user.id);
      await db.user.update({ where: { id: result.user.id }, data: { role } });
      return {
        id: result.user.id,
        headers: {
          Authorization: `Bearer ${result.accessToken}`,
          "X-Zhixue-Client": "web",
          Origin: "http://127.0.0.1:3000",
        },
      };
    }
    const admin = await account("ADMIN"),
      teacher = await account("TEACHER"),
      student = await account("STUDENT"),
      parent = await account("PARENT"),
      outsider = await account("PARENT");
    await request(app)
      .get("/api/learning-review-queue")
      .set(parent.headers)
      .expect(403);
    await request(app)
      .get("/api/learning-review-queue/next")
      .set(parent.headers)
      .expect(403);
    const source = validateContentPackage(
      JSON.parse(
        await readFile(
          "content/courses/g7-math-linear-equations.v1.json",
          "utf8",
        ),
      ),
    );
    const assessment = validateContentPackage(
      JSON.parse(
        await readFile(
          "content/assessments/g7-math-linear-unit.v1.json",
          "utf8",
        ),
      ),
    );
    const written = z
      .object({
        writtenPractice: z.array(
          z.object({
            prompt: z.string(),
            reference: z.string(),
            maxScore: z.number(),
          }),
        ),
      })
      .parse(
        JSON.parse(
          await readFile(
            "content/assessments/g7-math-linear-unit.blueprint.v1.json",
            "utf8",
          ),
        ),
      ).writtenPractice[3];
    const originalWhere = { id: contentId(source.id, "course") };
    const original = await db.course.findUnique({
      where: originalWhere,
      include: { chapters: { include: { lessons: true } } },
    });
    const classRow = await db.schoolClass.create({
      data: {
        name: "合成旅程班",
        grade: "G7",
        teacherId: teacher.id,
        students: { create: { studentId: student.id } },
      },
    });
    classes.push(classRow.id);
    await db.parentStudent.create({
      data: { parentId: parent.id, studentId: student.id },
    });
    let courseId = "",
      lessonId = "";

    await t.test(
      "copy a lesson, enroll, read and complete idempotently",
      async () => {
        const lesson = source.course.chapters[0].lessons[0];
        const created = await request(app)
          .post("/api/admin/courses")
          .set(admin.headers)
          .send({
            title: "合成验收副本",
            slug: prefix.replaceAll("_", "-"),
            grade: "G7",
            subject: "math",
            access: "FREE",
            description: "隔离验收副本，不是真实教学发布。",
            chapters: [
              {
                title: "合成验收",
                lessons: [{ title: lesson.title, content: lesson.content }],
              },
            ],
          })
          .expect(200);
        courseId = created.body.data.id as string;
        courses.push(courseId);
        lessonId = created.body.data.chapters[0].lessons[0].id as string;
        await approveSyntheticCourse(app, admin.headers, courseId);
        await request(app)
          .patch(`/api/admin/courses/${courseId}/status`)
          .set(admin.headers)
          .send({ status: "PUBLISHED" })
          .expect(200);
        await request(app)
          .post(`/api/course/${courseId}/enroll`)
          .set(student.headers)
          .send({})
          .expect(200);
        const read = await request(app)
          .get(`/api/learning/${courseId}/lessons/${lessonId}`)
          .set(student.headers)
          .expect(200);
        assert.equal(read.body.data.content, lesson.content);
        const completionTimes: string[] = [];
        for (let i = 0; i < 2; i++) {
          await request(app)
            .put(`/api/learning/${courseId}/lessons/${lessonId}/completion`)
            .set(student.headers)
            .send({})
            .expect(200);
          const progress = await db.lessonProgress.findFirstOrThrow({
            where: { enrollment: { userId: student.id }, lessonId },
          });
          assert.ok(progress.completedAt);
          completionTimes.push(progress.completedAt.toISOString());
        }
        assert.equal(completionTimes[0], completionTimes[1]);
        assert.equal(
          await db.lessonProgress.count({
            where: { enrollment: { userId: student.id }, lessonId },
          }),
          1,
        );
      },
    );

    await t.test(
      "wrong then correct practice resolves the student's wrongbook",
      async () => {
        const q = source.questions[0];
        const created = await request(app)
          .post("/api/admin/questions")
          .set(admin.headers)
          .send({
            title: q.title,
            grade: "G7",
            subject: "math",
            knowledgePoint: prefix,
            difficulty: q.difficulty,
            options: q.options,
            answer: q.answer,
            explanation: q.explanation,
            diagram: q.diagram,
            lessonIds: [lessonId],
          })
          .expect(200);
        const id = created.body.data.id as string;
        questions.push(id);
        const published = await request(app)
          .patch(`/api/admin/questions/${id}/status`)
          .set(admin.headers)
          .send({ status: "PUBLISHED", updatedAt: created.body.data.updatedAt })
          .expect(200);
        for (const selected of [(q.answer + 1) % 4, q.answer]) {
          await request(app)
            .post(`/api/practice/questions/${id}/attempts`)
            .set(student.headers)
            .send({
              selected,
              requestId: randomUUID(),
              updatedAt: published.body.data.updatedAt,
            })
            .expect(200);
        }
        const wrong = await db.wrongQuestion.findUniqueOrThrow({
          where: { userId_questionId: { userId: student.id, questionId: id } },
        });
        assert.ok(wrong.resolvedAt);
      },
    );

    await t.test(
      "written homework is submitted and manually graded independently",
      async () => {
        const created = await request(app)
          .post("/api/homework")
          .set(teacher.headers)
          .send({
            classId: classRow.id,
            title: "合成往返书面任务",
            instructions: written.prompt,
            maxScore: written.maxScore,
            dueAt: new Date(Date.now() + 3600000).toISOString(),
          })
          .expect(200);
        const id = created.body.data.id as string;
        homework.push(id);
        await request(app)
          .patch(`/api/homework/${id}/status`)
          .set(teacher.headers)
          .send({ status: "PUBLISHED", updatedAt: created.body.data.updatedAt })
          .expect(200);
        const submitted = await request(app)
          .post(`/api/homework/${id}/submissions`)
          .set(student.headers)
          .send({ answerText: written.reference, requestId: randomUUID() })
          .expect(200);
        await request(app)
          .post(
            `/api/homework/${id}/submissions/${submitted.body.data.id}/grade`,
          )
          .set(teacher.headers)
          .send({
            score: 8,
            feedback: "合成评分，仅验证人工批改链路。",
            updatedAt: submitted.body.data.updatedAt,
            requestId: randomUUID(),
          })
          .expect(200);
        const detail = await request(app)
          .get(`/api/homework/${id}`)
          .set(student.headers)
          .expect(200);
        assert.equal(detail.body.data.submission.score, 8);
        assert.match(detail.body.data.submission.feedback, /合成评分/);
      },
    );

    await t.test(
      "20-question exam saves, submits, withholds and releases results",
      async () => {
        const created = await request(app)
          .post("/api/exams")
          .set(teacher.headers)
          .send({
            classId: classRow.id,
            title: "合成单元测评副本",
            opensAt: new Date(Date.now() - 10000).toISOString(),
            closesAt: new Date(Date.now() + 3600000).toISOString(),
            durationMinutes: 40,
            questions: assessment.questions.map((q) => ({
              source: "MANUAL",
              title: q.title,
              options: q.options,
              answer: q.answer,
              explanation: q.explanation,
              diagram: q.diagram,
              points: 5,
            })),
          })
          .expect(200);
        const id = created.body.data.id as string;
        exams.push(id);
        await request(app)
          .patch(`/api/exams/${id}/status`)
          .set(teacher.headers)
          .send({ status: "PUBLISHED", updatedAt: created.body.data.updatedAt })
          .expect(200);
        const started = (
          await request(app)
            .post(`/api/exams/${id}/attempt/start`)
            .set(student.headers)
            .send({})
            .expect(200)
        ).body.data as ExamAttemptView;
        assert.equal(started.questions.length, 20);
        assert.equal(started.questions.filter((q) => q.diagram).length, 3);
        assert.ok(
          started.questions.every(
            (q) => q.answer === undefined && q.explanation === undefined,
          ),
        );
        const saved = await request(app)
          .put(`/api/exams/${id}/attempt/answers`)
          .set(student.headers)
          .send({
            revision: started.revision,
            requestId: randomUUID(),
            answers: started.questions.map((q, i) => ({
              questionId: q.id,
              selected: assessment.questions[i].answer,
            })),
          })
          .expect(200);
        const submitted = await request(app)
          .post(`/api/exams/${id}/attempt/submit`)
          .set(student.headers)
          .send({ revision: saved.body.data.revision, requestId: randomUUID() })
          .expect(200);
        assert.equal(submitted.body.data.score, null);
        assert.equal(submitted.body.data.released, false);
        const hidden = await request(app)
          .get(`/api/analytics/students/${student.id}`)
          .set(parent.headers)
          .expect(200);
        assert.equal(hidden.body.data.assessments.examScorePercent, null);
        const version = await db.exam.findUniqueOrThrow({ where: { id } });
        await request(app)
          .patch(`/api/exams/${id}/status`)
          .set(teacher.headers)
          .send({
            status: "CLOSED",
            updatedAt: version.updatedAt.toISOString(),
          })
          .expect(200);
        const result = (
          await request(app)
            .get(`/api/exams/${id}/attempt`)
            .set(student.headers)
            .expect(200)
        ).body.data as ExamAttemptView;
        assert.equal(result.score, 100);
        assert.equal(result.correctCount, 20);
        assert.equal(result.released, true);
        result.questions.forEach((q, i) => {
          assert.equal(q.explanation, assessment.questions[i].explanation);
          assert.deepEqual(
            q.diagram ?? null,
            assessment.questions[i].diagram ?? null,
          );
        });
      },
    );

    await t.test(
      "student/parent/class totals, trends and CSV agree without privacy leakage",
      async () => {
        const own = (
          await request(app)
            .get("/api/analytics/me")
            .set(student.headers)
            .expect(200)
        ).body.data as LearningAnalytics;
        assert.deepEqual(own.learning, {
          courses: 1,
          completedLessons: 1,
          attempts: 2,
          correctAttempts: 1,
          unresolvedWrongQuestions: 0,
          accuracyPercent: 50,
        });
        assert.deepEqual(own.assessments, {
          homeworkAssigned: 1,
          homeworkSubmitted: 1,
          homeworkGraded: 1,
          homeworkScorePercent: 80,
          examsAssigned: 1,
          examsSubmitted: 1,
          examsReleased: 1,
          examScorePercent: 100,
        });
        const bound = (
          await request(app)
            .get(`/api/analytics/students/${student.id}`)
            .set(parent.headers)
            .expect(200)
        ).body.data as LearningAnalytics;
        assert.deepEqual(bound.learning, own.learning);
        assert.deepEqual(bound.assessments, own.assessments);
        await request(app)
          .get(`/api/analytics/students/${student.id}`)
          .set(outsider.headers)
          .expect(404);
        const classView = (
          await request(app)
            .get(`/api/analytics/classes/${classRow.id}`)
            .set(teacher.headers)
            .expect(200)
        ).body.data as ClassAnalytics;
        assert.equal(classView.total, 1);
        assert.deepEqual(classView.list[0].assessments, own.assessments);
        assert.equal("learning" in classView.list[0], false);
        for (const [path, actor, privateMetrics] of [
          ["/api/analytics/me", student, true],
          [`/api/analytics/students/${student.id}`, parent, true],
          [`/api/analytics/classes/${classRow.id}`, teacher, false],
        ] as const) {
          const trend = (
            await request(app)
              .get(`${path}/trend?days=7`)
              .set(actor.headers)
              .expect(200)
          ).body.data as AnalyticsTrend;
          assert.equal(trend.timezone, "Asia/Shanghai");
          assert.equal(trend.list.length, 7);
          const sum = (
            key:
              | "attempts"
              | "completedLessons"
              | "homeworkSubmitted"
              | "examsSubmitted",
          ) => trend.list.reduce((n, d) => n + d[key], 0);
          assert.equal(sum("attempts"), privateMetrics ? 2 : 0);
          assert.equal(sum("completedLessons"), privateMetrics ? 1 : 0);
          assert.equal(sum("homeworkSubmitted"), 1);
          assert.equal(sum("examsSubmitted"), 1);
          const csv = (
            await request(app)
              .get(`${path}/trend/export?days=7`)
              .set(actor.headers)
              .expect(200)
          ).body.data.csv as string;
          assert.ok(csv.startsWith("\uFEFF"));
          assert.equal(csv.slice(1).trimEnd().split("\r\n").length, 8);
          const rows = csv
            .slice(1)
            .trimEnd()
            .split("\r\n")
            .slice(1)
            .map((line) => line.slice(1, -1).split('","'));
          assert.deepEqual(
            rows,
            trend.list.map((day) =>
              (privateMetrics
                ? [
                    day.date,
                    day.completedLessons,
                    day.attempts,
                    day.correctAttempts,
                    day.accuracyPercent ?? "",
                    day.homeworkSubmitted,
                    day.examsSubmitted,
                  ]
                : [day.date, day.homeworkSubmitted, day.examsSubmitted]
              ).map(String),
            ),
          );
          assert.equal(csv.includes("成绩"), false);
          if (!privateMetrics) assert.equal(csv.includes("正确"), false);
        }
        await db.parentStudent.deleteMany({
          where: { parentId: parent.id, studentId: student.id },
        });
        await request(app)
          .get(`/api/analytics/students/${student.id}/trend/export`)
          .set(parent.headers)
          .expect(404);
        assert.deepEqual(
          await db.course.findUnique({
            where: originalWhere,
            include: { chapters: { include: { lessons: true } } },
          }),
          original,
        );
      },
    );
  },
);

test(
  "G7–G9 lessons connect completion, linked questions and personal wrong-answer review",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb();
    const app = createApp();
    const prefix = "qa-lesson-" + randomBytes(5).toString("hex");
    const users: string[] = [];
    const courses: string[] = [];
    const questions: string[] = [];
    let planId: string | undefined;
    const origin = {
      Origin: "http://127.0.0.1:3000",
      "X-Zhixue-Client": "web",
    };
    t.after(async () => {
      await db.user.deleteMany({ where: { id: { in: users } } });
      if (planId) await db.membershipPlan.delete({ where: { id: planId } });
      await db.question.deleteMany({ where: { id: { in: questions } } });
      await db.course.deleteMany({ where: { id: { in: courses } } });
      await disconnectDb();
      await disconnectRedis();
    });

    async function account(grade: "G7" | "G8" | "G9") {
      const result = await request(app)
        .post("/api/auth/register")
        .set(origin)
        .send({
          username: `${prefix}_${grade.toLowerCase()}`.replaceAll("-", "_"),
          passphrase: randomBytes(24).toString("hex"),
          displayName: "课时练习验收",
          grade,
        })
        .expect(200);
      users.push(result.body.data.user.id);
      return {
        ...origin,
        Authorization: `Bearer ${result.body.data.accessToken}`,
      };
    }

    const students = {
      G7: await account("G7"),
      G8: await account("G8"),
      G9: await account("G9"),
    };
    const queuePath = "/api/learning-review-queue";
    await request(app).get(queuePath).expect(401);
    await request(app)
      .get(queuePath)
      .set(students.G7)
      .query({ userId: users[1] })
      .expect(400);
    async function queue(
      headers: typeof students.G7,
      query: { page?: number; pageSize: number } = { pageSize: 20 },
    ): Promise<LearningReviewQueue> {
      const response = await request(app)
        .get(queuePath)
        .query(query)
        .set(headers)
        .expect(200);
      assert.equal(response.headers["cache-control"], "no-store");
      return response.body.data;
    }
    assert.deepEqual(await queue(students.G7), {
      page: 1,
      pageSize: 20,
      total: 0,
      items: [],
    });
    const roundSamples = new Map<
      "G7" | "G8" | "G9",
      { courseId: string; items: { lessonId: string; questionId: string }[] }
    >();
    const nextPath = queuePath + "/next";
    await request(app).get(nextPath).expect(401);
    await request(app)
      .get(nextPath)
      .set(students.G7)
      .query({ courseId: "missing-lesson-id" })
      .expect(400);
    async function reviewNext(
      headers: typeof students.G7,
      scope:
        { courseId: string; lessonId: string } | Record<string, never> = {},
    ): Promise<LearningReviewNext> {
      const response = await request(app)
        .get(nextPath)
        .set(headers)
        .query(scope)
        .expect(200);
      assert.equal(response.headers["cache-control"], "no-store");
      return response.body.data;
    }
    assert.deepEqual(await reviewNext(students.G7), {
      currentPending: null,
      next: null,
    });
    function firstLesson(course?: LearningReviewQueue["items"][number]) {
      if (!course) return null;
      const lesson = course.lessons[0];
      return {
        courseId: course.courseId,
        lessonId: lesson.lessonId,
        courseTitle: course.title,
        lessonTitle: lesson.title,
        wrongCount: lesson.wrongCount,
      };
    }
    const directory = new URL("../../../../content/courses/", import.meta.url);
    const files = (await readdir(directory))
      .filter((name) => /^g[789]-.+\.v1\.json$/.test(name))
      .sort();
    const packages = await Promise.all(
      files.map(async (file) => ({
        name: file.replace(".v1.json", ""),
        source: validateContentPackage(
          JSON.parse(await readFile(new URL(file, directory), "utf8")),
        ),
      })),
    );
    for (const grade of ["G7", "G8", "G9"] as const) {
      const gradePackages = packages.filter(
        ({ source }) => source.course.grade === grade,
      );
      assert.ok(gradePackages.length, `${grade} has no course packages`);
      const lessons = gradePackages.reduce(
        (n, { source }) =>
          n +
          source.course.chapters.reduce(
            (count, chapter) => count + chapter.lessons.length,
            0,
          ),
        0,
      );
      const questions = gradePackages.reduce(
        (n, { source }) => n + source.questions.length,
        0,
      );
      t.diagnostic(
        `${grade} 源码盘点：${gradePackages.length} 门课，${lessons} 课时，${questions} 道题`,
      );
    }
    for (const [index, { name, source }] of packages.entries()) {
      await t.test(name, async () => {
        const pkg = structuredClone(source);
        pkg.id = `${prefix}-${index}`;
        pkg.course.slug = pkg.id;
        const courseId = contentId(pkg.id, "course");
        const idFor = (type: string, key: string) =>
          contentId(pkg.id, `${type}:${key}`);
        const lessonList = pkg.course.chapters.flatMap(
          (chapter) => chapter.lessons,
        );
        const linked = new Map(
          lessonList.map(({ key }) => [
            key,
            pkg.questions.filter((question) =>
              question.lessonKeys?.includes(key),
            ),
          ]),
        );
        for (const lesson of lessonList) {
          assert.ok(
            linked.get(lesson.key)?.length,
            `${name}: ${lesson.title} 缺配套练习`,
          );
        }
        const questionIds = pkg.questions.map((q) => idFor("question", q.key));
        courses.push(courseId);
        questions.push(...questionIds);
        await importContentPackage(pkg);
        // Publish synthetic copies in the test database only.
        await db.course.update({
          where: { id: courseId },
          data: { status: "PUBLISHED" },
        });
        await db.lesson.updateMany({
          where: { chapter: { courseId } },
          data: { publishedAt: new Date() },
        });
        await db.question.updateMany({
          where: { id: { in: questionIds } },
          data: { status: "PUBLISHED" },
        });

        const grade = pkg.course.grade;
        assert.ok(grade === "G7" || grade === "G8" || grade === "G9");
        if (!roundSamples.has(grade) && lessonList.length >= 4) {
          roundSamples.set(grade, {
            courseId,
            items: lessonList.slice(1, 4).map((lesson) => ({
              lessonId: idFor("lesson", lesson.key),
              questionId: idFor("question", linked.get(lesson.key)![0].key),
            })),
          });
        }
        const student = students[grade];
        const other = students[grade === "G8" ? "G9" : "G8"];
        const lessonPath = (key: string) =>
          `/api/learning/${courseId}/lessons/${idFor("lesson", key)}`;
        const firstWrongPath = `${lessonPath(lessonList[0].key)}/wrong-questions`;
        await request(app).get(firstWrongPath).expect(401);
        await request(app).get(firstWrongPath).set(student).expect(403);
        await request(app)
          .post(`/api/course/${courseId}/enroll`)
          .set(student)
          .send({})
          .expect(200);
        await request(app)
          .post(`/api/course/${courseId}/enroll`)
          .set(other)
          .send({})
          .expect(200);
        await request(app)
          .get(
            `/api/learning/${courseId}/lessons/missing-lesson/wrong-questions`,
          )
          .set(student)
          .expect(404);
        await request(app)
          .get(firstWrongPath)
          .query({ grade: "G8" })
          .set(student)
          .expect(400);

        async function submit(id: string, updatedAt: string, selected: number) {
          const response = await request(app)
            .post(`/api/practice/questions/${id}/attempts`)
            .set(student)
            .send({ selected, updatedAt, requestId: randomUUID() })
            .expect(200);
          return response.body.data;
        }
        // Keep a second lesson's error pending where an unused, lesson-only question exists.
        const secondLesson = lessonList[1];
        const unrelated = secondLesson
          ? linked
              .get(secondLesson.key)
              ?.slice(0, -1)
              .find((q) => q.lessonKeys?.length === 1)
          : undefined;
        const unrelatedId = unrelated && idFor("question", unrelated.key);
        if (secondLesson && unrelated && unrelatedId) {
          const response = await request(app)
            .get(`${lessonPath(secondLesson.key)}/questions`)
            .set(student)
            .expect(200);
          const item = response.body.data.items.find(
            (q: { id: string }) => q.id === unrelatedId,
          );
          assert.equal(
            (
              await submit(
                unrelatedId,
                item.updatedAt,
                (unrelated.answer + 1) % 4,
              )
            ).correct,
            false,
          );
        }
        const solved = new Set<string>();

        for (const lesson of lessonList) {
          const path = lessonPath(lesson.key);
          const lessonResponse = await request(app)
            .get(path)
            .set(student)
            .expect(200);
          assert.equal(lessonResponse.body.data.content, lesson.content);
          const complete = await request(app)
            .put(`${path}/completion`)
            .set(student)
            .send({})
            .expect(200);
          assert.ok(complete.body.data.completedAt);
          const progress = await request(app)
            .get(`/api/learning/${courseId}`)
            .set(student)
            .expect(200);
          assert.ok(
            progress.body.data.completedIds.includes(
              idFor("lesson", lesson.key),
            ),
          );

          const exercises = await request(app)
            .get(`${path}/questions`)
            .set(student)
            .expect(200);
          const data = exercises.body.data;
          const lessonQuestions = linked.get(lesson.key)!;
          const expectedIds = lessonQuestions.map((question) =>
            idFor("question", question.key),
          );
          assert.equal(data.lesson.title, lesson.title);
          assert.equal(data.lesson.grade, pkg.course.grade);
          assert.deepEqual(
            data.items.map((q: { id: string }) => q.id).sort(),
            [...expectedIds].sort(),
          );
          assert.equal(data.total, lessonQuestions.length);
          assert.ok(
            data.items.every(
              (q: object) => !("answer" in q) && !("explanation" in q),
            ),
          );
          const question = lessonQuestions.at(-1)!;
          const id = idFor("question", question.key);
          const listed = data.items.find((q: { id: string }) => q.id === id);
          assert.equal(
            (await submit(id, listed.updatedAt, (question.answer + 1) % 4))
              .correct,
            false,
          );

          const reviewPath = `${path}/wrong-questions`;
          const otherPending =
            unrelatedId && expectedIds.includes(unrelatedId)
              ? [unrelatedId]
              : [];
          const wrong = await request(app)
            .get(reviewPath)
            .set(student)
            .expect(200);
          assert.equal(wrong.headers["cache-control"], "no-store");
          assert.deepEqual(
            wrong.body.data.items
              .map((row: { question: { id: string } }) => row.question.id)
              .sort(),
            [id, ...otherPending].sort(),
          );
          const scope = { courseId, lessonId: idFor("lesson", lesson.key) };
          assert.deepEqual(await reviewNext(student, scope), {
            currentPending: wrong.body.data.total,
            next: null,
          });
          const summary = (await queue(student)).items.find(
            (item) => item.courseId === courseId,
          );
          assert.deepEqual(summary, {
            courseId,
            title: pkg.course.title,
            grade,
            subject: pkg.course.subject,
            wrongCount: unrelatedId ? 2 : 1,
            lessons: lessonList.flatMap((entry) => {
              const count =
                Number(entry.key === lesson.key) +
                Number(!!unrelatedId && entry.key === secondLesson?.key);
              return count
                ? [
                    {
                      lessonId: idFor("lesson", entry.key),
                      title: entry.title,
                      wrongCount: count,
                    },
                  ]
                : [];
            }),
          });
          const retry = wrong.body.data.items.find(
            (row: { question: { id: string } }) => row.question.id === id,
          );
          assert.equal("answer" in retry.question, false);
          assert.equal("explanation" in retry.question, false);
          const nonOwner = await request(app)
            .get(reviewPath)
            .set(other)
            .expect(200);
          assert.equal(nonOwner.body.data.total, 0);
          assert.ok(
            !(await queue(other)).items.some(
              (item) => item.courseId === courseId,
            ),
          );

          assert.equal(
            (await submit(id, retry.question.updatedAt, question.answer))
              .correct,
            true,
          );
          const pending = await request(app)
            .get(reviewPath)
            .set(student)
            .expect(200);
          assert.equal(pending.body.data.total, otherPending.length);
          const updated = (await queue(student)).items.find(
            (item) => item.courseId === courseId,
          );
          assert.equal(updated?.wrongCount ?? 0, unrelatedId ? 1 : 0);
          assert.equal(
            updated?.lessons.find(
              (item) => item.lessonId === idFor("lesson", lesson.key),
            )?.wrongCount ?? 0,
            pending.body.data.total,
          );
          const direction = await reviewNext(student, scope);
          assert.equal(direction.currentPending, pending.body.data.total);
          if (pending.body.data.total) {
            assert.equal(direction.next, null);
          } else {
            const remaining = await queue(student);
            assert.deepEqual(
              direction.next,
              firstLesson(updated ?? remaining.items[0]),
            );
          }
          solved.add(id);
          const resolved = await request(app)
            .get(reviewPath)
            .query({ state: "resolved" })
            .set(student)
            .expect(200);
          assert.deepEqual(
            resolved.body.data.items
              .map((row: { question: { id: string } }) => row.question.id)
              .sort(),
            expectedIds.filter((questionId) => solved.has(questionId)).sort(),
          );
        }
        if (index === 0 && unrelatedId) {
          const firstId = idFor("lesson", lessonList[0].key);
          const secondId = idFor("lesson", secondLesson.key);
          const sharedQuestion = await db.question.create({
            data: {
              title: "两课共用的合成练习",
              options: ["A", "B", "C", "D"],
              answer: 0,
              explanation: "合成验收数据",
              grade,
              subject: pkg.course.subject,
              status: "PUBLISHED",
              restrictToLessons: true,
              lessonLinks: {
                create: [{ lessonId: firstId }, { lessonId: secondId }],
              },
            },
          });
          questions.push(sharedQuestion.id);
          await submit(
            sharedQuestion.id,
            sharedQuestion.updatedAt.toISOString(),
            1,
          );
          const sharedCourse = (await queue(student)).items.find(
            (item) => item.courseId === courseId,
          );
          assert.equal(sharedCourse?.wrongCount, 2);
          assert.deepEqual(
            sharedCourse?.lessons.map((item) => [
              item.lessonId,
              item.wrongCount,
            ]),
            [
              [firstId, 1],
              [secondId, 2],
            ],
          );
          const sharedRound = await request(app)
            .post("/api/learning-review-rounds")
            .set(student)
            .send({ roundId: randomUUID() })
            .expect(200);
          assert.equal(sharedRound.body.data.round.total, 2);
          await db.question.update({
            where: { id: sharedQuestion.id },
            data: { status: "ARCHIVED" },
          });
          const archiveCourse = (await queue(student)).items.find(
            (item) => item.courseId === courseId,
          );
          assert.equal(archiveCourse?.wrongCount, 1);
          assert.deepEqual(
            archiveCourse?.lessons.map((item) => item.lessonId),
            [secondId],
          );

          const closed = await db.lesson.update({
            where: { id: secondId },
            data: { publishedAt: null },
          });
          assert.ok(
            !(await queue(student)).items.some(
              (item) => item.courseId === courseId,
            ),
          );
          await db.lesson.update({
            where: { id: closed.id },
            data: { publishedAt: new Date() },
          });

          await db.enrollment.delete({
            where: { userId_courseId: { userId: users[0], courseId } },
          });
          assert.ok(
            !(await queue(student)).items.some(
              (item) => item.courseId === courseId,
            ),
          );
          await request(app)
            .post(`/api/course/${courseId}/enroll`)
            .set(student)
            .send({})
            .expect(200);

          const plan = await db.membershipPlan.create({
            data: { code: prefix, name: "合成复练权益", active: true },
          });
          planId = plan.id;
          const membership = await db.membership.create({
            data: {
              userId: users[0],
              planId: plan.id,
              startsAt: new Date(Date.now() - 60_000),
              expiresAt: new Date(Date.now() + 60_000),
            },
          });
          await db.course.update({
            where: { id: courseId },
            data: { access: "MEMBER" },
          });
          assert.ok(
            (await queue(student)).items.some(
              (item) => item.courseId === courseId,
            ),
          );
          await db.membership.update({
            where: { id: membership.id },
            data: { expiresAt: new Date(Date.now() - 1_000) },
          });
        }
        await db.course.update({
          where: { id: courseId },
          data: { access: "MEMBER" },
        });
        await request(app).get(firstWrongPath).set(student).expect(403);
        assert.ok(
          !(await queue(student)).items.some(
            (item) => item.courseId === courseId,
          ),
        );
        await db.course.update({
          where: { id: courseId },
          data: { access: "FREE" },
        });
        await db.lesson.updateMany({
          where: { id: idFor("lesson", lessonList[0].key) },
          data: { publishedAt: null },
        });
        await request(app).get(firstWrongPath).set(student).expect(404);
      });
    }
    const fullQueue = await queue(students.G7);
    assert.ok(fullQueue.total > 1);
    for (const page of [1, 2]) {
      const slice = await queue(students.G7, { page, pageSize: 1 });
      assert.equal(slice.total, fullQueue.total);
      assert.deepEqual(slice.items, fullQueue.items.slice(page - 1, page));
    }
    const emptyPage = await queue(students.G7, { page: 10000, pageSize: 1 });
    assert.equal(emptyPage.total, fullQueue.total);
    assert.deepEqual(emptyPage.items, []);
    assert.deepEqual(await reviewNext(students.G7), {
      currentPending: null,
      next: firstLesson(fullQueue.items[0]),
    });
    const earlierCourse = fullQueue.items.at(-1)!;
    const finishedLesson = await db.lesson.findFirstOrThrow({
      where: {
        chapter: { courseId: earlierCourse.courseId },
        publishedAt: { not: null },
        id: { notIn: earlierCourse.lessons.map((lesson) => lesson.lessonId) },
      },
      select: { id: true },
    });
    assert.deepEqual(
      await reviewNext(students.G7, {
        courseId: earlierCourse.courseId,
        lessonId: finishedLesson.id,
      }),
      { currentPending: 0, next: firstLesson(earlierCourse) },
    );
    await db.wrongQuestion.updateMany({
      where: { userId: { in: users }, questionId: { in: questions } },
      data: { resolvedAt: new Date() },
    });
    assert.deepEqual(
      await reviewNext(students.G7, {
        courseId: earlierCourse.courseId,
        lessonId: finishedLesson.id,
      }),
      { currentPending: 0, next: null },
    );
    for (const grade of ["G7", "G8", "G9"] as const) {
      await t.test(
        `${grade} round stays accurate across lessons, reloads and outside answers`,
        async () => {
          const student = students[grade];
          const other = students[grade === "G8" ? "G9" : "G8"];
          const sample = roundSamples.get(grade);
          assert.ok(sample, grade);
          const { courseId, items } = sample;
          const [first, second, extra] = await Promise.all(
            items.map(({ lessonId, questionId }) =>
              db.question
                .findUniqueOrThrow({ where: { id: questionId } })
                .then(({ id, updatedAt, answer }) => ({
                  id,
                  lessonId,
                  updatedAt: updatedAt.toISOString(),
                  answer,
                })),
            ),
          );
          async function answer(
            question: typeof first,
            selected: number,
            roundId?: string,
            requestId = randomUUID(),
            status = 200,
          ) {
            return request(app)
              .post(`/api/practice/questions/${question.id}/attempts`)
              .set(student)
              .send({
                selected,
                requestId,
                updatedAt: question.updatedAt,
                ...(roundId ? { roundId } : {}),
              })
              .expect(status);
          }
          const roundId = randomUUID();
          const roundPath = "/api/learning-review-rounds";
          const read = () =>
            request(app)
              .get(nextPath)
              .query({ roundId })
              .set(student)
              .expect(200);
          const start = () =>
            request(app)
              .post(roundPath)
              .set(student)
              .send({ roundId })
              .expect(200);
          const view = (
            correct: number,
            remaining: number,
            skipped: number,
          ) => ({ id: roundId, total: 2, correct, remaining, skipped });
          const wrong = (question: typeof first) => (question.answer + 1) % 4;
          await answer(first, wrong(first));
          await answer(second, wrong(second));

          const opened = await start();
          assert.deepEqual(opened.body.data.round, view(0, 2, 0));
          assert.equal(opened.body.data.next.lessonId, first.lessonId);
          assert.deepEqual((await start()).body.data, opened.body.data);
          await request(app)
            .get(nextPath)
            .query({ roundId })
            .set(other)
            .expect(404);
          await request(app)
            .post(roundPath)
            .set(other)
            .send({ roundId })
            .expect(404);
          const scoped = `/api/learning/${courseId}/lessons/${first.lessonId}/wrong-questions`;
          await request(app)
            .get(scoped)
            .query({ roundId })
            .set(other)
            .expect(404);

          await answer(extra, wrong(extra)); // Wrong after this round started.
          await answer(extra, extra.answer, roundId, randomUUID(), 409);
          assert.deepEqual((await read()).body.data.round, view(0, 2, 0));
          const extraScope = `/api/learning/${courseId}/lessons/${extra.lessonId}/wrong-questions`;
          assert.equal(
            (
              await request(app)
                .get(extraScope)
                .query({ roundId })
                .set(student)
                .expect(200)
            ).body.data.total,
            0,
          );
          await answer(first, wrong(first), roundId);
          assert.deepEqual((await read()).body.data.round, view(0, 2, 0));

          const correctionId = randomUUID();
          const passed = await answer(
            first,
            first.answer,
            roundId,
            correctionId,
          );
          assert.equal(passed.body.data.correct, true);
          assert.equal(
            (await answer(first, first.answer, roundId, correctionId)).body.data
              .id,
            passed.body.data.id,
          );
          await answer(first, first.answer, undefined, correctionId, 409);
          const next = await read();
          assert.deepEqual(next.body.data.round, view(1, 1, 0));
          assert.equal(next.body.data.next.lessonId, second.lessonId);
          assert.equal(
            (
              await request(app)
                .get(scoped)
                .query({ roundId, state: "resolved" })
                .set(student)
                .expect(200)
            ).body.data.total,
            1,
          );
          await answer(first, wrong(first), roundId, randomUUID(), 409);

          await answer(second, second.answer, roundId);
          const finished = await read();
          assert.deepEqual(finished.body.data.round, view(2, 0, 0));
          assert.equal(finished.body.data.next, null);
          assert.deepEqual((await start()).body.data, finished.body.data);

          const outsideRoundId = randomUUID();
          const outside = await request(app)
            .post(roundPath)
            .set(student)
            .send({ roundId: outsideRoundId })
            .expect(200);
          assert.equal(outside.body.data.round.total, 1);
          assert.equal(outside.body.data.next.lessonId, extra.lessonId);
          await answer(extra, extra.answer);
          const skipped = await request(app)
            .get(nextPath)
            .query({ roundId: outsideRoundId })
            .set(student)
            .expect(200);
          assert.deepEqual(skipped.body.data.round, {
            id: outsideRoundId,
            total: 1,
            correct: 0,
            remaining: 0,
            skipped: 1,
          });
          assert.equal(skipped.body.data.next, null);
        },
      );
    }
  },
);
