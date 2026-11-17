import { z } from "zod";
import { gradeCodes } from "../auth/validation";
import { getDb } from "../lib/db";
import type { LessonReadinessPage } from "@zhixue/shared";
import type { Prisma } from "../generated/prisma/client";
export const lessonReadinessQuery = z
  .object({
    grade: z.enum(gradeCodes).default("G7"),
    subject: z.string().trim().min(1).max(100).optional(),
    courseId: z.string().min(1).max(100).optional(),
    missingOnly: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
export async function lessonReadiness(
  query: z.infer<typeof lessonReadinessQuery>,
): Promise<LessonReadinessPage> {
  const where: Prisma.LessonWhereInput = {
    publishedAt: { not: null },
    chapter: {
      course: {
        grade: query.grade,
        status: "PUBLISHED",
        ...(query.subject ? { subject: query.subject } : {}),
        ...(query.courseId ? { id: query.courseId } : {}),
      },
    },
    ...(query.missingOnly
      ? { questionLinks: { none: { question: { status: "PUBLISHED" } } } }
      : {}),
  };
  return getDb().$transaction(
    async (tx) => {
      const total = await tx.lesson.count({ where });
      const items = await tx.lesson.findMany({
        where,
        skip: (query.page - 1) * 20,
        take: 20,
        orderBy: [
          { chapter: { courseId: "asc" } },
          { chapter: { position: "asc" } },
          { position: "asc" },
          { id: "asc" },
        ],
        select: {
          id: true,
          title: true,
          chapter: {
            select: {
              title: true,
              course: {
                select: {
                  id: true,
                  title: true,
                  grade: true,
                  subject: true,
                  access: true,
                },
              },
            },
          },
        },
      });
      const ids = items.map((item) => item.id);
      const counts = await Promise.all(
        (["PUBLISHED", "DRAFT", "ARCHIVED"] as const).map((status) =>
          tx.lessonQuestion.groupBy({
            by: ["lessonId"],
            where: { lessonId: { in: ids }, question: { status } },
            _count: { _all: true },
          }),
        ),
      );
      return {
        total,
        page: query.page,
        pageSize: 20,
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          chapterTitle: item.chapter.title,
          courseId: item.chapter.course.id,
          courseTitle: item.chapter.course.title,
          grade: item.chapter.course.grade,
          subject: item.chapter.course.subject,
          access: item.chapter.course.access,
          publishedQuestions:
            counts[0].find((row) => row.lessonId === item.id)?._count._all ?? 0,
          draftQuestions:
            counts[1].find((row) => row.lessonId === item.id)?._count._all ?? 0,
          archivedQuestions:
            counts[2].find((row) => row.lessonId === item.id)?._count._all ?? 0,
        })),
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}
