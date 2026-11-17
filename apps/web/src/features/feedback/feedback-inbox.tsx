import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Pagination,
  Select,
  Space,
  Tag,
} from "antd";
import {
  feedbackStatuses,
  feedbackStatusLabels,
  type FeedbackPage,
  type TrialFeedbackView,
} from "@zhixue/shared";
import { api } from "@/lib/api";
export function FeedbackInbox({
  admin = false,
  refreshKey = 0,
}: {
  admin?: boolean;
  refreshKey?: number;
}) {
  const [data, setData] = useState<FeedbackPage>();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<TrialFeedbackView>();
  const [nextStatus, setNextStatus] = useState("IN_PROGRESS");
  const [reply, setReply] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const version = useRef(0);
  async function load() {
    const id = ++version.current;
    setLoading(true);
    setError("");
    try {
      const result = await api<FeedbackPage>(
        `/api/${admin ? "admin/" : ""}feedback?page=${page}${status ? `&status=${status}` : ""}`,
      );
      if (id === version.current) setData(result);
    } catch (e) {
      if (id === version.current) {
        setData(undefined);
        setError((e as Error).message);
      }
    } finally {
      if (id === version.current) setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    return () => {
      version.current++;
    };
  }, [page, status, refreshKey]);
  return (
    <section className="feedback-inbox" aria-busy={loading}>
      <div className="account-heading">
        <h2>{admin ? "试用反馈处理" : "我的反馈与处理进度"}</h2>
        <Space wrap>
          <Select
            aria-label="反馈状态筛选"
            value={status}
            placeholder="全部状态"
            allowClear
            style={{ width: 150 }}
            onChange={(value) => {
              setStatus(value);
              setPage(1);
            }}
            options={feedbackStatuses.map((value) => ({
              value,
              label: feedbackStatusLabels[value],
            }))}
          />
          <Button loading={loading} onClick={() => void load()}>
            刷新反馈
          </Button>
        </Space>
      </div>
      {error && <Alert type="error" title={error} />}
      {!loading && !data?.items.length && !error && (
        <p className="muted">当前没有反馈记录。</p>
      )}
      {data?.items.map((item) => (
        <Card key={item.id} className="lesson-chapter">
          <Space wrap>
            <Tag
              color={
                item.status === "RESOLVED"
                  ? "green"
                  : item.status === "IN_PROGRESS"
                    ? "blue"
                    : "default"
              }
            >
              {feedbackStatusLabels[item.status]}
            </Tag>
            <span>
              {item.area} · {item.severity}
            </span>
          </Space>
          <p className="muted">
            编号：{item.id} · {new Date(item.createdAt).toLocaleString("zh-CN")}
          </p>
          <p className="lesson-prose">{item.detail}</p>
          <p className="lesson-prose">
            <strong>处理说明：</strong>
            {item.reply || "尚无处理说明，已接收不代表问题已解决。"}
          </p>
          {admin && (
            <Button
              disabled={loading || saving}
              onClick={() => {
                setTarget(item);
                setNextStatus(
                  item.status === "NEW" ? "IN_PROGRESS" : item.status,
                );
                setReply(item.reply);
                setSaveError("");
              }}
            >
              更新处理进度
            </Button>
          )}
        </Card>
      ))}
      {!!data?.total && (
        <Pagination
          current={page}
          pageSize={20}
          total={data.total}
          showSizeChanger={false}
          onChange={setPage}
        />
      )}
      <Modal
        open={!!target}
        title="更新反馈处理进度"
        okText="保存并向提交人展示"
        cancelText="取消"
        confirmLoading={saving}
        closable={!saving}
        maskClosable={!saving}
        cancelButtonProps={{ disabled: saving }}
        onCancel={() => {
          if (!saving) setTarget(undefined);
        }}
        onOk={async () => {
          if (!target || saving) return;
          if (reply.trim().length < 5) {
            setSaveError("请填写至少5字的具体处理说明。");
            return;
          }
          setSaving(true);
          setSaveError("");
          try {
            await api(`/api/admin/feedback/${target.id}`, "PATCH", {
              revision: target.revision,
              status: nextStatus,
              reply,
            });
            setTarget(undefined);
            await load();
          } catch (e) {
            setSaveError((e as Error).message);
          } finally {
            setSaving(false);
          }
        }}
      >
        {saveError && <Alert type="error" title={saveError} />}
        <label className="photo-editor">
          处理状态
          <Select
            value={nextStatus}
            onChange={setNextStatus}
            disabled={saving}
            options={feedbackStatuses
              .filter((value) => value !== "NEW")
              .map((value) => ({ value, label: feedbackStatusLabels[value] }))}
          />
        </label>
        <label className="photo-editor">
          处理说明（提交人可见）
          <Input.TextArea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            disabled={saving}
            rows={5}
            maxLength={2000}
            showCount
          />
        </label>
        <p className="muted">
          请说明已做的检查或下一步。只有确认问题解决后才标记“已解决”。其他管理员更新后需关闭窗口、刷新再处理。
        </p>
      </Modal>
    </section>
  );
}
