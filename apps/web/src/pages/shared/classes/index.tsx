import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
} from "antd";
import { Link } from "react-router-dom";
import {
  gradeOptions,
  type ClassView,
  type GradeCode,
  type PageResult,
  type RelatedStudent,
} from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { useApiData } from "@/hooks/use-api-data";
import { relationsApi } from "@/api/relations";
import { UserPicker } from "@/components/user-picker";
export default function Classes() {
  const { user } = useAuth(),
    { message } = App.useApp();
  const canManage = user?.role === "ADMIN" || user?.role === "TEACHER";
  const [page, setPage] = useState(1),
    [rosterPage, setRosterPage] = useState(1),
    [selected, setSelected] = useState<ClassView | null>(null),
    [creating, setCreating] = useState(false),
    [busy, setBusy] = useState(false);
  const [form] = Form.useForm<{
      name: string;
      grade: GradeCode;
      teacherId?: string;
    }>(),
    [memberForm] = Form.useForm<{ username: string }>();
  const classes = useApiData<PageResult<ClassView>>(
    `/api/classes?page=${page}&pageSize=10`,
  );
  const roster = useApiData<PageResult<RelatedStudent>>(
    selected
      ? `/api/classes/${encodeURIComponent(selected.id)}/students?page=${rosterPage}&pageSize=10`
      : null,
  );
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
  return (
    <section className="wrap account-page relation-page">
      <div className="account-heading">
        <div>
          <p className="eyebrow">班级空间</p>
          <h1>{user?.role === "ADMIN" ? "班级管理" : "我的班级"}</h1>
          <p className="muted">
            {canManage
              ? "建立班级，维护学生名单。"
              : "查看老师已将你加入的班级。"}
          </p>
        </div>
        <Space wrap>
          <Link className="ant-btn" to="/dashboard">
            个人中心
          </Link>
          <Button onClick={classes.reload}>刷新</Button>
          {canManage && (
            <Button
              type="primary"
              onClick={() => {
                form.resetFields();
                form.setFieldsValue({ grade: "G7" });
                setCreating(true);
              }}
            >
              创建班级
            </Button>
          )}
        </Space>
      </div>
      {classes.error && (
        <Alert
          type="error"
          title={classes.error}
          action={<Button onClick={classes.reload}>重试</Button>}
        />
      )}
      <Card>
        <Table<ClassView>
          rowKey="id"
          dataSource={classes.data?.list ?? []}
          loading={classes.loading}
          scroll={{ x: canManage ? 560 : 360 }}
          locale={{
            emptyText: canManage
              ? "暂无班级，可以创建第一个班级。"
              : "暂无班级，请联系老师。",
          }}
          pagination={{
            current: page,
            pageSize: 10,
            total: classes.data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            { title: "班级", dataIndex: "name" },
            ...(canManage
              ? [
                  {
                    title: "学情",
                    render: (_: unknown, c: ClassView) => (
                      <Link
                        className="ant-btn"
                        to={`/analytics?classId=${encodeURIComponent(c.id)}`}
                      >
                        班级学情
                      </Link>
                    ),
                  },
                ]
              : []),
            {
              title: "考试",
              render: (_, c: ClassView) => (
                <Link
                  className="ant-btn"
                  to={`/exams?${new URLSearchParams({ classId: c.id, className: c.name })}`}
                >
                  班级考试
                </Link>
              ),
            },
            {
              title: "作业",
              render: (_, c: ClassView) => (
                <Link
                  className="ant-btn"
                  to={`/homework?${new URLSearchParams({ classId: c.id, className: c.name })}`}
                >
                  班级作业
                </Link>
              ),
            },
            {
              title: "年级",
              render: (_, c) =>
                gradeOptions.find((g) => g.value === c.grade)?.label,
            },
            ...(canManage
              ? [
                  {
                    title: "操作",
                    render: (_: unknown, c: ClassView) => (
                      <Space wrap>
                        <Button
                          disabled={busy}
                          onClick={() => {
                            memberForm.resetFields();
                            setRosterPage(1);
                            setSelected(c);
                          }}
                        >
                          学生名单
                        </Button>
                        <Popconfirm
                          title="归档该班级？"
                          description="归档后将停止班级管理，历史记录会保留。"
                          onConfirm={() =>
                            run(async () => {
                              await relationsApi.archiveClass(c.id);
                              setPage(1);
                              classes.reload();
                            })
                          }
                        >
                          <Button danger disabled={busy}>
                            归档
                          </Button>
                        </Popconfirm>
                      </Space>
                    ),
                  },
                ]
              : []),
          ]}
        />
      </Card>
      <Modal
        title="创建班级"
        open={creating}
        confirmLoading={busy}
        onCancel={() => {
          if (!busy) setCreating(false);
        }}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={(values) =>
            void run(async () => {
              await relationsApi.createClass(values);
              setCreating(false);
              setPage(1);
              classes.reload();
              message.success("班级已创建。");
            })
          }
        >
          <Form.Item
            name="name"
            label="班级名称"
            rules={[{ required: true, whitespace: true, max: 80 }]}
          >
            <Input maxLength={80} />
          </Form.Item>
          <Form.Item name="grade" label="年级" rules={[{ required: true }]}>
            <Select options={gradeOptions} />
          </Form.Item>
          {user?.role === "ADMIN" && (
            <Form.Item
              name="teacherId"
              label="授课教师"
              rules={[{ required: true }]}
            >
              <UserPicker role="TEACHER" disabled={busy} />
            </Form.Item>
          )}
        </Form>
      </Modal>
      <Modal
        title={selected ? `${selected.name} · 学生名单` : "学生名单"}
        open={!!selected}
        onCancel={() => {
          if (!busy) setSelected(null);
        }}
        footer={null}
        width={760}
      >
        <Form
          form={memberForm}
          layout="vertical"
          onFinish={(values) =>
            void run(async () => {
              if (!selected) return;
              await relationsApi.addStudent(selected.id, values.username);
              memberForm.resetFields();
              setRosterPage(1);
              roster.reload();
              message.success("学生已加入班级。");
            })
          }
        >
          <Form.Item
            name="username"
            label="添加学生：输入平台学习账号"
            rules={[
              { required: true },
              {
                pattern: /^[a-zA-Z0-9_]{4,32}$/,
                message: "请输入4–32位账号。",
              },
            ]}
          >
            <Input maxLength={32} autoComplete="off" />
          </Form.Item>
          <Button htmlType="submit" loading={busy}>
            添加学生
          </Button>
        </Form>
        {roster.error && (
          <Alert
            type="error"
            title={roster.error}
            action={<Button onClick={roster.reload}>重试</Button>}
          />
        )}
        <Table<RelatedStudent>
          rowKey="id"
          dataSource={roster.data?.list ?? []}
          loading={roster.loading}
          scroll={{ x: 360 }}
          pagination={{
            current: rosterPage,
            pageSize: 10,
            total: roster.data?.total ?? 0,
            showSizeChanger: false,
            onChange: setRosterPage,
          }}
          columns={[
            { title: "学生", dataIndex: "displayName" },
            {
              title: "年级",
              render: (_, s) =>
                gradeOptions.find((g) => g.value === s.grade)?.label,
            },
            {
              title: "操作",
              render: (_, s) => (
                <Popconfirm
                  title="将该学生移出班级？"
                  onConfirm={() =>
                    run(async () => {
                      if (!selected) return;
                      await relationsApi.removeStudent(selected.id, s.id);
                      setRosterPage(1);
                      roster.reload();
                    })
                  }
                >
                  <Button danger disabled={busy}>
                    移出
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Modal>
    </section>
  );
}
