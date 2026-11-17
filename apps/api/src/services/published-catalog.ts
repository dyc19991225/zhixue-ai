import { z } from "zod";
import { subjectsForGrade } from "@zhixue/shared";
import { getDb } from "../lib/db";
import { Prisma } from "../generated/prisma/client";
import { publishedOutline } from "../repositories/course-repository";
import { courseListSchema } from "./course-list.dto";

export const publishedCatalogSchema = courseListSchema
  .extend({
    pageSize: z.coerce.number().int().min(1).max(100).default(100),
    grade: z.enum(["G7", "G8", "G9", "G10", "G11", "G12"]).optional(),
    subject: z.string().trim().min(1).max(30).optional(),
    q: z.string().trim().max(120).optional(),
    region: z.string().trim().min(1).max(120).optional(),
    textbookEdition: z.string().trim().min(1).max(300).optional(),
    term: z.string().trim().min(1).max(120).optional(),
    access: z.enum(["FREE", "MEMBER"]).optional(),
  })
  .strict();
export type PublishedCatalogQuery = z.infer<typeof publishedCatalogSchema>;

export function publishedCatalog(query: PublishedCatalogQuery) {
  const { page, pageSize, q, subject, ...metadata } = query;
  const base: Prisma.CourseWhereInput = {
    status: "PUBLISHED",
    ...(metadata.grade ? { grade: metadata.grade } : {}),
  };
  const names = [...subjectsForGrade("七年级"), ...subjectsForGrade("高一")];
  const matchingSubjects = q
    ? [...new Set(names.filter((s) => s.name.includes(q)).map((s) => s.id))]
    : [];
  const acrossSubjects: Prisma.CourseWhereInput = {
    ...base,
    ...metadata,
    ...(q
      ? {
          OR: [
            { title: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            ...(matchingSubjects.length
              ? [{ subject: { in: matchingSubjects } }]
              : []),
          ],
        }
      : {}),
  };
  const where = { ...acrossSubjects, ...(subject ? { subject } : {}) };
  return getDb().$transaction(
    async (tx) => {
      const [total, items, regions, editions, terms, counts] =
        await Promise.all([
          tx.course.count({ where }),
          tx.course.findMany({
            where,
            skip: (page - 1) * pageSize,
            take: pageSize,
            orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
            select: {
              id: true,
              slug: true,
              title: true,
              grade: true,
              subject: true,
              description: true,
              region: true,
              textbookEdition: true,
              term: true,
              access: true,
              status: true,
              updatedAt: true,
              chapters: publishedOutline.chapters,
            },
          }),
          tx.course.groupBy({
            by: ["region"],
            where: { ...base, region: { not: null } },
            orderBy: { region: "asc" },
          }),
          tx.course.groupBy({
            by: ["textbookEdition"],
            where: { ...base, textbookEdition: { not: null } },
            orderBy: { textbookEdition: "asc" },
          }),
          tx.course.groupBy({
            by: ["term"],
            where: { ...base, term: { not: null } },
            orderBy: { term: "asc" },
          }),
          tx.course.groupBy({
            by: ["subject"],
            where: acrossSubjects,
            _count: { _all: true },
          }),
        ]);
      return {
        page,
        pageSize,
        total,
        items,
        facets: {
          regions: regions.flatMap((r) => (r.region?.trim() ? [r.region] : [])),
          textbookEditions: editions.flatMap((r) =>
            r.textbookEdition?.trim() ? [r.textbookEdition] : [],
          ),
          terms: terms.flatMap((r) => (r.term?.trim() ? [r.term] : [])),
        },
        subjectCounts: Object.fromEntries(
          counts.map((c) => [c.subject, c._count._all]),
        ),
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 20000,
    },
  );
}
