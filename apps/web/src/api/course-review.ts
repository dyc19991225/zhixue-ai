import type { CourseReviewDecision, CourseReviewRecord } from "@zhixue/shared";
import { api } from "@/lib/api";
export const courseReviewApi = {
  submit: (id: string, updatedAt: string) =>
    api<CourseReviewRecord>(
      `/api/courses/${encodeURIComponent(id)}/reviews`,
      "POST",
      { updatedAt },
    ),
  decide: (id: string, input: CourseReviewDecision) =>
    api<CourseReviewRecord>(
      `/api/courses/${encodeURIComponent(id)}/reviews/decision`,
      "POST",
      input,
    ),
};
