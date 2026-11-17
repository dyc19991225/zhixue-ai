import { z } from "zod";
import { getDb } from "../lib/db";
import { HttpError } from "../lib/http";
import { gradeCodes, parseInput } from "../auth/validation";
import { Prisma } from "../generated/prisma/client";
import { requireCourseEntitlement } from "./entitlement-service";
import { outline, publishedOutline } from "../repositories/course-repository";
export { outline } from "../repositories/course-repository";
const title = z.string().trim().min(1).max(120);
const id = z.string().min(1).max(100).optional();
const lesson = z
  .object({
    id,
    title,
    content: z.string().max(30000),
    mediaId: z.string().min(1).max(100).nullable().optional(),
  })
  .strict();
const schema = z
  .object({
    title,
    slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
    grade: z.enum(gradeCodes),
    subject: z.enum([
      "chinese",
      "math",
      "english",
      "physics",
      "chemistry",
      "biology",
      "history",
      "geography",
      "civics",
      "politics",
    ]),
    description: z.string().trim().max(2000),
    region: z.string().trim().max(120).nullable().optional(),
    textbookEdition: z.string().trim().max(300).nullable().optional(),
    term: z.string().trim().max(120).nullable().optional(),
    access: z.enum(["FREE", "MEMBER"]),
    chapters: z
      .array(z.object({ id, title, lessons: z.array(lesson).max(50) }).strict())
      .max(30),
  })
  .strict();
export async function publishedCourse(courseId: string) {
  const course = await getDb().course.findFirst({
    where: { id: courseId, status: "PUBLISHED" },
    include: publishedOutline,
  });
  if (!course) throw new HttpError(404, "课程不存在或尚未发布。");
  return course;
}
export async function saveCourse(courseId: string | null, input: unknown) {
  const data = parseInput(schema, input);
  const chapterIds = data.chapters.flatMap((c) => (c.id ? [c.id] : []));
  const lessonIds = data.chapters.flatMap((c) =>
    c.lessons.flatMap((l) => (l.id ? [l.id] : [])),
  );
  if (
    new Set(chapterIds).size !== chapterIds.length ||
    new Set(lessonIds).size !== lessonIds.length
  )
    throw new HttpError(400, "章节或课时重复。");
  try {
    return await getDb().$transaction(
      async (tx) => {
        if (courseId)
          await tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${courseId} FOR UPDATE`;
        const existing = courseId
          ? await tx.course.findUnique({
              where: { id: courseId },
              include: { chapters: { include: { lessons: true } } },
            })
          : null;
        if (courseId && !existing) throw new HttpError(404, "课程不存在。");
        if (existing?.status === "PUBLISHED")
          throw new HttpError(409, "请先将课程转为草稿，再编辑内容。");
        for (const chapter of data.chapters) {
          const old = existing?.chapters.find((c) => c.id === chapter.id);
          if (chapter.id && !old)
            throw new HttpError(400, "章节不属于该课程。");
          for (const item of chapter.lessons)
            if (item.id && !old?.lessons.some((l) => l.id === item.id))
              throw new HttpError(400, "课时不属于该章节。");
          for (const item of chapter.lessons)
            if (
              item.mediaId &&
              !(await tx.mediaAsset.findUnique({
                where: { id: item.mediaId },
                select: { id: true },
              }))
            )
              throw new HttpError(400, "所选视频不存在。");
        }
        const { chapters, ...metadata } = data;
        const course = existing
          ? await tx.course.update({
              where: { id: existing.id },
              data: metadata,
            })
          : await tx.course.create({ data: metadata });
        // Move old positions away before reordering; retained IDs preserve learning progress.
        for (const c of existing?.chapters ?? []) {
          await tx.chapter.update({
            where: { id: c.id },
            data: { position: -c.position - 1 },
          });
          for (const l of c.lessons)
            await tx.lesson.update({
              where: { id: l.id },
              data: { position: -l.position - 1 },
            });
        }
        await tx.chapter.deleteMany({
          where: { courseId: course.id, id: { notIn: chapterIds } },
        });
        for (const [position, c] of chapters.entries()) {
          const chapter = c.id
            ? await tx.chapter.update({
                where: { id: c.id },
                data: { title: c.title, position },
              })
            : await tx.chapter.create({
                data: { courseId: course.id, title: c.title, position },
              });
          await tx.lesson.deleteMany({
            where: {
              chapterId: chapter.id,
              id: { notIn: c.lessons.flatMap((l) => (l.id ? [l.id] : [])) },
            },
          });
          for (const [index, l] of c.lessons.entries()) {
            const values = {
              title: l.title,
              content: l.content,
              position: index,
              publishedAt: null,
              ...(l.mediaId !== undefined ? { mediaId: l.mediaId } : {}),
            };
            if (l.id)
              await tx.lesson.update({ where: { id: l.id }, data: values });
            else
              await tx.lesson.create({
                data: { ...values, chapterId: chapter.id },
              });
          }
        }
        return tx.course.findUniqueOrThrow({
          where: { id: course.id },
          include: outline,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new HttpError(409, "课程标识已存在。");
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      throw new HttpError(409, "内容正在变更，请刷新后重试。");
    throw error;
  }
}
export async function learning(userId: string, courseId: string) {
  const course = await publishedCourse(courseId);
  await requireCourseEntitlement(userId, course.access);
  const enrollment = await getDb().enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    include: { progress: true },
  });
  if (!enrollment) throw new HttpError(403, "请先加入这门课程。");
  const ids = course.chapters.flatMap((c) => c.lessons.map((l) => l.id));
  const completedIds = enrollment.progress
    .filter((p) => p.completedAt && ids.includes(p.lessonId))
    .map((p) => p.lessonId);
  return {
    course,
    positions: Object.fromEntries(
      enrollment.progress
        .filter((p) => ids.includes(p.lessonId))
        .map((p) => [p.lessonId, p.positionSeconds]),
    ),
    completedIds,
    nextLessonId:
      ids.find((id) => !completedIds.includes(id)) ?? ids[0] ?? null,
    total: ids.length,
  };
}
