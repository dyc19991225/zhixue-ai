import { useEffect, useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} from "antd";
import {
  roleLabels,
  roleOptions,
  type AuthUser,
  type Role,
} from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { api } from "@/lib/api";
export default function Admin() {
  const { user } = useAuth();
  const { message } = App.useApp();
  const [items, setItems] = useState<AuthUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [roleTarget, setRoleTarget] = useState<AuthUser | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [roleForm] = Form.useForm<{ role: Role }>();
  async function load(current = page) {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ items: AuthUser[]; total: number }>(
        `/api/admin/users?page=${current}`,
      );
      setItems(data.items);
      setTotal(data.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "无法加载用户。");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load(page);
  }, [page]);
  async function changeStatus(target: AuthUser) {
    try {
      await api(`/api/admin/users/${target.id}/status`, "PATCH", {
        status: target.status === "ACTIVE" ? "DISABLED" : "ACTIVE",
      });
      message.success("账户状态已更新。");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "更新未完成。");
    }
  }
  async function saveRole(values: { role: Role }) {
    if (!roleTarget) return;
    setRoleSaving(true);
    try {
      await api(`/api/admin/users/${roleTarget.id}/role`, "PATCH", {
        role: values.role,
        updatedAt: roleTarget.updatedAt,
      });
      setRoleTarget(null);
      message.success("角色已更新；角色发生变化时原登录会话已退出。");
      await load();
    } catch (cause) {
      message.error(cause instanceof Error ? cause.message : "角色更新失败。");
    } finally {
      setRoleSaving(false);
    }
  }
  return (
    <section className="wrap account-page">
      <div className="account-heading">
        <div>
          <p className="eyebrow">管理员工作台</p>
          <h1>用户管理</h1>
          <p className="muted">
            查看注册账号并管理使用状态，状态变更会留下操作记录。
          </p>
        </div>
        <Space wrap>
          <Button href="/admin/feedback">试用反馈</Button>
          <Button href="/admin/content-readiness">内容准备度</Button>
          <Button href="/admin/lesson-readiness">课时配套检查</Button>
          <Button href="/admin/relations">家长绑定</Button>
          <Button href="/classes">班级管理</Button>
          <Button href="/admin/questions">题库管理</Button>
          <Button href="/membership">权益管理</Button>
          <Button type="primary" href="/admin/courses">
            课程管理
          </Button>
          <Button href="/dashboard">个人中心</Button>
          <Button onClick={() => void load()}>刷新列表</Button>
        </Space>
      </div>
      {error && <Alert type="error" showIcon title={error} />}
      <Card>
        <Table
          rowKey="id"
          dataSource={items}
          loading={loading}
          scroll={{ x: 780 }}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: setPage,
            showSizeChanger: false,
          }}
          columns={[
            { title: "学习账号", dataIndex: "username" },
            { title: "昵称", dataIndex: "displayName" },
            {
              title: "角色",
              dataIndex: "role",
              render: (role: Role) => (
                <Tag color={role === "ADMIN" ? "blue" : "default"}>
                  {roleLabels[role]}
                </Tag>
              ),
            },
            {
              title: "状态",
              dataIndex: "status",
              render: (status) => (
                <Tag color={status === "ACTIVE" ? "green" : "red"}>
                  {status === "ACTIVE" ? "可用" : "已停用"}
                </Tag>
              ),
            },
            {
              title: "注册时间",
              dataIndex: "createdAt",
              render: (time) => new Date(time).toLocaleDateString("zh-CN"),
            },
            {
              title: "操作",
              render: (_, target) =>
                target.id === user?.id ? (
                  <span className="muted">当前账号</span>
                ) : (
                  <Space>
                    <Button
                      onClick={() => {
                        setRoleTarget(target);
                        roleForm.setFieldsValue({ role: target.role });
                      }}
                    >
                      设置角色
                    </Button>
                    <Popconfirm
                      title={
                        target.status === "ACTIVE"
                          ? "停用该账号并退出其全部会话？"
                          : "恢复该账号的使用权限？"
                      }
                      onConfirm={() => changeStatus(target)}
                    >
                      <Button danger={target.status === "ACTIVE"} size="small">
                        {target.status === "ACTIVE" ? "停用" : "恢复"}
                      </Button>
                    </Popconfirm>
                  </Space>
                ),
            },
          ]}
        />
      </Card>
      <Modal
        title="设置用户角色"
        open={!!roleTarget}
        confirmLoading={roleSaving}
        onCancel={() => {
          if (!roleSaving) setRoleTarget(null);
        }}
        onOk={() => roleForm.submit()}
        okText="确认修改"
        cancelText="取消"
      >
        <p>账号：{roleTarget?.username}</p>
        <p>角色变更会退出该账号的全部登录会话。管理员拥有全平台管理权限。</p>
        <Form form={roleForm} onFinish={saveRole} layout="vertical">
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={roleOptions} disabled={roleSaving} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
