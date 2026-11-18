import { useEffect, useState } from "react";
import { gradeOptions, roleLabels } from "@zhixue/shared";
import Link from "@/components/link";
import { useAuth } from "@/auth/auth-provider";

const FOCUS_SECONDS = 25 * 60;
const EYECARE_KEY = "zhixue_eyecare_mode";

export function StudentStudyBar({ pageName }: { pageName: string }) {
  const { user } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState(FOCUS_SECONDS);
  const [running, setRunning] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const [eyeCare, setEyeCare] = useState(() => {
    try {
      return window.localStorage.getItem(EYECARE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    document.documentElement.dataset.eyecare = eyeCare ? "true" : "false";
    try {
      window.localStorage.setItem(EYECARE_KEY, eyeCare ? "1" : "0");
    } catch {
      // Ignore storage quota errors in private browsing.
    }
  }, [eyeCare]);

  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setRunning(false);
          setDoneCount((count) => count + 1);
          return FOCUS_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");
  const gradeLabel = user?.grade
    ? gradeOptions.find((g) => g.value === user.grade)?.label
    : undefined;

  return (
    <div className="shell-context wrap">
      <div className="shell-context-left">
        <span className="shell-page-pill" aria-current="page">
          {pageName}
        </span>
        {user && (
          <span className="shell-student-badge">
            {gradeLabel ? `${gradeLabel} · ` : ""}
            {roleLabels[user.role]}
          </span>
        )}
      </div>

      <div
        className="shell-study-tools"
        role="group"
        aria-label="专注与护眼工具"
      >
        <div className={`pomodoro-pill ${running ? "is-active" : ""}`}>
          <span className="pomodoro-time" aria-live="off">
            🍅 {mins}:{secs}
          </span>
          <button
            type="button"
            className="pomodoro-btn"
            onClick={() => setRunning((value) => !value)}
          >
            {running
              ? "暂停"
              : secondsLeft < FOCUS_SECONDS
                ? "继续"
                : "专注25分"}
          </button>
          {secondsLeft < FOCUS_SECONDS && (
            <button
              type="button"
              className="pomodoro-reset"
              aria-label="重置专注计时"
              onClick={() => {
                setRunning(false);
                setSecondsLeft(FOCUS_SECONDS);
              }}
            >
              重置
            </button>
          )}
          {doneCount > 0 && (
            <span className="pomodoro-streak" title="本次页面已完成番茄钟数">
              ×{doneCount}
            </span>
          )}
        </div>

        <button
          type="button"
          className={`eyecare-toggle ${eyeCare ? "is-on" : ""}`}
          aria-pressed={eyeCare}
          onClick={() => setEyeCare((value) => !value)}
        >
          {eyeCare ? "🌙 护眼暖纸" : "☀️ 清爽日间"}
        </button>

        <Link href="/trial" className="shell-feedback-link">
          试学与反馈
        </Link>
      </div>
    </div>
  );
}
