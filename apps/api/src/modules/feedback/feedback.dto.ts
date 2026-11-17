import { z } from "zod";
import {
  feedbackAreas,
  feedbackSeverities,
  feedbackStatuses,
} from "@zhixue/shared";
export const submitSchema = z
  .object({
    requestId: z.uuid(),
    area: z.enum(feedbackAreas),
    severity: z.enum(feedbackSeverities),
    detail: z.string().trim().min(5).max(3000),
  })
  .strict();
export const listSchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    status: z.enum(feedbackStatuses).optional(),
  })
  .strict();
export const updateSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    status: z.enum(["IN_PROGRESS", "RESOLVED", "CLOSED"]),
    reply: z.string().trim().min(5).max(2000),
  })
  .strict();
