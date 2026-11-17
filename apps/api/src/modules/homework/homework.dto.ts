import { z } from "zod";
import { courseListSchema } from "../../services/course-list.dto";
export const homeworkCreateSchema = z
  .object({
    classId: z.string().min(1).max(100),
    title: z.string().trim().min(1).max(120),
    instructions: z.string().trim().min(1).max(30000),
    maxScore: z.number().int().min(1).max(1000),
    dueAt: z.iso.datetime(),
  })
  .strict();
export const homeworkUpdateSchema = homeworkCreateSchema
  .omit({ classId: true })
  .extend({ updatedAt: z.iso.datetime() })
  .strict();
export const homeworkStatusSchema = z
  .object({
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const homeworkQuerySchema = courseListSchema
  .extend({ classId: z.string().min(1).max(100).optional() })
  .strict();
export const homeworkSubmitSchema = z
  .object({
    answerText: z.string().trim().min(1).max(30000),
    requestId: z.uuid(),
  })
  .strict();
export const homeworkGradeSchema = z
  .object({
    score: z.number().int().min(0).max(1000),
    feedback: z.string().trim().min(1).max(12000),
    updatedAt: z.iso.datetime(),
    requestId: z.uuid(),
  })
  .strict();
export { courseListSchema as homeworkPageSchema };
export type HomeworkCreate = z.infer<typeof homeworkCreateSchema>;
export type HomeworkUpdate = z.infer<typeof homeworkUpdateSchema>;
export type HomeworkStatusInput = z.infer<typeof homeworkStatusSchema>;
export type HomeworkQuery = z.infer<typeof homeworkQuerySchema>;
export type HomeworkSubmit = z.infer<typeof homeworkSubmitSchema>;
export type HomeworkGrade = z.infer<typeof homeworkGradeSchema>;
