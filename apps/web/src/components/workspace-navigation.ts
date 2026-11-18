import type { Role } from "@zhixue/shared";

type Destination = { href: string; label: string };

export const studyLinks: Destination[] = [
  { href: "/", label: "首页" },
  { href: "/study", label: "同步学习" },
  { href: "/practice", label: "练习中心" },
  { href: "/photo-question", label: "拍照识题" },
  { href: "/ai-teacher", label: "AI 老师" },
];

const classes = [
  { href: "/classes", label: "班级空间" },
  { href: "/homework", label: "班级作业" },
  { href: "/exams", label: "班级考试" },
];

const roleLinks: Record<Role, Destination[]> = {
  STUDENT: [
    { href: "/dashboard?tab=review", label: "待复练" },
    { href: "/analytics", label: "学习报告" },
    ...classes,
  ],
  TEACHER: [
    { href: "/teacher/courses", label: "我的教学课程" },
    { href: "/analytics", label: "班级学情" },
    ...classes,
  ],
  PARENT: [
    { href: "/parent/students", label: "孩子的学习概览" },
    { href: "/analytics", label: "学习报告" },
  ],
  ADMIN: [
    { href: "/admin", label: "用户管理" },
    { href: "/admin/courses", label: "课程管理" },
    { href: "/admin/questions", label: "题库管理" },
    { href: "/admin/feedback", label: "试用反馈" },
    { href: "/analytics", label: "班级学情" },
    ...classes,
  ],
};

export const workspaces: Record<Role, string> = {
  STUDENT: "学习中心",
  TEACHER: "教师工作区",
  PARENT: "家长工作区",
  ADMIN: "管理工作区",
};

export function workspaceLinks(role: Role) {
  return roleLinks[role];
}
