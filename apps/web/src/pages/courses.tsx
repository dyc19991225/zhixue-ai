import { CourseExplorer } from "@/features/courses/course-explorer";
export default function CoursesPage() {
  return (
    <section className="wrap section">
      <p className="eyebrow">学习目录</p>
      <h1 className="page-title">选好方向，再出发。</h1>
      <p className="intro page-intro">
        选择年级，按学科、教材版本、地区和学期查找已发布课程。
      </p>
      <CourseExplorer />
    </section>
  );
}
