import { useState } from "react";
import { Alert, Button, Card, Empty, Pagination, Spin, Tag } from "antd";
import type { CourseReviewQueue } from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";
import { CourseReviewPanel } from "./course-review-panel";

const time = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    hour12: false,
  });
export function CourseReviewQueuePanel() {
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null);
  const { data, loading, error, reload } = useApiData<CourseReviewQueue>(
    `/api/admin/course-review-queue?page=${page}&pageSize=5`,
  );
  return (
    <section className="study-tasks" aria-labelledby="review-queue-title">
      <div className="study-task-heading">
        <h2 id="review-queue-title">课程审核队列</h2>
        <Button onClick={reload} loading={loading}>
          刷新队列
        </Button>
      </div>
      <p className="muted">
        按最早送审时间排列，仅列出草稿的最新待审记录。内容变更需重新送审，本人提交须由另一位管理员审核。
      </p>
      <Card>
        {loading ? (
          <Spin description="正在读取审核队列">
            <div style={{ minHeight: 100 }} />
          </Spin>
        ) : error ? (
          <Alert
            type="error"
            showIcon
            title={error}
            action={<Button onClick={reload}>重试</Button>}
          />
        ) : data ? (
          <>
            <p>
              当前待审记录：{data.total}{" "}
              项（含需重新送审或其他管理员处理的记录）
            </p>
            {!data.list.length ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  data.total ? "本页没有记录，请返回前一页。" : "暂无待审课程"
                }
              />
            ) : (
              <ul className="study-task-list">
                {data.list.map((r) => (
                  <li key={r.reviewId}>
                    <div className="study-task-copy">
                      <strong>{r.title}</strong>
                      <p>
                        <Tag color={r.canDecide ? "blue" : "orange"}>
                          {r.canDecide
                            ? "可审核"
                            : !r.versionCurrent
                              ? "内容已变更，需重新送审"
                              : "本人提交，需其他管理员审核"}
                        </Tag>
                        {!r.versionCurrent && r.submittedBySelf && (
                          <Tag>本人提交</Tag>
                        )}
                      </p>
                      <p className="muted">
                        提交人：{r.submittedByName} · 送审时间：
                        <time dateTime={r.submittedAt}>
                          {time(r.submittedAt)}
                        </time>
                        （北京时间）
                      </p>
                    </div>
                    <Button onClick={() => setSelected(r.courseId)}>
                      {r.canDecide ? "进入审核" : "查看版本记录"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <Pagination
              current={page}
              pageSize={5}
              total={data.total}
              showSizeChanger={false}
              hideOnSinglePage
              onChange={setPage}
              className="relation-pagination"
            />
          </>
        ) : null}
      </Card>
      {selected && (
        <CourseReviewPanel
          key={selected}
          courseId={selected}
          initialOpen
          hideTrigger
          onClosed={() => {
            setSelected(null);
            reload();
          }}
        />
      )}
    </section>
  );
}
