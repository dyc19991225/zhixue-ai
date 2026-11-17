import { grades, subjectsForGrade, type Grade } from "@zhixue/shared";
import { HttpError } from "../lib/http";
export function requireGrade(value: unknown): Grade {
  if (typeof value !== "string" || !grades.includes(value as Grade))
    throw new HttpError(400, "请选择有效的年级。");
  return value as Grade;
}
export function getPreviewCatalog(grade: Grade) {
  return { mode: "preview" as const, grade, subjects: subjectsForGrade(grade) };
}
