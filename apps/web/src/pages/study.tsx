import { Link, useSearchParams } from "react-router-dom";
import { gradeOptions, subjectOptions } from "@zhixue/shared";
import { CourseExplorer } from "@/features/courses/course-explorer";
import { parseGrade } from "@/features/courses/catalog";
import { useAuth } from "@/auth/auth-provider";
import { Arrow, BookMark } from "@/components/icons";

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
  const practice = `/practice?${scope}`;
  const wrong = `/practice?${scope}&mode=wrong`;
  return (
    <section className="wrap section study-hub">
      <div className="study-hub-hero">
        <div>
          <p className="eyebrow">同步学 · 认真练 · 回头看</p>
          <h1 className="page-title">今天学的，今天弄懂。</h1>
          <p className="intro">
            选好年级和教材版本，从一节课开始，把知识学会，再用练习巩固。
          </p>
          <div className="study-hub-actions">
            <Link className="button secondary" to="/photo-question">
              拍照识题
            </Link>
            <a className="button primary" href="#sync-courses">
              选择同步课程 <Arrow />
            </a>
            <Link
              className="button secondary"
              to={user ? "/dashboard" : "/login?next=%2Fdashboard"}
            >
              {user ? "继续我的学习" : "登录保存学习进度"}
            </Link>
          </div>
        </div>
        <div className="study-hub-note">
          <BookMark />
          <strong>一步一步，学得扎实</strong>
          <p>看课时讲解 → 做本课练习 → 复习错题</p>
          <small>进入课程后，按章节选择课时。</small>
        </div>
      </div>
      <nav className="study-path" aria-label="学习路径">
        {[
          {
            step: "01",
            title: "同步学习",
            text: "按教材版本找课程，按章节学课时。",
            href: "#sync-courses",
          },
          {
            step: "02",
            title: "练习巩固",
            text: "先独立作答，再对照解析理清思路。",
            href: practice,
          },
          {
            step: "03",
            title: "错题复习",
            text: "回看易错题，重新答对后再巩固。",
            href: wrong,
          },
          {
            step: "04",
            title: "学习报告",
            text: "查看已有学习与作答记录。",
            href: user ? "/analytics" : "/login?next=%2Fanalytics",
          },
        ].map((item) =>
          item.href.startsWith("#") ? (
            <a key={item.step} className="study-path-item" href={item.href}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
              <Arrow />
            </a>
          ) : (
            <Link key={item.step} className="study-path-item" to={item.href}>
              <span>{item.step}</span>
              <strong>{item.title}</strong>
              <p>{item.text}</p>
              <Arrow />
            </Link>
          ),
        )}
      </nav>
      <div className="study-scope" aria-live="polite">
        <strong>
          {grade.label} · {subject?.label ?? "全部学科"}
        </strong>
        <span>下方选择年级、学科后，练习与错题入口会同步切换。</span>
      </div>
      <section id="sync-courses" aria-labelledby="sync-courses-title">
        <h2 id="sync-courses-title">找到你正在学的内容</h2>
        <p className="muted">
          教材版本和学期以课程说明为准；没有匹配内容时可清空筛选。课时内的“本课配套练习”只练该课关联题目。
        </p>
        <CourseExplorer
          initialGrade={parseGrade(grade.label)}
          catalogPath="/study"
        />
      </section>
    </section>
  );
}
