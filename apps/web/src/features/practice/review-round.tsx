import { useEffect, useState } from "react";
import type { LearningReviewRoundView } from "@zhixue/shared";
import { Link } from "react-router-dom";

export function StudyDeskImage({ className }: { className: string }) {
  return (
    <img
      className={className}
      src="/images/study-review-desk.webp"
      alt=""
      width={960}
      height={640}
      decoding="async"
    />
  );
}

export function ReviewRoundMeter({
  round: current,
}: {
  round?: LearningReviewRoundView;
}) {
  const [last, setLast] = useState(current);
  useEffect(() => {
    if (current) setLast(current);
  }, [current]);
  const round = current ?? last;

  return (
    <section
      className="review-round-meter"
      aria-labelledby="review-round-title"
      aria-busy={!current}
    >
      <div className="review-round-heading">
        <h2 id="review-round-title">本轮复练</h2>
        <span>{current ? `共 ${current.total} 道` : "同步进度中…"}</span>
      </div>
      {round && (
        <>
          <ReviewStats round={round} />
          <div
            className="review-round-track"
            role="progressbar"
            aria-label="本轮复练进度"
            aria-valuemin={0}
            aria-valuemax={Math.max(1, round.total)}
            aria-valuenow={round.total - round.remaining}
            aria-valuetext={`已答对 ${round.correct} 道，还剩 ${round.remaining} 道${round.skipped ? `，跳过 ${round.skipped} 道` : ""}`}
          >
            <span
              className="review-round-fill"
              style={{ flexGrow: round.correct }}
            />
            {round.skipped > 0 && (
              <span
                className="review-round-skip"
                style={{ flexGrow: round.skipped }}
              />
            )}
            <span
              style={{ flexGrow: round.remaining || Number(!round.total) }}
            />
          </div>
          {round.skipped > 0 && (
            <p className="review-round-note">
              有 {round.skipped} 道题已在别处解决或暂不可复练。
            </p>
          )}
        </>
      )}
    </section>
  );
}

function ReviewStats({
  round,
  summary = false,
}: {
  round: LearningReviewRoundView;
  summary?: boolean;
}) {
  const stats = [
    { label: "已答对", count: round.correct },
    { label: "还剩", count: round.remaining },
    ...(summary && round.skipped
      ? [{ label: "已跳过", count: round.skipped }]
      : []),
  ];
  return (
    <dl className="review-round-stats" aria-live="polite">
      {stats.map(({ label, count }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {count}
            <span> 道</span>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function ReviewRoundSummary({
  round,
}: {
  round: LearningReviewRoundView;
}) {
  return (
    <section
      className="review-round-summary review-desk"
      aria-labelledby="review-round-summary-title"
    >
      <div className="review-desk-copy">
        <h2 id="review-round-summary-title">本轮复练小结</h2>
        <ReviewStats round={round} summary />
        {round.skipped > 0 && (
          <p className="review-round-note">
            跳过 {round.skipped} 道已在别处解决或暂不可复练的题。
          </p>
        )}
        <Link className="button primary" to="/dashboard?tab=review">
          返回待复练列表
        </Link>
      </div>
      <StudyDeskImage className="review-desk-image" />
    </section>
  );
}
