import { api } from "@/lib/api";
import type {
  ExamAnswer,
  ExamAttemptView,
  ExamCreateInput,
  ExamDetail,
  ExamStatus,
  ExamUpdateInput,
  ExamTemplatePreview,
} from "@zhixue/shared";
const id = encodeURIComponent;
export const examApi = {
  previewTemplate: (input: unknown) =>
    api<ExamTemplatePreview>("/api/exams/template-preview", "POST", input),
  create: (input: ExamCreateInput) =>
    api<ExamDetail>("/api/exams", "POST", input),
  update: (examId: string, input: ExamUpdateInput) =>
    api(`/api/exams/${id(examId)}`, "PUT", input),
  status: (
    examId: string,
    status: Exclude<ExamStatus, "DRAFT">,
    updatedAt: string,
  ) => api(`/api/exams/${id(examId)}/status`, "PATCH", { status, updatedAt }),
  start: (examId: string) =>
    api<ExamAttemptView>(`/api/exams/${id(examId)}/attempt/start`, "POST", {}),
  attempt: (examId: string) =>
    api<ExamAttemptView>(`/api/exams/${id(examId)}/attempt`),
  save: (
    examId: string,
    revision: number,
    answers: ExamAnswer[],
    requestId: string,
  ) =>
    api<ExamAttemptView>(`/api/exams/${id(examId)}/attempt/answers`, "PUT", {
      revision,
      answers,
      requestId,
    }),
  submit: (examId: string, revision: number, requestId: string) =>
    api<ExamAttemptView>(`/api/exams/${id(examId)}/attempt/submit`, "POST", {
      revision,
      requestId,
    }),
};
