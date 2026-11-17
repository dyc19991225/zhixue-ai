import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import { Link, useSearchParams } from "react-router-dom";
import dayjs, { type Dayjs } from "dayjs";
import type {
  HomeworkDetail,
  HomeworkItem,
  HomeworkSubmissionView,
  HomeworkSubmissions,
  PageResult,
} from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { useApiData } from "@/hooks/use-api-data";
import { homeworkApi } from "@/api/homework";
const statusNames = { DRAFT: "草稿", PUBLISHED: "已发布", ARCHIVED: "已归档" };
type EditorValues = {
  title: string;
  instructions: string;
  maxScore: number;
  dueAt: Dayjs;
};
export default function Homework() {
  const { user } = useAuth(),
    { message, modal } = App.useApp(),
    [search, setSearch] = useSearchParams();
  const selected = search.get("homeworkId");
  function setSelected(id: string | null) {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      if (id) next.set("homeworkId", id);
      else next.delete("homeworkId");
      return next;
    });
  }
  const canManage = user?.role === "ADMIN" || user?.role === "TEACHER",
    classId = search.get("classId"),
    className = search.get("className");
  const [page, setPage] = useState(1),
    [submissionPage, setSubmissionPage] = useState(1),
    [creating, setCreating] = useState(false),
    [editing, setEditing] = useState<HomeworkDetail["homework"] | null>(null),
    [grading, setGrading] = useState<HomeworkSubmissionView | null>(null),
    [busy, setBusy] = useState(false),
    [submitRequestId, setSubmitRequestId] = useState(() => crypto.randomUUID()),
    [gradeRequestId, setGradeRequestId] = useState(() => crypto.randomUUID());
  const [editor] = Form.useForm<EditorValues>(),
    [answerForm] = Form.useForm<{ answerText: string }>(),
    [gradeForm] = Form.useForm<{ score: number; feedback: string }>();
  const query = new URLSearchParams({
    page: String(page),
    pageSize: "10",
    ...(classId ? { classId } : {}),
  });
  const homework = useApiData<PageResult<HomeworkItem>>(
    `/api/homework?${query}`,
  );
  const detail = useApiData<HomeworkDetail>(
    selected ? `/api/homework/${encodeURIComponent(selected)}` : null,
  );
  const submissions = useApiData<HomeworkSubmissions>(
    selected && canManage
      ? `/api/homework/${encodeURIComponent(selected)}/submissions?page=${submissionPage}&pageSize=10`
      : null,
  );
  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
    } catch (cause) {
      message.error(
        cause instanceof Error ? cause.message : "操作未完成，请重试。",
      );
    } finally {
      setBusy(false);
    }
  }
  const refresh = () => {
    homework.reload();
    detail.reload();
    submissions.reload();
  };
  function open(id: string) {
    answerForm.resetFields();
    setSubmitRequestId(crypto.randomUUID());
    setSubmissionPage(1);
    setSelected(id);
  }
  const item = detail.data?.homework,
    own = detail.data?.submission;
  return (
    <section className="wrap account-page relation-page">
      <div className="account-heading">
        <div>
          <p className="eyebrow">班级学习</p>
          <h1>{canManage ? "作业管理" : "我的作业"}</h1>
          <p className="muted">{className || "查看所属班级的作业与反馈"}</p>
        </div>
        <Space wrap>
          <Link className="ant-btn" to="/classes">
            班级空间
          </Link>
          <Button onClick={refresh}>刷新</Button>
          {canManage &&
            (classId ? (
              <Button
                type="primary"
                onClick={() => {
                  setEditing(null);
                  editor.resetFields();
                  editor.setFieldsValue({ maxScore: 100 });
                  setCreating(true);
                }}
              >
                布置作业
              </Button>
            ) : (
              <Link className="ant-btn ant-btn-primary" to="/classes">
                选择班级布置
              </Link>
            ))}
        </Space>
      </div>
      {homework.error && (
        <Alert
          type="error"
          title={homework.error}
          action={<Button onClick={homework.reload}>重试</Button>}
        />
      )}
      <Card>
        <Table<HomeworkItem>
          rowKey="id"
          loading={homework.loading}
          dataSource={homework.data?.list ?? []}
          scroll={{ x: 760 }}
          locale={{
            emptyText: canManage
              ? "暂无作业，请从班级空间选择班级后布置。"
              : "暂无分配作业。",
          }}
          pagination={{
            current: page,
            pageSize: 10,
            total: homework.data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            { title: "作业", dataIndex: "title" },
            { title: "班级", dataIndex: "className" },
            {
              title: "截止时间",
              render: (_, h) => new Date(h.dueAt).toLocaleString("zh-CN"),
            },
            {
              title: "状态",
              render: (_, h) => (
                <Space direction="vertical" size={0}>
                  <Tag>{statusNames[h.status]}</Tag>
                  {!canManage && (
                    <span>
                      {
                        {
                          NOT_SUBMITTED: "未提交",
                          SUBMITTED: "待批改",
                          GRADED: "已批改",
                        }[h.submissionState]
                      }
                    </span>
                  )}
                </Space>
              ),
            },
            {
              title: "操作",
              render: (_, h) => (
                <Space wrap>
                  <Button disabled={busy} onClick={() => open(h.id)}>
                    {canManage ? "查看 / 批改" : "查看作业"}
                  </Button>
                  {canManage && h.status === "DRAFT" && (
                    <Popconfirm
                      title="发布给当前班级的学生？"
                      description="发布后锁定内容和名单，请先检查作业要求。"
                      onConfirm={() =>
                        run(async () => {
                          await homeworkApi.status(
                            h.id,
                            "PUBLISHED",
                            h.updatedAt,
                          );
                          homework.reload();
                          message.success("作业已发布。");
                        })
                      }
                    >
                      <Button type="primary" disabled={busy}>
                        发布
                      </Button>
                    </Popconfirm>
                  )}
                  {canManage && h.status !== "ARCHIVED" && (
                    <Popconfirm
                      title="归档作业并停止接收提交？"
                      onConfirm={() =>
                        run(async () => {
                          await homeworkApi.status(
                            h.id,
                            "ARCHIVED",
                            h.updatedAt,
                          );
                          refresh();
                        })
                      }
                    >
                      <Button danger disabled={busy}>
                        归档
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title={editing ? "编辑作业草稿" : "布置作业"}
        open={creating}
        confirmLoading={busy}
        onCancel={() => {
          if (!busy) setCreating(false);
        }}
        onOk={() => editor.submit()}
        okText="保存草稿"
        cancelText="取消"
        width={720}
      >
        <Form
          form={editor}
          layout="vertical"
          onFinish={(values) =>
            void run(async () => {
              const body = {
                title: values.title,
                instructions: values.instructions,
                maxScore: values.maxScore,
                dueAt: values.dueAt.toISOString(),
              };
              if (editing)
                await homeworkApi.update(editing.id, {
                  ...body,
                  updatedAt: editing.updatedAt,
                });
              else {
                if (!classId) return;
                await homeworkApi.create({ ...body, classId });
              }
              setCreating(false);
              setPage(1);
              refresh();
              message.success("作业草稿已保存。");
            })
          }
        >
          <Form.Item
            name="title"
            label="作业标题"
            rules={[{ required: true, whitespace: true, max: 120 }]}
          >
            <Input maxLength={120} disabled={busy} />
          </Form.Item>
          <Form.Item
            name="instructions"
            label="题目与作业要求"
            rules={[{ required: true, whitespace: true, max: 30000 }]}
          >
            <Input.TextArea
              rows={6}
              maxLength={30000}
              showCount
              disabled={busy}
            />
          </Form.Item>
          <div className="relation-form-grid">
            <Form.Item
              name="dueAt"
              label="截止时间（本地时间）"
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
              name="maxScore"
              label="满分"
              rules={[{ required: true }]}
            >
              <InputNumber min={1} max={1000} precision={0} disabled={busy} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
      <Modal
        title={item?.title ?? "作业详情"}
        open={!!selected}
        footer={null}
        width={1000}
        onCancel={() => {
          if (!busy) {
            setSelected(null);
            setGrading(null);
          }
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
        ) : item ? (
          <>
            <Space wrap>
              <Tag>{statusNames[item.status]}</Tag>
              <span>满分 {item.maxScore}</span>
              <span>截止：{new Date(item.dueAt).toLocaleString("zh-CN")}</span>
            </Space>
            <Card title="作业要求" className="lesson-chapter">
              <div className="relation-prose">{item.instructions}</div>
            </Card>
            {canManage ? (
              <>
                {item.status === "DRAFT" && (
                  <Button
                    disabled={busy}
                    onClick={() => {
                      setSelected(null);
                      setEditing(item);
                      editor.setFieldsValue({
                        title: item.title,
                        instructions: item.instructions,
                        dueAt: dayjs(item.dueAt),
                        maxScore: item.maxScore,
                      });
                      setCreating(true);
                    }}
                  >
                    编辑草稿
                  </Button>
                )}
                {submissions.error && (
                  <Alert
                    type="error"
                    title={submissions.error}
                    action={<Button onClick={submissions.reload}>重试</Button>}
                  />
                )}
                <p>
                  发布名单 {submissions.data?.recipientCount ?? 0} 人 · 已交{" "}
                  {submissions.data?.total ?? 0} 人 · 已批{" "}
                  {submissions.data?.gradedCount ?? 0} 人
                </p>
                <Table<HomeworkSubmissionView>
                  rowKey="id"
                  loading={submissions.loading}
                  dataSource={submissions.data?.list ?? []}
                  scroll={{ x: 560 }}
                  pagination={{
                    current: submissionPage,
                    pageSize: 10,
                    total: submissions.data?.total ?? 0,
                    showSizeChanger: false,
                    onChange: setSubmissionPage,
                  }}
                  columns={[
                    { title: "学生", render: (_, s) => s.student.displayName },
                    {
                      title: "提交时间",
                      render: (_, s) =>
                        new Date(s.submittedAt).toLocaleString("zh-CN"),
                    },
                    {
                      title: "成绩",
                      render: (_, s) =>
                        s.gradedAt ? `${s.score} / ${item.maxScore}` : "待批改",
                    },
                    {
                      title: "操作",
                      render: (_, s) => (
                        <Button
                          disabled={busy}
                          onClick={() => {
                            setGrading(s);
                            gradeForm.resetFields();
                            setGradeRequestId(crypto.randomUUID());
                          }}
                        >
                          查看作答{s.gradedAt ? "" : " / 批改"}
                        </Button>
                      ),
                    },
                  ]}
                />
              </>
            ) : own ? (
              <Card title="我的提交与反馈" className="lesson-chapter">
                <div className="relation-prose">{own.answerText}</div>
                <p>
                  {own.gradedAt
                    ? `成绩：${own.score} / ${item.maxScore}`
                    : "已提交，等待教师批改。"}
                </p>
                {own.gradedAt && (
                  <div className="relation-prose">教师反馈：{own.feedback}</div>
                )}
              </Card>
            ) : item.status === "PUBLISHED" &&
              new Date(item.dueAt).getTime() > Date.now() ? (
              <Form
                form={answerForm}
                layout="vertical"
                onFinish={(values) =>
                  modal.confirm({
                    title: "确认提交作业？",
                    content: "提交后锁定作答，本版本暂不支持重交。",
                    okText: "确认提交",
                    cancelText: "继续检查",
                    onOk: () =>
                      run(async () => {
                        await homeworkApi.submit(
                          item.id,
                          values.answerText,
                          submitRequestId,
                        );
                        refresh();
                        message.success("作业已提交。");
                      }),
                  })
                }
              >
                <Form.Item
                  name="answerText"
                  label="我的作答"
                  rules={[{ required: true, whitespace: true, max: 30000 }]}
                >
                  <Input.TextArea
                    rows={7}
                    maxLength={30000}
                    showCount
                    disabled={busy}
                  />
                </Form.Item>
                <Button type="primary" htmlType="submit" loading={busy}>
                  提交作业
                </Button>
              </Form>
            ) : (
              <Alert type="info" title="作业已截止或停止接收提交。" />
            )}
          </>
        ) : (
          <Empty />
        )}
      </Modal>
      <Modal
        title={grading ? `${grading.student.displayName} · 作答` : "批改作业"}
        open={!!grading}
        onCancel={() => {
          if (!busy) setGrading(null);
        }}
        onOk={() => gradeForm.submit()}
        footer={
          grading?.gradedAt || item?.status !== "PUBLISHED" ? null : undefined
        }
        confirmLoading={busy}
        okText="确认批改"
        cancelText="取消"
        width={720}
      >
        <div className="relation-prose">{grading?.answerText}</div>
        {grading?.gradedAt ? (
          <>
            <p>
              成绩：{grading.score} / {item?.maxScore}
            </p>
            <div className="relation-prose">{grading.feedback}</div>
          </>
        ) : item?.status === "PUBLISHED" ? (
          <Form
            className="lesson-chapter"
            form={gradeForm}
            layout="vertical"
            onFinish={(values) =>
              void run(async () => {
                if (!grading || !item) return;
                await homeworkApi.grade(item.id, grading.id, {
                  ...values,
                  updatedAt: grading.updatedAt,
                  requestId: gradeRequestId,
                });
                setGrading(null);
                refresh();
                message.success("批改已保存。");
              })
            }
          >
            <Form.Item
              name="score"
              label={`得分（满分${item.maxScore}）`}
              rules={[{ required: true }]}
            >
              <InputNumber
                min={0}
                max={item.maxScore}
                precision={0}
                disabled={busy}
              />
            </Form.Item>
            <Form.Item
              name="feedback"
              label="教师反馈"
              rules={[{ required: true, whitespace: true, max: 12000 }]}
            >
              <Input.TextArea rows={4} maxLength={12000} disabled={busy} />
            </Form.Item>
          </Form>
        ) : (
          <Alert type="info" title="作业已停止批改。" />
        )}
      </Modal>
    </section>
  );
}
