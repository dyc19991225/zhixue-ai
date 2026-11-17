import { z } from "zod";
import { courseListSchema } from "../../services/course-list.dto";
export const analyticsQuerySchema = courseListSchema
  .extend({ pageSize: z.coerce.number().int().min(1).max(20).default(10) })
  .strict();
export const emptyQuerySchema = z.object({}).strict();
export const trendQuerySchema = z
  .object({
    days: z.coerce
      .number()
      .pipe(z.union([z.literal(7), z.literal(30)]))
      .default(7),
  })
  .strict();
export type TrendQuery = z.infer<typeof trendQuerySchema>;
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
