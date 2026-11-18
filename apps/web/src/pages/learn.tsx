import { useEffect, useRef, useState } from "react";
import { Alert, Button, Spin } from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { LearningView } from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import Image from "@/components/image";
import { api } from "@/lib/api";
import { LessonVideo } from "@/features/courses/lesson-video";
import {
  learnLessonPath,
  lessonPracticePath,
} from "@/features/practice/lesson-practice-path";

import "./learning-entry.css";
import "./course-reader.css";

type Lesson = { title: string; content: string | null; hasVideo: boolean };

export default function Learn() {
  const { id, lessonId } = useParams();
  const { user } = useAuth();
  if (!id || !lessonId || !user) return null;
  return (
    <LearnLesson
      key={JSON.stringify([user.id, id, lessonId])}
      courseId={id}
      lessonId={lessonId}
    />
  );
}

function LearnLesson({
  courseId,
  lessonId,
}: {
  courseId: string;
  lessonId: string;
}) {
  const navigate = useNavigate();
  const [data, setData] = useState<{ view: LearningView; lesson: Lesson }>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"practice" | "complete">();
  const [refresh, setRefresh] = useState(0);
  const live = useRef(false);
  const apiPath = `/api/learning/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`;
  const practiceHref = lessonPracticePath(courseId, lessonId);

  useEffect(() => {
    let active = true;
    live.current = true;
    setError("");
    Promise.all([
      api<LearningView>(`/api/learning/${encodeURIComponent(courseId)}`),
      api<Lesson>(apiPath),
    ])
      .then(([view, lesson]) => {
        if (active) setData({ view, lesson });
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      live.current = false;
    };
  }, [apiPath, courseId, refresh]);

  async function complete(goToPractice: boolean) {
    setBusy(goToPractice ? "practice" : "complete");
    setError("");
    try {
      await api(`${apiPath}/completion`, "PUT", {});
      if (!live.current) return;
      setData((current) =>
        current && !current.view.completedIds.includes(lessonId)
          ? {
              ...current,
              view: {
                ...current.view,
                completedIds: [...current.view.completedIds, lessonId],
              },
            }
          : current,
      );
      if (goToPractice) void navigate(practiceHref);
    } catch (e) {
      if (live.current) setError((e as Error).message);
    } finally {
      if (live.current) setBusy(undefined);
    }
  }

  const view = data?.view;
  const lesson = data?.lesson;
  const lessons = view?.course.chapters.flatMap((c) => c.lessons) ?? [];
  const index = lessons.findIndex((l) => l.id === lessonId);
  const next = index >= 0 ? lessons[index + 1] : undefined;
  const completed = view?.completedIds.includes(lessonId);

  return (
    <div className="learning-entry course-reader">
      <nav className="wrap reader-top-nav" aria-label="课时导航">
        <Link
          to={`/course/${encodeURIComponent(courseId)}`}
          className="learning-entry-link"
        >
          ← 返回课程
        </Link>
        <Link to="/dashboard" className="learning-entry-link">
          学习中心
        </Link>
      </nav>
      {!lesson || !view ? (
        error ? (
          <div className="wrap">
            <Alert
              type="error"
              showIcon
              title={error}
              action={
                <Button onClick={() => setRefresh((value) => value + 1)}>
                  重新加载
                </Button>
              }
            />
          </div>
        ) : (
          <div className="wrap reader-loading" role="status">
            <Spin /> 正在加载课时…
          </div>
        )
      ) : (
        <div className="wrap reader-workspace">
          <article className="reader-lesson" aria-labelledby="lesson-title">
            <header className="reader-lesson-title">
              <p>{view.course.title}</p>
              <h1 id="lesson-title">{lesson.title}</h1>
              <a
                href="#lesson-outline"
                className="learning-entry-link reader-mobile-outline"
              >
                查看课时目录
              </a>
            </header>
            <div className="reader-lesson-main">
              {lesson.hasVideo && (
                <LessonVideo
                  courseId={courseId}
                  lessonId={lessonId}
                  position={view.positions[lessonId] ?? 0}
                />
              )}
              {lesson.content?.trim() && (
                <div className="reader-text">
                  {lesson.content
                    .trim()
                    .split(/\r?\n[ \t]*\r?\n+/)
                    .map((paragraph, index) => {
                      const lines = paragraph.split(/\r?\n/);
                      const label = lines[0];
                      if (
                        ![
                          "学习目标",
                          "开放资料要点整理",
                          "来源与许可",
                        ].includes(label)
                      )
                        return <p key={index}>{paragraph}</p>;
                      return (
                        <section className="reader-text-section" key={index}>
                          <h2>{label}</h2>
                          {lines.length > 1 && (
                            <p>{lines.slice(1).join("\n")}</p>
                          )}
                        </section>
                      );
                    })}
                </div>
              )}
            </div>
            <footer className="reader-lesson-footer">
              {completed && (
                <p className="reader-completed" role="status">
                  ✓ 本课已完成
                </p>
              )}
              <div className="lesson-actions">
                {completed ? (
                  <Link className="button primary" to={practiceHref}>
                    做本课配套练习
                  </Link>
                ) : (
                  <>
                    <Button
                      type="primary"
                      size="large"
                      loading={busy === "practice"}
                      disabled={busy === "complete"}
                      onClick={() => void complete(true)}
                    >
                      完成本课并去练习
                    </Button>
                    <Button
                      size="large"
                      loading={busy === "complete"}
                      disabled={busy === "practice"}
                      onClick={() => void complete(false)}
                    >
                      仅标记完成
                    </Button>
                    <Link className="learning-entry-link" to={practiceHref}>
                      先做配套练习
                    </Link>
                  </>
                )}
                {next ? (
                  <Link
                    className="learning-entry-link"
                    to={learnLessonPath(courseId, next.id)}
                  >
                    下一课 <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <Link className="learning-entry-link" to="/dashboard">
                    返回学习中心
                  </Link>
                )}
              </div>
              {error && (
                <Alert
                  className="reader-action-error"
                  type="error"
                  showIcon
                  title={error}
                />
              )}
            </footer>
          </article>
          <aside id="lesson-outline" className="reader-lesson-nav">
            <Image
              src="/images/course-workbench.webp"
              width={960}
              height={640}
              alt=""
            />
            <div className="reader-nav-body">
              <h2 id="lesson-outline-heading">课时目录</h2>
              <div className="reader-nav-progress">
                <p id="lesson-progress-label" aria-live="polite">
                  已完成 {view.completedIds.length} / {view.total} 课时
                </p>
                <progress
                  aria-labelledby="lesson-progress-label"
                  value={view.completedIds.length}
                  max={Math.max(1, view.total)}
                />
              </div>
              <nav aria-labelledby="lesson-outline-heading">
                {view.course.chapters
                  .filter((chapter) => chapter.lessons.length > 0)
                  .map((chapter) => (
                    <div key={chapter.id}>
                      <h3>{chapter.title}</h3>
                      <ul>
                        {chapter.lessons.map((item) => (
                          <li key={item.id}>
                            <Link
                              aria-current={
                                item.id === lessonId ? "page" : undefined
                              }
                              className="reader-lesson-link"
                              to={learnLessonPath(courseId, item.id)}
                            >
                              <span>{item.title}</span>
                              {view.completedIds.includes(item.id) && (
                                <span aria-label="已完成">✓</span>
                              )}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
              </nav>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
