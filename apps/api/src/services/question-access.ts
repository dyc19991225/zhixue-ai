import type { Prisma } from "../generated/prisma/client";
import { hasMembership } from "./entitlement-service";
export async function questionVisibility(
  userId?: string,
): Promise<Prisma.QuestionWhereInput> {
  const courses: Prisma.CourseWhereInput[] = [
    { status: "PUBLISHED", access: "FREE" },
  ];
  if (userId && (await hasMembership(userId)))
    courses.push({
      status: "PUBLISHED",
      access: "MEMBER",
      enrollments: { some: { userId } },
    });
  return {
    OR: [
      { restrictToLessons: false, lessonLinks: { none: {} } },
      {
        lessonLinks: {
          some: {
            lesson: {
              publishedAt: { not: null },
              chapter: { course: { OR: courses } },
            },
          },
        },
      },
    ],
  };
}
