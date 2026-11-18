import { useEffect, useRef, useState } from "react";
import { Alert, Button, Space } from "antd";
import { Link, useNavigate } from "react-router-dom";
import type { LearningReviewNext } from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";
import { ReviewRoundSummary } from "./review-round";
import { api } from "@/lib/api";
import { lessonPracticePath } from "./lesson-practice-path";

type LessonScope = { courseId: string; lessonId: string };

export function reviewNextPath(scope?: LessonScope, roundId?: string) {
  const params = new URLSearchParams(scope);
  if (roundId) params.set("roundId", roundId);
  return "/api/learning-review-queue/next" + (params.size ? `?${params}` : "");
}

export function ReviewAdvanceButton({
  scope,
  roundId,
  disabled,
  onUnavailable,
}: {
  scope?: LessonScope;
  roundId?: string;
  disabled?: boolean;
  onUnavailable: () => void;
}) {
  const navigate = useNavigate();
  const active = useRef(false);
  const startId = useRef<string>(undefined);
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
      const result = scope
        ? await api<LearningReviewNext>(reviewNextPath(scope, roundId))
        : await api<LearningReviewNext>("/api/learning-review-rounds", "POST", {
            roundId: (startId.current ??= crypto.randomUUID()),
          });
      const { next } = result;
      if (!active.current) return;
      if (next) {
        void navigate(
          lessonPracticePath(next.courseId, next.lessonId, {
            mode: "wrong",
            roundId: result.round?.id ?? roundId,
          }),
        );
      } else {
        startId.current = undefined;
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
  direction,
  refreshLesson,
  pageDone,
  checkedAfterAttempt,
}: {
  scope: LessonScope;
  direction: ReturnType<typeof useApiData<LearningReviewNext>>;
  refreshLesson: () => void;
  pageDone: boolean;
  checkedAfterAttempt: boolean;
}) {
  const { data, loading, error, reload } = direction;
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
  if (data.round?.remaining === 0)
    return <ReviewRoundSummary round={data.round} />;

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
            <ReviewAdvanceButton
              scope={scope}
              roundId={data.round?.id}
              onUnavailable={reload}
            />
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
