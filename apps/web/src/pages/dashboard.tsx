import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  Tabs,
} from "antd";
import type { AuthUser, SessionView } from "@zhixue/shared";
import { gradeOptions, roleLabels } from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { api, clearSession, setProfile, signOut } from "@/lib/api";
import { LearningReviewPanel } from "@/features/courses/learning-review-panel";
import { MyLearning } from "@/features/courses/my-learning";
import { StudyTaskPanel } from "@/features/courses/study-tasks";
import { TeacherTaskPanel } from "@/features/courses/teacher-tasks";
import ParentStudents from "@/pages/parent/students";
import { CourseReviewQueuePanel } from "@/components/course-review-queue";
import { Arrow } from "@/components/icons";
import { workspaceLinks, workspaces } from "@/components/workspace-navigation";

const mainAction = {
  STUDENT: { href: "/study", label: "继续学习" },
  TEACHER: { href: "/teacher/courses", label: "我的教学课程" },
  PARENT: { href: "/parent/students", label: "孩子的学习概览" },
  ADMIN: { href: "/admin/courses", label: "课程管理" },
};

export default function Dashboard() {
  const { user } = useAuth();
  const [query, setQuery] = useSearchParams();
  const requestedTab = query.get("tab");
  const student = user?.role === "STUDENT";
  const tab =
    requestedTab === "profile" ||
    requestedTab === "security" ||
    (requestedTab === "review" && student)
      ? requestedTab
      : "learning";
  const requestedPage = Number(query.get("reviewPage"));
  const reviewPage =
    Number.isInteger(requestedPage) &&
    requestedPage >= 1 &&
    requestedPage <= 10000
      ? requestedPage
      : 1;
  const { message } = App.useApp();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [sessions, setSessions] = useState<SessionView[]>([]);
  const [profileForm] = Form.useForm();
  const [secretForm] = Form.useForm();
  async function load() {
    try {
      const [profile, result] = await Promise.all([
        api<AuthUser>("/api/users/me"),
        api<{ items: SessionView[] }>("/api/auth/sessions"),
      ]);
      setProfile(profile);
      setSessions(result.items);
      profileForm.setFieldsValue(profile);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "加载失败。");
    }
  }
  useEffect(() => {
    void load();
  }, []);
  async function save(values: { displayName: string; grade: string }) {
    setSaving(true);
    setError("");
    try {
      setProfile(await api<AuthUser>("/api/users/me", "PATCH", values));
      message.success("个人设置已保存。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }
  async function run(action: () => Promise<unknown>) {
    setError("");
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作未完成。");
    }
  }
  return (
    <section className="wrap account-page">
      <header className="workspace-welcome">
        <div>
          <h1>{user ? workspaces[user.role] : "个人工作区"}</h1>
          <p>
            你好，{user?.displayName}{" "}
            <span>· {user && roleLabels[user.role]}</span>
          </p>
        </div>
        <div className="workspace-welcome-actions">
          {user && (
            <Link className="button primary" to={mainAction[user.role].href}>
              {mainAction[user.role].label}
            </Link>
          )}
          <Button onClick={() => void run(signOut)}>退出登录</Button>
        </div>
      </header>
      {user && (
        <nav className="workspace-shortcuts" aria-label="工作区常用入口">
          {workspaceLinks(user.role)
            .filter((link) => link.href !== mainAction[user.role].href)
            .map((link) => (
              <Link key={link.href} to={link.href}>
                {link.label}
                <Arrow />
              </Link>
            ))}
          <Link to="/practice?mode=wrong">
            我的错题
            <Arrow />
          </Link>
        </nav>
      )}
      {error && (
        <Alert
          type="error"
          showIcon
          title={error}
          closable
          onClose={() => setError("")}
        />
      )}
      <Tabs
        activeKey={tab}
        onChange={(value) => {
          setQuery((current) => {
            const next = new URLSearchParams(current);
            if (value === "learning") next.delete("tab");
            else next.set("tab", value);
            next.delete("reviewPage");
            return next;
          });
        }}
        items={[
          {
            key: "learning",
            label: "学习记录",
            children: (
              <>
                {user?.role === "STUDENT" && <StudyTaskPanel />}
                {user?.role === "TEACHER" && <TeacherTaskPanel />}
                {user?.role === "ADMIN" && <CourseReviewQueuePanel />}
                {user?.role === "PARENT" ? (
                  <ParentStudents embedded />
                ) : (
                  <MyLearning key={user?.id} />
                )}
              </>
            ),
          },
          ...(student
            ? [
                {
                  key: "review",
                  label: "待复练",
                  children: tab === "review" && (
                    <LearningReviewPanel
                      page={reviewPage}
                      onPageChange={(page) => {
                        setQuery((current) => {
                          const next = new URLSearchParams(current);
                          if (page > 1) next.set("reviewPage", String(page));
                          else next.delete("reviewPage");
                          return next;
                        });
                      }}
                    />
                  ),
                },
              ]
            : []),
          {
            key: "profile",
            forceRender: true,
            label: "个人设置",
            children: (
              <Card title="昵称与年级">
                <Form
                  form={profileForm}
                  layout="vertical"
                  className="settings-form"
                  onFinish={save}
                  initialValues={user ?? {}}
                >
                  <Form.Item
                    name="displayName"
                    label="昵称"
                    rules={[
                      { required: true },
                      { min: 2, max: 20, message: "昵称为2–20个字符。" },
                    ]}
                  >
                    <Input maxLength={20} autoComplete="nickname" />
                  </Form.Item>
                  <Form.Item
                    name="grade"
                    label="年级"
                    rules={[{ required: true }]}
                  >
                    <Select options={gradeOptions} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" loading={saving}>
                    保存设置
                  </Button>
                </Form>
              </Card>
            ),
          },
          {
            key: "security",
            forceRender: true,
            label: "账号安全",
            children: (
              <Space
                orientation="vertical"
                size="large"
                style={{ width: "100%" }}
              >
                <Card title="修改密码">
                  <Form
                    form={secretForm}
                    layout="vertical"
                    className="settings-form"
                    onFinish={(values) =>
                      void run(async () => {
                        await api("/api/auth/credentials/change", "POST", {
                          currentPassword: values.currentPassword,
                          newPassword: values.newPassword,
                        });
                        clearSession();
                        message.success("密码已修改，请重新登录。");
                      })
                    }
                  >
                    <Form.Item
                      name="currentPassword"
                      label="当前密码"
                      rules={[{ required: true }]}
                    >
                      <Input.Password autoComplete="current-password" />
                    </Form.Item>
                    <Form.Item
                      name="newPassword"
                      label="新密码"
                      rules={[
                        { required: true },
                        { min: 12, message: "密码至少12位。" },
                      ]}
                    >
                      <Input.Password autoComplete="new-password" />
                    </Form.Item>
                    <Form.Item
                      name="confirm"
                      label="确认新密码"
                      dependencies={["newPassword"]}
                      rules={[
                        { required: true },
                        ({ getFieldValue }) => ({
                          validator: (_, value) =>
                            value === getFieldValue("newPassword")
                              ? Promise.resolve()
                              : Promise.reject(new Error("两次密码不一致。")),
                        }),
                      ]}
                    >
                      <Input.Password autoComplete="new-password" />
                    </Form.Item>
                    <Button type="primary" htmlType="submit">
                      修改并重新登录
                    </Button>
                  </Form>
                </Card>
                <Card
                  title="登录会话"
                  extra={<Button onClick={() => void load()}>刷新</Button>}
                >
                  <Table
                    rowKey="id"
                    dataSource={sessions}
                    pagination={false}
                    scroll={{ x: 560 }}
                    columns={[
                      {
                        title: "会话",
                        dataIndex: "current",
                        render: (current) =>
                          current ? "当前会话" : "其他会话",
                      },
                      {
                        title: "建立时间",
                        dataIndex: "createdAt",
                        render: (time) =>
                          new Date(time).toLocaleString("zh-CN"),
                      },
                      {
                        title: "操作",
                        render: (_, item) => (
                          <Popconfirm
                            title="结束这个登录会话？"
                            onConfirm={() =>
                              run(async () => {
                                await api(
                                  `/api/auth/sessions/${item.id}`,
                                  "DELETE",
                                );
                                if (item.current) clearSession();
                                else await load();
                              })
                            }
                          >
                            <Button danger size="small">
                              退出该会话
                            </Button>
                          </Popconfirm>
                        ),
                      },
                    ]}
                  />
                  <Popconfirm
                    title="退出所有设备上的登录？"
                    onConfirm={() =>
                      run(async () => {
                        await api("/api/auth/logout-all", "POST");
                        clearSession();
                      })
                    }
                  >
                    <Button danger style={{ marginTop: 20 }}>
                      退出全部会话
                    </Button>
                  </Popconfirm>
                </Card>
              </Space>
            ),
          },
        ]}
      />
    </section>
  );
}
