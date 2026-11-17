import { useEffect, useState } from "react";
import { Alert, Button, Card, Spin } from "antd";
import { Link, useParams } from "react-router-dom";
import type { LearningView } from "@zhixue/shared";
import { api } from "@/lib/api";
import { LessonVideo } from "@/features/courses/lesson-video";
export default function Learn() {
  const { id, lessonId } = useParams();
  const [view, setView] = useState<LearningView>(),
    [lesson, setLesson] = useState<{
      title: string;
      content: string;
      hasVideo: boolean;
    }>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setLesson(undefined);
    setError("");
    Promise.all([
      api<LearningView>(`/api/learning/${id}`),
      api<{ title: string; content: string; hasVideo: boolean }>(
        `/api/learning/${id}/lessons/${lessonId}`,
      ),
    ])
      .then(([v, l]) => {
        if (active) {
          setView(v);
          setLesson(l);
        }
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id, lessonId]);
  async function complete() {
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/learning/${id}/lessons/${lessonId}/completion`,
        "PUT",
        {},
      );
      setView(await api<LearningView>(`/api/learning/${id}`));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const lessons = view?.course.chapters.flatMap((c) => c.lessons) ?? [];
  const next = lessons[lessons.findIndex((l) => l.id === lessonId) + 1];
  return (
    <section className="wrap account-page">
      <Link to="/dashboard" className="text-link">
        ← 学习中心
      </Link>
      {error && <Alert type="error" title={error} />}
      {!lesson ? (
        !error && <Spin />
      ) : (
        <div className="lesson-layout">
          <aside>
            <h2>{view?.course.title}</h2>
            <p>
              已完成 {view?.completedIds.length} / {view?.total} 课时
            </p>
            {view?.course.chapters.map((c) => (
              <div key={c.id}>
                <h3>{c.title}</h3>
                {c.lessons.map((l) => (
                  <Link
                    aria-current={l.id === lessonId ? "page" : undefined}
                    className="lesson-nav"
                    key={l.id}
                    to={`/learn/${id}/${l.id}`}
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
                key={lessonId}
                courseId={id!}
                lessonId={lessonId!}
                position={view?.positions[lessonId!] ?? 0}
              />
            )}
            <article className="lesson-prose">{lesson.content}</article>
            <Link
              className="button primary"
              to={`/practice?courseId=${id}&lessonId=${lessonId}`}
            >
              本课配套练习
            </Link>
            <div className="lesson-actions">
              <Button
                type="primary"
                loading={busy}
                disabled={view?.completedIds.includes(lessonId!)}
                onClick={() => void complete()}
              >
                {view?.completedIds.includes(lessonId!)
                  ? "本课已完成"
                  : "标记本课完成"}
              </Button>
              {next ? (
                <Link className="text-link" to={`/learn/${id}/${next.id}`}>
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
