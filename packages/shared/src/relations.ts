import type { GradeCode } from "./auth";
import type { Role } from "./auth";
import type { CourseView } from "./learning";
export type AccountOption = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
};
export type ParentLinkView = {
  parentId: string;
  studentId: string;
  createdAt: string;
  parent: Pick<AccountOption, "id" | "username" | "displayName">;
  student: Pick<AccountOption, "id" | "username" | "displayName">;
};
export type TeacherCourseDetail = Omit<CourseView, "chapters"> & {
  chapters: {
    id: string;
    title: string;
    position: number;
    lessons: {
      id: string;
      title: string;
      position: number;
      content: string | null;
    }[];
  }[];
};
export type TeacherCourseRevision = Pick<
  CourseView,
  "title" | "region" | "textbookEdition" | "term" | "updatedAt"
> & {
  description: string;
  chapters: {
    id: string;
    title: string;
    lessons: { id: string; title: string; content: string }[];
  }[];
};
export type ClassView = {
  id: string;
  name: string;
  grade: GradeCode;
  teacherId: string;
  createdAt: string;
};
export type RelatedStudent = {
  id: string;
  displayName: string;
  grade: GradeCode;
};
export type StudentOverview = {
  student: RelatedStudent;
  courses: number;
  completedLessons: number;
  attempts: number;
  correctAttempts: number;
  unresolvedWrongQuestions: number;
};
export type TeacherAssignmentResult = {
  id: string;
  ownerTeacherId: string | null;
  updatedAt: string;
};
