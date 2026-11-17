import type { RelatedStudent } from "./relations";
import type { PageResult } from "./learning";
export type TrendDay = {
  date: string;
  completedLessons: number;
  attempts: number;
  correctAttempts: number;
  homeworkSubmitted: number;
  examsSubmitted: number;
  accuracyPercent: number | null;
};
export type AnalyticsTrend = {
  days: 7 | 30;
  timezone: "Asia/Shanghai";
  generatedAt: string;
  scope: "student" | "class";
  list: TrendDay[];
};
export type AnalyticsExport = {
  fileName: string;
  contentType: "text/csv;charset=utf-8";
  csv: string;
  generatedAt: string;
};
export type AssessmentSummary = {
  homeworkAssigned: number;
  homeworkSubmitted: number;
  homeworkGraded: number;
  homeworkScorePercent: number | null;
  examsAssigned: number;
  examsSubmitted: number;
  examsReleased: number;
  examScorePercent: number | null;
};
export type LearningAnalytics = {
  student: RelatedStudent;
  generatedAt: string;
  learning: {
    courses: number;
    completedLessons: number;
    attempts: number;
    correctAttempts: number;
    unresolvedWrongQuestions: number;
    accuracyPercent: number | null;
  };
  assessments: AssessmentSummary;
};
export type ClassAnalytics = PageResult<{
  student: RelatedStudent;
  assessments: AssessmentSummary;
}> & { className: string; generatedAt: string };
