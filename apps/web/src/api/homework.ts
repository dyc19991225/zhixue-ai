import { api } from "@/lib/api";
import type { HomeworkSubmissionView, HomeworkStatus } from "@zhixue/shared";
const key = encodeURIComponent;
export const homeworkApi = {
  create: (input: {
    classId: string;
    title: string;
    instructions: string;
    dueAt: string;
    maxScore: number;
  }) => api("/api/homework", "POST", input),
  update: (
    id: string,
    input: {
      title: string;
      instructions: string;
      dueAt: string;
      maxScore: number;
      updatedAt: string;
    },
  ) => api(`/api/homework/${key(id)}`, "PUT", input),
  status: (id: string, status: HomeworkStatus, updatedAt: string) =>
    api(`/api/homework/${key(id)}/status`, "PATCH", { status, updatedAt }),
  submit: (id: string, answerText: string, requestId: string) =>
    api<HomeworkSubmissionView>(
      `/api/homework/${key(id)}/submissions`,
      "POST",
      { answerText, requestId },
    ),
  grade: (
    id: string,
    submissionId: string,
    input: {
      score: number;
      feedback: string;
      updatedAt: string;
      requestId: string;
    },
  ) =>
    api<HomeworkSubmissionView>(
      `/api/homework/${key(id)}/submissions/${key(submissionId)}/grade`,
      "POST",
      input,
    ),
};
