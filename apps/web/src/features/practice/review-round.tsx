import { useEffect, useState } from "react";
import type { LearningReviewRoundView } from "@zhixue/shared";
import { Link } from "react-router-dom";

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
  if (!round)
    return (
      <section
        className="review-round-meter review-round-sync"
        aria-label="本轮复练进度"
        aria-busy="true"
      >
        <h2>本轮复练</h2>
        <p className="muted" role="status">
          正在同步进度…
        </p>
      </section>
    );

  const denominator = Math.max(1, round.total);
  const correctShare = (100 * round.correct) / denominator;
  const skippedShare = (100 * round.skipped) / denominator;

  return (
    <section
      className="review-round-meter"
      aria-labelledby="review-round-title"
      aria-busy={!current}
    >
      <div className="review-round-heading">
        <h2 id="review-round-title">本轮复练</h2>
        <span>{current ? `共 ${round.total} 道` : "同步进度中…"}</span>
      </div>
      <dl className="review-round-stats" aria-live="polite">
        <div>
          <dt>已答对</dt>
          <dd>
            {round.correct}
            <span>道</span>
          </dd>
        </div>
        <div>
          <dt>还剩</dt>
          <dd>
            {round.remaining}
            <span>道</span>
          </dd>
        </div>
      </dl>
      <div
        className="review-round-track"
        role="progressbar"
        aria-label="本轮复练进度"
        aria-valuemin={0}
        aria-valuemax={denominator}
        aria-valuenow={round.total - round.remaining}
        aria-valuetext={`已答对 ${round.correct} 道，还剩 ${round.remaining} 道${round.skipped ? `，跳过 ${round.skipped} 道` : ""}`}
      >
        <span
          className="review-round-fill"
          style={{ width: `${correctShare}%` }}
        />
        {round.skipped > 0 && (
          <span
            className="review-round-skip"
            style={{ width: `${skippedShare}%` }}
          />
        )}
      </div>
      {round.skipped > 0 && (
        <p className="review-round-note">
          有 {round.skipped} 道题已在别处解决或暂不可复练。
        </p>
      )}
    </section>
  );
}

export function ReviewRoundSummary({
  round,
}: {
  round: LearningReviewRoundView;
}) {
  return (
    <section
      className="review-round-summary"
      aria-labelledby="review-round-summary-title"
    >
      <span className="review-round-check" aria-hidden="true">
        ✓
      </span>
      <div>
        <h2 id="review-round-summary-title">本轮复练小结</h2>
        <p role="status">
          本轮答对 <strong>{round.correct}</strong> 道，待复练{" "}
          <strong>0</strong> 道。
        </p>
        {round.skipped > 0 && (
          <p>跳过 {round.skipped} 道已在别处解决或暂不可复练的题。</p>
        )}
        <Link className="button primary" to="/dashboard?tab=review">
          返回待复练列表
        </Link>
      </div>
    </section>
  );
}
