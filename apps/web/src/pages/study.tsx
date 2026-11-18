import { useSearchParams } from "react-router-dom";
import { gradeOptions, subjectOptions } from "@zhixue/shared";
import Link from "@/components/link";
import { Arrow } from "@/components/icons";
import { CourseExplorer } from "@/features/courses/course-explorer";
import { MidmapKnowledgeBoard } from "@/features/courses/midmap-knowledge-board";
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
      title: "选课梳理脉络",
      description: "在看板中定位章节节点，精读讲义。",
      href: "#sync-courses",
    },
    {
      title: "Run · 随堂练习",
      description: "独立完成配套好题，核对详尽解析。",
      href: `/practice?${scope}`,
    },
    {
      title: "Diff · 错题清零",
      description: "针对答错节点复练，答对即审阅通过。",
      href: `/practice?${scope}&mode=wrong`,
    },
  ];

  return (
    <div className="learning-entry">
      <section
        className="wrap mm-study-header"
        aria-labelledby="study-board-title"
      >
        <div className="mm-section-header">
          <h1 id="study-board-title">
            同步学习 <span className="headline-accent">知识看板</span>
          </h1>
          <p>
            选择你的年级与学科节点，从一节课的核心脉络出发，串联配套练习与错题复练。
          </p>
          <div className="mm-hero-actions">
            <Link className="mm-primary-cta" href="#sync-courses">
              浏览课程列表 <Arrow />
            </Link>
            <Link
              className="mm-secondary-cta"
              href={user ? "/dashboard" : "/login?next=%2Fdashboard"}
            >
              {user ? "我的学习中心" : "登录同步进度"}
            </Link>
          </div>
        </div>

        <MidmapKnowledgeBoard
          initialGrade={parseGrade(grade.label)}
          showDrawerDefault={true}
        />
      </section>

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
            <span className="section-pill">已发布目录</span>
            <h2 id="sync-courses-title">
              按条件检索 <span className="headline-accent">同步课程</span>
            </h2>
            <p aria-live="polite">
              当前筛选：{grade.label} · {subject?.label ?? "全部学科"}
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
