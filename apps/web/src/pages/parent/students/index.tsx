import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Pagination,
  Row,
  Spin,
  Statistic,
} from "antd";
import {
  gradeOptions,
  type PageResult,
  type RelatedStudent,
  type StudentOverview,
} from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";
import { StudyTaskPanel } from "@/features/courses/study-tasks";
export default function ParentStudents({
  embedded = false,
}: {
  embedded?: boolean;
}) {
  const [page, setPage] = useState(1),
    [selectedId, setSelectedId] = useState<string | null>(null);
  const students = useApiData<PageResult<RelatedStudent>>(
    `/api/parent/students?page=${page}&pageSize=6`,
  );
  const selected = students.data?.list.find((s) => s.id === selectedId) ?? null;
  const overview = useApiData<StudentOverview>(
    selected
      ? `/api/parent/students/${encodeURIComponent(selected.id)}/overview`
      : null,
  );
  return (
    <section
      className={embedded ? "relation-page" : "wrap account-page relation-page"}
    >
      <div className="account-heading">
        <div>
          <p className="eyebrow">家长空间</p>
          {embedded ? <h2>孩子的学习概览</h2> : <h1>孩子的学习概览</h1>}
          <p className="muted">查看管理员已绑定学生的学习记录。</p>
        </div>
        <Button
          onClick={() => {
            students.reload();
            overview.reload();
          }}
        >
          刷新
        </Button>
      </div>
      {students.error && (
        <Alert
          type="error"
          title={students.error}
          action={<Button onClick={students.reload}>重试</Button>}
        />
      )}
      {students.loading ? (
        <Spin />
      ) : !students.data?.list.length ? (
        <Empty description="暂无绑定学生，请联系管理员核对并绑定。" />
      ) : (
        <Row gutter={[16, 16]}>
          {students.data.list.map((s) => (
            <Col xs={24} md={12} lg={8} key={s.id}>
              <Card title={s.displayName}>
                <p>{gradeOptions.find((g) => g.value === s.grade)?.label}</p>
                <Button
                  type={selected?.id === s.id ? "primary" : "default"}
                  onClick={() => {
                    setSelectedId(s.id);
                    overview.reload();
                  }}
                >
                  查看概览与待办
                </Button>
              </Card>
            </Col>
          ))}
        </Row>
      )}
      <Pagination
        className="relation-pagination"
        current={page}
        total={students.data?.total ?? 0}
        pageSize={6}
        hideOnSinglePage
        showSizeChanger={false}
        onChange={(p) => {
          setSelectedId(null);
          setPage(p);
        }}
      />
      {selected && (
        <>
          <Card
            title={`${selected.displayName} · 学习记录`}
            className="lesson-chapter"
          >
            {overview.loading ? (
              <Spin />
            ) : overview.error ? (
              <Alert
                type="error"
                title={overview.error}
                action={<Button onClick={overview.reload}>重试</Button>}
              />
            ) : overview.data ? (
              <>
                <Row gutter={[16, 24]}>
                  {(
                    [
                      ["已选发布课程", overview.data.courses],
                      ["已完成课时", overview.data.completedLessons],
                      ["累计作答", overview.data.attempts],
                      ["正确作答", overview.data.correctAttempts],
                      ["待复习错题", overview.data.unresolvedWrongQuestions],
                    ] as const
                  ).map(([title, value]) => (
                    <Col xs={12} md={8} key={title}>
                      <Statistic title={title} value={value} />
                    </Col>
                  ))}
                </Row>
                <p className="muted relation-note">
                  <Button
                    href={`/analytics?studentId=${encodeURIComponent(selected.id)}`}
                  >
                    查看完整学习报告
                  </Button>
                  统计来自平台学习记录，仅作学习进展参考。
                </p>
              </>
            ) : null}
          </Card>
          <StudyTaskPanel key={selected.id} studentId={selected.id} />
        </>
      )}
    </section>
  );
}
