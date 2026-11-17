import { useEffect, useRef, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Empty,
  Radio,
  Space,
  Spin,
  Statistic,
  Tag,
} from "antd";
import { useNavigate, useParams } from "react-router-dom";
import type { ExamAnswer, ExamAttemptView, ExamDetail } from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { useApiData } from "@/hooks/use-api-data";
import { examApi } from "@/api/exam";
import { QuestionDiagram } from "@/features/practice/question-diagram";
export default function ExamTake() {
  const { id = "" } = useParams(),
    { user } = useAuth(),
    { modal } = App.useApp(),
    navigate = useNavigate();
  const identity = user?.id ?? "",
    identityRef = useRef(identity);
  identityRef.current = identity;
  const meta = useApiData<ExamDetail>(`/api/exams/${encodeURIComponent(id)}`);
  const [stored, setStored] = useState<{
      owner: string;
      data: ExamAttemptView;
    } | null>(null),
    [choices, setChoices] = useState<Record<string, number | null>>({}),
    [pending, setPending] = useState(0),
    [error, setError] = useState(""),
    [starting, setStarting] = useState(false),
    [submitting, setSubmitting] = useState(false),
    [, tick] = useState(0);
  const generation = useRef(0),
    queue = useRef<Promise<void>>(Promise.resolve()),
    revision = useRef(0),
    current = useRef<ExamAttemptView | null>(null),
    latestChoices = useRef<Record<string, number | null>>({}),
    errorRef = useRef(""),
    pendingRef = useRef(0),
    submitId = useRef(crypto.randomUUID()),
    timeoutFired = useRef(false),
    clock = useRef({ server: 0, received: 0 });
  const attempt =
    stored?.owner === identity && stored.data.examId === id
      ? stored.data
      : null;
  const remaining =
    attempt && !attempt.submittedAt
      ? Math.max(
          0,
          Date.parse(attempt.expiresAt) -
            clock.current.server -
            (performance.now() - clock.current.received),
        )
      : 0;
  function apply(value: ExamAttemptView, reset = false) {
    if (value.revision < revision.current) return;
    if (value.submittedAt) {
      errorRef.current = "";
      setError("");
    } else if (!errorRef.current) setError("");
    revision.current = value.revision;
    current.current = value;
    clock.current = {
      server: Date.parse(value.serverNow),
      received: performance.now(),
    };
    setStored({ owner: identity, data: value });
    if (reset || value.submittedAt) {
      const next = Object.fromEntries(
        value.answers.map((a) => [a.questionId, a.selected]),
      );
      latestChoices.current = next;
      setChoices(next);
    }
  }
  async function reload() {
    const g = generation.current,
      owner = identity;
    const value = await examApi.attempt(id);
    if (g !== generation.current || owner !== identityRef.current) return;
    errorRef.current = "";
    setError("");
    timeoutFired.current = false;
    apply(value, true);
  }
  useEffect(() => {
    generation.current++;
    queue.current = Promise.resolve();
    current.current = null;
    revision.current = 0;
    pendingRef.current = 0;
    errorRef.current = "";
    timeoutFired.current = false;
    setStored(null);
    setChoices({});
    setPending(0);
    setError("");
    return () => {
      generation.current++;
    };
  }, [id, identity]);
  useEffect(() => {
    if (!meta.data || meta.data.attemptState === "NOT_STARTED") return;
    const g = generation.current,
      owner = identity;
    examApi
      .attempt(id)
      .then((value) => {
        if (g === generation.current && owner === identityRef.current)
          apply(value, true);
      })
      .catch((cause: unknown) => {
        if (g === generation.current)
          setError(
            cause instanceof Error ? cause.message : "考试进度加载失败。",
          );
      });
  }, [id, identity, meta.data]);
  useEffect(() => {
    if (!attempt || attempt.submittedAt) return;
    const timer = setInterval(() => tick((v) => v + 1), 500);
    return () => clearInterval(timer);
  }, [attempt?.id, attempt?.submittedAt]);
  useEffect(() => {
    if (
      !attempt ||
      attempt.submittedAt ||
      remaining > 0 ||
      timeoutFired.current
    )
      return;
    timeoutFired.current = true;
    void reload().catch((cause: unknown) =>
      setError(
        cause instanceof Error
          ? cause.message
          : "时间已到，服务器将结算已保存答案。请稍后重新加载。",
      ),
    );
  }, [attempt?.id, attempt?.submittedAt, remaining]);
  useEffect(() => {
    if (!attempt || (attempt.submittedAt && attempt.released)) return;
    const g = generation.current,
      owner = identity;
    const timer = setInterval(() => {
      void examApi
        .attempt(id)
        .then((value) => {
          if (
            g !== generation.current ||
            owner !== identityRef.current ||
            value.revision < revision.current
          )
            return;
          if (value.submittedAt) {
            apply(value, true);
            return;
          }
          if (pendingRef.current) return;
          if (value.revision > revision.current) {
            errorRef.current = "作答已在其他页面更新，请重新加载已保存答案。";
            setError(errorRef.current);
            return;
          }
          apply(value);
        })
        .catch((cause: unknown) => {
          if (g === generation.current && !errorRef.current)
            setError(
              cause instanceof Error
                ? cause.message
                : "连接暂时不可用，请重试。",
            );
        });
    }, 5000);
    return () => clearInterval(timer);
  }, [id, identity, attempt?.id, attempt?.submittedAt, attempt?.released]);
  function select(questionId: string, selected: number) {
    const value = current.current;
    if (!value || value.submittedAt || errorRef.current) return;
    const next = { ...latestChoices.current, [questionId]: selected };
    latestChoices.current = next;
    setChoices(next);
    const answers: ExamAnswer[] = value.questions.map((q) => ({
      questionId: q.id,
      selected: next[q.id] ?? null,
    }));
    const g = generation.current,
      owner = identity,
      requestId = crypto.randomUUID();
    pendingRef.current++;
    setPending(pendingRef.current);
    queue.current = queue.current.then(async () => {
      try {
        if (
          g !== generation.current ||
          owner !== identityRef.current ||
          errorRef.current ||
          current.current?.submittedAt
        )
          return;
        const saved = await examApi.save(
          id,
          revision.current,
          answers,
          requestId,
        );
        if (g === generation.current && owner === identityRef.current)
          apply(saved);
      } catch (cause) {
        if (g === generation.current) {
          errorRef.current =
            cause instanceof Error
              ? cause.message
              : "答案尚未保存，请重新加载。";
          setError(errorRef.current);
        }
      } finally {
        if (g === generation.current) {
          pendingRef.current = Math.max(0, pendingRef.current - 1);
          setPending(pendingRef.current);
        }
      }
    });
  }
  async function start() {
    setStarting(true);
    setError("");
    try {
      apply(await examApi.start(id), true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "暂时无法开始考试。");
    } finally {
      setStarting(false);
    }
  }
  async function submit() {
    setSubmitting(true);
    try {
      await queue.current;
      if (errorRef.current) throw new Error(errorRef.current);
      if (current.current?.submittedAt) return;
      apply(await examApi.submit(id, revision.current, submitId.current), true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "交卷未确认，请重新加载查看结果。",
      );
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <section className="wrap account-page relation-page">
      <div className="account-heading">
        <div>
          <p className="eyebrow">单选考试</p>
          <h1>{attempt?.title ?? meta.data?.title ?? "考试"}</h1>
        </div>
        <Button
          disabled={pending > 0 || submitting}
          onClick={() => navigate("/exams")}
        >
          返回考试列表
        </Button>
      </div>
      {(error || meta.error) && (
        <Alert
          type="error"
          title={error || meta.error}
          action={
            <Button
              disabled={pending > 0}
              onClick={() =>
                modal.confirm({
                  title: "重新加载服务器已保存的答案？",
                  content: "未保存的本地选择将被替换。",
                  okText: "重新加载",
                  cancelText: "取消",
                  onOk: () =>
                    reload().catch((cause: unknown) =>
                      setError(
                        cause instanceof Error ? cause.message : "加载失败。",
                      ),
                    ),
                })
              }
            >
              重新加载已保存答案
            </Button>
          }
        />
      )}
      {!meta.data ? (
        meta.loading ? (
          <Spin />
        ) : (
          <Empty description="考试不可用" />
        )
      ) : !attempt ? (
        <Card title="考试说明">
          <p>
            共{meta.data.questionCount}题，满分{meta.data.totalPoints}
            分，最多作答{meta.data.durationMinutes}分钟。
          </p>
          <p>
            开放：{new Date(meta.data.opensAt).toLocaleString("zh-CN")} 至{" "}
            {new Date(meta.data.closesAt).toLocaleString("zh-CN")}
          </p>
          <p>
            开始后计时持续进行，每次选择会保存到服务器；超时按已保存答案交卷。每人仅一次作答，考试结束后查看成绩与解析。
          </p>
          {meta.data.attemptState !== "NOT_STARTED" ? (
            <Spin description="加载已有作答…" />
          ) : meta.data.status === "PUBLISHED" ? (
            <Button
              type="primary"
              loading={starting}
              onClick={() =>
                modal.confirm({
                  title: "确认开始计时？",
                  okText: "开始考试",
                  cancelText: "取消",
                  onOk: start,
                })
              }
            >
              开始考试
            </Button>
          ) : (
            <Alert type="info" title="考试已结束，未找到你的作答记录。" />
          )}
        </Card>
      ) : (
        <>
          <Card className="lesson-chapter">
            <Space wrap size="large">
              {attempt.submittedAt ? (
                <Tag color="green">已交卷</Tag>
              ) : (
                <Statistic
                  title="剩余时间"
                  value={`${Math.floor(remaining / 60000)}:${String(Math.floor(remaining / 1000) % 60).padStart(2, "0")}`}
                />
              )}
              <span>满分 {attempt.totalPoints}</span>
              {!attempt.submittedAt && (
                <span aria-live="polite">
                  {pending
                    ? `正在保存（${pending}）`
                    : errorRef.current
                      ? "有未确认的答案"
                      : "当前答案已保存"}
                </span>
              )}
              {attempt.released && (
                <Statistic
                  title="得分"
                  value={attempt.score ?? 0}
                  suffix={`/ ${attempt.totalPoints}`}
                />
              )}
            </Space>
          </Card>
          {attempt.submittedAt && !attempt.released && (
            <Alert type="info" title="交卷已保存，考试结束后开放成绩与解析。" />
          )}
          {attempt.questions.map((q, index) => (
            <Card
              title={`第${index + 1}题 · ${q.points}分`}
              key={q.id}
              className="lesson-chapter"
            >
              <h2 className="exam-question-title">{q.title}</h2>
              <QuestionDiagram diagram={q.diagram} />
              <Radio.Group
                className="exam-question-options"
                aria-label={`第${index + 1}题选项`}
                value={choices[q.id]}
                disabled={
                  !!attempt.submittedAt ||
                  remaining <= 0 ||
                  submitting ||
                  !!errorRef.current
                }
                onChange={(event) => select(q.id, event.target.value as number)}
              >
                <Space direction="vertical">
                  {q.options.map((option, n) => (
                    <Radio key={n} value={n}>
                      {String.fromCharCode(65 + n)}. {option}
                    </Radio>
                  ))}
                </Space>
              </Radio.Group>
              {attempt.released && (
                <>
                  <p>
                    正确答案：
                    {q.answer === undefined
                      ? "—"
                      : String.fromCharCode(65 + q.answer)}{" "}
                    · 我的选择：
                    {choices[q.id] == null
                      ? "未作答"
                      : String.fromCharCode(65 + choices[q.id]!)}
                  </p>
                  <div className="relation-prose">{q.explanation}</div>
                </>
              )}
            </Card>
          ))}
          {!attempt.submittedAt && (
            <Button
              type="primary"
              loading={submitting}
              disabled={remaining <= 0 || !!errorRef.current}
              onClick={() =>
                modal.confirm({
                  title: "确认交卷？",
                  content: "交卷后不能修改答案。",
                  okText: "确认交卷",
                  cancelText: "继续作答",
                  onOk: submit,
                })
              }
            >
              交卷并结束作答
            </Button>
          )}
        </>
      )}
    </section>
  );
}
