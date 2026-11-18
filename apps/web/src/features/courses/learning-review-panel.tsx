import { Alert, Button, Empty, Pagination, Space, Spin } from "antd";
import { Link } from "react-router-dom";
import type { LearningReviewQueue } from "@zhixue/shared";
import { gradeOptions, subjectOptions } from "@zhixue/shared";
import { lessonPracticePath } from "@/features/practice/lesson-practice-path";
import { ReviewAdvanceButton } from "@/features/practice/review-advance";
import { StudyDeskImage } from "@/features/practice/review-round";
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
    <section
      aria-labelledby="learning-review-title"
      aria-busy={loading}
      className="review-workspace"
    >
      <header className="review-desk">
        <div className="review-desk-copy">
          <h2 id="learning-review-title">待复练</h2>
          <p>按课时复练错题，答对后继续下一课。</p>
          <Space wrap size={[10, 10]}>
            <ReviewAdvanceButton
              disabled={loading || !data?.total}
              onUnavailable={reload}
            />
            <Button onClick={reload} loading={loading}>
              刷新待复练
            </Button>
          </Space>
        </div>
        <StudyDeskImage className="review-desk-image" />
      </header>
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
          <div className="review-course-list-heading">
            <h3>按课时复练</h3>
            <span>共 {data.total} 门课有待复练</span>
          </div>
          <div className="learning-review-courses">
            {data.items.map((course) => (
              <article className="review-course" key={course.courseId}>
                <header className="review-course-heading">
                  <div>
                    <p>
                      {
                        gradeOptions.find(
                          (grade) => grade.value === course.grade,
                        )?.label
                      }
                      {" · "}
                      {subjectOptions.find(
                        (subject) => subject.value === course.subject,
                      )?.label ?? course.subject}
                    </p>
                    <h4>{course.title}</h4>
                  </div>
                  <span className="review-course-count">
                    <strong>{course.wrongCount}</strong> 道待复练
                  </span>
                </header>
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
                          <span>{lesson.wrongCount} 道</span>
                          <span>
                            去复练 <span aria-hidden="true">→</span>
                          </span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {course.lessons.reduce(
                  (total, lesson) => total + lesson.wrongCount,
                  0,
                ) > course.wrongCount && (
                  <p className="learning-review-count-note">
                    同一道错题关联多个课时时，课程总数只计一次。
                  </p>
                )}
              </article>
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
