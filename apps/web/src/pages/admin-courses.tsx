import { useEffect, useState } from "react";
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
  Tag,
} from "antd";
import type { CourseEdit, CoursePage, CourseView } from "@zhixue/shared";
import { gradeOptions } from "@zhixue/shared";
import { api } from "@/lib/api";
import { relationsApi } from "@/api/relations";
import { UserPicker } from "@/components/user-picker";
import { CourseReviewPanel } from "@/components/course-review-panel";
import { CourseReviewQueuePanel } from "@/components/course-review-queue";
const subjects = [
  "chinese",
  "math",
  "english",
  "physics",
  "chemistry",
  "biology",
  "history",
  "geography",
  "civics",
  "politics",
];
const names = [
  "语文",
  "数学",
  "英语",
  "物理",
  "化学",
  "生物",
  "历史",
  "地理",
  "道德与法治",
  "思想政治",
];
export default function AdminCourses() {
  const [items, setItems] = useState<CourseView[]>([]),
    [page, setPage] = useState(1),
    [total, setTotal] = useState(0),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [editing, setEditing] = useState<string | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [form] = Form.useForm();
  const [teacherForm] = Form.useForm<{ teacherId?: string }>();
  const [assignmentTarget, setAssignmentTarget] = useState<CourseView | null>(
    null,
  );
  const { message } = App.useApp();
  const [media, setMedia] = useState<
    { id: string; filename: string; size: number }[]
  >([]);
  async function loadMedia() {
    const result = await api<{ items: typeof media }>("/api/admin/media");
    setMedia(result.items);
  }
  useEffect(() => {
    void loadMedia().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api<CoursePage>(`/api/admin/courses?page=${page}&pageSize=10`)
      .then((data) => {
        if (!active) return;
        setItems(data.list);
        setTotal(data.total);
      })
      .catch((cause: unknown) => {
        if (active) {
          setItems([]);
          setError(
            cause instanceof Error ? cause.message : "课程列表加载失败。",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [page, revision]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function edit(id: string) {
    await run(async () => {
      const c = await api<CourseEdit>(`/api/admin/courses/${id}`);
      setEditing(id);
      form.setFieldsValue(c);
    });
  }
  async function save(values: CourseEdit) {
    await run(async () => {
      const body = {
        title: values.title,
        slug: values.slug,
        grade: values.grade,
        subject: values.subject,
        description: values.description ?? "",
        region: values.region ?? null,
        textbookEdition: values.textbookEdition ?? null,
        term: values.term ?? null,
        access: values.access,
        chapters: (values.chapters ?? []).map((c) => ({
          ...(c.id ? { id: c.id } : {}),
          title: c.title,
          lessons: (c.lessons ?? []).map((l) => ({
            ...(l.id ? { id: l.id } : {}),
            title: l.title,
            content: l.content ?? "",
            mediaId: l.mediaId ?? null,
          })),
        })),
      };
      await api(
        editing === "new"
          ? "/api/admin/courses"
          : `/api/admin/courses/${editing}`,
        editing === "new" ? "POST" : "PUT",
        body,
      );
      setEditing(null);
      setPage(1);
      setRevision((value) => value + 1);
      message.success("课程草稿已保存。");
    });
  }
  async function status(c: CourseView, value: string) {
    await run(async () => {
      await api(`/api/admin/courses/${c.id}/status`, "PATCH", {
        status: value,
      });
      setRevision((value) => value + 1);
      message.success("课程状态已更新。");
    });
  }
  return (
    <section className="wrap account-page">
      <div className="account-heading">
        <div>
          <p className="eyebrow">内容工作台</p>
          <h1>课程管理</h1>
          <p className="muted">
            保存草稿 → 提交审核 → 另一位管理员审核通过 →
            单独发布。修改内容后需重新审核。
          </p>
        </div>
        <Space wrap>
          <Button href="/admin">用户管理</Button>
          <Button
            type="primary"
            onClick={() => {
              setEditing("new");
              form.resetFields();
              form.setFieldsValue({
                grade: "G7",
                subject: "math",
                access: "FREE",
                chapters: [],
              });
            }}
          >
            创建课程
          </Button>
        </Space>
      </div>
      <CourseReviewQueuePanel />
      {error && <Alert type="error" title={error} />}
      <Card title="本地视频素材" className="lesson-chapter">
        <p className="muted">
          上传 MP4（单个不超过
          200MB），再在课时中选择。视频文件仅保存在本机，不会自动上传云端。
        </p>
        <label className="media-upload-label">
          上传视频{" "}
          <input
            type="file"
            accept="video/mp4,.mp4"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void run(async () => {
                  if (file.size > 200 * 1024 * 1024)
                    throw new Error("视频不能超过 200MB。");
                  await api(
                    "/api/admin/media",
                    "POST",
                    new File([file], file.name, { type: "video/mp4" }),
                  );
                  await loadMedia();
                  message.success("视频已保存到本机。");
                });
                event.target.value = "";
              }
            }}
          />
        </label>
        <p className="muted">
          已保存 {media.length} 个素材（最多展示最近 100 个）。
        </p>
      </Card>
      <Table
        rowKey="id"
        dataSource={items}
        loading={loading}
        scroll={{ x: 760 }}
        pagination={{
          current: page,
          pageSize: 10,
          total,
          onChange: setPage,
          showSizeChanger: false,
        }}
        columns={[
          {
            title: "授课归属",
            render: (_, c: CourseView) => (
              <Button
                disabled={busy}
                onClick={() => {
                  setAssignmentTarget(c);
                  teacherForm.setFieldsValue({
                    teacherId: c.ownerTeacherId ?? undefined,
                  });
                }}
              >
                分配教师
              </Button>
            ),
          },
          { title: "课程", dataIndex: "title" },
          {
            title: "状态",
            dataIndex: "status",
            render: (v) => (
              <Tag>
                {
                  (
                    {
                      DRAFT: "草稿",
                      PUBLISHED: "已发布",
                      ARCHIVED: "已归档",
                    } as Record<string, string>
                  )[v]
                }
              </Tag>
            ),
          },
          {
            title: "操作",
            render: (_, c) => (
              <Space wrap>
                <CourseReviewPanel courseId={c.id} />
                <Button
                  disabled={c.status === "PUBLISHED" || busy}
                  onClick={() => void edit(c.id)}
                >
                  编辑
                </Button>
                {c.status !== "PUBLISHED" && (
                  <Popconfirm
                    title="发布当前已审核通过的课程版本？"
                    onConfirm={() => status(c, "PUBLISHED")}
                  >
                    <Button disabled={busy}>发布</Button>
                  </Popconfirm>
                )}
                {c.status !== "DRAFT" && (
                  <Button
                    disabled={busy}
                    onClick={() => void status(c, "DRAFT")}
                  >
                    转为草稿
                  </Button>
                )}
                {c.status !== "ARCHIVED" && (
                  <Popconfirm
                    title="归档后学生将无法继续访问，确定归档？"
                    onConfirm={() => status(c, "ARCHIVED")}
                  >
                    <Button disabled={busy}>归档</Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />
      {editing && (
        <Card
          title={editing === "new" ? "新建课程草稿" : "编辑课程草稿"}
          className="course-editor"
        >
          <Alert
            type="info"
            title="删除章节或课时并保存后，对应进度会一起删除。已有课时仅改正文时会保留完成记录。"
          />
          <Form form={form} layout="vertical" onFinish={save}>
            <div className="editor-grid">
              <Form.Item
                name="title"
                label="课程名称"
                rules={[{ required: true, max: 120 }]}
              >
                <Input maxLength={120} />
              </Form.Item>
              <Form.Item
                name="slug"
                label="英文标识（3–80位小写字母、数字、短横线）"
                rules={[
                  { required: true, pattern: /^[a-z0-9][a-z0-9-]{2,79}$/ },
                ]}
              >
                <Input />
              </Form.Item>
              <Form.Item name="grade" label="年级" rules={[{ required: true }]}>
                <Select options={gradeOptions} />
              </Form.Item>
              <Form.Item
                name="subject"
                label="学科"
                rules={[{ required: true }]}
              >
                <Select
                  options={subjects.map((value, i) => ({
                    value,
                    label: names[i],
                  }))}
                />
              </Form.Item>
              <Form.Item name="access" label="访问权限">
                <Select
                  options={[
                    { value: "FREE", label: "免费" },
                    { value: "MEMBER", label: "需要有效会员权益" },
                  ]}
                />
              </Form.Item>
            </div>
            <Form.Item name="description" label="课程简介">
              <Input.TextArea rows={3} maxLength={2000} showCount />
            </Form.Item>
            <div className="editor-grid">
              <Form.Item
                name="region"
                label="适用地区（待核验可留空）"
                rules={[{ max: 120 }]}
              >
                <Input maxLength={120} />
              </Form.Item>
              <Form.Item
                name="textbookEdition"
                label="教材出版社 / 版次 / ISBN依据（不确定勿填）"
                rules={[{ max: 300 }]}
              >
                <Input maxLength={300} />
              </Form.Item>
              <Form.Item name="term" label="学期 / 模块" rules={[{ max: 120 }]}>
                <Input maxLength={120} />
              </Form.Item>
            </div>
            <Form.List name="chapters">
              {(chapters, { add, remove }) => (
                <>
                  {chapters.map((c) => (
                    <Card
                      key={c.key}
                      title={`第 ${c.name + 1} 章`}
                      className="lesson-chapter"
                      extra={
                        <Button danger onClick={() => remove(c.name)}>
                          删除章节
                        </Button>
                      }
                    >
                      <Form.Item name={[c.name, "id"]} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name={[c.name, "title"]}
                        label="章节名称"
                        rules={[{ required: true, max: 120 }]}
                      >
                        <Input />
                      </Form.Item>
                      <Form.List name={[c.name, "lessons"]}>
                        {(lessons, actions) => (
                          <>
                            {lessons.map((l) => (
                              <div key={l.key} className="lesson-editor">
                                <Form.Item name={[l.name, "id"]} hidden>
                                  <Input />
                                </Form.Item>
                                <Form.Item
                                  name={[l.name, "title"]}
                                  label={`课时 ${l.name + 1} 名称`}
                                  rules={[{ required: true, max: 120 }]}
                                >
                                  <Input />
                                </Form.Item>
                                <Form.Item
                                  name={[l.name, "content"]}
                                  label="课时正文"
                                >
                                  <Input.TextArea
                                    rows={8}
                                    maxLength={30000}
                                    showCount
                                  />
                                </Form.Item>
                                <Form.Item
                                  name={[l.name, "mediaId"]}
                                  label="课时视频（可选）"
                                >
                                  <Select
                                    allowClear
                                    placeholder="仅使用文本正文"
                                    options={media.map((m) => ({
                                      value: m.id,
                                      label: `${m.filename} · ${(m.size / 1024 / 1024).toFixed(1)}MB`,
                                    }))}
                                  />
                                </Form.Item>
                                <Button
                                  danger
                                  onClick={() => actions.remove(l.name)}
                                >
                                  删除课时
                                </Button>
                              </div>
                            ))}
                            <Button
                              disabled={lessons.length >= 50}
                              onClick={() =>
                                actions.add({ title: "", content: "" })
                              }
                            >
                              添加课时
                            </Button>
                          </>
                        )}
                      </Form.List>
                    </Card>
                  ))}
                  <Button
                    disabled={chapters.length >= 30}
                    onClick={() => add({ title: "", lessons: [] })}
                  >
                    添加章节
                  </Button>
                </>
              )}
            </Form.List>
            <Space className="lesson-actions">
              <Button loading={busy} type="primary" htmlType="submit">
                保存草稿
              </Button>
              <Button disabled={busy} onClick={() => setEditing(null)}>
                取消编辑
              </Button>
            </Space>
          </Form>
        </Card>
      )}
      <Modal
        title="分配授课教师"
        open={!!assignmentTarget}
        confirmLoading={busy}
        onCancel={() => {
          if (!busy) setAssignmentTarget(null);
        }}
        onOk={() => teacherForm.submit()}
        okText="保存归属"
        cancelText="取消"
      >
        <p>{assignmentTarget?.title}</p>
        <p>分配后教师可查看课程及课时正文；清空选择可解除归属。</p>
        <Form
          form={teacherForm}
          layout="vertical"
          onFinish={(values) =>
            void run(async () => {
              if (!assignmentTarget) return;
              await relationsApi.assignTeacher(
                assignmentTarget.id,
                values.teacherId ?? null,
                assignmentTarget.updatedAt,
              );
              setAssignmentTarget(null);
              setRevision((v) => v + 1);
              message.success("教师归属已更新。");
            })
          }
        >
          <Form.Item name="teacherId" label="授课教师">
            <UserPicker role="TEACHER" disabled={busy} />
          </Form.Item>
        </Form>
      </Modal>
    </section>
  );
}
