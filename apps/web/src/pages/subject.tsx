import { useParams, useSearchParams } from "react-router-dom";
import Link from "@/components/link";
import NotFound from "./not-found";
import { PublishedCourses } from "@/features/courses/published-courses";
import { gradeOptions } from "@zhixue/shared";
import {
  findSubject,
  parseGrade,
  subjectsForGrade,
} from "@/features/courses/catalog";
export default function SubjectPage() {
  const { slug } = useParams();
  const [query] = useSearchParams();
  const subject = findSubject(slug ?? "");
  const grade = parseGrade(query.get("grade"));
  if (!subject || !subjectsForGrade(grade).some((s) => s.id === slug))
    return <NotFound />;
  return (
    <section className="wrap section placeholder">
      <Link className="text-link" href="/courses">
        ← 返回学科目录
      </Link>
      <p className="eyebrow detail-eyebrow">{grade} · 学科入口</p>
      <h1>{subject.name}</h1>
      <p className="intro">{subject.line}</p>
      <PublishedCourses
        grade={gradeOptions.find((g) => g.label === grade)?.value}
        subject={slug}
      />
      <Link className="button primary" href="/courses">
        选择其他学科
      </Link>
    </section>
  );
}
