import {
  subjectOptions,
  type ContentReadiness,
  type GradeCode,
} from "@zhixue/shared";
import { getDb } from "../lib/db";
import { questionVisibility } from "./question-access";
export async function contentReadiness(
  grade: GradeCode,
): Promise<ContentReadiness> {
  const visibility = await questionVisibility();
  return getDb().$transaction(
    async (tx) => {
      const [courses, questions, publicQuestions, lessons] = await Promise.all([
        tx.course.groupBy({
          by: ["subject", "status"],
          where: { grade },
          _count: { _all: true },
        }),
        tx.question.groupBy({
          by: ["subject", "status"],
          where: { grade },
          _count: { _all: true },
        }),
        tx.question.groupBy({
          by: ["subject"],
          where: { grade, status: "PUBLISHED", ...visibility },
          _count: { _all: true },
        }),
        tx.$queryRaw<
          {
            subject: string;
            openLessons: number;
            lessonsWithoutPractice: number;
          }[]
        >`
        SELECT c.subject,
          COUNT(*)::int AS "openLessons",
          COUNT(*) FILTER (WHERE NOT EXISTS (
            SELECT 1 FROM "LessonQuestion" lq JOIN "Question" q ON q.id = lq."questionId"
            WHERE lq."lessonId" = l.id AND q.status = 'PUBLISHED'
          ))::int AS "lessonsWithoutPractice"
        FROM "Lesson" l JOIN "Chapter" ch ON ch.id = l."chapterId"
        JOIN "Course" c ON c.id = ch."courseId"
        WHERE c.grade = ${grade}::"Grade" AND c.status = 'PUBLISHED' AND l."publishedAt" IS NOT NULL
        GROUP BY c.subject`,
      ]);
      const subjects = new Map(
        subjectOptions.map((item) => [
          item.value as string,
          item.label as string,
        ]),
      );
      for (const row of [...courses, ...questions])
        if (!subjects.has(row.subject)) subjects.set(row.subject, row.subject);
      const rows = [...subjects].map(([subject, subjectLabel]) => ({
        subject,
        subjectLabel,
        publishedCourses:
          courses.find(
            (row) => row.subject === subject && row.status === "PUBLISHED",
          )?._count._all ?? 0,
        draftCourses:
          courses.find(
            (row) => row.subject === subject && row.status === "DRAFT",
          )?._count._all ?? 0,
        publishedQuestions:
          questions.find(
            (row) => row.subject === subject && row.status === "PUBLISHED",
          )?._count._all ?? 0,
        draftQuestions:
          questions.find(
            (row) => row.subject === subject && row.status === "DRAFT",
          )?._count._all ?? 0,
        publicQuestions:
          publicQuestions.find((row) => row.subject === subject)?._count._all ??
          0,
        openLessons:
          lessons.find((row) => row.subject === subject)?.openLessons ?? 0,
        lessonsWithoutPractice:
          lessons.find((row) => row.subject === subject)
            ?.lessonsWithoutPractice ?? 0,
      }));
      return { grade, generatedAt: new Date().toISOString(), rows };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
