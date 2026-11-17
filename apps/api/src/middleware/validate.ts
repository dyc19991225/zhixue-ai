import type { RequestHandler } from "express";
import type { z } from "zod";
import { parseInput } from "../auth/validation";

export function validate<T>(
  schema: z.ZodType<T>,
  source: "body" | "query" = "body",
): RequestHandler {
  return (request, response, next) => {
    response.locals.input = parseInput(schema, request[source]);
    next();
  };
}
