import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import request from "supertest";
import { z } from "zod";
import type {
  AnalyticsTrend,
  ClassAnalytics,
  ExamAttemptView,
  LearningAnalytics,
  Role,
} from "@zhixue/shared";
import { createApp } from "../app";
import { register } from "../auth/service";
import { getDb, disconnectDb } from "../lib/db";
import { disconnectRedis } from "../lib/rate-limiter";
import { validateContentPackage, contentId } from "./content-package";
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
