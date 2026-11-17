import { api } from "@/lib/api";
import type {
  GradeCode,
  TeacherAssignmentResult,
  TeacherCourseRevision,
  TeacherCourseDetail,
} from "@zhixue/shared";
const id = encodeURIComponent;
export const relationsApi = {
  reviseCourse: (courseId: string, input: TeacherCourseRevision) =>
    api<TeacherCourseDetail>(
      `/api/teacher/courses/${id(courseId)}/content`,
      "PUT",
      input,
    ),
  createClass: (input: {
    name: string;
    grade: GradeCode;
    teacherId?: string;
  }) => api("/api/classes", "POST", input),
  addStudent: (classId: string, username: string) =>
    api(`/api/classes/${id(classId)}/students`, "POST", { username }),
  removeStudent: (classId: string, studentId: string) =>
    api(`/api/classes/${id(classId)}/students/${id(studentId)}`, "DELETE"),
  archiveClass: (classId: string) =>
    api(`/api/classes/${id(classId)}`, "DELETE"),
  bind: (input: { parentId: string; studentId: string }) =>
    api("/api/admin/parent-links", "POST", input),
  unbind: (parentId: string, studentId: string) =>
    api(`/api/admin/parent-links/${id(parentId)}/${id(studentId)}`, "DELETE"),
  assignTeacher: (
    courseId: string,
    teacherId: string | null,
    updatedAt: string,
  ) =>
    api<TeacherAssignmentResult>(
      `/api/admin/courses/${id(courseId)}/teacher`,
      "PUT",
      { teacherId, updatedAt },
    ),
};
