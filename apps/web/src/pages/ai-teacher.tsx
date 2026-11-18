import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Input, Popconfirm, Space, Tag } from "antd";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/auth/auth-provider";
import { api } from "@/lib/api";
import { PhotoQuestion } from "@/features/practice/photo-question";
import { AnswerActions } from "@/features/practice/answer-actions";
type Turn = {
  id: string;
  question: string;
  answer: string | null;
  status: string;
  createdAt: string;
};
export default function AiTeacher() {
  const { user } = useAuth();
  return <AiTeacherSession key={user?.id ?? "guest"} />;
}
function AiTeacherSession() {
  const photoMode = useLocation().pathname === "/photo-question";
  const { user } = useAuth();
  const [imageAttachment, setImageAttachment] = useState<string>();
  const [imagesEnabled, setImagesEnabled] = useState(false);
  const [currentAnswer, setCurrentAnswer] = useState<Turn>();
  const [retry, setRetry] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const submitting = useRef(false);
  const answerPanel = useRef<HTMLDivElement>(null);
  const [enabled, setEnabled] = useState(false),
    [ready, setReady] = useState(false),
    [question, setQuestion] = useState(""),
    [items, setItems] = useState<Turn[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<{ text: string; image?: string; id: string }>();
  function revise(text: string) {
    setQuestion(text);
    setImageAttachment(undefined);
    pending.current = undefined;
    setRetry(false);
    setError("");
    setNotice(
      "题干已放回提问框。请校对不清楚的条件；如需看图，请重新勾选并填入照片。再次提问会产生新的模型请求。",
    );
    requestAnimationFrame(() =>
      document
        .getElementById("ai-question-editor")
        ?.scrollIntoView({ block: "start" }),
    );
  }
  function acceptResult(result: Turn) {
    if (result.status === "FAILED") {
      pending.current = undefined;
      setRetry(true);
      setError(
        "本次解题未完成，照片和文字已保留。点击“重新解题”会发起一次新的模型请求。",
      );
    } else if (result.status === "PENDING") {
      setError(
        "这个问题仍在处理中，请稍后点击“检查解题结果”，不会重复调用模型。",
      );
    } else {
      setCurrentAnswer(result);
      setQuestion("");
      setImageAttachment(undefined);
      pending.current = undefined;
      setRetry(false);
      setError("");
      requestAnimationFrame(() =>
        answerPanel.current?.scrollIntoView({
          behavior: "auto",
          block: "start",
        }),
      );
    }
  }
  async function history() {
    if (user) {
      const d = await api<{ items: Turn[] }>("/api/ai/history");
      setItems(d.items);
    }
  }
  useEffect(() => {
    api<{ enabled: boolean; imagesEnabled?: boolean }>("/api/ai/status")
      .then((d) => {
        setEnabled(d.enabled);
        setImagesEnabled(!!d.imagesEnabled);
      })
      .catch((e) => setError(e.message))
      .finally(() => setReady(true));
    void history().catch((e) => setError(e.message));
  }, [user]);
  async function ask() {
    if (submitting.current || photoBusy) return;
    submitting.current = true;
    setBusy(true);
    setNotice("");
    setError("");
    if (
      pending.current?.text !== question ||
      pending.current?.image !== imageAttachment
    )
      pending.current = {
        text: question,
        image: imageAttachment,
        id: crypto.randomUUID(),
      };
    try {
      const result = await api<Turn>("/api/ai/questions", "POST", {
        question,
        requestId: pending.current!.id,
        ...(imageAttachment ? { image: imageAttachment } : {}),
      });
      acceptResult(result);
    } catch (e) {
      setError((e as Error).message);
      if (pending.current) {
        try {
          acceptResult(
            await api<Turn>(`/api/ai/questions/${pending.current.id}`),
          );
        } catch {
          // Keep the same request id when the outcome is unknown.
        }
      }
    } finally {
      await history().catch(() => {});
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <section className="wrap account-page ai-page">
      <div className="account-heading">
        <div>
          <h1>{photoMode ? "拍照识题" : "AI 老师"}</h1>
          <p className="intro">
            {photoMode
              ? "照片在本机识别，校对后再决定是否提问。"
              : "描述你的思路，让 AI 帮你找到下一步。"}
          </p>
        </div>
        <Tag color={enabled ? "green" : "default"}>
          {!ready ? "检查中" : enabled ? "模型已配置" : "等待配置模型"}
        </Tag>
      </div>
      {!enabled && ready && (
        <Alert
          type="info"
          showIcon
          title="AI 老师尚未启用"
          description="提问界面与记录功能已准备好。管理员配置模型并启用后才能回答；当前不会发送问题或产生模型调用。"
        />
      )}
      <p className="muted">
        启用后，你主动提交的问题会发送到管理员配置的模型服务，账号与个人资料不会附带发送。回答可能有误，请结合教材和老师意见核对。不要填写姓名、学校、联系方式等个人信息。
      </p>
      {error && <Alert type="error" title={error} />}
      {notice && <Alert type="info" title={notice} />}
      <PhotoQuestion
        key={user?.id ?? "guest"}
        imagesEnabled={imagesEnabled}
        locked={busy}
        onBusyChange={setPhotoBusy}
        onImageChange={() => {
          setImageAttachment(undefined);
          pending.current = undefined;
          setRetry(false);
          setCurrentAnswer(undefined);
        }}
        onUse={(text, image) => {
          setNotice("");
          setCurrentAnswer(undefined);
          setQuestion(text);
          setImageAttachment(image);
          pending.current = undefined;
          setError("");
          setRetry(false);
        }}
      />
      <Card title="说出你的问题" id="ai-question-editor">
        {imageAttachment && (
          <Alert
            type="info"
            title="本次提问已附照片，点击提问会发送给模型服务。"
            description={
              <img
                src={imageAttachment}
                alt="待发送给模型的照片"
                style={{
                  maxWidth: "100%",
                  maxHeight: 200,
                  objectFit: "contain",
                }}
              />
            }
            action={
              <Button
                disabled={busy}
                onClick={() => {
                  setImageAttachment(undefined);
                  pending.current = undefined;
                }}
              >
                移除照片
              </Button>
            }
          />
        )}
        <div className="ai-prompt-chips" aria-label="提问灵感模板">
          <span className="ai-chips-label">💡 提问小帮手：</span>
          {[
            "我算到一半卡住了，请帮我看看下一步该怎么想：",
            "这道题主要考查哪个知识点？突破口在哪里？",
            "请用通俗好懂的生活例子帮我理解这个概念：",
            "帮我总结一下这类题型的常见易错点和检查方法：",
          ].map((starter) => (
            <button
              key={starter}
              type="button"
              className="ai-chip-btn"
              disabled={busy || photoBusy}
              onClick={() =>
                setQuestion((prev) =>
                  prev.trim() ? `${starter}\n${prev}` : starter,
                )
              }
            >
              {starter.replace("：", "")}
            </button>
          ))}
        </div>
        <Input.TextArea
          aria-label="学习问题"
          rows={5}
          maxLength={2000}
          showCount
          value={question}
          disabled={busy || photoBusy}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="例如：我知道一元一次方程要移项，但不理解为什么移项要变号……"
        />
        <Space wrap className="lesson-actions">
          {user ? (
            <Button
              type="primary"
              loading={busy}
              disabled={!enabled || photoBusy || question.trim().length < 2}
              onClick={() => void ask()}
            >
              {retry
                ? "重新解题"
                : pending.current
                  ? "检查解题结果"
                  : imageAttachment
                    ? "分析照片并解题"
                    : "请老师给个提示"}
            </Button>
          ) : (
            <Link className="button primary" to="/login?next=%2Fai-teacher">
              登录后提问
            </Link>
          )}
          <Button
            disabled={busy || photoBusy}
            onClick={() => {
              setQuestion("");
              setImageAttachment(undefined);
              pending.current = undefined;
              setError("");
              setRetry(false);
              setCurrentAnswer(undefined);
              setNotice("");
            }}
          >
            开始新问题
          </Button>
        </Space>
      </Card>
      {busy && (
        <p role="status">
          正在核对题意并生成解题思路，请保留当前页面；照片不会自动重复提交。
        </p>
      )}
      {currentAnswer && (
        <div ref={answerPanel} className="ai-current-answer" aria-live="polite">
          <Card title="本次解题思路">
            <h3 className="question-text">{currentAnswer.question}</h3>
            <p className="lesson-prose">{currentAnswer.answer}</p>
            <p className="muted">
              AI回答可能有误，请核对题干、图形标注和计算，必要时请老师确认。
            </p>
            <AnswerActions
              question={currentAnswer.question}
              answer={currentAnswer.answer ?? ""}
              disabled={busy || photoBusy}
              onRevise={() => revise(currentAnswer.question)}
            />
          </Card>
        </div>
      )}
      {user && (
        <>
          <div className="account-heading">
            <h2>我的提问记录</h2>
            <Space wrap>
              <Button
                onClick={() => void history().catch((e) => setError(e.message))}
              >
                刷新记录
              </Button>
              <Popconfirm
                title="永久删除已完成的提问记录？处理中问题保留。"
                onConfirm={async () => {
                  try {
                    await api("/api/ai/history", "DELETE", { confirm: true });
                    await history();
                  } catch (e) {
                    setError((e as Error).message);
                  }
                }}
              >
                <Button danger disabled={!items.length}>
                  清空记录
                </Button>
              </Popconfirm>
            </Space>
          </div>
          {!items.length ? (
            <p className="muted">还没有提问记录。</p>
          ) : (
            items.map((t) => (
              <Card key={t.id} className="lesson-chapter">
                <p className="muted">
                  {new Date(t.createdAt).toLocaleString("zh-CN")} ·{" "}
                  {t.status === "SUCCEEDED"
                    ? "已回答"
                    : t.status === "PENDING"
                      ? "处理中"
                      : "未完成"}
                </p>
                {t.status === "SUCCEEDED" && t.answer && (
                  <AnswerActions
                    question={t.question}
                    answer={t.answer}
                    disabled={busy || photoBusy}
                    onRevise={() => revise(t.question)}
                  />
                )}
                <h3 className="question-text">{t.question}</h3>
                <p className="lesson-prose">
                  {t.answer ??
                    (t.status === "PENDING"
                      ? "问题仍在处理中，稍后刷新。"
                      : "本次未能生成回答。")}
                </p>
              </Card>
            ))
          )}
        </>
      )}
    </section>
  );
}
