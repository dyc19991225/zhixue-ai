import { useEffect, useRef, useState } from "react";
import { Alert, Button, Card, Select, Space, Tag } from "antd";
import { Link, useSearchParams } from "react-router-dom";
import { gradeOptions, type ContentReadiness } from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { api } from "@/lib/api";
export default function ContentReadinessPage() {
  const { user } = useAuth();
  return <ReadinessSession key={user?.id} />;
}
function ReadinessSession() {
  const [params, setParams] = useSearchParams();
  const grade =
    gradeOptions.find((item) => item.value === params.get("grade"))?.value ??
    "G7";
  const gradeLabel = gradeOptions.find((item) => item.value === grade)?.label;
  const [data, setData] = useState<ContentReadiness>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const sequence = useRef(0);
  useEffect(() => {
    const id = ++sequence.current;
    setData(undefined);
    setLoading(true);
    setError("");
    api<ContentReadiness>(`/api/admin/content-readiness?grade=${grade}`)
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
  }, [grade, revision]);
  function download() {
    if (!data || data.grade !== grade) return;
    const text =
      `${gradeLabel} 内容准备清单\n统计时间：${data.generatedAt}\n数量不代表教材覆盖率或人工教研结论。\n公开题采用未登录可见口径；开放课时包含已发布课程的会员课时。\n\n` +
      data.rows
        .map(
          (row) =>
            `${row.subjectLabel}\n已发布课程 ${row.publishedCourses}，课程草稿 ${row.draftCourses}\n已发布题 ${row.publishedQuestions}，公开练习题 ${row.publicQuestions}，题目草稿 ${row.draftQuestions}\n开放课时 ${row.openLessons}，缺少已发布配套题的开放课时 ${row.lessonsWithoutPractice}\n`,
        )
        .join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `知学-内容准备-${grade}.txt`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const total = data?.rows.reduce(
    (sum, row) => ({
      courses: sum.courses + row.publishedCourses,
      questions: sum.questions + row.publicQuestions,
      gaps: sum.gaps + row.lessonsWithoutPractice,
    }),
    { courses: 0, questions: 0, gaps: 0 },
  );
  return (
    <section className="wrap account-page" aria-busy={loading}>
      <p className="eyebrow">内容审核准备</p>
      <h1>先看清缺口，再安排试学。</h1>
      <p className="intro">
        按真实发布状态盘点课程、题目和课时配套情况，供管理员安排人工审阅。
      </p>
      <Space wrap className="lesson-actions">
        <Link
          className="text-link"
          to={`/admin/lesson-readiness?grade=${grade}`}
        >
          逐课检查配套题
        </Link>
        <Select
          aria-label="内容准备年级"
          value={grade}
          onChange={(value) => setParams({ grade: value })}
          options={gradeOptions}
          style={{ width: 150 }}
        />
        <Button
          loading={loading}
          onClick={() => setRevision((value) => value + 1)}
        >
          刷新统计
        </Button>
        <Button
          disabled={!data || loading || data.grade !== grade}
          onClick={download}
        >
          下载准备清单
        </Button>
        <Link className="text-link" to="/admin/courses">
          课程审核与管理
        </Link>
        <Link className="text-link" to="/admin/questions">
          题库管理
        </Link>
      </Space>
      <Alert
        type="info"
        showIcon
        title="统计不能代替教研审核"
        description="公开练习题按未登录学生可见范围统计；已发布题可能受课时或会员限制。开放课时仅指已发布课程中设置了开放时间的课时，也包含会员课。这里不计算教材章节覆盖率，不自动审核或发布内容。"
      />
      {error && <Alert type="error" title={error} />}
      {loading && <p role="status">正在读取{gradeLabel}的课程与题库…</p>}
      {data && data.grade === grade && (
        <>
          <p role="status">
            {gradeLabel}：已发布课程 {total?.courses} 门 · 公开练习题{" "}
            {total?.questions} 道 · 缺配套题的开放课时 {total?.gaps} 个
          </p>
          <p className="muted">
            统计时间：{new Date(data.generatedAt).toLocaleString("zh-CN")}
            。内容变更后请刷新。
          </p>
          <div className="readiness-grid">
            {data.rows.map((row) => (
              <Card key={row.subject} title={row.subjectLabel}>
                <p>
                  已发布课程 <strong>{row.publishedCourses}</strong> · 课程草稿{" "}
                  {row.draftCourses}
                </p>
                <p>
                  已发布题 <strong>{row.publishedQuestions}</strong> · 题目草稿{" "}
                  {row.draftQuestions}
                </p>
                <p>
                  公开练习题 {row.publicQuestions} · 开放课时 {row.openLessons}
                </p>
                <Space wrap>
                  {!row.publishedCourses && <Tag>尚无已发布课程</Tag>}
                  {!row.publicQuestions && (
                    <Tag color="orange">暂无公开练习题</Tag>
                  )}
                  {row.publishedCourses > 0 && !row.openLessons && (
                    <Tag color="orange">尚无开放课时</Tag>
                  )}
                  {row.lessonsWithoutPractice > 0 && (
                    <Tag color="orange">
                      {row.lessonsWithoutPractice} 个开放课时缺配套题
                    </Tag>
                  )}
                  {(row.draftCourses > 0 || row.draftQuestions > 0) && (
                    <Tag color="blue">有草稿需人工审阅</Tag>
                  )}
                </Space>
              </Card>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
