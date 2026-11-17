import { createHash } from "node:crypto";
import { z } from "zod";
import { questionSchema, subjects } from "./practice-validation";
import { gradeCodes } from "../auth/validation";
import { getDb } from "../lib/db";
import { HttpError } from "../lib/http";
import { Prisma } from "../generated/prisma/client";
const key = z.string().regex(/^[a-z0-9][a-z0-9-]{1,79}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const side = z
  .object({
    a: z.number().int().min(-1000).max(1000),
    b: z.number().int().min(-1000).max(1000),
  })
  .strict();
const check = z.discriminatedUnion("kind", [
  z
    .object({ kind: z.literal("linear-equation"), left: side, right: side })
    .strict(),
  z.object({ kind: z.literal("manual"), note: text(500) }).strict(),
]);
export const contentPackageSchema = z
  .object({
    id: key,
    version: z.literal(1),
    editorialStatus: z.literal("DRAFT_REVIEW_REQUIRED"),
    provenance: text(1000),
    course: z
      .object({
        title: text(120),
        slug: z.string().regex(/^[a-z0-9][a-z0-9-]{2,79}$/),
        grade: z.enum(gradeCodes),
        subject: z.enum(subjects),
        description: text(2000),
        access: z.literal("FREE"),
        chapters: z
          .array(
            z
              .object({
                key,
                title: text(120),
                lessons: z
                  .array(
                    z
                      .object({ key, title: text(120), content: text(30000) })
                      .strict(),
                  )
                  .min(1)
                  .max(50),
              })
              .strict(),
          )
          .min(1)
          .max(30),
      })
      .strict(),
    questions: z
      .array(
        questionSchema
          .omit({ grade: true, subject: true, lessonIds: true })
          .extend({ key, check, lessonKeys: z.array(key).max(30).optional() })
          .strict(),
      )
      .min(1)
      .max(100),
  })
  .strict();
export type ContentPackage = z.infer<typeof contentPackageSchema>;
function rational(value: string): { n: bigint; d: bigint } | null {
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\d+\/\d+)$/.test(value)) return null;
  if (value.includes("/")) {
    const [n, d] = value.split("/").map(BigInt);
    return d ? { n, d } : null;
  }
  const negative = value.startsWith("-"),
    parts = value.replace(/^[+-]/, "").split(".");
  return {
    n: BigInt(parts[0] + (parts[1] ?? "")) * (negative ? -1n : 1n),
    d: 10n ** BigInt(parts[1]?.length ?? 0),
  };
}
export function contentId(packageId: string, resource: string) {
  return (
    "content_" +
    createHash("sha256")
      .update(packageId + ":" + resource)
      .digest("hex")
      .slice(0, 32)
  );
}
export function validateContentPackage(input: unknown) {
  const result = contentPackageSchema.safeParse(input);
  if (!result.success)
    throw new HttpError(
      400,
      result.error.issues[0]?.message ?? "内容包格式无效。",
    );
  const pkg = result.data,
    keys = [
      ...pkg.course.chapters.map((c) => "chapter:" + c.key),
      ...pkg.course.chapters.flatMap((c) =>
        c.lessons.map((l) => "lesson:" + l.key),
      ),
      ...pkg.questions.map((q) => "question:" + q.key),
    ];
  if (new Set(keys).size !== keys.length)
    throw new HttpError(400, "内容包包含重复资源标识。");
  for (const q of pkg.questions) {
    const validLessons = new Set(
      pkg.course.chapters.flatMap((c) => c.lessons.map((l) => l.key)),
    );
    if (
      q.lessonKeys?.some((k) => !validLessons.has(k)) ||
      new Set(q.lessonKeys ?? []).size !== (q.lessonKeys ?? []).length
    )
      throw new HttpError(400, `题目 ${q.key} 的课时关联无效。`);
    if (!q.explanation.trim())
      throw new HttpError(400, `题目 ${q.key} 缺少解析。`);
    if (q.check.kind === "linear-equation") {
      const { left, right } = q.check,
        coefficient = left.a - right.a;
      if (!coefficient)
        throw new HttpError(400, `题目 ${q.key} 不是有唯一解的一元一次方程。`);
      const choices = q.options.map(rational);
      const matches = choices.flatMap((v, i) =>
        v && v.n * BigInt(coefficient) === BigInt(right.b - left.b) * v.d
          ? [i]
          : [],
      );
      if (matches.length !== 1 || matches[0] !== q.answer)
        throw new HttpError(400, `题目 ${q.key} 的选项与方程校验结果不一致。`);
    }
  }
  return pkg;
}
export async function importContentPackage(input: unknown) {
  const pkg = validateContentPackage(input),
    courseId = contentId(pkg.id, "course");
  return getDb().$transaction(async (tx) => {
    const existing = await tx.course.findUnique({ where: { id: courseId } });
    if (existing && existing.slug !== pkg.course.slug)
      throw new HttpError(
        409,
        "已有导入课程已改标识，请保留人工修改并检查包版本。",
      );
    if (!existing) {
      const { chapters, ...metadata } = pkg.course;
      const chapterData = chapters.map((c, position) => ({
        id: contentId(pkg.id, "chapter:" + c.key),
        title: c.title,
        position,
        lessons: {
          create: c.lessons.map((l, index) => ({
            id: contentId(pkg.id, "lesson:" + l.key),
            title: l.title,
            content: l.content,
            position: index,
          })),
        },
      }));
      await tx.course.create({
        data: {
          ...metadata,
          id: courseId,
          status: "DRAFT",
          chapters: { create: chapterData },
        },
      });
    }
    let createdQuestions = 0;
    for (const question of pkg.questions) {
      const id = contentId(pkg.id, "question:" + question.key);
      if (
        !(await tx.question.findUnique({ where: { id }, select: { id: true } }))
      ) {
        await tx.question.create({
          data: {
            id,
            title: question.title,
            options: question.options,
            answer: question.answer,
            explanation: question.explanation,
            knowledgePoint: question.knowledgePoint,
            difficulty: question.difficulty,
            grade: pkg.course.grade,
            subject: pkg.course.subject,
            status: "DRAFT",
            ...(question.diagram !== undefined
              ? { diagram: question.diagram ?? Prisma.DbNull }
              : {}),
            restrictToLessons: !!question.lessonKeys?.length,
            lessonLinks: {
              create: (question.lessonKeys ?? []).map((key, position) => ({
                lessonId: contentId(pkg.id, "lesson:" + key),
                position,
              })),
            },
          },
        });
        createdQuestions++;
      }
    }
    return {
      courseId,
      createdCourse: !existing,
      createdQuestions,
      skippedQuestions: pkg.questions.length - createdQuestions,
      packageLessonCount: pkg.course.chapters.reduce(
        (n, c) => n + c.lessons.length,
        0,
      ),
      status: existing?.status ?? "DRAFT",
    };
  });
}

