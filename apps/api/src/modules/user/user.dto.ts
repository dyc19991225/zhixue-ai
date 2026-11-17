import { z } from "zod";
import { roles } from "@zhixue/shared";

export const roleUpdateSchema = z
  .object({ role: z.enum(roles), updatedAt: z.iso.datetime() })
  .strict();
export type RoleUpdate = z.infer<typeof roleUpdateSchema>;
export const userOptionsSchema = z
  .object({
    role: z.enum(roles),
    q: z.string().trim().max(80).default(""),
    id: z.string().max(100).optional(),
  })
  .strict();
export type UserOptionsQuery = z.infer<typeof userOptionsSchema>;
