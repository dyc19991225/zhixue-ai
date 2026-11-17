import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
} from "antd";
import { Link, useSearchParams } from "react-router-dom";
import type {
  CoursePage,
  CourseView,
  TeacherCourseDetail,
} from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";
import { CourseReviewPanel } from "@/components/course-review-panel";
import { CourseDraftEditor } from "./course-draft-editor";
export default function TeacherCourses() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useSearchParams();
  const selected = search.get("courseId");
  function setSelected(id: string | null) {
    setSearch((previous) => {
      const next = new URLSearchParams(previous);
      if (id) next.set("courseId", id);
      else next.delete("courseId");
      return next;
    });
  }
  const courses = useApiData<CoursePage>(
    `/api/teacher/courses?page=${page}&pageSize=10`,
  );
  const detail = useApiData<TeacherCourseDetail>(
    selected ? `/api/teacher/courses/${encodeURIComponent(selected)}` : null,
  );
  return (
    <section className="wrap account-page relation-page">
      <div className="account-heading">
        <div>
          <p className="eyebrow">教师工作台</p>
          <h1>我的教学课程</h1>
          <p className="muted">查看分配课程，修改草稿正文并提交审核。</p>
        </div>
        <Space wrap>
          <Link className="ant-btn" to="/classes">
            我的班级
          </Link>
          <Button onClick={courses.reload}>刷新</Button>
        </Space>
      </div>
      {courses.error && (
        <Alert
          type="error"
          title={courses.error}
          action={<Button onClick={courses.reload}>重试</Button>}
        />
      )}
      <Card>
        <Table<CourseView>
          rowKey="id"
          loading={courses.loading}
          dataSource={courses.data?.list ?? []}
          scroll={{ x: 560 }}
          locale={{ emptyText: "暂无分配课程，请联系管理员。" }}
          pagination={{
            current: page,
            pageSize: 10,
            total: courses.data?.total ?? 0,
            showSizeChanger: false,
            onChange: setPage,
          }}
          columns={[
            { title: "课程", dataIndex: "title" },
            {
              title: "状态",
              render: (_, c) => (
                <Tag>
                  {
                    { DRAFT: "草稿", PUBLISHED: "已发布", ARCHIVED: "已归档" }[
                      c.status
                    ]
                  }
                </Tag>
              ),
            },
            {
              title: "课时",
              render: (_, c) =>
                c.chapters.reduce(
                  (n, chapter) => n + chapter.lessons.length,
                  0,
                ),
            },
            {
              title: "操作",
              render: (_, c) => (
                <Space wrap>
                  <CourseDraftEditor
                    courseId={c.id}
                    disabled={c.status !== "DRAFT"}
                    onSaved={courses.reload}
                  />
                  <Button onClick={() => setSelected(c.id)}>查看课时</Button>
                  <CourseReviewPanel courseId={c.id} />
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title={detail.data?.title ?? "课程内容"}
        open={!!selected}
        onCancel={() => setSelected(null)}
        footer={null}
        width={860}
      >
        {detail.data && (
          <Space wrap style={{ marginBottom: 16 }}>
            <CourseDraftEditor
              key={detail.data.id}
              courseId={detail.data.id}
              disabled={detail.data.status !== "DRAFT"}
              onSaved={() => {
                detail.reload();
                courses.reload();
              }}
            />
            <CourseReviewPanel
              key={`review-${detail.data.id}`}
              courseId={detail.data.id}
            />
          </Space>
        )}
        {detail.loading ? (
          <Spin />
        ) : detail.error ? (
          <Alert
            type="error"
            title={detail.error}
            action={<Button onClick={detail.reload}>重试</Button>}
          />
        ) : detail.data?.chapters.length ? (
          detail.data.chapters.map((c) => (
            <section key={c.id}>
              <h2>{c.title}</h2>
              {c.lessons.map((l) => (
                <Card key={l.id} title={l.title} className="lesson-chapter">
                  <div className="relation-prose">
                    {l.content || "本课时暂无文本内容。"}
                  </div>
                </Card>
              ))}
            </section>
          ))
        ) : (
          <Empty description="暂无课时" />
        )}
      </Modal>
    </section>
  );
}
