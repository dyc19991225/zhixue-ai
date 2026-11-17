import { useState } from "react";
import { Alert, App, Button, Card, Form, Popconfirm, Space, Table } from "antd";
import { Link } from "react-router-dom";
import type { PageResult, ParentLinkView } from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";
import { relationsApi } from "@/api/relations";
import { UserPicker } from "@/components/user-picker";
export default function ParentLinks() {
  const { message } = App.useApp();
  const [page, setPage] = useState(1),
    [busy, setBusy] = useState(false);
  const [form] = Form.useForm<{ parentId: string; studentId: string }>();
  const links = useApiData<PageResult<ParentLinkView>>(
    `/api/admin/parent-links?page=${page}&pageSize=10`,
  );
  async function run(work: () => Promise<void>) {
    setBusy(true);
    try {
      await work();
      setPage(1);
      links.reload();
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
          <p className="eyebrow">管理员工作台</p>
          <h1>家长与学生绑定</h1>
          <p className="muted">核对家长与学生关系后，在此维护查看权限。</p>
        </div>
        <Space wrap>
          <Link className="ant-btn" to="/admin">
            用户管理
          </Link>
          <Link className="ant-btn" to="/classes">
            班级管理
          </Link>
          <Button onClick={links.reload}>刷新</Button>
        </Space>
      </div>
      <Card title="新增绑定" className="lesson-chapter">
        <Form
          layout="vertical"
          form={form}
          onFinish={(values) =>
            void run(async () => {
              await relationsApi.bind(values);
              form.resetFields();
              message.success("绑定已保存。");
            })
          }
        >
          <RowFields busy={busy} />
          <Button type="primary" htmlType="submit" loading={busy}>
            确认绑定
          </Button>
        </Form>
      </Card>
      {links.error && (
        <Alert
          type="error"
          title={links.error}
          action={<Button onClick={links.reload}>重试</Button>}
        />
      )}
      <Card title="有效绑定">
        <Table<ParentLinkView>
          rowKey={(r) => `${r.parentId}:${r.studentId}`}
          dataSource={links.data?.list ?? []}
          loading={links.loading}
          scroll={{ x: 560 }}
          locale={{ emptyText: "暂无有效绑定" }}
          pagination={{
            current: page,
            pageSize: 10,
            total: links.data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            {
              title: "家长",
              render: (_, r) =>
                `${r.parent.displayName}（${r.parent.username}）`,
            },
            {
              title: "学生",
              render: (_, r) =>
                `${r.student.displayName}（${r.student.username}）`,
            },
            {
              title: "操作",
              render: (_, r) => (
                <Popconfirm
                  title="解除绑定？"
                  description="该家长将无法继续查看此学生的概览。"
                  onConfirm={() =>
                    run(async () => {
                      await relationsApi.unbind(r.parentId, r.studentId);
                    })
                  }
                >
                  <Button danger disabled={busy}>
                    解除绑定
                  </Button>
                </Popconfirm>
              ),
            },
          ]}
        />
      </Card>
    </section>
  );
}
function RowFields({ busy }: { busy: boolean }) {
  return (
    <div className="relation-form-grid">
      <Form.Item name="parentId" label="家长账号" rules={[{ required: true }]}>
        <UserPicker role="PARENT" disabled={busy} />
      </Form.Item>
      <Form.Item name="studentId" label="学生账号" rules={[{ required: true }]}>
        <UserPicker role="STUDENT" disabled={busy} />
      </Form.Item>
    </div>
  );
}
