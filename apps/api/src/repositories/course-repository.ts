import type { Grade } from "@zhixue/shared";
import { getDb } from "../lib/db";
import type { CourseListQuery } from "../services/course-list.dto";
export const outline = {
  chapters: {
    orderBy: { position: "asc" as const },
    include: {
      lessons: {
        orderBy: { position: "asc" as const },
        select: { id: true, title: true, position: true },
      },
    },
  },
};
export const publishedOutline = {
  chapters: {
    ...outline.chapters,
    include: {
      lessons: {
        ...outline.chapters.include.lessons,
        where: { publishedAt: { not: null } },
      },
    },
  },
};
export async function adminCoursePage({ page, pageSize }: CourseListQuery) {
  const db = getDb();
  const [total, list] = await db.$transaction([
    db.course.count(),
    db.course.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: outline,
    }),
  ]);
  return { page, pageSize, total, list };
}
const databaseGrades = {
  七年级: "G7",
  八年级: "G8",
  九年级: "G9",
  高一: "G10",
  高二: "G11",
  高三: "G12",
} as const;
export async function listPublishedCourses(grade: Grade) {
  return getDb().course.findMany({
    where: { grade: databaseGrades[grade], status: "PUBLISHED" },
    select: { id: true, slug: true, title: true, subject: true, access: true },
    orderBy: { title: "asc" },
    take: 100,
  });
}
