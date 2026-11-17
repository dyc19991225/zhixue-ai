import { useRef, useState, type ReactNode } from "react";
import { Alert, Button, Radio, Space, Tag } from "antd";
import { Link } from "react-router-dom";
import type { AttemptView, QuestionView } from "@zhixue/shared";
import { difficultyOptions, subjectOptions } from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { api } from "@/lib/api";
import { QuestionDiagram } from "./question-diagram";
export const optionLetter = (index: number) => String.fromCharCode(65 + index);
export function AttemptResult({ attempt }: { attempt: AttemptView }) {
  return (
    <div
      className={`answer-result ${attempt.correct ? "answer-correct" : "answer-wrong"}`}
      aria-live="polite"
    >
      <h3>{attempt.correct ? "答对了，继续保持" : "这道题再想一想"}</h3>
      <p>
        你的选择：{optionLetter(attempt.selected)} / 正确答案：
        {optionLetter(attempt.snapshot.answer)}
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
}: {
  question: QuestionView;
  wrongCount?: number;
  reviewAction?: (attempt: AttemptView) => ReactNode;
}) {
  const { user } = useAuth();
  const [selected, setSelected] = useState<number>(),
    [result, setResult] = useState<AttemptView>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  async function submit() {
    setBusy(true);
    setError("");
    try {
      setResult(
        await api<AttemptView>(
          `/api/practice/questions/${question.id}/attempts`,
          "POST",
          {
            selected,
            requestId: requestId.current,
            updatedAt: question.updatedAt,
          },
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="question-card">
      <div className="question-meta">
        <Tag color="blue">
          {subjectOptions.find((s) => s.value === question.subject)?.label}
        </Tag>
        <Tag>
          {
            difficultyOptions.find((d) => d.value === question.difficulty)
              ?.label
          }
        </Tag>
        {question.knowledgePoint && <span>{question.knowledgePoint}</span>}
        {wrongCount && <span>累计答错 {wrongCount} 次</span>}
      </div>
      <h2 className="question-text">{question.title}</h2>
      <QuestionDiagram diagram={question.diagram} />
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
        {question.options.map((text, index) => (
          <Radio key={index} value={index}>
            <strong>{optionLetter(index)}</strong>
            <span>{text}</span>
          </Radio>
        ))}
      </Radio.Group>
      {error && <Alert type="error" title={error} />}
      {result ? (
        <>
          <AttemptResult attempt={result} />
          {wrongCount && result.correct && (
            <p className="muted">这道题已进入“已答对”。</p>
          )}
          <Space wrap>
            <Button
              onClick={() => {
                setResult(undefined);
                setSelected(undefined);
                requestId.current = crypto.randomUUID();
              }}
            >
              重新练习
            </Button>
            {reviewAction ? (
              reviewAction(result)
            ) : (
              <Link className="text-link" to="/practice?mode=wrong">
                查看我的错题
              </Link>
            )}
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
              确认答案
            </Button>
          ) : (
            <Link
              className="button primary"
              to={`/login?next=${encodeURIComponent("/practice")}`}
            >
              登录后作答
            </Link>
          )}
          <span className="muted">提交后查看答案解析</span>
        </div>
      )}
    </article>
  );
}
