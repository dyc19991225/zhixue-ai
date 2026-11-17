import type { GradeCode } from "./auth";
export type ContentReadinessRow = {
  subject: string;
  subjectLabel: string;
  publishedCourses: number;
  draftCourses: number;
  publishedQuestions: number;
  draftQuestions: number;
  publicQuestions: number;
  openLessons: number;
  lessonsWithoutPractice: number;
};
export type ContentReadiness = {
  grade: GradeCode;
  generatedAt: string;
  rows: ContentReadinessRow[];
};
