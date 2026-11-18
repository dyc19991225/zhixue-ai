import { useSearchParams } from "react-router-dom";
import { gradeOptions, subjectOptions } from "@zhixue/shared";
import Link from "@/components/link";
import { Arrow } from "@/components/icons";
import { CourseExplorer } from "@/features/courses/course-explorer";
import { LearningEntryHero } from "@/features/courses/learning-entry-hero";
import { parseGrade } from "@/features/courses/catalog";
import { useAuth } from "@/auth/auth-provider";
import "./learning-entry.css";

export default function Study() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const grade =
    gradeOptions.find((item) => item.value === params.get("grade")) ??
    gradeOptions.find((item) => item.value === user?.grade) ??
    gradeOptions[0];
  const subject = subjectOptions.find(
    (item) => item.value === params.get("subject"),
  );
  const scope = new URLSearchParams({ grade: grade.value });
  if (subject) scope.set("subject", subject.value);

  const steps = [
    {
      title: "选课学习",
      description: "按年级和学科找课，跟着章节学。",
      href: "#sync-courses",
    },
    {
      title: "做题巩固",
      description: "先独立作答，再看答案解析。",
      href: `/practice?${scope}`,
    },
    {
      title: "错题复练",
      description: "把没做对的题重新练一遍。",
      href: `/practice?${scope}&mode=wrong`,
    },
  ];

  return (
    <div className="learning-entry">
      <LearningEntryHero
        variant="study"
        image="/images/study-review-desk.webp"
        headline="同步学习"
        description="从一节课开始。看讲解、做配套练习，再把没答对的题练一遍。"
      >
        <Link className="button primary" href="#sync-courses">
          选择课程 <Arrow />
        </Link>
        <Link
          className="learning-entry-link"
          href={user ? "/dashboard" : "/login?next=%2Fdashboard"}
        >
          {user ? "继续我的学习" : "登录保存进度"}
        </Link>
      </LearningEntryHero>

      <nav className="wrap entry-learning-path" aria-label="学习路径">
        <ol>
          {steps.map((step, index) => (
            <li key={step.title}>
              <Link href={step.href}>
                <span className="entry-path-index" aria-hidden="true">
                  {index + 1}
                </span>
                <span>
                  <strong>{step.title}</strong>
                  <small>{step.description}</small>
                </span>
                <Arrow />
              </Link>
            </li>
          ))}
        </ol>
      </nav>

      <section
        id="sync-courses"
        className="wrap entry-catalog entry-catalog--study"
        aria-labelledby="sync-courses-title"
      >
        <div className="entry-section-heading">
          <div>
            <h2 id="sync-courses-title">找正在学的课程</h2>
            <p aria-live="polite">
              {grade.label} · {subject?.label ?? "全部学科"}
            </p>
          </div>
          <div className="entry-section-links">
            <Link className="text-link" href="/photo-question">
              拍照识题
            </Link>
            <Link
              className="text-link"
              href={user ? "/analytics" : "/login?next=%2Fanalytics"}
            >
              学习报告
            </Link>
          </div>
        </div>
        <CourseExplorer
          initialGrade={parseGrade(grade.label)}
          catalogPath="/study"
        />
      </section>
    </div>
  );
}
