import { useEffect, useState } from "react";
import { Alert, Button, Empty, Pagination, Space, Spin } from "antd";
import { Link, useNavigate } from "react-router-dom";
import type { PageData, QuestionView, WrongQuestionView } from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { api } from "@/lib/api";
import { QuestionCard } from "./question-card";
import { learnLessonPath, lessonPracticePath } from "./lesson-practice-path";

type Props = {
  courseId: string;
  lessonId: string;
  mode: "questions" | "wrong";
  state: "active" | "resolved";
  page: number;
  canLoad: boolean;
  authLoading: boolean;
};

type LessonPage = PageData<QuestionView | WrongQuestionView> & {
  lesson: {
    title: string;
    courseTitle: string;
    grade: string;
    subject: string;
  };
};

export function LessonPractice({
  courseId,
  lessonId,
  mode,
  state,
  page,
  canLoad,
  authLoading,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<LessonPage>();
  const [error, setError] = useState("");
  const [revision, retry] = useState(0);
  const review = mode === "wrong";
  const practiceHref = lessonPracticePath(courseId, lessonId);
  const wrongHref = lessonPracticePath(courseId, lessonId, { mode: "wrong" });
  const resolvedHref = lessonPracticePath(courseId, lessonId, {
    mode: "wrong",
    state: "resolved",
  });
  const path = `/api/learning/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/${review ? "wrong-questions" : "questions"}?${new URLSearchParams({ page: String(page), ...(review ? { state } : {}) })}`;

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  useEffect(() => {
    if (!canLoad || authLoading) return;
    let active = true;
    api<LessonPage>(path)
      .then((result) => {
        if (active) setData(result);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, canLoad, authLoading, revision]);

  function reload() {
    setError("");
    retry((value) => value + 1);
  }

  return (
    <section className="wrap practice-page lesson-practice">
      <Space wrap>
        <Link className="text-link" to={learnLessonPath(courseId, lessonId)}>
          ← 返回课时学习
        </Link>
        {review && user?.role === "STUDENT" && (
          <Link className="text-link" to="/dashboard?tab=review">
            返回待复练
          </Link>
        )}
      </Space>
      <header className="lesson-practice-header">
        {data && (
          <p className="muted">
            {data.lesson.courseTitle} · {data.lesson.title}
          </p>
        )}
        <h1>{review ? "本课错题复练" : "本课配套练习"}</h1>
        <nav aria-label="本课练习步骤">
          <Space wrap>
            <Link
              className={review ? "text-link" : "button primary"}
              to={practiceHref}
              aria-current={review ? undefined : "page"}
            >
              本课练习
            </Link>
            <Link
              className={review ? "button primary" : "text-link"}
              to={wrongHref}
              aria-current={review ? "page" : undefined}
            >
              复练本课错题
            </Link>
            {data && (
              <Link
                className="text-link"
                to={`/practice?${new URLSearchParams({ grade: data.lesson.grade, subject: data.lesson.subject })}`}
              >
                全部练习
              </Link>
            )}
          </Space>
        </nav>
      </header>
      {authLoading ? (
        <div className="account-loading">
          <Spin />
        </div>
      ) : !canLoad ? (
        <Empty description="登录并加入课程后，即可练习和复习本课错题。">
          <Link
            className="button primary"
            to={`/login?next=${encodeURIComponent(lessonPracticePath(courseId, lessonId, { mode, state, page }))}`}
          >
            去登录
          </Link>
        </Empty>
      ) : error ? (
        <Alert
          type="error"
          showIcon
          title={error}
          action={<Button onClick={reload}>重试</Button>}
        />
      ) : !data ? (
        <div className="account-loading">
          <Spin />
        </div>
      ) : (
        <>
          {review && (
            <nav className="lesson-review-filter" aria-label="本课错题状态">
              <Space wrap>
                <Link
                  className={
                    state === "active" ? "button primary" : "text-link"
                  }
                  aria-current={state === "active" ? "page" : undefined}
                  to={wrongHref}
                >
                  待复练
                </Link>
                <Link
                  className={
                    state === "resolved" ? "button primary" : "text-link"
                  }
                  aria-current={state === "resolved" ? "page" : undefined}
                  to={resolvedHref}
                >
                  已答对
                </Link>
              </Space>
            </nav>
          )}
          {data.items.length ? (
            <>
              <p className="muted">共 {data.total} 道题</p>
              {data.items.map((item) => {
                const wrong = "question" in item ? item : undefined;
                const question = "question" in item ? item.question : item;
                return (
                  <QuestionCard
                    key={wrong?.id ?? `${question.id}-${question.updatedAt}`}
                    question={question}
                    wrongCount={wrong?.wrongCount}
                    reviewAction={(attempt) => {
                      if (review && attempt.correct && state === "active") {
                        return (
                          <Link className="text-link" to={resolvedHref}>
                            查看本课已答对
                          </Link>
                        );
                      }
                      if (attempt.correct || (review && state === "active"))
                        return null;
                      return (
                        <Link className="text-link" to={wrongHref}>
                          复练本课错题
                        </Link>
                      );
                    }}
                  />
                );
              })}
            </>
          ) : (
            <Empty
              description={
                data.total > 0
                  ? "这一页没有题目。"
                  : !review
                    ? "本课暂未发布配套练习。"
                    : state === "active"
                      ? "本课没有待复练的错题。"
                      : "本课还没有通过复练答对的错题。"
              }
            >
              {review && (
                <Link className="text-link" to={practiceHref}>
                  继续做本课练习
                </Link>
              )}
            </Empty>
          )}
          {(data.total > data.pageSize || page > 1) && (
            <Pagination
              current={page}
              pageSize={data.pageSize}
              total={data.total}
              showSizeChanger={false}
              onChange={(nextPage) => {
                void navigate(
                  lessonPracticePath(courseId, lessonId, {
                    mode,
                    state,
                    page: nextPage,
                  }),
                );
              }}
            />
          )}
        </>
      )}
    </section>
  );
}
