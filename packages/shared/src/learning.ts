import type { GradeCode } from "./auth";
export type PageResult<T> = {
  page: number;
  pageSize: number;
  total: number;
  list: T[];
};
export type CoursePage = PageResult<CourseView>;
export type PublishedCatalog = {
  items: CourseView[];
  page: number;
  pageSize: number;
  total: number;
  facets: { regions: string[]; textbookEditions: string[]; terms: string[] };
  subjectCounts: Record<string, number>;
};
export type LessonOutline = { id: string; title: string; position: number };
export type CourseView = {
  ownerTeacherId?: string | null;
  id: string;
  slug: string;
  title: string;
  grade: GradeCode;
  subject: string;
  description: string | null;
  region?: string | null;
  textbookEdition?: string | null;
  term?: string | null;
  access: "FREE" | "MEMBER";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  updatedAt: string;
  chapters: {
    id: string;
    title: string;
    position: number;
    lessons: LessonOutline[];
  }[];
};
export type CourseEdit = Omit<CourseView, "chapters"> & {
  chapters: {
    id?: string;
    title: string;
    lessons: {
      id?: string;
      title: string;
      content: string;
      mediaId?: string | null;
    }[];
  }[];
};
export type LearningView = {
  positions: Record<string, number>;
  course: CourseView;
  completedIds: string[];
  nextLessonId: string | null;
  total: number;
};
export type LibraryState = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED";
export type LearningLibrary = {
  page: number;
  pageSize: number;
  total: number;
  counts: {
    all: number;
    notStarted: number;
    inProgress: number;
    completed: number;
  };
  items: {
    courseId: string;
    title: string;
    grade: GradeCode;
    subject: string;
    access: "FREE" | "MEMBER";
    totalLessons: number;
    completedLessons: number;
    state: LibraryState;
    lastStudiedAt: string | null;
    nextLessonId: string | null;
    canStudy: boolean;
  }[];
};

export type LearningReviewQueue = {
  page: number;
  pageSize: number;
  total: number;
  items: {
    courseId: string;
    title: string;
    grade: GradeCode;
    subject: string;
    wrongCount: number;
    lessons: { lessonId: string; title: string; wrongCount: number }[];
  }[];
};

export type LearningReviewNext = {
  currentPending: number | null;
  next: {
    courseId: string;
    lessonId: string;
    courseTitle: string;
    lessonTitle: string;
    wrongCount: number;
  } | null;
};
