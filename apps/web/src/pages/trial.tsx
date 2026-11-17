import { useRef, useState } from "react";
import { Alert, Button, Card, Checkbox, Input, Select, Space } from "antd";
import { Link } from "react-router-dom";
import {
  feedbackAreas,
  feedbackSeverities,
  type TrialFeedbackView,
} from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { api } from "@/lib/api";
import { FeedbackInbox } from "@/features/feedback/feedback-inbox";

const steps = [
  {
    title: "找到适合的课程",
    detail: "选择年级和教材版本，核对课程说明；没有匹配内容就记录缺口。",
    href: "/study",
  },
  {
    title: "完成一个课时",
    detail: "登录后进入已开放课时，阅读讲解；有视频时检查播放和进度保存。",
    href: "/dashboard",
  },
  {
    title: "练习与复习错题",
    detail:
      "完成本课配套题，查看解析，再检查本人错题本。无需故意修改真实学习记录。",
    href: "/practice",
  },
  {
    title: "试一次照片识别",
    detail: "用不含个人信息的印刷题照片，识别后校对数字和符号，不需要提交AI。",
    href: "/photo-question",
  },
  {
    title: "查看学习报告",
    detail: "核对已有课时和作答记录；没有记录时应显示空状态。",
    href: "/analytics",
  },
];
export default function Trial() {
  const { user } = useAuth();
  return <TrialSession key={user?.id ?? "guest"} />;
}
function TrialSession() {
  const { user } = useAuth();
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const pending = useRef<{ fingerprint: string; requestId: string }>();
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [done, setDone] = useState<string[]>([]);
  const [area, setArea] = useState("课程与内容");
  const [severity, setSeverity] = useState("一般问题");
  const [detail, setDetail] = useState("");
  const [downloaded, setDownloaded] = useState(false);
  function download() {
    const body = `知学本地试用反馈\n时间：${new Date().toISOString()}\n范围：${area}\n影响：${severity}\n已勾选试用项（自行确认，非系统验收）：${done.join("、") || "无"}\n问题现象、重现步骤和预期：\n${detail.trim()}\n\n本次下载仅生成本机文件，不会提交反馈。提交状态以本站回执和我的反馈列表为准。`;
    const url = URL.createObjectURL(
      new Blob([body], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `zhixue-feedback-${Date.now()}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setDownloaded(true);
  }
  async function submit() {
    if (sendingRef.current || !user) return;
    sendingRef.current = true;
    setSending(true);
    setError("");
    setReceipt("");
    const fingerprint = JSON.stringify([area, severity, detail.trim()]);
    if (pending.current?.fingerprint !== fingerprint)
      pending.current = { fingerprint, requestId: crypto.randomUUID() };
    try {
      const result = await api<TrialFeedbackView>("/api/feedback", "POST", {
        area,
        severity,
        detail: detail.trim(),
        requestId: pending.current!.requestId,
      });
      setReceipt(result.id);
      setRefreshKey((value) => value + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }
  return (
    <section className="wrap account-page trial-page">
      <p className="eyebrow">小范围试学</p>
      <h1>走完一次学习，再告诉我们哪里卡住。</h1>
      <p className="intro">
        建议预留20分钟。先用测试昵称，不填写真实姓名、学校或联系方式；未成年人请在监护人指导下试用。
      </p>
      <Alert
        type="info"
        showIcon
        title="当前试用边界"
        description="课程以实际发布内容为准。拍照文字识别在本机完成，主动附图提问才会调用已配置模型，不保证手写、公式和几何解答准确。没有真实交易；反馈只有点击提交后才发送到本站。"
      />
      <div className="trial-grid">
        <Card title={`试学清单 · 已自行确认 ${done.length}/${steps.length}`}>
          <ol className="trial-list">
            {steps.map((step) => (
              <li key={step.title}>
                <Checkbox
                  checked={done.includes(step.title)}
                  onChange={(event) =>
                    setDone((previous) =>
                      event.target.checked
                        ? [...previous, step.title]
                        : previous.filter((item) => item !== step.title),
                    )
                  }
                >
                  {step.title}
                </Checkbox>
                <p>{step.detail}</p>
                <Link className="text-link" to={step.href}>
                  进入体验 →
                </Link>
              </li>
            ))}
          </ol>
          <p className="muted">
            清单仅保留在本页内存，刷新会清空。勾选不修改课程完成状态或作答记录。
          </p>
        </Card>
        <Card title="记录问题，下载或提交反馈">
          <fieldset disabled={sending} className="photo-fieldset">
            <label className="photo-editor">
              问题范围
              <Select
                value={area}
                disabled={sending}
                onChange={(value) => {
                  setArea(value);
                  setReceipt("");
                  setDownloaded(false);
                }}
                options={feedbackAreas.map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </label>
            <label className="photo-editor">
              影响程度
              <Select
                value={severity}
                disabled={sending}
                onChange={(value) => {
                  setSeverity(value);
                  setReceipt("");
                  setDownloaded(false);
                }}
                options={feedbackSeverities.map((value) => ({
                  value,
                  label: value,
                }))}
              />
            </label>
            <label className="photo-editor">
              现象、步骤和预期
              <Input.TextArea
                value={detail}
                rows={7}
                maxLength={3000}
                showCount
                onChange={(event) => {
                  setDetail(event.target.value);
                  setDownloaded(false);
                  setReceipt("");
                }}
                placeholder="例如：选七年级数学，打开某课，点击配套练习后……请勿粘贴密码、恢复码、学生姓名或原始照片。"
              />
            </label>
            <Space wrap>
              <Button
                type="primary"
                disabled={detail.trim().length < 5}
                onClick={download}
              >
                下载反馈单
              </Button>
              {user ? (
                <Button
                  disabled={detail.trim().length < 5}
                  loading={sending}
                  onClick={() => void submit()}
                >
                  提交到本站
                </Button>
              ) : (
                <Link to="/login?next=%2Ftrial">登录后提交并查看进度</Link>
              )}
              <Button
                onClick={() => {
                  setDetail("");
                  setDone([]);
                  setDownloaded(false);
                  setReceipt("");
                  setError("");
                  pending.current = undefined;
                }}
              >
                清空本页记录
              </Button>
            </Space>
          </fieldset>
          {error && <Alert type="error" title={error} />}
          {receipt && (
            <Alert
              type="success"
              title={`本站已接收，反馈编号：${receipt}`}
              description="接收成功不代表已处理，请在下方查看进度和处理说明。"
            />
          )}
          {downloaded && (
            <Alert
              type="success"
              title="已生成本地反馈单，本次下载不会提交反馈。"
            />
          )}
          <p className="muted">
            提交会保存问题范围、影响程度和描述供本站管理员查看，不包含勾选清单或照片。请勿填写密码、恢复码或学生个人信息。疑似隐私或权限问题请先停止相关操作。
          </p>
          <Link className="text-link" to="/privacy">
            阅读隐私说明
          </Link>
        </Card>
      </div>
      {user && <FeedbackInbox refreshKey={refreshKey} key={user.id} />}
    </section>
  );
}
