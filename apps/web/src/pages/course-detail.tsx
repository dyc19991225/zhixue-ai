import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spin } from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { CourseView, LearningView } from "@zhixue/shared";
import { gradeOptions, subjectOptions } from "@zhixue/shared";
import { Arrow } from "@/components/icons";
import Image from "@/components/image";
import { api } from "@/lib/api";
import { useApiData } from "@/hooks/use-api-data";
import { useAuth } from "@/auth/auth-provider";
import { learnLessonPath } from "@/features/practice/lesson-practice-path";
import "./learning-entry.css";
import "./course-reader.css";

export default function CourseDetail() {
  const { id } = useParams();
  return id ? <CoursePage key={id} id={id} /> : null;
}

function CoursePage({ id }: { id: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const path = `/api/course/${encodeURIComponent(id)}`;
  const { data: course, loading, error, reload } = useApiData<CourseView>(path);
  const [startError, setStartError] = useState("");
  const [busy, setBusy] = useState(false);
  const live = useRef(false);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  async function start() {
    setBusy(true);
    setStartError("");
    try {
      await api(`${path}/enroll`, "POST");
      if (!live.current) return;
      const view = await api<LearningView>(
        `/api/learning/${encodeURIComponent(id)}`,
      );
      if (!live.current) return;
      if (view.nextLessonId)
        void navigate(learnLessonPath(id, view.nextLessonId));
      else setStartError("当前没有开放课时，可以稍后再来查看。");
    } catch (cause) {
      if (live.current) setStartError((cause as Error).message);
    } finally {
      if (live.current) setBusy(false);
    }
  }

  const count =
    course?.chapters.reduce(
      (sum, chapter) => sum + chapter.lessons.length,
      0,
    ) ?? 0;
  const courseScope = course
    ? new URLSearchParams({ grade: course.grade, subject: course.subject })
    : undefined;
  const loginHref = `/login?next=${encodeURIComponent(`/course/${encodeURIComponent(id)}`)}`;

  return (
    <div className="learning-entry course-reader">
      <nav className="wrap reader-top-nav" aria-label="课程导航">
        <Link
          className="learning-entry-link"
          to={courseScope ? `/study?${courseScope}` : "/courses"}
        >
          ← 返回课程目录
        </Link>
      </nav>
      {loading ? (
        <div className="wrap reader-loading" role="status">
          <Spin /> 正在加载课程…
        </div>
      ) : error ? (
        <div className="wrap">
          <Alert
            type="error"
            showIcon
            title={error}
            action={<Button onClick={reload}>重新加载</Button>}
          />
        </div>
      ) : (
        course && (
          <>
            <section
              className="wrap entry-hero entry-hero--course"
              aria-labelledby="course-title"
            >
              <div className="entry-hero-copy">
                <ul className="reader-course-meta" aria-label="课程信息">
                  <li>
                    {gradeOptions.find((grade) => grade.value === course.grade)
                      ?.label ?? course.grade}
                  </li>
                  <li>
                    {subjectOptions.find(
                      (subject) => subject.value === course.subject,
                    )?.label ?? course.subject}
                  </li>
                  <li>{course.access === "FREE" ? "免费课程" : "会员课程"}</li>
                </ul>
                <h1 id="course-title">{course.title}</h1>
                {course.description && <p>{course.description}</p>}
                <div className="entry-hero-actions">
                  {count > 0 ? (
                    user ? (
                      <Button
                        type="primary"
                        size="large"
                        loading={busy}
                        onClick={() => void start()}
                      >
                        加入课程，开始学习
                      </Button>
                    ) : (
                      <Link className="button primary" to={loginHref}>
                        登录后开始学习 <Arrow />
                      </Link>
                    )
                  ) : (
                    <span className="reader-status">暂无开放课时</span>
                  )}
                  <a className="learning-entry-link" href="#course-outline">
                    查看课时目录
                  </a>
                </div>
                {startError && (
                  <Alert
                    className="reader-action-error"
                    type="error"
                    showIcon
                    title={startError}
                  />
                )}
              </div>
              <div className="entry-hero-photo">
                <Image
                  src="/images/course-workbench.webp"
                  width={960}
                  height={640}
                  alt=""
                  priority
                />
              </div>
            </section>

            <section
              className="wrap reader-outline"
              id="course-outline"
              aria-labelledby="course-outline-title"
            >
              <div className="entry-section-heading">
                <div>
                  <h2 id="course-outline-title">课程目录</h2>
                  <p>
                    {course.chapters.length} 章 · {count} 个开放课时
                  </p>
                </div>
              </div>
              {course.chapters.length ? (
                <ol className="reader-chapters">
                  {course.chapters.map((chapter, index) => (
                    <li className="reader-chapter" key={chapter.id}>
                      <div className="reader-chapter-heading">
                        <span className="reader-chapter-index">
                          第 {index + 1} 章
                        </span>
                        <h3>{chapter.title}</h3>
                        <span className="reader-chapter-count">
                          {chapter.lessons.length} 课时
                        </span>
                      </div>
                      {chapter.lessons.length ? (
                        <ol className="reader-chapter-lessons">
                          {chapter.lessons.map((lesson, index) => (
                            <li key={lesson.id}>
                              <span aria-hidden="true">{index + 1}.</span>
                              <span>{lesson.title}</span>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="reader-chapter-empty">
                          这一章暂无开放课时。
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="reader-empty">这门课还没有开放的章节。</p>
              )}
            </section>
          </>
        )
      )}
    </div>
  );
}
