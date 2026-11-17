import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  Table,
  Tag,
} from "antd";
import { Link } from "react-router-dom";
import { useAuth } from "@/auth/auth-provider";
import { api } from "@/lib/api";
type Membership = {
  id: string;
  startsAt: string;
  expiresAt: string;
  revokedAt?: string | null;
  plan: { name: string };
  user?: { username: string };
};
export default function MembershipPage() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [grantForm] = Form.useForm();
  const [mine, setMine] = useState<{ active: boolean; items: Membership[] }>(),
    [items, setItems] = useState<Membership[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function load() {
    if (!user) return;
    setMine(await api("/api/membership"));
    if (user.role === "ADMIN") {
      const d = await api<{ items: Membership[]; total: number }>(
        `/api/admin/memberships?page=${page}`,
      );
      setItems(d.items);
      setTotal(d.total);
    }
  }
  useEffect(() => {
    void load().catch((e) => setError(e.message));
  }, [user, page]);
  async function grant(v: { username: string; days: number }) {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/memberships", "POST", v);
      await load();
      grantForm.resetFields(["username"]);
      message.success(`已授予 ${v.days} 天学习权益。`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="wrap account-page">
      <h1>我的学习权益</h1>
      <p className="intro">免费课程可直接加入，会员课程在权益有效期内开放。</p>
      <Alert
        type="info"
        title="当前不开放购买、支付或续费"
        description="本地版本仅支持管理员手动授予测试权益，没有默认付费套餐。"
      />
      {error && <Alert type="error" title={error} />}
      <Card
        className="lesson-chapter"
        title={mine?.active ? "会员权益生效中" : "当前没有有效会员权益"}
      >
        {!user ? (
          <Link className="button primary" to="/login?next=%2Fmembership">
            登录查看权益
          </Link>
        ) : (
          <>
            {mine?.items.map((m) => (
              <p key={m.id}>
                {m.plan.name} · 有效至{" "}
                {new Date(m.expiresAt).toLocaleString("zh-CN")}
              </p>
            ))}
            <Link className="text-link" to="/courses">
              浏览课程
            </Link>
          </>
        )}
      </Card>
      {user?.role === "ADMIN" && (
        <>
          <h2>管理员权益管理</h2>
          <Card title="授予测试权益">
            <Form
              layout="vertical"
              onFinish={grant}
              form={grantForm}
              initialValues={{ days: 7 }}
            >
              <Form.Item
                name="username"
                label="学习账号"
                rules={[{ required: true, pattern: /^[a-z0-9_]{4,32}$/ }]}
              >
                <Input autoComplete="off" />
              </Form.Item>
              <Form.Item
                name="days"
                label="有效天数（1–365天）"
                rules={[{ required: true }]}
              >
                <InputNumber min={1} max={365} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={busy}>
                授予权益
              </Button>
            </Form>
          </Card>
          <Table
            rowKey="id"
            scroll={{ x: 650 }}
            dataSource={items}
            pagination={{
              current: page,
              total,
              pageSize: 20,
              showSizeChanger: false,
              onChange: setPage,
            }}
            columns={[
              { title: "账号", render: (_, m) => m.user?.username },
              {
                title: "有效期至",
                dataIndex: "expiresAt",
                render: (t) => new Date(t).toLocaleString("zh-CN"),
              },
              {
                title: "状态",
                render: (_, m) => (
                  <Tag>
                    {m.revokedAt
                      ? "已撤销"
                      : new Date(m.expiresAt) <= new Date()
                        ? "已到期"
                        : "有效"}
                  </Tag>
                ),
              },
              {
                title: "操作",
                render: (_, m) => (
                  <Popconfirm
                    title="撤销这条权益？该账号的其他有效权益不受影响。"
                    onConfirm={async () => {
                      try {
                        await api(`/api/admin/memberships/${m.id}`, "DELETE");
                        await load();
                      } catch (e) {
                        setError((e as Error).message);
                      }
                    }}
                  >
                    <Button disabled={!!m.revokedAt} danger>
                      撤销
                    </Button>
                  </Popconfirm>
                ),
              },
            ]}
          />
        </>
      )}
    </section>
  );
}
