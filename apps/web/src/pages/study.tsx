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
      title: "1. 选课精学",
      description: "按年级和学科挑课，跟着章节讲义吃透概念。",
      href: "#sync-courses",
    },
    {
      title: "2. 随堂闯关",
      description: "独立思考并动手演算，提交后对照详尽解析。",
      href: `/practice?${scope}`,
    },
    {
      title: "3. 错题清零",
      description: "针对薄弱错题再次挑战，答对即移入已掌握。",
      href: `/practice?${scope}&mode=wrong`,
    },
  ];

  return (
    <div className="learning-entry">
      <LearningEntryHero
        variant="study"
        badge="📖 课前预习 · 课后巩固 · 错题复练闭环"
        image="/images/study-review-desk.webp"
        headline="同步学习空间"
        description="按三步高效学习法：先看懂一节课的核心规律，再做配套好题巩固，最后把易错点彻底扫清。"
      >
        <Link className="button primary" href="#sync-courses">
          挑选同步课程 <Arrow />
        </Link>
        <Link
          className="learning-entry-link"
          href={user ? "/dashboard" : "/login?next=%2Fdashboard"}
        >
          {user ? "进入我的学习书桌 →" : "登录保存学习进度 →"}
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
            <span className="section-pill">同步课程库</span>
            <h2 id="sync-courses-title">找正在学的课程</h2>
            <p aria-live="polite">
              当前范围：{grade.label} · {subject?.label ?? "全部学科"}
            </p>
          </div>
          <div className="entry-section-links">
            <Link className="text-link" href="/photo-question">
              📸 拍照识题
            </Link>
            <Link
              className="text-link"
              href={user ? "/analytics" : "/login?next=%2Fanalytics"}
            >
              📊 学习报告
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
