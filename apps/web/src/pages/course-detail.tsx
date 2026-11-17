import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Alert, Button, Card, Spin, Tag } from "antd";
import type { CourseView, LearningView } from "@zhixue/shared";
import { gradeOptions } from "@zhixue/shared";
import { api } from "@/lib/api";
import { useAuth } from "@/auth/auth-provider";
export default function CourseDetail() {
  const { id } = useParams(),
    navigate = useNavigate(),
    { user } = useAuth();
  const [course, setCourse] = useState<CourseView>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setCourse(undefined);
    setError("");
    api<CourseView>(`/api/course/${id}`)
      .then((c) => {
        if (active) setCourse(c);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function start() {
    if (!user)
      return navigate(`/login?next=${encodeURIComponent(`/course/${id}`)}`);
    setBusy(true);
    setError("");
    try {
      await api(`/api/course/${id}/enroll`, "POST");
      const view = await api<LearningView>(`/api/learning/${id}`);
      if (view.nextLessonId) navigate(`/learn/${id}/${view.nextLessonId}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="wrap account-page">
      <Link to="/courses" className="text-link">
        ← 课程目录
      </Link>
      {error && <Alert title={error} type="error" />}
      {!course ? (
        !error && <Spin />
      ) : (
        <>
          <div className="course-heading">
            <p className="eyebrow">
              {gradeOptions.find((g) => g.value === course.grade)?.label} ·
              系统学习
            </p>
            <h1>{course.title}</h1>
            <p className="intro">{course.description}</p>
            <Tag>{course.access === "FREE" ? "免费课程" : "会员课程"}</Tag>
            <Button
              type="primary"
              size="large"
              loading={busy}
              onClick={() => void start()}
            >
              加入课程，开始学习
            </Button>
          </div>
          <h2>课程目录</h2>
          {course.chapters.map((c) => (
            <Card key={c.id} title={c.title} className="lesson-chapter">
              <ol>
                {c.lessons.map((l) => (
                  <li key={l.id}>{l.title}</li>
                ))}
              </ol>
            </Card>
          ))}
        </>
      )}
    </section>
  );
}
