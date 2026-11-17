import "../apps/api/src/config";
import { mkdir, writeFile } from "node:fs/promises";
import { getDb, disconnectDb } from "../apps/api/src/lib/db";
import { gradeOptions, subjectOptions } from "@zhixue/shared";
try {
  const db = getDb();
  const report = await db.$transaction(
    async (tx) => {
      const [courses, questions] = await Promise.all([
        tx.course.groupBy({
          by: ["grade", "subject", "status"],
          _count: { _all: true },
        }),
        tx.question.groupBy({
          by: ["grade", "subject", "status"],
          _count: { _all: true },
        }),
      ]);
      return {
        generatedAt: new Date().toISOString(),
        note: "按库中实际状态汇总；课程数量不代表教材章节覆盖率或内容质量。草稿不可作为已上线课程。",
        rows: gradeOptions.flatMap((grade) =>
          subjectOptions.map((subject) => ({
            grade: grade.label,
            subject: subject.label,
            publishedCourses:
              courses.find(
                (row) =>
                  row.grade === grade.value &&
                  row.subject === subject.value &&
                  row.status === "PUBLISHED",
              )?._count._all ?? 0,
            draftCourses:
              courses.find(
                (row) =>
                  row.grade === grade.value &&
                  row.subject === subject.value &&
                  row.status === "DRAFT",
              )?._count._all ?? 0,
            publishedQuestions:
              questions.find(
                (row) =>
                  row.grade === grade.value &&
                  row.subject === subject.value &&
                  row.status === "PUBLISHED",
              )?._count._all ?? 0,
            draftQuestions:
              questions.find(
                (row) =>
                  row.grade === grade.value &&
                  row.subject === subject.value &&
                  row.status === "DRAFT",
              )?._count._all ?? 0,
          })),
        ),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
  await mkdir("work", { recursive: true });
  await writeFile(
    "work/content-coverage.json",
    JSON.stringify(report, null, 2),
  );
  console.log(
    "课程与题库覆盖盘点已生成：work/content-coverage.json（无账号资料）。",
  );
} finally {
  await disconnectDb();
}
