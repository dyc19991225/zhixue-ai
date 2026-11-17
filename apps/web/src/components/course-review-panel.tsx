import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Checkbox,
  Collapse,
  Empty,
  Form,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Radio,
  Space,
  Spin,
  Tag,
} from "antd";
import type { CourseReviewPage, CourseReviewSnapshot } from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { useApiData } from "@/hooks/use-api-data";
import { courseReviewApi } from "@/api/course-review";
const names = {
  NOT_SUBMITTED: "未提交",
  STALE: "内容已变更，需重新送审",
  PENDING: "待审核",
  APPROVED: "审核通过",
  RETURNED: "已退回",
};
const checks = [
  ["accuracy", "已核对正文知识、例题答案与解析"],
  ["alignment", "已确认适用年级与教材版本依据"],
  ["rights", "已确认课程文字及视频的使用依据"],
  ["readability", "已检查表达、单位和学生阅读体验"],
] as const;
function Snapshot({ value }: { value: CourseReviewSnapshot }) {
  return (
    <>
      <p>
        {value.title} · {value.grade} · {value.subject}
      </p>
      <p>
        教材版本：{value.textbookEdition || "未填写"}；地区：
        {value.region || "未填写"}；学期：{value.term || "未填写"}
      </p>
      <p style={{ whiteSpace: "pre-wrap" }}>{value.description}</p>
      <Collapse
        items={value.chapters.map((ch) => ({
          key: ch.id,
          label: ch.title,
          children: ch.lessons.map((l) => (
            <section key={l.id}>
              <h4>{l.title}</h4>
              <div className="relation-prose">{l.content || "无文字正文"}</div>
              {l.mediaId && (
                <p>关联视频编号：{l.mediaId}（请在课程素材中另行核验视频）</p>
              )}
            </section>
          )),
        }))}
      />
    </>
  );
}
export function CourseReviewPanel({
  courseId,
  initialOpen = false,
  hideTrigger = false,
  onClosed,
}: {
  courseId: string;
  initialOpen?: boolean;
  hideTrigger?: boolean;
  onClosed?: () => void;
}) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <>
      {!hideTrigger && (
        <Button onClick={() => setOpen(true)}>审核 / 记录</Button>
      )}
      <Modal
        title="课程审核与版本记录"
        open={open}
        onCancel={() => {
          setOpen(false);
          onClosed?.();
        }}
        footer={null}
        width={900}
        centered
        styles={{ body: { maxHeight: "75vh", overflowY: "auto" } }}
        destroyOnHidden
      >
        {open && <ReviewContent courseId={courseId} />}
      </Modal>
    </>
  );
}
function ReviewContent({ courseId }: { courseId: string }) {
  const { user } = useAuth(),
    { message } = App.useApp();
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [form] = Form.useForm<{
    status: "APPROVED" | "RETURNED";
    feedback: string;
    accuracy?: boolean;
    alignment?: boolean;
    rights?: boolean;
    readability?: boolean;
  }>();
  const decision = Form.useWatch("status", form);
  const result = useApiData<CourseReviewPage>(
    `/api/courses/${encodeURIComponent(courseId)}/reviews?page=${page}&pageSize=5`,
  );
  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
      result.reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "操作失败，请刷新重试。",
      );
    } finally {
      setBusy(false);
    }
  }
  if (result.loading && !result.data) return <Spin />;
  if (!result.data)
    return (
      <Alert
        type="error"
        title={result.error || "无法读取审核记录"}
        action={<Button onClick={result.reload}>重试</Button>}
      />
    );
  const { current, list, total } = result.data;
  const canDecide =
    current.courseStatus === "DRAFT" &&
    current.state === "PENDING" &&
    user?.role === "ADMIN" &&
    current.latest?.submittedById !== user.id;
  return (
    <Space orientation="vertical" style={{ width: "100%" }} size="middle">
      <Alert
        type="info"
        title="提交人与审核人必须不同；审核通过后仍需在课程管理中单独发布。"
        description="本流程留存人工确认和课程正文/视频编号快照；不代表题库、教材版权或全部视频已被系统自动核验。"
      />
      {(error || result.error) && (
        <Alert type="error" title={error || result.error} />
      )}
      <Space wrap>
        <Tag>{names[current.state]}</Tag>
        <Tag>课程状态：{current.courseStatus}</Tag>
        <Button disabled={busy} onClick={result.reload}>
          刷新版本
        </Button>
        {current.courseStatus === "DRAFT" &&
          ["NOT_SUBMITTED", "STALE", "RETURNED"].includes(current.state) && (
            <Popconfirm
              title="按已保存的当前版本提交审核？"
              description="尚未保存到服务器的编辑不会包含在本次提交中。"
              onConfirm={() =>
                run(async () => {
                  await courseReviewApi.submit(courseId, current.updatedAt);
                  setPage(1);
                  message.success("已提交，请由另一位管理员审核。");
                })
              }
            >
              <Button type="primary" disabled={busy}>
                提交审核
              </Button>
            </Popconfirm>
          )}
      </Space>
      <Collapse
        items={[
          {
            key: "current",
            label: "查看当前已保存课程内容",
            children: <Snapshot value={current.snapshot} />,
          },
        ]}
      />
      {current.state === "PENDING" &&
        current.latest?.submittedById === user?.id && (
          <Alert
            type="warning"
            title="你是本次提交人，请由另一位管理员审核。"
          />
        )}
      {canDecide && (
        <Form
          form={form}
          layout="vertical"
          initialValues={{ status: "RETURNED" }}
          onFinish={(v) =>
            void run(async () => {
              if (!current.latest) return;
              const common = {
                reviewId: current.latest.id,
                updatedAt: current.updatedAt,
                feedback: v.feedback,
              };
              await courseReviewApi.decide(
                courseId,
                v.status === "RETURNED"
                  ? { ...common, status: "RETURNED" }
                  : {
                      ...common,
                      status: "APPROVED",
                      checks: {
                        accuracy: true,
                        alignment: true,
                        rights: true,
                        readability: true,
                      },
                    },
              );
              form.resetFields();
              message.success("审核结论已保存。");
            })
          }
        >
          <Form.Item
            name="status"
            label="审核结论"
            rules={[{ required: true }]}
          >
            <Radio.Group
              disabled={busy}
              options={[
                { label: "退回修改", value: "RETURNED" },
                { label: "审核通过", value: "APPROVED" },
              ]}
            />
          </Form.Item>
          {decision === "APPROVED" &&
            checks.map(([key, label]) => (
              <Form.Item
                key={key}
                name={key}
                valuePropName="checked"
                rules={[
                  {
                    validator: (_, value: boolean) =>
                      value
                        ? Promise.resolve()
                        : Promise.reject(
                            new Error("请实际核对后勾选，未确认请退回。"),
                          ),
                  },
                ]}
              >
                <Checkbox disabled={busy}>{label}</Checkbox>
              </Form.Item>
            ))}
          <Form.Item
            name="feedback"
            label="审核意见 / 依据（10至2000字）"
            rules={[{ required: true, whitespace: true, min: 10, max: 2000 }]}
          >
            <Input.TextArea
              rows={3}
              maxLength={2000}
              showCount
              disabled={busy}
            />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={busy}>
            保存审核结论
          </Button>
        </Form>
      )}
      <h3>审核历史（{total}次）</h3>
      {!list.length ? (
        <Empty description="尚无提交记录" />
      ) : (
        <Collapse
          items={list.map((record) => ({
            key: record.id,
            label: `${names[record.status]} · ${record.submittedByName} · ${new Date(record.submittedAt).toLocaleString("zh-CN")}`,
            children: (
              <>
                <p>版本指纹：{record.contentHash.slice(0, 16)}…</p>
                <p>
                  审核人：{record.reviewerName || "待审核"}{" "}
                  {record.reviewedAt &&
                    new Date(record.reviewedAt).toLocaleString("zh-CN")}
                </p>
                <p style={{ whiteSpace: "pre-wrap" }}>
                  {record.feedback || "暂无结论"}
                </p>
                {record.checks && (
                  <p>已确认：知识准确、教材适配、使用依据、阅读体验。</p>
                )}
                <Snapshot value={record.snapshot} />
              </>
            ),
          }))}
        />
      )}
      <Pagination
        current={page}
        pageSize={5}
        total={total}
        showSizeChanger={false}
        onChange={setPage}
        size="small"
      />
    </Space>
  );
}
