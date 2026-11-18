import { useEffect, useRef, useState } from "react";
import { Alert, Button, Space } from "antd";
import { Link, useNavigate } from "react-router-dom";
import type { LearningReviewNext } from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";
import { api } from "@/lib/api";
import { lessonPracticePath } from "./lesson-practice-path";

type LessonScope = { courseId: string; lessonId: string };

function nextPath(scope?: LessonScope) {
  return (
    "/api/learning-review-queue/next" +
    (scope ? `?${new URLSearchParams(scope)}` : "")
  );
}

export function ReviewAdvanceButton({
  scope,
  disabled,
  onUnavailable,
}: {
  scope?: LessonScope;
  disabled?: boolean;
  onUnavailable: () => void;
}) {
  const navigate = useNavigate();
  const active = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);

  async function openNext() {
    setBusy(true);
    setError("");
    try {
      const { next } = await api<LearningReviewNext>(nextPath(scope));
      if (!active.current) return;
      if (next) {
        void navigate(
          lessonPracticePath(next.courseId, next.lessonId, { mode: "wrong" }),
        );
      } else {
        onUnavailable();
      }
    } catch (cause) {
      if (active.current) setError((cause as Error).message);
    } finally {
      if (active.current) setBusy(false);
    }
  }

  return (
    <Space wrap>
      <Button
        type="primary"
        disabled={disabled}
        loading={busy}
        onClick={() => void openNext()}
      >
        {scope ? "下一课复练" : "开始复练"}
      </Button>
      {error && (
        <span className="learning-review-error" role="alert">
          {error}
        </span>
      )}
    </Space>
  );
}

export function LessonReviewProgress({
  scope,
  refreshLesson,
  pageDone,
  checkedAfterAttempt,
}: {
  scope: LessonScope;
  refreshLesson: () => void;
  pageDone: boolean;
  checkedAfterAttempt: boolean;
}) {
  const { data, loading, error, reload } = useApiData<LearningReviewNext>(
    nextPath(scope),
  );
  if (loading)
    return (
      <p className="muted" role="status">
        正在核对本课待复练题目…
      </p>
    );
  if (error)
    return (
      <Alert
        type="error"
        showIcon
        title={error}
        action={<Button onClick={reload}>重新核对</Button>}
      />
    );
  if (!data) return null;

  return (
    <section className="lesson-review-progress" aria-label="本课复练进度">
      <p role="status">
        {data.currentPending === 0
          ? checkedAfterAttempt
            ? "本课复练完成"
            : "本课没有待复练的错题。"
          : `本课还有 ${data.currentPending} 道待复练`}
      </p>
      {data.currentPending === 0 ? (
        data.next ? (
          <>
            <p className="muted">
              下一课：{data.next.courseTitle} · {data.next.lessonTitle}
            </p>
            <ReviewAdvanceButton scope={scope} onUnavailable={reload} />
          </>
        ) : (
          <Space wrap>
            <span className="muted">暂无其他待复练课时。</span>
            <Link className="text-link" to="/dashboard?tab=review">
              返回待复练列表
            </Link>
          </Space>
        )
      ) : pageDone ? (
        <Button onClick={refreshLesson}>继续复练本课</Button>
      ) : null}
    </section>
  );
}
