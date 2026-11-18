import { useEffect, lazy, Suspense } from "react";
import { Spin } from "antd";
import { Route, Routes, useLocation } from "react-router-dom";
import { SiteHeader } from "./components/site-header";
import { SiteFooter } from "./components/site-footer";
import Link from "@/components/link";
import Home from "./pages/home";
import Courses from "./pages/courses";
import Subject from "./pages/subject";
import Practice from "./pages/practice";
import AiTeacher from "./pages/ai-teacher";
import Membership from "./pages/membership";
const Dashboard = lazy(() => import("./pages/dashboard"));
const Study = lazy(() => import("./pages/study"));
const Trial = lazy(() => import("./pages/trial"));
const Login = lazy(() => import("./pages/login"));
const Admin = lazy(() => import("./pages/admin"));
const LessonReadiness = lazy(() => import("./pages/admin/lesson-readiness"));
const AdminFeedback = lazy(() => import("./pages/admin/feedback"));
const ContentReadinessPage = lazy(
  () => import("./pages/admin/content-readiness"),
);
const AdminCourses = lazy(() => import("./pages/admin-courses"));
const AdminQuestions = lazy(() => import("./pages/admin-questions"));
const CourseDetail = lazy(() => import("./pages/course-detail"));
const Learn = lazy(() => import("./pages/learn"));
const TeacherCourses = lazy(() => import("./pages/teacher/courses"));
const Classes = lazy(() => import("./pages/shared/classes"));
const ParentStudents = lazy(() => import("./pages/parent/students"));
const ParentLinks = lazy(() => import("./pages/admin/relations"));
const Homework = lazy(() => import("./pages/shared/homework"));
const Exams = lazy(() => import("./pages/shared/exams"));
const Analytics = lazy(() => import("./pages/shared/analytics"));
const ExamTake = lazy(() => import("./pages/student/exams/take"));
import About from "./pages/about";
import Privacy from "./pages/privacy";
import Terms from "./pages/terms";
import NotFound from "./pages/not-found";
import { ProtectedRoute } from "./auth/protected-route";
const titles: Record<string, string> = {
  "/courses": "学科课程",
  "/study": "同步学习",
  "/trial": "试学与反馈",
  "/dashboard": "学习中心",
  "/practice": "练习中心",
  "/ai-teacher": "AI 老师",
  "/photo-question": "拍照识题",
  "/membership": "会员计划",
  "/login": "登录与注册",
  "/admin": "用户管理",
  "/admin/feedback": "试用反馈管理",
  "/admin/content-readiness": "内容准备度",
  "/admin/lesson-readiness": "课时配套检查",
  "/admin/courses": "课程管理",
  "/admin/questions": "题库管理",
  "/teacher/courses": "我的教学课程",
  "/classes": "班级空间",
  "/homework": "班级作业",
  "/exams": "班级考试",
  "/analytics": "学习报告",
  "/parent/students": "孩子的学习概览",
  "/admin/relations": "家长与学生绑定",
  "/about": "关于知学",
  "/privacy": "隐私说明",
  "/terms": "使用说明",
};
export default function App() {
  const { pathname, search } = useLocation();
  const mode = new URLSearchParams(search).get("mode");
  const pageName =
    pathname === "/"
      ? "首页"
      : pathname === "/practice" && mode === "wrong"
        ? "我的错题本"
        : pathname === "/practice" && mode === "history"
          ? "作答记录"
          : (titles[pathname] ??
            (pathname.startsWith("/exams/")
              ? "考试作答"
              : pathname.startsWith("/course/")
                ? "课程详情"
                : pathname.startsWith("/learn/")
                  ? "课时学习"
                  : pathname.startsWith("/courses/")
                    ? "学科详情"
                    : "页面不存在"));
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => {
    document.title = `${pageName} | 知学 AI`;
  }, [pageName]);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        跳到主要内容
      </a>
      <SiteHeader />
      <div className="shell-main-column">
        <div className="shell-context wrap">
          <span aria-current="page">{pageName}</span>
          <Link href="/trial">试学与反馈</Link>
        </div>
        <main id="main" tabIndex={-1}>
          <Suspense
            fallback={
              <div className="account-loading">
                <Spin />
              </div>
            }
          >
            <Routes>
              <Route
                path="/analytics"
                element={
                  <ProtectedRoute>
                    <Analytics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/exams"
                element={
                  <ProtectedRoute
                    allowedRoles={["ADMIN", "TEACHER", "STUDENT"]}
                  >
                    <Exams />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/exams/:id/take"
                element={
                  <ProtectedRoute allowedRoles={["STUDENT"]}>
                    <ExamTake />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/homework"
                element={
                  <ProtectedRoute
                    allowedRoles={["ADMIN", "TEACHER", "STUDENT"]}
                  >
                    <Homework />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teacher/courses"
                element={
                  <ProtectedRoute allowedRoles={["TEACHER"]}>
                    <TeacherCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/classes"
                element={
                  <ProtectedRoute
                    allowedRoles={["ADMIN", "TEACHER", "STUDENT"]}
                  >
                    <Classes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/parent/students"
                element={
                  <ProtectedRoute allowedRoles={["PARENT"]}>
                    <ParentStudents />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/relations"
                element={
                  <ProtectedRoute admin>
                    <ParentLinks />
                  </ProtectedRoute>
                }
              />
              <Route path="/" element={<Home />} />
              <Route path="/courses" element={<Courses />} />
              <Route path="/study" element={<Study />} />
              <Route path="/trial" element={<Trial />} />
              <Route
                path="/admin/lesson-readiness"
                element={
                  <ProtectedRoute admin>
                    <LessonReadiness />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/content-readiness"
                element={
                  <ProtectedRoute admin>
                    <ContentReadinessPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/feedback"
                element={
                  <ProtectedRoute admin>
                    <AdminFeedback />
                  </ProtectedRoute>
                }
              />
              <Route path="/courses/:slug" element={<Subject />} />
              <Route path="/course/:id" element={<CourseDetail />} />
              <Route
                path="/learn/:id/:lessonId"
                element={
                  <ProtectedRoute>
                    <Learn />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/courses"
                element={
                  <ProtectedRoute admin>
                    <AdminCourses />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route path="/practice" element={<Practice />} />
              <Route
                path="/admin/questions"
                element={
                  <ProtectedRoute admin>
                    <AdminQuestions />
                  </ProtectedRoute>
                }
              />
              <Route path="/ai-teacher" element={<AiTeacher />} />
              <Route path="/photo-question" element={<AiTeacher />} />
              <Route path="/membership" element={<Membership />} />
              <Route path="/login" element={<Login />} />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute admin>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route path="/about" element={<About />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
