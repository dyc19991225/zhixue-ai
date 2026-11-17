import { z } from "zod";

export const courseListSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(10),
  })
  .strict();
export type CourseListQuery = z.infer<typeof courseListSchema>;
