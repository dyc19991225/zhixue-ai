import { getDb } from "../../lib/db";
import type { ReviewTransaction as Tx } from "./course-review.types";
import type { Prisma } from "../../generated/prisma/client";
const order = [{ submittedAt: "desc" as const }, { id: "desc" as const }];
export const reviewRepository = {
  transaction: <T>(work: (tx: Tx) => Promise<T>) => getDb().$transaction(work),
  lockActor: (tx: Tx, id: string) =>
    tx.$queryRaw`SELECT id FROM "User" WHERE id = ${id} FOR SHARE`,
  actor: (tx: Tx, id: string) => tx.user.findUnique({ where: { id } }),
  lockCourse: (tx: Tx, id: string) =>
    tx.$queryRaw`SELECT id FROM "Course" WHERE id = ${id} FOR UPDATE`,
  course: (tx: Tx, id: string) =>
    tx.course.findUnique({
      where: { id },
      include: {
        chapters: {
          orderBy: { position: "asc" },
          include: { lessons: { orderBy: { position: "asc" } } },
        },
      },
    }),
  latest: (tx: Tx, courseId: string) =>
    tx.courseReview.findFirst({ where: { courseId }, orderBy: order }),
  count: (tx: Tx, courseId: string) =>
    tx.courseReview.count({ where: { courseId } }),
  page: (tx: Tx, courseId: string, page: number, pageSize: number) =>
    tx.courseReview.findMany({
      where: { courseId },
      orderBy: order,
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  create: (tx: Tx, data: Prisma.CourseReviewUncheckedCreateInput) =>
    tx.courseReview.create({ data }),
  decide: (tx: Tx, id: string, data: Prisma.CourseReviewUpdateInput) =>
    tx.courseReview.update({ where: { id }, data }),
  setStatus: async (
    tx: Tx,
    id: string,
    status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
  ) => {
    await tx.lesson.updateMany({
      where: { chapter: { courseId: id } },
      data: { publishedAt: status === "PUBLISHED" ? new Date() : null },
    });
    return tx.course.update({ where: { id }, data: { status } });
  },
};
