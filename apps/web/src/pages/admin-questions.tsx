import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/auth-provider";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import type { PageData, QuestionEdit } from "@zhixue/shared";
import {
  difficultyOptions,
  gradeOptions,
  subjectOptions,
} from "@zhixue/shared";
import { api } from "@/lib/api";
import { DiagramEditor } from "@/features/practice/diagram-editor";
import { QuestionReview } from "@/features/practice/question-review";
export default function AdminQuestions() {
  const { user } = useAuth();
  return <AdminQuestionSession key={user?.id} />;
}
function AdminQuestionSession() {
  const [params, setParams] = useSearchParams();
  const query = new URLSearchParams();
  for (const key of [
    "grade",
    "subject",
    "status",
    "lessonId",
    "page",
    "q",
    "difficulty",
    "knowledgePoint",
  ]) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const page = Number(query.get("page") ?? 1);
  const queryKey = query.toString();
  const currentQuery = useRef(queryKey);
  currentQuery.current = queryKey;
  const sequence = useRef(0);
  const lessonId = query.get("lessonId");
  const appliedText = query.get("q") ?? "";
  const appliedKnowledge = query.get("knowledgePoint") ?? "";
  const [searchText, setSearchText] = useState(appliedText);
  const [knowledgeText, setKnowledgeText] = useState(appliedKnowledge);
  const [searchError, setSearchError] = useState("");
  useEffect(() => {
    setSearchText(appliedText);
    setKnowledgeText(appliedKnowledge);
    setSearchError("");
  }, [appliedText, appliedKnowledge]);
  function search(reset = false) {
    const text = reset ? "" : searchText.trim();
    const knowledge = reset ? "" : knowledgeText.trim();
    if (text && text.length < 2) {
      setSearchError("题干关键词至少输入2个字；也可以清空后只按知识点筛选。");
      return;
    }
    setSearchError("");
    if (reset) {
      setSearchText("");
      setKnowledgeText("");
    }
    const next = new URLSearchParams(queryKey);
    if (text) next.set("q", text);
    else next.delete("q");
    if (knowledge) next.set("knowledgePoint", knowledge);
    else next.delete("knowledgePoint");
    next.set("page", "1");
    setEditing(null);
    setParams(next);
  }
  function filter(key: string, value?: string) {
    const next = new URLSearchParams(queryKey);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    setEditing(null);
    setParams(next);
  }
  const [data, setData] = useState<PageData<QuestionEdit>>(),
    [editing, setEditing] = useState<QuestionEdit | "new" | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [form] = Form.useForm();
  const [reviewQueue, setReviewQueue] = useState<{
    ids: string[];
    index: number;
    query: string;
  }>();
  const loadedQuery = useRef<string>();
  const reviewId = reviewQueue?.ids[reviewQueue.index];
  function openReview(id?: string) {
    if (loadedQuery.current !== queryKey || loading || busy) return;
    const ids = data?.items.map((item) => item.id) ?? [];
    const index = id ? ids.indexOf(id) : 0;
    if (!ids.length || index < 0) return;
    setEditing(null);
    setReviewQueue({ ids, index, query: queryKey });
  }
  const [loading, setLoading] = useState(true);
  const { message } = App.useApp();
  const [lessons, setLessons] = useState<
    {
      id: string;
      title: string;
      chapter: { title: string; course: { title: string } };
    }[]
  >([]);
  useEffect(() => {
    let active = true;
    setLessons([]);
    api<{ items: typeof lessons }>(
      `/api/admin/lesson-options${lessonId ? `?includeId=${encodeURIComponent(lessonId)}` : ""}`,
    )
      .then((d) => {
        if (active) setLessons(d.items);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [lessonId]);
  async function load() {
    if (currentQuery.current !== queryKey) return;
    const id = ++sequence.current;
    setLoading(true);
    try {
      const result = await api<PageData<QuestionEdit>>(
        `/api/admin/questions?${queryKey}`,
      );
      if (id === sequence.current && currentQuery.current === queryKey) {
        setData(result);
        loadedQuery.current = queryKey;
      }
    } finally {
      if (id === sequence.current && currentQuery.current === queryKey)
        setLoading(false);
    }
  }
  useEffect(() => {
    setData(undefined);
    setError("");
    setEditing(null);
    setReviewQueue(undefined);
    void load().catch((e) => {
      if (currentQuery.current === queryKey) setError(e.message);
    });
    return () => {
      sequence.current++;
    };
  }, [queryKey]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (editing) {
      form.resetFields();
      form.setFieldsValue(
        editing === "new"
          ? {
              grade: gradeOptions.some(
                (item) => item.value === query.get("grade"),
              )
                ? query.get("grade")
                : "G7",
              subject: subjectOptions.some(
                (item) => item.value === query.get("subject"),
              )
                ? query.get("subject")
                : "math",
              difficulty: "MEDIUM",
              knowledgePoint: "",
              options: ["", "", "", ""],
              answer: 0,
              explanation: "",
              diagram: null,
              lessonIds:
                lessonId && lessons.some((item) => item.id === lessonId)
                  ? [lessonId]
                  : [],
            }
          : {
              ...editing,
              lessonIds: editing.lessonLinks?.map((l) => l.lessonId) ?? [],
            },
      );
    }
  }, [editing, form]);
  async function save(values: QuestionEdit) {
    await run(async () => {
      const body = {
        title: values.title,
        grade: values.grade,
        subject: values.subject,
        knowledgePoint: values.knowledgePoint ?? "",
        difficulty: values.difficulty,
        options: values.options,
        answer: values.answer,
        explanation: values.explanation ?? "",
        diagram: values.diagram ?? null,
        lessonIds: values.lessonIds ?? [],
        ...(editing && editing !== "new"
          ? { updatedAt: editing.updatedAt }
          : {}),
      };
      await api(
        editing === "new"
          ? "/api/admin/questions"
          : `/api/admin/questions/${editing && editing.id}`,
        editing === "new" ? "POST" : "PUT",
        body,
      );
      setEditing(null);
      await load();
      message.success("题目草稿已保存。");
    });
  }
  async function status(q: QuestionEdit, status: string) {
    await run(async () => {
      await api(`/api/admin/questions/${q.id}/status`, "PATCH", {
        status,
        updatedAt: q.updatedAt,
      });
      await load();
      message.success("题目状态已更新。");
    });
  }
  return (
    <section className="wrap account-page">
      <div className="account-heading">
        <div>
          <p className="eyebrow">内容工作台</p>
          <h1>题库管理</h1>
          <p className="muted">先核对题干、四个选项与解析，再发布给学生。</p>
        </div>
        <Space wrap>
          <Button
            disabled={busy || loading || !data?.items.length}
            onClick={() => openReview()}
          >
            逐题预览当前页
          </Button>
          <Button href="/admin/courses">课程管理</Button>
          <Button
            type="primary"
            disabled={
              busy ||
              (!!lessonId && !lessons.some((item) => item.id === lessonId))
            }
            onClick={() => {
              setEditing("new");
              setError("");
            }}
          >
            创建单选题
          </Button>
        </Space>
      </div>
      {error && <Alert type="error" showIcon title={error} />}
      <form
        className="admin-question-search"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <label>
          题干关键词
          <Input
            aria-label="题干关键词"
            value={searchText}
            maxLength={120}
            disabled={busy}
            allowClear
            placeholder="输入题干中的连续短句，至少2个字"
            onChange={(e) => {
              setSearchText(e.target.value);
              setSearchError("");
            }}
          />
        </label>
        <label>
          知识点关键词
          <Input
            aria-label="知识点关键词"
            value={knowledgeText}
            maxLength={80}
            disabled={busy}
            allowClear
            placeholder="例如：一元一次方程"
            onChange={(e) => {
              setKnowledgeText(e.target.value);
              setSearchError("");
            }}
          />
        </label>
        <Space wrap>
          <Button type="primary" htmlType="submit" disabled={busy}>
            搜索题库
          </Button>
          <Button disabled={busy} onClick={() => search(true)}>
            重置文字
          </Button>
        </Space>
      </form>
      {searchError && <Alert type="warning" title={searchError} />}
      {(searchText.trim() !== appliedText ||
        knowledgeText.trim() !== appliedKnowledge) && (
        <p className="muted" role="status">
          文字已修改，点击“搜索题库”后应用。
        </p>
      )}
      <Space wrap className="lesson-actions">
        <Select
          aria-label="题库难度筛选"
          disabled={busy}
          value={query.get("difficulty") ?? undefined}
          placeholder="全部难度"
          allowClear
          options={difficultyOptions}
          style={{ width: 140 }}
          onChange={(value) => filter("difficulty", value)}
        />
        <Select
          aria-label="题库年级筛选"
          disabled={busy}
          value={query.get("grade") ?? undefined}
          placeholder="全部年级"
          allowClear
          options={gradeOptions}
          style={{ width: 140 }}
          onChange={(value) => filter("grade", value)}
        />
        <Select
          aria-label="题库学科筛选"
          disabled={busy}
          value={query.get("subject") ?? undefined}
          placeholder="全部学科"
          allowClear
          options={subjectOptions}
          style={{ width: 150 }}
          onChange={(value) => filter("subject", value)}
        />
        <Select
          aria-label="题库状态筛选"
          disabled={busy}
          value={query.get("status") ?? undefined}
          placeholder="全部状态"
          allowClear
          options={[
            { value: "DRAFT", label: "草稿" },
            { value: "PUBLISHED", label: "已发布" },
            { value: "ARCHIVED", label: "已归档" },
          ]}
          style={{ width: 150 }}
          onChange={(value) => filter("status", value)}
        />
        <Button
          disabled={busy}
          onClick={() => {
            setEditing(null);
            setSearchText("");
            setKnowledgeText("");
            setSearchError("");
            setParams({});
          }}
        >
          清空筛选
        </Button>
        <Link
          className="text-link"
          to={`/admin/lesson-readiness?grade=${query.get("grade") ?? "G7"}`}
        >
          返回课时配套检查
        </Link>
      </Space>
      <div className="admin-question-filter-summary">
        {appliedText && <Tag>题干：{appliedText}</Tag>}
        {appliedKnowledge && <Tag>知识点：{appliedKnowledge}</Tag>}
        {data && loadedQuery.current === queryKey && !loading && (
          <p role="status">
            当前条件共 {data.total} 道题，每页 {data.pageSize}{" "}
            道。搜索按题干与知识点文字匹配，不查找答案或解析。
          </p>
        )}
      </div>
      {lessonId && (
        <Alert
          type="info"
          title={
            lessons.some((item) => item.id === lessonId)
              ? "当前仅显示指定课时的关联题目"
              : "课时信息尚未载入或不存在，暂不能新建题目"
          }
          description="创建新题时会预选该课时，请在编辑器内核对关联。改变年级或学科不会解除课时限定；需要查看其他题目时请取消限定。"
          action={
            <Button disabled={busy} onClick={() => filter("lessonId")}>
              取消课时限定
            </Button>
          }
        />
      )}
      <Table
        loading={loading}
        rowKey="id"
        dataSource={data?.items}
        scroll={{ x: 850 }}
        pagination={{
          current: page,
          total: data?.total,
          pageSize: 12,
          showSizeChanger: false,
          onChange: (value) => filter("page", String(value)),
        }}
        columns={[
          { title: "题干", dataIndex: "title", ellipsis: true },
          {
            title: "学科",
            dataIndex: "subject",
            render: (s) => subjectOptions.find((o) => o.value === s)?.label,
          },
          {
            title: "状态",
            dataIndex: "status",
            render: (s) => (
              <Tag>
                {
                  (
                    {
                      DRAFT: "草稿",
                      PUBLISHED: "已发布",
                      ARCHIVED: "已归档",
                    } as Record<string, string>
                  )[s]
                }
              </Tag>
            ),
          },
          { title: "作答数", render: (_, q) => q._count?.attempts ?? 0 },
          {
            title: "操作",
            render: (_, q) => (
              <Space wrap>
                <Button
                  disabled={busy || loading}
                  onClick={() => {
                    openReview(q.id);
                  }}
                >
                  预览与核对
                </Button>
                <Button
                  disabled={
                    busy || q.status === "PUBLISHED" || !!q._count?.attempts
                  }
                  onClick={() => setEditing(q)}
                >
                  编辑
                </Button>
                {q.status !== "PUBLISHED" && (
                  <Button
                    disabled={busy || loading}
                    onClick={() => {
                      openReview(q.id);
                    }}
                  >
                    核对后发布
                  </Button>
                )}
                {q.status !== "DRAFT" && (
                  <Button disabled={busy} onClick={() => status(q, "DRAFT")}>
                    转为草稿
                  </Button>
                )}
                {q.status !== "ARCHIVED" && (
                  <Popconfirm
                    title="归档后题目停止作答，并暂时从错题本隐藏，作答记录保留。"
                    onConfirm={() => status(q, "ARCHIVED")}
                  >
                    <Button disabled={busy}>归档</Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />
      <p className="muted">
        已有作答的题目保留原版，不再改写；需要勘误时，请归档旧题并创建新题。
      </p>
      {reviewId && reviewQueue && reviewQueue.query === queryKey && (
        <QuestionReview
          key={`${queryKey}:${reviewId}`}
          questionId={reviewId}
          onClose={() => setReviewQueue(undefined)}
          onPublished={load}
          onEdit={(question) => {
            setReviewQueue(undefined);
            setEditing(question);
          }}
          navigation={{
            index: reviewQueue.index,
            total: reviewQueue.ids.length,
            previous: () =>
              setReviewQueue((value) =>
                value && value.index > 0
                  ? { ...value, index: value.index - 1 }
                  : value,
              ),
            next: () =>
              setReviewQueue((value) =>
                value && value.index < value.ids.length - 1
                  ? { ...value, index: value.index + 1 }
                  : value,
              ),
          }}
        />
      )}
      {editing && (
        <Card
          className="course-editor"
          title={editing === "new" ? "新建单选题" : "编辑单选题"}
        >
          <Form form={form} layout="vertical" onFinish={save}>
            <Form.Item
              name="title"
              label="题干"
              rules={[{ required: true, max: 6000 }]}
            >
              <Input.TextArea rows={4} maxLength={6000} />
            </Form.Item>
            <Form.Item name="diagram" label="题图">
              <DiagramEditor />
            </Form.Item>
            <Form.Item
              name="lessonIds"
              label="配套课时（可选）"
              extra="未关联课时的题目发布后公开；关联后随对应课程开放。"
            >
              <Select
                mode="multiple"
                allowClear
                optionFilterProp="label"
                placeholder="选择题目所属的课时"
                options={lessons.map((l) => ({
                  value: l.id,
                  label: `${l.chapter.course.title} / ${l.chapter.title} / ${l.title}`,
                }))}
              />
            </Form.Item>
            <div className="editor-grid">
              <Form.Item name="grade" label="年级" rules={[{ required: true }]}>
                <Select options={gradeOptions} />
              </Form.Item>
              <Form.Item
                name="subject"
                label="学科"
                rules={[{ required: true }]}
              >
                <Select options={subjectOptions} />
              </Form.Item>
              <Form.Item
                name="difficulty"
                label="难度"
                rules={[{ required: true }]}
              >
                <Select options={difficultyOptions} />
              </Form.Item>
              <Form.Item name="knowledgePoint" label="知识点">
                <Input maxLength={80} />
              </Form.Item>
            </div>
            {["A", "B", "C", "D"].map((label, i) => (
              <Form.Item
                key={label}
                name={["options", i]}
                label={`选项 ${label}`}
                rules={[{ required: true, max: 1000 }]}
              >
                <Input.TextArea rows={2} maxLength={1000} />
              </Form.Item>
            ))}
            <Form.Item
              name="answer"
              label="正确答案"
              rules={[{ required: true }]}
            >
              <Select
                options={["A", "B", "C", "D"].map((label, value) => ({
                  value,
                  label,
                }))}
              />
            </Form.Item>
            <Form.Item name="explanation" label="答案解析（发布时必填）">
              <Input.TextArea rows={6} maxLength={12000} showCount />
            </Form.Item>
            <Space>
              <Button loading={busy} type="primary" htmlType="submit">
                保存草稿
              </Button>
              <Button disabled={busy} onClick={() => setEditing(null)}>
                取消编辑
              </Button>
            </Space>
          </Form>
        </Card>
      )}
    </section>
  );
}
