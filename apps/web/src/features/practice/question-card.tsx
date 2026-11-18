import { useRef, useState, type ReactNode } from "react";
import { Alert, Button, Radio, Space, Tag } from "antd";
import { Link, useLocation } from "react-router-dom";
import type { AttemptView, QuestionView } from "@zhixue/shared";
import { difficultyOptions, subjectOptions } from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { api } from "@/lib/api";
import { QuestionDiagram } from "./question-diagram";
import { QuestionScratchpad } from "./scratchpad";

export const optionLetter = (index: number) => String.fromCharCode(65 + index);

export function AttemptResult({ attempt }: { attempt: AttemptView }) {
  return (
    <div
      className={`answer-result ${attempt.correct ? "answer-correct" : "answer-wrong"}`}
      aria-live="polite"
    >
      <h3>
        {attempt.correct
          ? "🎉 答对了！思路很清晰，继续保持"
          : "💡 这道题再想一想，看看关键步骤"}
      </h3>
      <p className="answer-choice-summary">
        你的选择：<strong>{optionLetter(attempt.selected)}</strong> · 正确答案：
        <strong>{optionLetter(attempt.snapshot.answer)}</strong>
      </p>
      <h4>答案解析</h4>
      <p className="question-text">{attempt.snapshot.explanation}</p>
    </div>
  );
}

export function QuestionCard({
  question,
  wrongCount,
  reviewAction,
  onAttempt,
  roundId,
}: {
  question: QuestionView;
  wrongCount?: number;
  reviewAction?: (attempt: AttemptView) => ReactNode;
  onAttempt?: (attempt: AttemptView) => void;
  roundId?: string;
}) {
  const { user } = useAuth();
  const location = useLocation();
  const [selected, setSelected] = useState<number>();
  const [result, setResult] = useState<AttemptView>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showScratch, setShowScratch] = useState(false);
  const requestId = useRef(crypto.randomUUID());

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const attempt = await api<AttemptView>(
        `/api/practice/questions/${question.id}/attempts`,
        "POST",
        {
          selected,
          requestId: requestId.current,
          updatedAt: question.updatedAt,
          ...(roundId ? { roundId } : {}),
        },
      );
      setResult(attempt);
      onAttempt?.(attempt);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const diffLabel = difficultyOptions.find(
    (d) => d.value === question.difficulty,
  )?.label;
  const diffColor =
    question.difficulty === "EASY"
      ? "green"
      : question.difficulty === "HARD"
        ? "volcano"
        : "geekblue";

  return (
    <article className="question-card">
      <div className="question-card-top">
        <div className="question-meta">
          <Tag color="blue">
            {subjectOptions.find((s) => s.value === question.subject)?.label}
          </Tag>
          <Tag color={diffColor}>{diffLabel}</Tag>
          {question.knowledgePoint && (
            <span className="kp-chip">📌 {question.knowledgePoint}</span>
          )}
          {wrongCount && (
            <span className="wrong-chip">曾答错 {wrongCount} 次</span>
          )}
        </div>
        <button
          type="button"
          className={`scratchpad-toggle-btn ${showScratch ? "is-open" : ""}`}
          aria-expanded={showScratch}
          onClick={() => setShowScratch((value) => !value)}
        >
          {showScratch ? "收起草稿纸" : "✏️ 草稿演算纸"}
        </button>
      </div>

      <h2 className="question-text">{question.title}</h2>
      <QuestionDiagram diagram={question.diagram} />

      {showScratch && <QuestionScratchpad />}

      <Radio.Group
        value={selected}
        disabled={busy || !!result}
        onChange={(e) => {
          setSelected(e.target.value);
          setError("");
        }}
        aria-label="选择答案"
        className="question-options"
      >
        {question.options.map((text, index) => {
          const isCorrectOpt = result && result.snapshot.answer === index;
          const isWrongPicked =
            result && !result.correct && result.selected === index;
          const stateClass = isCorrectOpt
            ? "opt-is-correct"
            : isWrongPicked
              ? "opt-is-wrong"
              : "";
          return (
            <Radio key={index} value={index} className={stateClass}>
              <strong className="option-badge">{optionLetter(index)}</strong>
              <span>{text}</span>
            </Radio>
          );
        })}
      </Radio.Group>

      {error && <Alert type="error" title={error} />}

      {result ? (
        <>
          <AttemptResult attempt={result} />
          {wrongCount && result.correct && (
            <p className="muted">✨ 太棒了！这道题已移入「已答对」列表。</p>
          )}
          <Space wrap>
            {!(roundId && result.correct) && (
              <Button
                onClick={() => {
                  setResult(undefined);
                  setSelected(undefined);
                  requestId.current = crypto.randomUUID();
                }}
              >
                再做一遍
              </Button>
            )}
            {reviewAction ? (
              reviewAction(result)
            ) : (
              <Link className="text-link" to="/practice?mode=wrong">
                查看我的错题本
              </Link>
            )}
            <Link className="text-link" to="/ai-teacher">
              ✨ 还有疑问？问问 AI 老师
            </Link>
          </Space>
        </>
      ) : (
        <div className="question-submit">
          {user ? (
            <Button
              type="primary"
              size="large"
              loading={busy}
              disabled={selected === undefined}
              onClick={() => void submit()}
            >
              确认提交答案
            </Button>
          ) : (
            <Link
              className="button primary"
              to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`}
            >
              登录后作答
            </Link>
          )}
          <span className="muted">先独立选择，提交后立即查看详细解析</span>
        </div>
      )}
    </article>
  );
}
