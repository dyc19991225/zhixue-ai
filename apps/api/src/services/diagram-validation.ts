import { z } from "zod";
const label = z.string().trim().min(1).max(35),
  base = {
    alt: z.string().trim().min(5).max(400),
    note: z.string().trim().max(60),
  };
export const diagramSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...base,
      kind: z.literal("rectangle"),
      widthLabel: label,
      heightLabel: label,
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("segment"),
      leftLabel: label,
      rightLabel: label,
      totalLabel: label,
    })
    .strict(),
  z
    .object({
      ...base,
      kind: z.literal("adjacent-angles"),
      knownAngle: z.number().min(10).max(170),
      unknownLabel: label,
    })
    .strict(),
]);
