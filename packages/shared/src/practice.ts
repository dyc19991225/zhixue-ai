import type { GradeCode } from "./auth";
export const subjectOptions = [
  { value: "chinese", label: "语文" },
  { value: "math", label: "数学" },
  { value: "english", label: "英语" },
  { value: "physics", label: "物理" },
  { value: "chemistry", label: "化学" },
  { value: "biology", label: "生物" },
  { value: "history", label: "历史" },
  { value: "geography", label: "地理" },
  { value: "civics", label: "道德与法治" },
  { value: "politics", label: "思想政治" },
];
export const difficultyOptions = [
  { value: "EASY", label: "基础" },
  { value: "MEDIUM", label: "巩固" },
  { value: "HARD", label: "提高" },
];
export type QuestionView = {
  id: string;
  title: string;
  grade: GradeCode;
  subject: string;
  knowledgePoint: string;
  difficulty: string;
  options: string[];
  updatedAt: string;
  diagram?: import("./diagram").QuestionDiagram | null;
};
export type QuestionEdit = QuestionView & {
  lessonLinks?: { lessonId: string }[];
  lessonIds?: string[];
  answer: number;
  explanation: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  _count?: { attempts: number };
};
export type QuestionReviewView = Omit<QuestionEdit, "lessonLinks"> & {
  restrictToLessons: boolean;
  lessonLinks: {
    lessonId: string;
    lesson: {
      title: string;
      publishedAt: string | null;
      chapter: {
        title: string;
        course: {
          title: string;
          status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
          access: "FREE" | "MEMBER";
        };
      };
    };
  }[];
};
export type AttemptView = {
  id: string;
  questionId: string;
  selected: number;
  correct: boolean;
  createdAt: string;
  snapshot: {
    title: string;
    options: string[];
    answer: number;
    explanation: string;
    diagram?: import("./diagram").QuestionDiagram | null;
  };
};
export type WrongQuestionView = {
  id: string;
  wrongCount: number;
  lastWrongAt: string;
  resolvedAt: string | null;
  question: QuestionView;
};
export type PageData<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};
