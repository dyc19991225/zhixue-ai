import type { RelatedStudent } from "./relations";
import type { PageResult } from "./learning";
export type HomeworkStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type HomeworkItem = {
  id: string;
  classId: string;
  className: string;
  title: string;
  status: HomeworkStatus;
  dueAt: string;
  maxScore: number;
  updatedAt: string;
  submissionState: "NOT_SUBMITTED" | "SUBMITTED" | "GRADED";
};
export type HomeworkSubmissionView = {
  id: string;
  homeworkId: string;
  studentId: string;
  student: RelatedStudent;
  answerText: string;
  submittedAt: string;
  score: number | null;
  feedback: string | null;
  gradedAt: string | null;
  updatedAt: string;
};
export type HomeworkDetail = {
  homework: Omit<HomeworkItem, "submissionState"> & { instructions: string };
  submission: HomeworkSubmissionView | null;
};
export type HomeworkSubmissions = PageResult<HomeworkSubmissionView> & {
  recipientCount: number;
  gradedCount: number;
};
