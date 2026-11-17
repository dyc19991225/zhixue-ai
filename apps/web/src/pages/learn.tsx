import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Spin } from "antd";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { LearningView } from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { api } from "@/lib/api";
import { LessonVideo } from "@/features/courses/lesson-video";
import {
  learnLessonPath,
  lessonPracticePath,
} from "@/features/practice/lesson-practice-path";

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
  const live = useRef(false);
  const apiPath = `/api/learning/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}`;
  const practiceHref = lessonPracticePath(courseId, lessonId);

  useEffect(() => {
    let active = true;
    live.current = true;
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
  }, [apiPath, courseId]);

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
    <section className="wrap account-page">
      <Link to="/dashboard" className="text-link">
        ← 学习中心
      </Link>
      {error && <Alert type="error" showIcon title={error} />}
      {!lesson || !view ? (
        !error && <Spin />
      ) : (
        <div className="lesson-layout">
          <aside>
            <h2>{view.course.title}</h2>
            <p>
              已完成 {view.completedIds.length} / {view.total} 课时
            </p>
            {view.course.chapters.map((c) => (
              <div key={c.id}>
                <h3>{c.title}</h3>
                {c.lessons.map((l) => (
                  <Link
                    aria-current={l.id === lessonId ? "page" : undefined}
                    className="lesson-nav"
                    key={l.id}
                    to={learnLessonPath(courseId, l.id)}
                  >
                    {view.completedIds.includes(l.id) ? "✓ " : ""}
                    {l.title}
                  </Link>
                ))}
              </div>
            ))}
          </aside>
          <Card>
            <h1>{lesson.title}</h1>
            {lesson.hasVideo && (
              <LessonVideo
                courseId={courseId}
                lessonId={lessonId}
                position={view.positions[lessonId] ?? 0}
              />
            )}
            <article className="lesson-prose">{lesson.content}</article>
            <div className="lesson-actions">
              {completed ? (
                <>
                  <span className="muted" role="status">
                    本课已完成
                  </span>
                  <Link className="button primary" to={practiceHref}>
                    做本课配套练习
                  </Link>
                </>
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
                  <Link className="text-link" to={practiceHref}>
                    先做配套练习
                  </Link>
                </>
              )}
              {next ? (
                <Link
                  className="text-link"
                  to={learnLessonPath(courseId, next.id)}
                >
                  下一课 →
                </Link>
              ) : (
                <Link to="/dashboard">返回学习中心</Link>
              )}
            </div>
          </Card>
        </div>
      )}
    </section>
  );
}
