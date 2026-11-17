import { z } from "zod";
import { gradeCodes } from "../auth/validation";
import { diagramSchema } from "./diagram-validation";
export const subjects = [
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
] as const;
const text = (max: number) => z.string().trim().max(max);
export const questionSchema = z
  .object({
    title: text(6000).min(1),
    grade: z.enum(gradeCodes),
    subject: z.enum(subjects),
    knowledgePoint: text(80),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]),
    options: z
      .array(text(1000).min(1))
      .length(4)
      .refine((items) => new Set(items).size === 4, "四个选项不能相同。"),
    answer: z.number().int().min(0).max(3),
    explanation: text(12000),
    diagram: diagramSchema.nullable().optional(),
    lessonIds: z
      .array(z.string().min(1).max(100))
      .max(30)
      .refine((ids) => new Set(ids).size === ids.length, "课时不能重复。")
      .optional(),
  })
  .strict();
export const questionUpdateSchema = questionSchema
  .extend({ updatedAt: z.iso.datetime() })
  .strict();
export const questionStatusSchema = z
  .object({
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
    updatedAt: z.iso.datetime(),
  })
  .strict();
const page = z.coerce.number().int().min(1).max(10000).default(1);
export const practiceQuerySchema = z
  .object({
    q: z.string().trim().min(2).max(120).optional(),
    grade: z.enum(gradeCodes).optional(),
    subject: z.enum(subjects).optional(),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).optional(),
    knowledgePoint: text(80).optional(),
    page,
  })
  .strict();
export const wrongQuerySchema = z
  .object({
    grade: z.enum(gradeCodes).optional(),
    subject: z.enum(subjects).optional(),
    state: z.enum(["active", "resolved"]).default("active"),
    page,
  })
  .strict();
export const adminQuestionQuerySchema = practiceQuerySchema
  .extend({
    lessonId: z.string().min(1).max(100).optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  })
  .strict();
export const pageSchema = z.object({ page }).strict();
export const attemptSchema = z
  .object({
    selected: z.number().int().min(0).max(3),
    requestId: z.uuid(),
    updatedAt: z.iso.datetime(),
  })
  .strict();
