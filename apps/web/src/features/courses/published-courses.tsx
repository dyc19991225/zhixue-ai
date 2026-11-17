import { useState } from "react";
import { Alert, Button, Card, Empty, Pagination, Spin, Tag } from "antd";
import { Link } from "react-router-dom";
import type { CourseView, PublishedCatalog } from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";

export type CatalogFilters = {
  page?: number;
  pageSize?: number;
  q?: string;
  region?: string;
  textbookEdition?: string;
  term?: string;
  access?: string;
};
export function usePublishedCourses(
  grade?: string,
  subject?: string,
  filters: CatalogFilters = {},
) {
  const query = new URLSearchParams();
  if (grade) query.set("grade", grade);
  if (subject) query.set("subject", subject);
  for (const [key, value] of Object.entries(filters))
    if (value !== undefined && value !== "") query.set(key, String(value));
  const result = useApiData<PublishedCatalog>(
    `/api/published-courses?${query}`,
  );
  return {
    items: result.data?.items ?? [],
    total: result.data?.total ?? 0,
    facets: result.data?.facets,
    subjectCounts: result.data?.subjectCounts ?? {},
    loading: result.loading,
    error: result.error,
    reload: result.reload,
  };
}
export function PublishedCourses({
  grade,
  subject,
}: {
  grade?: string;
  subject?: string;
}) {
  const [page, setPage] = useState(1);
  const result = usePublishedCourses(grade, subject, { page, pageSize: 9 });
  return (
    <>
      <PublishedCourseList {...result} />
      {!result.error && (
        <Pagination
          current={page}
          pageSize={9}
          total={result.total}
          hideOnSinglePage
          showSizeChanger={false}
          onChange={setPage}
          className="relation-pagination"
        />
      )}
    </>
  );
}
export function PublishedCourseList({
  items,
  loading,
  error,
  reload,
  compact = false,
  total = items.length,
}: {
  items: CourseView[];
  loading: boolean;
  error: string;
  reload: () => void;
  compact?: boolean;
  total?: number;
}) {
  return (
    <div className="published-section" aria-live="polite">
      <h2>可学习课程</h2>
      {loading ? (
        <Spin />
      ) : error ? (
        <Alert
          type="error"
          title={error}
          action={<Button onClick={reload}>重试</Button>}
        />
      ) : !items.length ? (
        <Empty description="当前筛选下暂无已发布课程，请调整筛选条件或清空搜索。" />
      ) : (
        <>
          <div className="learning-grid">
            {(compact ? items.slice(0, 3) : items).map((course) => (
              <Link key={course.id} to={`/course/${course.id}`}>
                <Card hoverable title={course.title}>
                  <Tag color="green">已发布</Tag>
                  <Tag color="blue">
                    {course.access === "FREE" ? "免费学习" : "需要会员权益"}
                  </Tag>
                  <p>{course.description}</p>
                  {(course.region || course.textbookEdition || course.term) && (
                    <dl className="course-metadata">
                      {course.region && (
                        <div>
                          <dt>适用地区</dt>
                          <dd>{course.region}</dd>
                        </div>
                      )}
                      {course.textbookEdition && (
                        <div>
                          <dt>教材版本</dt>
                          <dd>{course.textbookEdition}</dd>
                        </div>
                      )}
                      {course.term && (
                        <div>
                          <dt>学期</dt>
                          <dd>{course.term}</dd>
                        </div>
                      )}
                    </dl>
                  )}
                  <span className="text-link">查看课程与课时 →</span>
                </Card>
              </Link>
            ))}
          </div>
          {compact && total > 3 && (
            <Link to="/courses" className="text-link">
              查看全部可学习课程 →
            </Link>
          )}
        </>
      )}
    </div>
  );
}
