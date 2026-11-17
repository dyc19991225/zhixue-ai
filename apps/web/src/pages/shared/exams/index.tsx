import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
} from "antd";
import { Link, useSearchParams } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";
import type {
  ExamBankOption,
  ExamCreateInput,
  ExamDetail,
  ExamItem,
  ExamQuestionDraft,
  ExamResultRow,
  ExamResults,
  PageResult,
} from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { useApiData } from "@/hooks/use-api-data";
import { examApi } from "@/api/exam";
import { QuestionDiagram } from "@/features/practice/question-diagram";
import { ExamTemplateImport } from "./exam-template-import";
type EditorValues = Omit<
  ExamCreateInput,
  "classId" | "opensAt" | "closesAt"
> & { opensAt: Dayjs; closesAt: Dayjs };
const statusNames = {
  DRAFT: "草稿",
  PUBLISHED: "已发布",
  CLOSED: "已结束",
  ARCHIVED: "已归档",
};
function HiddenValue(_props: { value?: unknown }) {
  return null;
}
export default function Exams() {
  const { user } = useAuth(),
    { message } = App.useApp(),
    [search] = useSearchParams();
  const manager = user?.role === "ADMIN" || user?.role === "TEACHER",
    classId = search.get("classId"),
    className = search.get("className");
  const [page, setPage] = useState(1),
    [resultPage, setResultPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null),
    [creating, setCreating] = useState(false),
    [editing, setEditing] = useState<ExamDetail | null>(null),
    [busy, setBusy] = useState(false),
    [bankOpen, setBankOpen] = useState(false),
    [bankPage, setBankPage] = useState(1),
    [bankQuery, setBankQuery] = useState(""),
    [bankKeys, setBankKeys] = useState<string[]>([]),
    [bankTitles, setBankTitles] = useState<Record<string, string>>({});
  const [form] = Form.useForm<EditorValues>();
  const values = Form.useWatch("questions", form) as
    ExamQuestionDraft[] | undefined;
  const list = useApiData<PageResult<ExamItem>>(
    `/api/exams?${new URLSearchParams({ page: String(page), pageSize: "10", ...(classId ? { classId } : {}) })}`,
  );
  const detail = useApiData<ExamDetail>(
    selected && manager ? `/api/exams/${encodeURIComponent(selected)}` : null,
  );
  const results = useApiData<ExamResults>(
    selected && manager
      ? `/api/exams/${encodeURIComponent(selected)}/results?page=${resultPage}&pageSize=10`
      : null,
  );
  const bankClass = editing?.classId ?? classId;
  const bank = useApiData<PageResult<ExamBankOption>>(
    bankOpen && bankClass
      ? `/api/exams/question-options?${new URLSearchParams({ classId: bankClass, page: String(bankPage), pageSize: "10", q: bankQuery })}`
      : null,
  );
  useEffect(() => {
    if (bank.data)
      setBankTitles((previous) => ({
        ...previous,
        ...Object.fromEntries(bank.data!.list.map((q) => [q.id, q.title])),
      }));
  }, [bank.data]);
  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "操作失败。");
    } finally {
      setBusy(false);
    }
  }
  const refresh = () => {
    list.reload();
    detail.reload();
    results.reload();
  };
  function editPaper(d: ExamDetail) {
    setSelected(null);
    setEditing(d);
    setBankTitles((previous) => ({
      ...previous,
      ...Object.fromEntries(
        (d.questions ?? []).flatMap((q) =>
          q.sourceQuestionId ? [[q.sourceQuestionId, q.title]] : [],
        ),
      ),
    }));
    form.setFieldsValue({
      title: d.title,
      opensAt: dayjs(d.opensAt),
      closesAt: dayjs(d.closesAt),
      durationMinutes: d.durationMinutes,
      questions: (d.questions ?? []).map((q) =>
        q.sourceQuestionId
          ? {
              source: "BANK" as const,
              questionId: q.sourceQuestionId,
              points: q.points,
            }
          : {
              source: "MANUAL" as const,
              title: q.title,
              options: q.options,
              answer: q.answer,
              explanation: q.explanation,
              points: q.points,
              diagram: q.diagram,
            },
      ),
    });
    setCreating(true);
  }
  return (
    <section className="wrap account-page relation-page">
      <div className="account-heading">
        <div>
          <p className="eyebrow">班级测评</p>
          <h1>{manager ? "考试管理" : "我的考试"}</h1>
          <p className="muted">{className || "单选测评与成绩记录"}</p>
        </div>
        <Space wrap>
          <Link className="ant-btn" to="/classes">
            班级空间
          </Link>
          <Button onClick={refresh}>刷新</Button>
          {manager &&
            (classId ? (
              <Button
                type="primary"
                onClick={() => {
                  setEditing(null);
                  form.resetFields();
                  form.setFieldsValue({
                    opensAt: dayjs(),
                    closesAt: dayjs().add(1, "hour"),
                    durationMinutes: 45,
                    questions: [
                      {
                        source: "MANUAL" as const,
                        title: "",
                        options: ["", "", "", ""],
                        answer: 0,
                        explanation: "",
                        points: 1,
                      },
                    ],
                  });
                  setCreating(true);
                }}
              >
                创建试卷
              </Button>
            ) : (
              <Link className="ant-btn ant-btn-primary" to="/classes">
                选择班级组卷
              </Link>
            ))}
        </Space>
      </div>
      {list.error && (
        <Alert
          type="error"
          title={list.error}
          action={<Button onClick={list.reload}>重试</Button>}
        />
      )}
      <Card>
        <Table<ExamItem>
          rowKey="id"
          loading={list.loading}
          dataSource={list.data?.list ?? []}
          scroll={{ x: 900 }}
          pagination={{
            current: page,
            pageSize: 10,
            total: list.data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
          locale={{ emptyText: "暂无考试" }}
          columns={[
            { title: "考试", dataIndex: "title" },
            { title: "班级", dataIndex: "className" },
            {
              title: "时间窗口",
              render: (_, e) => (
                <>
                  {new Date(e.opensAt).toLocaleString("zh-CN")}
                  <br />至 {new Date(e.closesAt).toLocaleString("zh-CN")}
                </>
              ),
            },
            {
              title: "限时 / 满分",
              render: (_, e) => `${e.durationMinutes}分钟 / ${e.totalPoints}分`,
            },
            {
              title: "状态",
              render: (_, e) => (
                <Space direction="vertical" size={0}>
                  <Tag>{statusNames[e.status]}</Tag>
                  {!manager && (
                    <span>
                      {
                        {
                          NOT_STARTED: "未参加",
                          STARTED: "已开始",
                          SUBMITTED: "已交卷",
                        }[e.attemptState]
                      }
                    </span>
                  )}
                </Space>
              ),
            },
            {
              title: "操作",
              render: (_, e) =>
                manager ? (
                  <Space wrap>
                    <Button
                      disabled={busy}
                      onClick={() => {
                        setResultPage(1);
                        setSelected(e.id);
                      }}
                    >
                      试卷 / 成绩
                    </Button>
                    {e.status === "DRAFT" && (
                      <Popconfirm
                        title="发布考试并锁定试卷和学生名单？"
                        onConfirm={() =>
                          run(async () => {
                            await examApi.status(
                              e.id,
                              "PUBLISHED",
                              e.updatedAt,
                            );
                            refresh();
                          })
                        }
                      >
                        <Button type="primary" disabled={busy}>
                          发布
                        </Button>
                      </Popconfirm>
                    )}
                    {e.status === "PUBLISHED" && (
                      <Popconfirm
                        title="结束考试并公布成绩？"
                        description="停止接收答案，正在作答的学生将按已保存答案结算。"
                        onConfirm={() =>
                          run(async () => {
                            await examApi.status(e.id, "CLOSED", e.updatedAt);
                            refresh();
                          })
                        }
                      >
                        <Button danger disabled={busy}>
                          结束考试
                        </Button>
                      </Popconfirm>
                    )}
                    {e.status !== "ARCHIVED" && (
                      <Popconfirm
                        title="归档考试并停止作答？"
                        onConfirm={() =>
                          run(async () => {
                            await examApi.status(e.id, "ARCHIVED", e.updatedAt);
                            refresh();
                          })
                        }
                      >
                        <Button disabled={busy}>归档</Button>
                      </Popconfirm>
                    )}
                  </Space>
                ) : (
                  <Link
                    className="ant-btn ant-btn-primary"
                    to={`/exams/${e.id}/take`}
                  >
                    {e.attemptState === "SUBMITTED"
                      ? "查看交卷结果"
                      : e.attemptState === "STARTED"
                        ? "继续考试"
                        : "查看 / 参加"}
                  </Link>
                ),
            },
          ]}
        />
      </Card>
      <Modal
        title={editing ? "编辑试卷草稿" : "创建试卷"}
        open={creating}
        width={1000}
        onCancel={() => {
          if (!busy) setCreating(false);
        }}
        onOk={() => form.submit()}
        confirmLoading={busy}
        okText="保存草稿"
        cancelText="取消"
      >
        {creating && (
          <div style={{ marginBottom: 16 }}>
            <ExamTemplateImport
              disabled={busy}
              onApply={(payload) => {
                form.setFieldsValue(payload);
              }}
            />
          </div>
        )}
        <Form
          form={form}
          layout="vertical"
          onFinish={(v) =>
            void run(async () => {
              const body = {
                title: v.title,
                opensAt: v.opensAt.toISOString(),
                closesAt: v.closesAt.toISOString(),
                durationMinutes: v.durationMinutes,
                questions: v.questions.map((q) =>
                  q.source === "BANK"
                    ? {
                        source: "BANK" as const,
                        questionId: q.questionId,
                        points: q.points,
                      }
                    : {
                        source: "MANUAL" as const,
                        title: q.title,
                        options: q.options,
                        answer: q.answer,
                        explanation: q.explanation,
                        points: q.points,
                        diagram: q.diagram,
                      },
                ),
              };
              if (editing)
                await examApi.update(editing.id, {
                  ...body,
                  updatedAt: editing.updatedAt,
                });
              else {
                if (!classId) return;
                await examApi.create({ ...body, classId });
              }
              setCreating(false);
              setPage(1);
              refresh();
              message.success("试卷草稿已保存。");
            })
          }
        >
          <Form.Item
            name="title"
            label="试卷标题"
            rules={[{ required: true, whitespace: true, max: 120 }]}
          >
            <Input maxLength={120} disabled={busy} />
          </Form.Item>
          <div className="relation-form-grid">
            <Form.Item
              name="opensAt"
              label="开始时间（本地时间）"
              rules={[{ required: true }]}
            >
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm"
                style={{ width: "100%" }}
                disabled={busy}
              />
            </Form.Item>
            <Form.Item
              name="closesAt"
              label="结束时间（本地时间）"
              rules={[{ required: true }]}
            >
              <DatePicker
                showTime
                format="YYYY-MM-DD HH:mm"
                style={{ width: "100%" }}
                disabled={busy}
              />
            </Form.Item>
          </div>
          <Form.Item
            name="durationMinutes"
            label="每人作答时长（分钟）"
            rules={[{ required: true }]}
          >
            <InputNumber min={1} max={180} precision={0} disabled={busy} />
          </Form.Item>
          <Form.List
            name="questions"
            rules={[
              {
                validator: async (_, items: ExamQuestionDraft[]) => {
                  if (!items?.length || items.length > 50)
                    throw new Error("请添加1至50道题。列出的每题均计入总分。");
                },
              },
            ]}
          >
            {(fields, { add, remove }, { errors }) => (
              <>
                {fields.map((field) => (
                  <Card
                    title={`第${field.name + 1}题`}
                    key={field.key}
                    className="lesson-chapter"
                    extra={
                      <Button
                        danger
                        disabled={busy}
                        onClick={() => remove(field.name)}
                      >
                        移除题目
                      </Button>
                    }
                  >
                    <Form.Item name={[field.name, "source"]} hidden>
                      <Input />
                    </Form.Item>
                    <Form.Item name={[field.name, "diagram"]} hidden>
                      <HiddenValue />
                    </Form.Item>
                    <Form.Item noStyle shouldUpdate>
                      {() =>
                        (form.getFieldValue([
                          "questions",
                          field.name,
                          "source",
                        ]) as string) === "BANK" ? (
                          <>
                            <Form.Item name={[field.name, "questionId"]} hidden>
                              <Input />
                            </Form.Item>
                            <p>
                              {bankTitles[
                                form.getFieldValue([
                                  "questions",
                                  field.name,
                                  "questionId",
                                ]) as string
                              ] ?? "已选题库题"}
                            </p>
                            <small>保存时复制原题和解析为试卷快照。</small>
                          </>
                        ) : (
                          <>
                            <Form.Item
                              name={[field.name, "title"]}
                              label="题目"
                              rules={[
                                { required: true, whitespace: true, max: 6000 },
                              ]}
                            >
                              <Input.TextArea rows={2} maxLength={6000} />
                            </Form.Item>
                            <div className="relation-form-grid">
                              {[0, 1, 2, 3].map((n) => (
                                <Form.Item
                                  key={n}
                                  name={[field.name, "options", n]}
                                  label={`选项${String.fromCharCode(65 + n)}`}
                                  rules={[
                                    {
                                      required: true,
                                      whitespace: true,
                                      max: 1000,
                                    },
                                  ]}
                                >
                                  <Input maxLength={1000} />
                                </Form.Item>
                              ))}
                            </div>
                            <Form.Item
                              name={[field.name, "answer"]}
                              label="正确选项"
                              rules={[{ required: true }]}
                            >
                              <Select
                                options={[0, 1, 2, 3].map((value) => ({
                                  value,
                                  label: String.fromCharCode(65 + value),
                                }))}
                              />
                            </Form.Item>
                            <Form.Item
                              name={[field.name, "explanation"]}
                              label="解析 / 来源许可"
                              rules={[
                                {
                                  required: true,
                                  whitespace: true,
                                  max: 12000,
                                },
                              ]}
                            >
                              <Input.TextArea rows={3} maxLength={12000} />
                            </Form.Item>
                          </>
                        )
                      }
                    </Form.Item>
                    <Form.Item
                      name={[field.name, "points"]}
                      label="本题分值"
                      rules={[{ required: true }]}
                    >
                      <InputNumber min={1} max={1000} precision={0} />
                    </Form.Item>
                  </Card>
                ))}
                <Form.ErrorList errors={errors} />
                <Space wrap>
                  <Button
                    disabled={busy || fields.length >= 50}
                    onClick={() =>
                      add({
                        source: "MANUAL" as const,
                        options: ["", "", "", ""],
                        answer: 0,
                        points: 1,
                      })
                    }
                  >
                    添加自编题
                  </Button>
                  <Button
                    disabled={busy || fields.length >= 50}
                    onClick={() => {
                      setBankPage(1);
                      setBankKeys([]);
                      setBankQuery("");
                      setBankOpen(true);
                    }}
                  >
                    从题库选题
                  </Button>
                </Space>
              </>
            )}
          </Form.List>
        </Form>
      </Modal>
      <Modal
        title="选择公开题库题"
        open={bankOpen}
        width={900}
        onCancel={() => setBankOpen(false)}
        okText="加入试卷"
        cancelText="取消"
        onOk={() => {
          const current =
            (form.getFieldValue("questions") as ExamQuestionDraft[]) ?? [];
          const existing = new Set(
            current.flatMap((q) => (q.source === "BANK" ? [q.questionId] : [])),
          );
          const added = bankKeys
            .filter((k) => !existing.has(k))
            .map((questionId) => ({
              source: "BANK" as const,
              questionId,
              points: 1,
            }));
          if (current.length + added.length > 50) {
            message.error("每份试卷最多50题。");
            return;
          }
          form.setFieldValue("questions", [...current, ...added]);
          setBankOpen(false);
        }}
      >
        <Input.Search
          aria-label="搜索题目"
          placeholder="输入题目关键词"
          onSearch={(q) => {
            setBankPage(1);
            setBankQuery(q);
          }}
          enterButton
        />
        {bank.error && <Alert type="error" title={bank.error} />}
        <Table<ExamBankOption>
          rowKey="id"
          loading={bank.loading}
          dataSource={bank.data?.list ?? []}
          scroll={{ x: 560 }}
          rowSelection={{
            selectedRowKeys: bankKeys,
            preserveSelectedRowKeys: true,
            onChange: (keys) => setBankKeys(keys.map(String)),
            getCheckboxProps: (q) => ({
              disabled: (values ?? []).some(
                (v) => v.source === "BANK" && v.questionId === q.id,
              ),
            }),
          }}
          pagination={{
            current: bankPage,
            pageSize: 10,
            total: bank.data?.total ?? 0,
            showSizeChanger: false,
            onChange: setBankPage,
          }}
          columns={[
            { title: "题目", dataIndex: "title" },
            { title: "知识点", dataIndex: "knowledgePoint" },
          ]}
          locale={{
            emptyText:
              "暂无可选题。可先使用自编题，或请管理员发布对应年级的公开题。",
          }}
        />
      </Modal>
      <Modal
        title={detail.data?.title ?? "试卷与成绩"}
        open={!!selected}
        width={1100}
        footer={null}
        onCancel={() => {
          if (!busy) setSelected(null);
        }}
      >
        {detail.loading ? (
          <Spin />
        ) : detail.error ? (
          <Alert
            type="error"
            title={detail.error}
            action={<Button onClick={detail.reload}>重试</Button>}
          />
        ) : detail.data ? (
          <>
            <Space wrap>
              <Tag>{statusNames[detail.data.status]}</Tag>
              <span>
                {detail.data.questionCount}题 / {detail.data.totalPoints}分 /
                限时{detail.data.durationMinutes}分钟
              </span>
              {detail.data.status === "DRAFT" && (
                <Button onClick={() => editPaper(detail.data!)}>
                  编辑草稿
                </Button>
              )}
            </Space>
            <Row gutter={[16, 16]} className="lesson-chapter">
              {[
                ["发布人数", results.data?.recipientCount ?? 0],
                ["已开始", results.data?.total ?? 0],
                ["已交卷", results.data?.submittedCount ?? 0],
                [
                  "平均分",
                  results.data?.averageScore == null
                    ? "—"
                    : results.data.averageScore.toFixed(1),
                ],
              ].map(([label, number]) => (
                <Col xs={12} md={6} key={String(label)}>
                  <Statistic title={label} value={number} />
                </Col>
              ))}
            </Row>
            <Button onClick={results.reload}>刷新成绩</Button>
            {results.error && <Alert type="error" title={results.error} />}
            <Table<ExamResultRow>
              rowKey="id"
              dataSource={results.data?.list ?? []}
              loading={results.loading}
              scroll={{ x: 600 }}
              pagination={{
                current: resultPage,
                pageSize: 10,
                total: results.data?.total ?? 0,
                showSizeChanger: false,
                onChange: setResultPage,
              }}
              columns={[
                { title: "学生", render: (_, r) => r.student.displayName },
                {
                  title: "交卷时间",
                  render: (_, r) =>
                    r.submittedAt
                      ? new Date(r.submittedAt).toLocaleString("zh-CN")
                      : "进行中",
                },
                { title: "得分", render: (_, r) => r.score ?? "—" },
                {
                  title: "交卷方式",
                  render: (_, r) =>
                    r.submissionReason
                      ? ({
                          MANUAL: "主动交卷",
                          TIMEOUT: "超时",
                          CLOSED: "考试结束",
                          ACCESS_REVOKED: "权限终止",
                        }[r.submissionReason] ?? r.submissionReason)
                      : "—",
                },
              ]}
            />
            <h2>逐题统计</h2>
            <Table
              rowKey="questionId"
              pagination={false}
              dataSource={results.data?.questionStats ?? []}
              scroll={{ x: 500 }}
              columns={[
                { title: "题目", dataIndex: "title" },
                {
                  title: "已答 / 已交卷",
                  render: (_, r: ExamResults["questionStats"][number]) =>
                    `${r.answered} / ${r.total}`,
                },
                {
                  title: "正确率",
                  render: (_, r: ExamResults["questionStats"][number]) =>
                    r.total
                      ? `${((100 * r.correct) / r.total).toFixed(1)}%`
                      : "—",
                },
              ]}
            />
            <h2>试卷审阅</h2>
            {detail.data.questions?.map((q, index) => (
              <Card
                key={q.id}
                title={`第${index + 1}题 · ${q.points}分`}
                className="lesson-chapter"
              >
                <h3 className="exam-question-title">{q.title}</h3>
                <QuestionDiagram diagram={q.diagram} />
                <ol type="A">
                  {q.options.map((option, i) => (
                    <li key={i}>{option}</li>
                  ))}
                </ol>
                <p>答案：{String.fromCharCode(65 + q.answer)}</p>
                <div className="relation-prose">{q.explanation}</div>
              </Card>
            ))}
          </>
        ) : (
          <Empty />
        )}
      </Modal>
    </section>
  );
}
