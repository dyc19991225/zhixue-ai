import { useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Tabs,
  Typography,
  App,
} from "antd";
import { gradeOptions, isInternalHref } from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { signIn, signUp, recover } from "@/lib/api";
type Mode = "login" | "register" | "recover";
type Credentials = {
  username: string;
  passphrase: string;
  displayName?: string;
  grade?: string;
  recoveryCode?: string;
  newPassword?: string;
  confirm?: string;
};
const secretRules = [
  { required: true, message: "请输入密码。" },
  { min: 12, message: "密码至少12位。" },
  {
    validator: (_: unknown, value: string) =>
      !value || new TextEncoder().encode(value).length <= 72
        ? Promise.resolve()
        : Promise.reject(new Error("密码长度不能超过72字节。")),
  },
];
export default function Login() {
  const { user, loading } = useAuth();
  const { message } = App.useApp();
  const [query] = useSearchParams();
  const candidate = query.get("next") ?? "/dashboard";
  const next =
    isInternalHref(candidate) &&
    candidate.startsWith("/") &&
    !candidate.startsWith("/login")
      ? candidate
      : "/dashboard";
  const [mode, setMode] = useState<Mode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [saved, setSaved] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);
  if (!loading && user && !busy && !recoveryCode)
    return <Navigate to={next} replace />;
  async function submit(values: Credentials) {
    setBusy(true);
    setError("");
    try {
      if (mode === "login")
        await signIn({
          username: values.username,
          passphrase: values.passphrase,
        });
      else if (mode === "register") {
        const result = await signUp({
          username: values.username,
          passphrase: values.passphrase,
          displayName: values.displayName,
          grade: values.grade,
        });
        setRecoveryCode(result.recoveryCode ?? "");
      } else {
        const result = await recover({
          username: values.username,
          recoveryCode: values.recoveryCode,
          newPassword: values.newPassword,
        });
        setRecoveryCode(result.recoveryCode);
        setMode("login");
        message.success("密码已重设，请保存新恢复码后登录。");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作未完成。");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="wrap auth-layout">
      <div className="auth-intro">
        <h1>继续你的学习</h1>
        <p>登录后保存课时进度、作答记录与错题。</p>
        <img
          src="/images/course-workbench.webp"
          alt=""
          width={960}
          height={640}
        />
      </div>
      <div className="auth-form-card">
        <h2>
          {mode === "register"
            ? "创建学习账号"
            : mode === "recover"
              ? "找回账号密码"
              : "欢迎回来"}
        </h2>
        <p className="muted">使用学习账号登录，无需填写手机号。</p>
        <Tabs
          activeKey={mode}
          onChange={(key) => {
            setMode(key as Mode);
            setError("");
          }}
          items={[
            { key: "login", label: "账号登录" },
            { key: "register", label: "注册账号" },
            { key: "recover", label: "找回密码" },
          ]}
        />
        {error && (
          <div ref={errorRef} tabIndex={-1} role="alert">
            <Alert type="error" showIcon title={error} />
          </div>
        )}
        <Form
          key={mode}
          layout="vertical"
          onFinish={submit}
          initialValues={{ grade: "G7" }}
          autoComplete="on"
          requiredMark={false}
        >
          <Form.Item
            name="username"
            label="学习账号"
            normalize={(value) => String(value ?? "").toLowerCase()}
            rules={[
              { required: true, message: "请输入学习账号。" },
              {
                pattern: /^[a-z0-9_]{4,32}$/,
                message: "4–32位字母、数字或下划线。",
              },
            ]}
          >
            <Input
              autoComplete="username"
              placeholder="例如：study_2026"
              maxLength={32}
            />
          </Form.Item>
          {mode === "register" && (
            <>
              <Form.Item
                name="displayName"
                label="昵称"
                rules={[
                  { required: true, message: "请输入昵称。" },
                  { min: 2, max: 20, message: "昵称为2–20个字符。" },
                ]}
              >
                <Input
                  placeholder="不用填写真实姓名"
                  autoComplete="nickname"
                  maxLength={20}
                />
              </Form.Item>
              <Form.Item name="grade" label="年级" rules={[{ required: true }]}>
                <Select options={gradeOptions} />
              </Form.Item>
            </>
          )}
          {mode !== "recover" && (
            <Form.Item
              name="passphrase"
              label="密码"
              rules={
                mode === "register"
                  ? secretRules
                  : [{ required: true, message: "请输入密码。" }]
              }
              extra={
                mode === "register"
                  ? "至少12位，支持粘贴和密码管理器。"
                  : undefined
              }
            >
              <Input.Password
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
              />
            </Form.Item>
          )}
          {mode === "recover" && (
            <>
              <Alert
                type="info"
                showIcon
                title="本地版本使用注册时保存的恢复码找回密码，暂未接入短信或邮箱。"
              />
              <Form.Item
                name="recoveryCode"
                label="一次性恢复码"
                rules={[
                  { required: true, message: "请输入恢复码。" },
                  {
                    pattern: /^[a-f0-9]{64}$/,
                    message: "恢复码需为64位字符。",
                  },
                ]}
              >
                <Input.TextArea
                  autoSize={{ minRows: 2, maxRows: 3 }}
                  autoComplete="off"
                />
              </Form.Item>
              <Form.Item name="newPassword" label="新密码" rules={secretRules}>
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            </>
          )}
          {mode !== "login" && (
            <Form.Item
              name="confirm"
              label="确认密码"
              dependencies={[mode === "recover" ? "newPassword" : "passphrase"]}
              rules={[
                { required: true, message: "请再次输入密码。" },
                ({ getFieldValue }) => ({
                  validator: (_, value) =>
                    getFieldValue(
                      mode === "recover" ? "newPassword" : "passphrase",
                    ) === value
                      ? Promise.resolve()
                      : Promise.reject(new Error("两次输入的密码不一致。")),
                }),
              ]}
            >
              <Input.Password autoComplete="new-password" />
            </Form.Item>
          )}
          <Button
            type="primary"
            htmlType="submit"
            block
            size="large"
            loading={busy}
            disabled={loading}
          >
            {mode === "register"
              ? "创建账号"
              : mode === "recover"
                ? "验证恢复码并重设"
                : "登录学习中心"}
          </Button>
        </Form>
        <p className="auth-footnote">
          请保存恢复码。正式对外服务前仍需完善监护人流程和正式政策。
        </p>
      </div>
      <Modal
        open={!!recoveryCode}
        title="请保存一次性恢复码"
        closable={false}
        mask={{ closable: false }}
        footer={
          <Button
            type="primary"
            disabled={!saved}
            onClick={() => {
              setRecoveryCode("");
              setSaved(false);
            }}
          >
            已保存，继续
          </Button>
        }
      >
        <Alert
          type="warning"
          showIcon
          title="只在本次操作显示。恢复码可以重设密码，请与密码分开保存，不要分享。"
        />
        <Typography.Paragraph copyable className="recovery-code">
          {recoveryCode}
        </Typography.Paragraph>
        <Button
          onClick={() => {
            const a = document.createElement("a");
            const url = URL.createObjectURL(
              new Blob(
                [`知学 AI 一次性恢复码\n${recoveryCode}\n请保密保存。\n`],
                { type: "text/plain;charset=utf-8" },
              ),
            );
            a.href = url;
            a.download = "zhixue-recovery-code.txt";
            a.click();
            URL.revokeObjectURL(url);
            setSaved(true);
          }}
        >
          下载恢复码
        </Button>
        <Button type="link" onClick={() => setSaved(true)}>
          我已自行保存
        </Button>
      </Modal>
    </section>
  );
}
