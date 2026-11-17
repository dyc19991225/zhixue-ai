export type LessonReadinessItem = {
  id: string;
  title: string;
  chapterTitle: string;
  courseId: string;
  courseTitle: string;
  grade: import("./auth").GradeCode;
  subject: string;
  access: "FREE" | "MEMBER";
  publishedQuestions: number;
  draftQuestions: number;
  archivedQuestions: number;
};
export type LessonReadinessPage = {
  items: LessonReadinessItem[];
  total: number;
  page: number;
  pageSize: number;
};
