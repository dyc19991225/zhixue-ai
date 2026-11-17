import { z } from "zod";
import { courseListSchema } from "../../services/course-list.dto";
export const reviewQueueSchema = courseListSchema
  .extend({ pageSize: z.coerce.number().int().min(1).max(20).default(5) })
  .strict();
export { courseListSchema as reviewPageSchema } from "../../services/course-list.dto";
export const reviewSubmitSchema = z
  .object({ updatedAt: z.iso.datetime() })
  .strict();
const common = {
  reviewId: z.string().min(1).max(100),
  updatedAt: z.iso.datetime(),
  feedback: z.string().trim().min(10).max(2000),
};
export const reviewDecisionSchema = z.discriminatedUnion("status", [
  z
    .object({
      ...common,
      status: z.literal("APPROVED"),
      checks: z
        .object({
          accuracy: z.literal(true),
          alignment: z.literal(true),
          rights: z.literal(true),
          readability: z.literal(true),
        })
        .strict(),
    })
    .strict(),
  z.object({ ...common, status: z.literal("RETURNED") }).strict(),
]);
export const courseStatusSchema = z
  .object({ status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]) })
  .strict();
export type ReviewSubmit = z.infer<typeof reviewSubmitSchema>;
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;
