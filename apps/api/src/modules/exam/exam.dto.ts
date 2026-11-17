import { z } from "zod";
import type { ExamCreateInput, ExamUpdateInput } from "@zhixue/shared";
import { courseListSchema } from "../../services/course-list.dto";
import { diagramSchema } from "../../services/diagram-validation";
const id = z.string().min(1).max(100);
const points = z.number().int().min(1).max(1000);
export const manualQuestionSchema = z
  .object({
    source: z.literal("MANUAL"),
    title: z.string().trim().min(1).max(6000),
    options: z
      .array(z.string().trim().min(1).max(1000))
      .length(4)
      .refine((items) => new Set(items).size === 4, "选项不能重复。"),
    answer: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(1).max(12000),
    points,
    diagram: diagramSchema.nullable().optional(),
  })
  .strict();
const bankQuestionSchema = z
  .object({ source: z.literal("BANK"), questionId: id, points })
  .strict();
export const examTemplateSchema = z
  .object({
    status: z.literal("UNBOUND_DRAFT_TEMPLATE"),
    requiredBeforeUse: z.tuple([
      z.literal("classId"),
      z.literal("opensAt"),
      z.literal("closesAt"),
    ]),
    payload: z
      .object({
        title: z.string().trim().min(1).max(120),
        durationMinutes: z.number().int().min(1).max(180),
        questions: z.array(manualQuestionSchema).min(1).max(50),
      })
      .strict(),
  })
  .strict();
export type ExamTemplate = z.infer<typeof examTemplateSchema>;
const fields = z
  .object({
    title: z.string().trim().min(1).max(120),
    opensAt: z.iso.datetime(),
    closesAt: z.iso.datetime(),
    durationMinutes: z.number().int().min(1).max(180),
    questions: z
      .array(
        z.discriminatedUnion("source", [
          manualQuestionSchema,
          bankQuestionSchema,
        ]),
      )
      .min(1)
      .max(50),
  })
  .strict();
const timeOrder = (value: { opensAt: string; closesAt: string }) =>
  Date.parse(value.closesAt) > Date.parse(value.opensAt);
export const examCreateSchema = fields
  .extend({ classId: id })
  .strict()
  .refine(timeOrder, "结束时间必须晚于开始时间。");
export const examUpdateSchema = fields
  .extend({ updatedAt: z.iso.datetime() })
  .strict()
  .refine(timeOrder, "结束时间必须晚于开始时间。");
export const examStatusSchema = z
  .object({
    status: z.enum(["PUBLISHED", "CLOSED", "ARCHIVED"]),
    updatedAt: z.iso.datetime(),
  })
  .strict();
export const examQuerySchema = courseListSchema
  .extend({ classId: id.optional() })
  .strict();
export const bankQuerySchema = courseListSchema
  .extend({ classId: id, q: z.string().trim().max(80).default("") })
  .strict();
export const answerPairsSchema = z
  .array(
    z
      .object({
        questionId: id,
        selected: z.number().int().min(0).max(3).nullable(),
      })
      .strict(),
  )
  .max(50)
  .refine(
    (items) => new Set(items.map((i) => i.questionId)).size === items.length,
    "题目不能重复。",
  );
export const saveAnswersSchema = z
  .object({
    revision: z.number().int().min(0),
    requestId: z.uuid(),
    answers: answerPairsSchema,
  })
  .strict();
export const submitExamSchema = z
  .object({ revision: z.number().int().min(0), requestId: z.uuid() })
  .strict();
export const startExamSchema = z.object({}).strict();
export { courseListSchema as examPageSchema };
export type ExamCreate = ExamCreateInput;
export type ExamUpdate = ExamUpdateInput;
export type ExamQuery = z.infer<typeof examQuerySchema>;
export type BankQuery = z.infer<typeof bankQuerySchema>;
export type ExamStatusInput = z.infer<typeof examStatusSchema>;
export type SaveAnswers = z.infer<typeof saveAnswersSchema>;
export type SubmitExam = z.infer<typeof submitExamSchema>;
export type AnswerPairs = z.infer<typeof answerPairsSchema>;
