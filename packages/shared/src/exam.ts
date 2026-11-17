import type { QuestionDiagram } from "./diagram";
import type { PageResult } from "./learning";
export type ExamStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "ARCHIVED";
export type ExamQuestionDraft =
  | { source: "BANK"; questionId: string; points: number }
  | {
      source: "MANUAL";
      title: string;
      options: string[];
      answer: number;
      explanation: string;
      points: number;
      diagram?: QuestionDiagram | null;
    };
export type ExamDraftFields = {
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  questions: ExamQuestionDraft[];
};
export type ExamCreateInput = ExamDraftFields & { classId: string };
export type ExamTemplatePayload = Pick<
  ExamDraftFields,
  "title" | "durationMinutes"
> & {
  questions: Extract<ExamQuestionDraft, { source: "MANUAL" }>[];
};
export type ExamTemplatePreview = ExamTemplatePayload & { totalPoints: number };
export type ExamUpdateInput = ExamDraftFields & { updatedAt: string };
export type ExamItem = {
  id: string;
  classId: string;
  className: string;
  title: string;
  opensAt: string;
  closesAt: string;
  durationMinutes: number;
  status: ExamStatus;
  updatedAt: string;
  questionCount: number;
  totalPoints: number;
  attemptState: "NOT_STARTED" | "STARTED" | "SUBMITTED";
};
export type ExamPublicQuestion = {
  id: string;
  title: string;
  options: string[];
  points: number;
  diagram?: QuestionDiagram | null;
  answer?: number;
  explanation?: string;
};
export type ExamTeacherQuestion = ExamPublicQuestion & {
  answer: number;
  explanation: string;
  sourceQuestionId: string | null;
};
export type ExamDetail = Omit<ExamItem, "attemptState"> & {
  attemptState?: ExamItem["attemptState"];
  questions?: ExamTeacherQuestion[];
};
export type ExamAnswer = { questionId: string; selected: number | null };
export type ExamAttemptView = {
  id: string;
  examId: string;
  title: string;
  startedAt: string;
  expiresAt: string;
  serverNow: string;
  revision: number;
  submittedAt: string | null;
  submissionReason: string | null;
  released: boolean;
  totalPoints: number;
  score: number | null;
  correctCount: number | null;
  answers: ExamAnswer[];
  questions: ExamPublicQuestion[];
};
export type ExamBankOption = {
  id: string;
  title: string;
  options: string[];
  diagram?: QuestionDiagram | null;
  knowledgePoint: string;
};
export type ExamResultRow = {
  id: string;
  student: { id: string; displayName: string };
  startedAt: string;
  submittedAt: string | null;
  score: number | null;
  correctCount: number | null;
  submissionReason: string | null;
};
export type ExamResults = PageResult<ExamResultRow> & {
  recipientCount: number;
  submittedCount: number;
  averageScore: number | null;
  highestScore: number | null;
  lowestScore: number | null;
  questionStats: {
    questionId: string;
    title: string;
    answered: number;
    correct: number;
    total: number;
  }[];
};
