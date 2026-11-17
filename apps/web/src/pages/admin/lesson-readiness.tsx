import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Pagination,
  Select,
  Space,
  Tag,
} from "antd";
import { Link, useSearchParams } from "react-router-dom";
import {
  gradeOptions,
  subjectOptions,
  type LessonReadinessPage,
} from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { api } from "@/lib/api";
export default function LessonReadiness() {
  const { user } = useAuth();
  return <LessonReadinessSession key={user?.id} />;
}
function LessonReadinessSession() {
  const [params, setParams] = useSearchParams();
  const grade = params.get("grade") ?? "G7",
    subject = params.get("subject") ?? undefined;
  const missingOnly = params.get("missingOnly") !== "false";
  const page = Number(params.get("page") ?? 1);
  const courseId = params.get("courseId");
  const query = new URLSearchParams({
    grade,
    missingOnly: String(missingOnly),
    page: String(page),
  });
  if (subject) query.set("subject", subject);
  if (courseId) query.set("courseId", courseId);
  const queryKey = query.toString();
  const [data, setData] = useState<LessonReadinessPage>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  function change(key: string, value?: string) {
    const next = new URLSearchParams(queryKey);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "page") next.set("page", "1");
    if (key === "grade" || key === "subject") next.delete("courseId");
    setParams(next);
  }
  useEffect(() => {
    const id = ++sequence.current;
    setLoading(true);
    setData(undefined);
    setError("");
    api<LessonReadinessPage>(`/api/admin/lesson-readiness?${queryKey}`)
      .then((result) => {
        if (id === sequence.current) setData(result);
      })
      .catch((e) => {
        if (id === sequence.current) setError(e.message);
      })
      .finally(() => {
        if (id === sequence.current) setLoading(false);
      });
    return () => {
      sequence.current++;
    };
  }, [queryKey, revision]);
  return (
    <section className="wrap account-page" aria-busy={loading}>
      <p className="eyebrow">内容审核准备</p>
      <h1>逐课检查配套练习。</h1>
      <p className="intro">
        仅列已发布课程的开放课时，包含会员课。缺口按是否关联已发布题判断，草稿与归档题不算已就绪。
      </p>
      <Space wrap className="lesson-actions">
        <Select
          aria-label="配套检查年级"
          value={grade}
          options={gradeOptions}
          onChange={(value) => change("grade", value)}
          style={{ width: 140 }}
        />
        <Select
          aria-label="配套检查学科"
          value={subject}
          options={subjectOptions}
          placeholder="全部学科"
          allowClear
          onChange={(value) => change("subject", value)}
          style={{ width: 160 }}
        />
        <Checkbox
          checked={missingOnly}
          onChange={(e) => change("missingOnly", String(e.target.checked))}
        >
          只看缺少已发布题的课时
        </Checkbox>
        <Button
          loading={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          刷新配套检查
        </Button>
        <Link
          className="text-link"
          to={`/admin/content-readiness?grade=${grade}`}
        >
          返回内容准备度
        </Link>
        {courseId && (
          <Button onClick={() => change("courseId")}>取消课程限定</Button>
        )}
      </Space>
      <Alert
        type="info"
        title="先核对题目与课时是否相符，再人工发布"
        description="有已发布题不代表数量充足、题目质量通过或学生已掌握。新建题目、课时关联和发布仍在题库管理中单独确认。"
      />
      {error && <Alert type="error" title={error} />}
      {loading && <p role="status">正在读取课时配套情况…</p>}
      {data && (
        <>
          <p role="status">当前条件共 {data.total} 个课时。</p>
          {!data.items.length && (
            <p className="muted">
              当前筛选没有课时，请调整年级、学科或取消“只看缺少已发布题”。
            </p>
          )}
          {data.items.map((item) => {
            const base = new URLSearchParams({
              lessonId: item.id,
              grade: item.grade,
              subject: item.subject,
            });
            return (
              <Card key={item.id} className="lesson-chapter" title={item.title}>
                <p>
                  {item.courseTitle} · {item.chapterTitle}
                </p>
                <Space wrap>
                  <Tag>{item.access === "MEMBER" ? "会员课" : "免费课"}</Tag>
                  <Tag color={item.publishedQuestions ? "green" : "orange"}>
                    {item.publishedQuestions
                      ? "已有关联发布题"
                      : "缺少已发布配套题"}
                  </Tag>
                </Space>
                <p>
                  已发布题 {item.publishedQuestions} · 草稿题{" "}
                  {item.draftQuestions} · 已归档题 {item.archivedQuestions}
                </p>
                <Space wrap>
                  <Link
                    className="text-link"
                    to={`/admin/questions?${base}&status=DRAFT`}
                  >
                    审阅该课草稿题
                  </Link>
                  <Link className="text-link" to={`/admin/questions?${base}`}>
                    管理该课全部配套题
                  </Link>
                </Space>
              </Card>
            );
          })}
          {data.total > 0 && (
            <Pagination
              current={data.page}
              pageSize={20}
              total={data.total}
              showSizeChanger={false}
              onChange={(value) => change("page", String(value))}
            />
          )}
        </>
      )}
    </section>
  );
}
