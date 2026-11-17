export type GradeCode = "G7" | "G8" | "G9" | "G10" | "G11" | "G12";
export const roles = ["ADMIN", "TEACHER", "STUDENT", "PARENT"] as const;
export type Role = (typeof roles)[number];
export const roleLabels: Record<Role, string> = {
  ADMIN: "管理员",
  TEACHER: "教师",
  STUDENT: "学生",
  PARENT: "家长",
};
export const roleOptions = roles.map((value) => ({
  value,
  label: roleLabels[value],
}));
export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  grade: GradeCode;
  role: Role;
  status: "ACTIVE" | "DISABLED";
  createdAt: string;
  updatedAt: string;
};
export type AuthResult = {
  user: AuthUser | null;
  accessToken: string | null;
  recoveryCode?: string;
};
export type SessionView = {
  id: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
};
export const gradeOptions = [
  { value: "G7", label: "七年级" },
  { value: "G8", label: "八年级" },
  { value: "G9", label: "九年级" },
  { value: "G10", label: "高一" },
  { value: "G11", label: "高二" },
  { value: "G12", label: "高三" },
];
