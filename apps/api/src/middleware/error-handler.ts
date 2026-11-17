import type { ErrorRequestHandler } from "express";
import { HttpError } from "../lib/http";
export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  if (
    error &&
    typeof error === "object" &&
    "type" in error &&
    ["entity.parse.failed", "entity.too.large"].includes(String(error.type))
  ) {
    const status = error.type === "entity.too.large" ? 413 : 400;
    response
      .status(status)
      .json({
        code: status,
        message: status === 413 ? "提交内容过大。" : "提交内容格式无效。",
        data: null,
      });
    return;
  }
  const status = error instanceof HttpError ? error.status : 500;
  const message =
    error instanceof HttpError ? error.message : "服务暂时异常，请稍后再试。";
  // 不把数据库连接、堆栈、原始异常或环境变量返回给浏览器。
  response.status(status).json({ code: status, message, data: null });
};