export async function linkContentPackage(input: unknown) {
  const pkg = validateContentPackage(input),
    courseId = contentId(pkg.id, "course");
  return getDb().$transaction(async (tx) => {
    const course = await tx.course.findUnique({ where: { id: courseId } });
    if (!course || course.status !== "DRAFT")
      throw new HttpError(409, "仅为已导入的草稿课程补充关联。");
    let added = 0;
    for (const q of pkg.questions) {
      if (!q.lessonKeys?.length) continue;
      const questionId = contentId(pkg.id, "question:" + q.key),
        question = await tx.question.findUnique({
          where: { id: questionId },
          include: { _count: { select: { attempts: true } } },
        });
      if (!question || question.status !== "DRAFT" || question._count.attempts)
        throw new HttpError(
          409,
          "仅为未作答的草稿题补充关联，不修改已有正文。",
        );
      const lessonIds = q.lessonKeys.map((key) =>
        contentId(pkg.id, "lesson:" + key),
      );
      if (
        (await tx.lesson.count({
          where: { id: { in: lessonIds }, chapter: { courseId } },
        })) !== lessonIds.length
      )
        throw new HttpError(400, "课程课时已修改，请先核对关联。");
      added += (
        await tx.lessonQuestion.createMany({
          data: lessonIds.map((lessonId, position) => ({
            lessonId,
            questionId,
            position,
          })),
          skipDuplicates: true,
        })
      ).count;
      await tx.question.update({
        where: { id: questionId },
        data: { restrictToLessons: true },
      });
    }
    return { courseId, addedLinks: added };
  });
}
