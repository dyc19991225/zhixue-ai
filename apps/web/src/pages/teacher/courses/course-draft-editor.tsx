import { useState } from "react";
import {
  Alert,
  App,
  Button,
  Card,
  Form,
  Input,
  Modal,
  Space,
  Spin,
} from "antd";
import type {
  TeacherCourseDetail,
  TeacherCourseRevision,
} from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";
import { relationsApi } from "@/api/relations";

export function CourseDraftEditor({
  courseId,
  disabled,
  onSaved,
}: {
  courseId: string;
  disabled: boolean;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  const { modal } = App.useApp();
  const detail = useApiData<TeacherCourseDetail>(
    open ? `/api/teacher/courses/${encodeURIComponent(courseId)}` : null,
  );
  function close() {
    if (busy) return;
    if (dirty)
      modal.confirm({
        title: "放弃尚未保存的改稿？",
        okText: "放弃改稿",
        cancelText: "继续编辑",
        onOk: () => {
          setDirty(false);
          setOpen(false);
        },
      });
    else setOpen(false);
  }
  return (
    <>
      <Button disabled={disabled} onClick={() => setOpen(true)}>
        修改草稿
      </Button>
      <Modal
        title="教师改稿"
        open={open}
        onCancel={close}
        footer={null}
        width={940}
        maskClosable={false}
        keyboard={!busy}
        closable={!busy}
        centered
        destroyOnHidden
        styles={{ body: { maxHeight: "75vh", overflowY: "auto" } }}
      >
        {detail.loading ? (
          <Spin />
        ) : detail.error ? (
          <Alert
            type="error"
            title={detail.error}
            action={<Button onClick={detail.reload}>重试加载</Button>}
          />
        ) : (
          detail.data && (
            <DraftForm
              key={detail.data.updatedAt}
              value={detail.data}
              onDirty={() => setDirty(true)}
              onBusy={setBusy}
              onSaved={() => {
                setDirty(false);
                setOpen(false);
                onSaved();
              }}
            />
          )
        )}
      </Modal>
    </>
  );
}
function DraftForm({
  value,
  onDirty,
  onBusy,
  onSaved,
}: {
  value: TeacherCourseDetail;
  onDirty: () => void;
  onBusy: (busy: boolean) => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const { message } = App.useApp();
  const initial: TeacherCourseRevision = {
    title: value.title,
    description: value.description ?? "",
    updatedAt: value.updatedAt,
    region: value.region ?? "",
    textbookEdition: value.textbookEdition ?? "",
    term: value.term ?? "",
    chapters: value.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      lessons: ch.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        content: l.content ?? "",
      })),
    })),
  };
  if (value.status !== "DRAFT")
    return (
      <Alert
        type="warning"
        title="当前课程不是草稿，请联系管理员转为草稿后再修改。"
      />
    );
  return (
    <Form<TeacherCourseRevision>
      layout="vertical"
      initialValues={initial}
      onValuesChange={onDirty}
      onFinish={async (input) => {
        setBusy(true);
        onBusy(true);
        setError("");
        try {
          await relationsApi.reviseCourse(value.id, {
            ...input,
            updatedAt: value.updatedAt,
            chapters: input.chapters.map((ch) => ({
              id: ch.id,
              title: ch.title,
              lessons: ch.lessons.map((l) => ({
                id: l.id,
                title: l.title,
                content: l.content ?? "",
              })),
            })),
          });
          message.success("改稿已保存，请在审核 / 记录中重新送审。");
          onSaved();
        } catch (cause) {
          setError(
            cause instanceof Error ? cause.message : "保存失败，请重试。",
          );
        } finally {
          setBusy(false);
          onBusy(false);
        }
      }}
    >
      <Alert
        type="info"
        title="保存改稿不会直接发布；内容变化后需重新审核。"
        description="本入口修改课程说明、现有章节标题及课时正文。章节增删、顺序和视频由管理员维护；原课时ID与学习记录保留。"
      />
      {error && <Alert type="error" title={error} />}
      <Form.Item
        name="title"
        label="课程名称"
        rules={[{ required: true, whitespace: true, max: 120 }]}
      >
        <Input maxLength={120} disabled={busy} />
      </Form.Item>
      <Form.Item name="description" label="课程简介" rules={[{ max: 2000 }]}>
        <Input.TextArea rows={3} maxLength={2000} disabled={busy} />
      </Form.Item>
      <Form.Item
        name="region"
        label="适用地区（未核验可留空）"
        rules={[{ max: 120 }]}
      >
        <Input maxLength={120} disabled={busy} />
      </Form.Item>
      <Form.Item
        name="textbookEdition"
        label="教材出版社 / 版次 / ISBN依据（不确定勿填）"
        rules={[{ max: 300 }]}
      >
        <Input maxLength={300} disabled={busy} />
      </Form.Item>
      <Form.Item name="term" label="学期 / 模块" rules={[{ max: 120 }]}>
        <Input maxLength={120} disabled={busy} />
      </Form.Item>
      <Form.List name="chapters">
        {(chapters) =>
          chapters.map((ch) => (
            <Card
              key={ch.key}
              title={`第${ch.name + 1}章`}
              className="lesson-chapter"
            >
              <Form.Item name={[ch.name, "id"]} hidden>
                <Input />
              </Form.Item>
              <Form.Item
                name={[ch.name, "title"]}
                label="章节名称"
                rules={[{ required: true, whitespace: true, max: 120 }]}
              >
                <Input disabled={busy} maxLength={120} />
              </Form.Item>
              <Form.List name={[ch.name, "lessons"]}>
                {(lessons) =>
                  lessons.map((l) => (
                    <section key={l.key}>
                      <Form.Item name={[l.name, "id"]} hidden>
                        <Input />
                      </Form.Item>
                      <Form.Item
                        name={[l.name, "title"]}
                        label={`课时${l.name + 1}名称`}
                        rules={[{ required: true, whitespace: true, max: 120 }]}
                      >
                        <Input disabled={busy} maxLength={120} />
                      </Form.Item>
                      <Form.Item
                        name={[l.name, "content"]}
                        label={`课时${l.name + 1}正文`}
                        rules={[{ max: 30000 }]}
                      >
                        <Input.TextArea
                          disabled={busy}
                          rows={8}
                          maxLength={30000}
                          showCount
                        />
                      </Form.Item>
                    </section>
                  ))
                }
              </Form.List>
            </Card>
          ))
        }
      </Form.List>
      <Space wrap>
        <Button type="primary" htmlType="submit" loading={busy}>
          保存改稿
        </Button>
        <span>保存后由管理员审核并发布。</span>
      </Space>
    </Form>
  );
}
