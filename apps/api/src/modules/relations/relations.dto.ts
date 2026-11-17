import { z } from "zod";
import type { TeacherCourseRevision } from "@zhixue/shared";
import { gradeCodes } from "../../auth/validation";
import { courseListSchema } from "../../services/course-list.dto";
export { courseListSchema as relationPageSchema } from "../../services/course-list.dto";
export type { CourseListQuery as RelationPageQuery } from "../../services/course-list.dto";

const id = z.string().min(1).max(100);
const revisionTitle = z.string().trim().min(1).max(120);
export const teacherCourseRevisionSchema = z
  .object({
    updatedAt: z.iso.datetime(),
    title: revisionTitle,
    description: z.string().trim().max(2000),
    region: z.string().trim().max(120).nullable().optional(),
    textbookEdition: z.string().trim().max(300).nullable().optional(),
    term: z.string().trim().max(120).nullable().optional(),
    chapters: z
      .array(
        z
          .object({
            id,
            title: revisionTitle,
            lessons: z
              .array(
                z
                  .object({
                    id,
                    title: revisionTitle,
                    content: z.string().max(30000),
                  })
                  .strict(),
              )
              .max(50),
          })
          .strict(),
      )
      .max(30),
  })
  .strict()
  .superRefine((value, context) => {
    const chapters = value.chapters.map((ch) => ch.id),
      lessons = value.chapters.flatMap((ch) => ch.lessons.map((l) => l.id));
    if (
      new Set(chapters).size !== chapters.length ||
      new Set(lessons).size !== lessons.length
    )
      context.addIssue({
        code: "custom",
        message: "章节或课时不能重复。",
        path: ["chapters"],
      });
  });
export type TeacherRevision = TeacherCourseRevision;
export const teacherAssignmentSchema = z
  .object({ teacherId: id.nullable(), updatedAt: z.iso.datetime() })
  .strict();
export const classCreateSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .refine(
        (value) => !Array.from(value).some((c) => c.charCodeAt(0) < 32),
        "班级名称包含无效字符。",
      ),
    grade: z.enum(gradeCodes),
    teacherId: id.optional(),
  })
  .strict();
export const parentLinkSchema = z
  .object({ parentId: id, studentId: id })
  .strict();
export const emptySchema = z.object({}).strict();
export type TeacherAssignment = z.infer<typeof teacherAssignmentSchema>;
export type ClassCreate = z.infer<typeof classCreateSchema>;
export type ParentLinkInput = z.infer<typeof parentLinkSchema>;
export const memberUsernameSchema = z
  .object({
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_]{4,32}$/),
  })
  .strict();
export const parentLinksQuerySchema = courseListSchema
  .extend({ parentId: id.optional(), studentId: id.optional() })
  .strict();
export type ParentLinksQuery = z.infer<typeof parentLinksQuerySchema>;
