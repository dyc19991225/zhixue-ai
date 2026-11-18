import { Alert, Button, Card, Empty, Pagination, Space, Spin, Tag } from "antd";
import { Link } from "react-router-dom";
import type { LearningReviewQueue } from "@zhixue/shared";
import { gradeOptions, subjectOptions } from "@zhixue/shared";
import { lessonPracticePath } from "@/features/practice/lesson-practice-path";
import { ReviewAdvanceButton } from "@/features/practice/review-advance";
import { useApiData } from "@/hooks/use-api-data";

export function LearningReviewPanel({
  page,
  onPageChange,
}: {
  page: number;
  onPageChange: (page: number) => void;
}) {
  const { data, loading, error, reload } = useApiData<LearningReviewQueue>(
    `/api/learning-review-queue?page=${page}`,
  );

  return (
    <section aria-labelledby="learning-review-title" aria-busy={loading}>
      <div className="study-task-heading">
        <h2 id="learning-review-title">待复练</h2>
        <Space wrap>
          <ReviewAdvanceButton
            disabled={loading || !data?.total}
            onUnavailable={reload}
          />
          <Button onClick={reload} loading={loading}>
            刷新待复练
          </Button>
        </Space>
      </div>
      {loading ? (
        <Spin description="正在读取待复练错题">
          <div className="learning-review-loading" />
        </Spin>
      ) : error ? (
        <Alert
          type="error"
          showIcon
          title={error}
          action={<Button onClick={reload}>重新读取</Button>}
        />
      ) : data && !data.items.length ? (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            data.total ? "这一页没有待复练的课程。" : "已选课程暂无待复练错题。"
          }
        >
          {data.total ? (
            <Button onClick={() => onPageChange(1)}>返回第一页</Button>
          ) : (
            <Link className="text-link" to="/practice?mode=wrong">
              查看全部错题
            </Link>
          )}
        </Empty>
      ) : data ? (
        <>
          <p className="muted">共 {data.total} 门课有待复练</p>
          <div className="learning-review-courses">
            {data.items.map((course) => (
              <Card
                key={course.courseId}
                title={
                  <div className="learning-review-course-heading">
                    <h3>{course.title}</h3>
                    <Tag color="blue">{course.wrongCount} 道待复练</Tag>
                  </div>
                }
              >
                <p className="muted">
                  {
                    gradeOptions.find((grade) => grade.value === course.grade)
                      ?.label
                  }
                  {" · "}
                  {subjectOptions.find(
                    (subject) => subject.value === course.subject,
                  )?.label ?? course.subject}
                </p>
                <ul className="learning-review-lessons">
                  {course.lessons.map((lesson) => (
                    <li key={lesson.lessonId}>
                      <Link
                        className="learning-review-link"
                        to={lessonPracticePath(
                          course.courseId,
                          lesson.lessonId,
                          { mode: "wrong" },
                        )}
                      >
                        <span>{lesson.title}</span>
                        <span className="learning-review-action">
                          {lesson.wrongCount} 道 · 去复练{" "}
                          <span aria-hidden="true">→</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {course.lessons.reduce(
                  (total, lesson) => total + lesson.wrongCount,
                  0,
                ) > course.wrongCount && (
                  <p className="muted learning-review-count-note">
                    同一道错题关联多个课时时，课程总数只计一次。
                  </p>
                )}
              </Card>
            ))}
          </div>
          <Pagination
            aria-label="待复练课程分页"
            current={page}
            pageSize={data.pageSize}
            total={data.total}
            showSizeChanger={false}
            hideOnSinglePage
            onChange={onPageChange}
            className="relation-pagination"
          />
        </>
      ) : null}
    </section>
  );
}
