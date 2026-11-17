import type { Response } from "express";
import type { ApiResponse } from "@zhixue/shared";
export function ok<T>(response: Response, data: T, message = "ok") {
  return response.json({ code: 0, message, data } satisfies ApiResponse<T>);
}
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
export { AppError as HttpError };
