import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Modal,
  Popconfirm,
  Radio,
  Space,
  Spin,
  Tag,
} from "antd";
import {
  renderDiagramSvg,
  type QuestionReviewView,
  type QuestionEdit,
} from "@zhixue/shared";
import { api, ApiError } from "@/lib/api";
import { QuestionDiagram } from "./question-diagram";

const checks = [
  "题干、选项和题图条件已核对",
  "正确答案已独立核算",
  "解析步骤、单位和适用条件已核对",
  "关联课时与学生可见范围已核对",
];
export function QuestionReview({
  questionId,
  onClose,
  onPublished,
  onEdit,
  navigation,
}: {
  questionId: string;
  onClose: () => void;
  onPublished: () => Promise<void>;
  onEdit?: (question: QuestionEdit) => void;
  navigation?: {
    index: number;
    total: number;
    previous: () => void;
    next: () => void;
  };
}) {
  const [question, setQuestion] = useState<QuestionReviewView>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [stale, setStale] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [checked, setChecked] = useState<boolean[]>(checks.map(() => false));
  const [picked, setPicked] = useState<number>();
  const sequence = useRef(0);
  const saving = useRef(false);
  async function load() {
    const id = ++sequence.current;
    setQuestion(undefined);
    setStale(false);
    setLoading(true);
    setError("");
    setRevealed(false);
    setPicked(undefined);
    setChecked(checks.map(() => false));
    try {
      const data = await api<QuestionReviewView>(
        `/api/admin/questions/${encodeURIComponent(questionId)}/review`,
      );
      if (id === sequence.current) setQuestion(data);
    } catch (e) {
      if (id === sequence.current) setError((e as Error).message);
    } finally {
      if (id === sequence.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      sequence.current++;
    };
  }, [questionId]);
  let diagramValid = true;
  if (question?.diagram) {
    try {
      renderDiagramSvg(question.diagram);
    } catch {
      diagramValid = false;
    }
  }
  const structurallyValid =
    !!question &&
    !!question.title.trim() &&
    question.options.length === 4 &&
    question.options.every((option) => !!option.trim()) &&
    new Set(question.options.map((option) => option.trim())).size === 4 &&
    Number.isInteger(question.answer) &&
    question.answer >= 0 &&
    question.answer < 4 &&
    !!question.explanation.trim() &&
    diagramValid &&
    !(question.restrictToLessons && !question.lessonLinks.length);
  const canPublish =
    !!question &&
    question.status !== "PUBLISHED" &&
    structurallyValid &&
    revealed &&
    checked.every(Boolean) &&
    !busy &&
    !stale &&
    !loading;
  async function publish() {
    if (!question || !canPublish || saving.current) return;
    saving.current = true;
    setBusy(true);
    setError("");
    try {
      const published = await api<QuestionEdit>(
        `/api/admin/questions/${question.id}/status`,
        "PATCH",
        {
          status: "PUBLISHED",
          updatedAt: question.updatedAt,
        },
      );
      setQuestion({
        ...question,
        status: published.status,
        updatedAt: published.updatedAt,
      });
      setChecked(checks.map(() => false));
      try {
        await onPublished();
      } catch {
        setError("题目已发布，但列表刷新未完成。请关闭预览后刷新列表核对。");
        return;
      }
      if (!navigation) onClose();
    } catch (e) {
      if (e instanceof ApiError && (e.status === 409 || e.status === 404)) {
        setStale(true);
        setChecked(checks.map(() => false));
      }
      setError((e as Error).message);
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <Modal
      open
      title="题目预览与发布前核对"
      width={960}
      style={{ top: 24 }}
      onCancel={() => {
        if (!busy) onClose();
      }}
      closable={!busy}
      maskClosable={!busy}
      keyboard={!busy}
      styles={{ body: { maxHeight: "60vh", overflowY: "auto" } }}
      footer={
        <>
          {navigation && (
            <div className="question-review-navigation">
              <Button
                disabled={busy || loading || navigation.index === 0}
                onClick={navigation.previous}
              >
                上一题
              </Button>
              <span role="status">
                当前页第 {navigation.index + 1} / {navigation.total} 题
              </span>
              <Button
                disabled={
                  busy || loading || navigation.index >= navigation.total - 1
                }
                onClick={navigation.next}
              >
                下一题
              </Button>
            </div>
          )}
          <Space wrap>
            <Button disabled={busy || loading} onClick={() => void load()}>
              刷新预览并重新核对
            </Button>
            <Button disabled={busy} onClick={onClose}>
              关闭预览
            </Button>
            {onEdit && question && (
              <Button
                disabled={
                  busy ||
                  loading ||
                  stale ||
                  question.status === "PUBLISHED" ||
                  !!question._count?.attempts
                }
                onClick={() => onEdit(question)}
              >
                编辑这道题
              </Button>
            )}
            {question?.status !== "PUBLISHED" && (
              <Popconfirm
                title="确认完成本次核对并发布这道题？"
                description="发布后按关联课程与课时的当前权限向学生开放。"
                onConfirm={() => void publish()}
                disabled={!canPublish}
              >
                <Button type="primary" loading={busy} disabled={!canPublish}>
                  确认核对后发布
                </Button>
              </Popconfirm>
            )}
          </Space>
        </>
      }
    >
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          description="若题目版本已变更，请刷新预览并重新核对。"
        />
      )}
      {loading && (
        <Spin description="正在读取最新题目…">
          <div style={{ height: 100 }} />
        </Spin>
      )}
      {question && (
        <>
          {navigation && (
            <p className="muted">
              仅按打开时当前页的题目顺序切换。上一题、下一题不保存核对或发布；每题都需重新检查。
            </p>
          )}
          <Tag>
            {question.status === "PUBLISHED"
              ? "已发布"
              : question.status === "ARCHIVED"
                ? "已归档"
                : "草稿"}
          </Tag>
          <h3>学生题面预览</h3>
          <p className="muted">
            这里的选择只用于核对题面，不提交作答，也不修改学习记录。
          </p>
          <h2 className="question-text">{question.title}</h2>
          {diagramValid ? (
            <QuestionDiagram diagram={question.diagram} />
          ) : (
            <Alert type="error" title="题图格式异常，请先编辑修正。" />
          )}
          <Radio.Group
            className="question-options"
            aria-label="预览中选择答案"
            value={picked}
            disabled={busy}
            onChange={(e) => setPicked(e.target.value)}
          >
            {question.options.map((option, i) => (
              <Radio key={i} value={i}>
                <strong>{String.fromCharCode(65 + i)}</strong>
                <span>{option}</span>
              </Radio>
            ))}
          </Radio.Group>
          <h3>答案与解析</h3>
          <Button
            disabled={busy}
            onClick={() => setRevealed((value) => !value)}
          >
            {revealed ? "收起答案与解析" : "查看答案与解析"}
          </Button>
          {revealed && (
            <div className="answer-result">
              <p>
                <strong>正确答案：</strong>
                {question.answer >= 0 &&
                question.answer < question.options.length
                  ? String.fromCharCode(65 + question.answer)
                  : "未正确设置"}
              </p>
              <p className="question-text">
                {question.explanation || "尚未填写解析。"}
              </p>
            </div>
          )}
          <h3>关联课时与可见范围</h3>
          <p className="muted">
            同一道题关联多个课时时，满足任一可见关联即可展示；会员课关联不会阻止其他免费课关联公开这道题。
          </p>
          {!question.lessonLinks.length ? (
            <p>
              {question.restrictToLessons
                ? "题目有课时限制但缺少关联，学生暂不可访问，请先编辑关联。"
                : "未关联课时，发布后会作为公开练习题展示。"}
            </p>
          ) : (
            <ul>
              {question.lessonLinks.map((link) => (
                <li key={link.lessonId}>
                  <p>
                    {link.lesson.chapter.course.title} /{" "}
                    {link.lesson.chapter.title} / {link.lesson.title}
                  </p>
                  <p className="muted">
                    {link.lesson.chapter.course.status !== "PUBLISHED"
                      ? "课程未发布，学生暂不可访问。"
                      : !link.lesson.publishedAt
                        ? "课时尚未开放。"
                        : link.lesson.chapter.course.access === "MEMBER"
                          ? "会员课程，仍须符合课程与会员访问条件。"
                          : "题目发布后可随此开放课时公开展示。"}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {question.status === "PUBLISHED" ? (
            <Alert
              type="info"
              title={
                navigation
                  ? "本题已发布，可继续查看下一题。已有作答的题目需保留原版。"
                  : "已发布题目仅供查看，已有作答的题目需保留原版。"
              }
            />
          ) : (
            <>
              {!structurallyValid && (
                <Alert
                  type="warning"
                  title="本页基础检查未通过"
                  description="请检查题干、四个不同选项、答案、解析、题图及课时关联，关闭预览后编辑修正。"
                />
              )}
              <h3>本次人工核对</h3>
              <div className="question-review-checks">
                {checks.map((label, i) => (
                  <Checkbox
                    key={label}
                    checked={checked[i]}
                    disabled={busy || stale || (i === 1 && !revealed)}
                    onChange={(e) =>
                      setChecked((values) =>
                        values.map((value, index) =>
                          index === i ? e.target.checked : value,
                        ),
                      )
                    }
                  >
                    {label}
                  </Checkbox>
                ))}
              </div>
              <p className="muted">
                勾选只用于本次核对，不保存为独立教研审核记录。题目或关联课程变更后需重新检查；刷新预览会清空勾选。
              </p>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
