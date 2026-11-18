import { Fragment, useEffect, useState } from "react";
import { Alert, Button, Empty, Pagination, Space, Spin } from "antd";
import { Link, useNavigate } from "react-router-dom";
import type {
  AttemptView,
  LearningReviewNext,
  PageData,
  QuestionView,
  WrongQuestionView,
} from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { useApiData } from "@/hooks/use-api-data";
import { api } from "@/lib/api";
import { QuestionCard } from "./question-card";
import { LessonReviewProgress, reviewNextPath } from "./review-advance";
import { ReviewRoundMeter } from "./review-round";
import { learnLessonPath, lessonPracticePath } from "./lesson-practice-path";

type Props = {
  courseId: string;
  lessonId: string;
  mode: "questions" | "wrong";
  state: "active" | "resolved";
  page: number;
  roundId?: string;
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
  roundId,
  canLoad,
  authLoading,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState<LessonPage>();
  const [error, setError] = useState("");
  const [revision, retry] = useState(0);
  const review = mode === "wrong";
  const sequential = review && state === "active" && user?.role === "STUDENT";
  const [attemptRevision, setAttemptRevision] = useState(0);
  const [answers, setAnswers] = useState<{
    lastId: string;
    solved: Set<string>;
  }>();

  const practiceHref = lessonPracticePath(courseId, lessonId);
  const wrongHref = lessonPracticePath(courseId, lessonId, {
    mode: "wrong",
    roundId,
  });
  const resolvedHref = lessonPracticePath(courseId, lessonId, {
    mode: "wrong",
    state: "resolved",
    roundId,
  });
  const path = `/api/learning/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/${review ? "wrong-questions" : "questions"}?${new URLSearchParams({ page: String(page), ...(review ? { state, ...(roundId ? { roundId } : {}) } : {}) })}`;

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

  function noteAttempt(attempt: AttemptView) {
    setAttemptRevision((value) => value + 1);
    setAnswers((previous) => {
      const solved = new Set(previous?.solved);
      if (attempt.correct) solved.add(attempt.questionId);
      else solved.delete(attempt.questionId);
      return {
        lastId: attempt.questionId,
        solved,
      };
    });
  }

  function refreshActiveLesson() {
    if (page > 1) {
      void navigate(wrongHref);
      return;
    }
    setData(undefined);
    setAnswers(undefined);
    reload();
  }

  const scope = { courseId, lessonId };
  const direction = useApiData<LearningReviewNext>(
    sequential &&
      !authLoading &&
      (roundId || (data && (answers || data.total === 0)))
      ? reviewNextPath(scope, roundId)
      : null,
    revision + attemptRevision,
  );
  const roundDone = direction.data?.round?.remaining === 0;
  const progress =
    sequential &&
    ((data && (answers || data.total === 0 || roundDone)) ||
      (error && direction.data)) ? (
      <LessonReviewProgress
        scope={scope}
        direction={direction}
        pageDone={
          !!data?.items.every(
            (item) =>
              "question" in item && answers?.solved.has(item.question.id),
          )
        }
        refreshLesson={refreshActiveLesson}
        checkedAfterAttempt={!!answers}
      />
    ) : null;

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
      {roundId &&
        sequential &&
        (direction.error && !progress && !error ? (
          <Alert
            type="error"
            showIcon
            title={direction.error}
            action={<Button onClick={direction.reload}>重新同步</Button>}
          />
        ) : (
          !direction.error && <ReviewRoundMeter round={direction.data?.round} />
        ))}
      {authLoading ? (
        <div className="account-loading">
          <Spin />
        </div>
      ) : !canLoad ? (
        <Empty description="登录并加入课程后，即可练习和复习本课错题。">
          <Link
            className="button primary"
            to={`/login?next=${encodeURIComponent(lessonPracticePath(courseId, lessonId, { mode, state, page, roundId }))}`}
          >
            去登录
          </Link>
        </Empty>
      ) : error ? (
        <>
          <Alert
            type="error"
            showIcon
            title={error}
            action={<Button onClick={reload}>重试</Button>}
          />
          {progress}
        </>
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
          {!answers && progress}
          {data.items.length && (!roundDone || answers) ? (
            <>
              {(!sequential || !answers) && (
                <p className="muted">共 {data.total} 道题</p>
              )}
              {data.items.map((item) => {
                const wrong = "question" in item ? item : undefined;
                const question = "question" in item ? item.question : item;
                return (
                  <Fragment
                    key={wrong?.id ?? `${question.id}-${question.updatedAt}`}
                  >
                    <QuestionCard
                      question={question}
                      wrongCount={wrong?.wrongCount}
                      onAttempt={sequential ? noteAttempt : undefined}
                      roundId={sequential ? roundId : undefined}
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
                    {answers?.lastId === question.id && progress}
                  </Fragment>
                );
              })}
            </>
          ) : (
            !progress && (
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
                {review && page > 1 && data.total > 0 ? (
                  <Link
                    className="text-link"
                    to={state === "active" ? wrongHref : resolvedHref}
                  >
                    返回本课第一页
                  </Link>
                ) : (
                  review && (
                    <Link className="text-link" to={practiceHref}>
                      继续做本课练习
                    </Link>
                  )
                )}
              </Empty>
            )
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
                    roundId,
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
