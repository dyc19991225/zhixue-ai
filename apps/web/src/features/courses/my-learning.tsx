import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Pagination,
  Progress,
  Select,
  Spin,
  Tag,
} from "antd";
import { Link } from "react-router-dom";
import type { LearningLibrary } from "@zhixue/shared";
import { gradeOptions } from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";

const stateNames = {
  NOT_STARTED: "待开始",
  IN_PROGRESS: "学习中",
  COMPLETED: "已完成",
};
export function MyLearning() {
  const [page, setPage] = useState(1),
    [state, setState] = useState("ALL"),
    [draft, setDraft] = useState(""),
    [query, setQuery] = useState("");
  const result = useApiData<LearningLibrary>(
    `/api/learning-library?${new URLSearchParams({ page: String(page), pageSize: "6", state, q: query })}`,
  );
  const counts = result.data?.counts;
  return (
    <section aria-labelledby="my-learning-title">
      <div className="study-task-heading">
        <h2 id="my-learning-title">我的选课记录</h2>
        <Button onClick={result.reload} loading={result.loading}>
          刷新课程
        </Button>
      </div>
      <p className="muted">
        按最近保存进度排序，只统计已开放课时；会员到期后仍保留进度摘要。
      </p>
      <div className="library-controls">
        <label>
          课程名称
          <Input.Search
            aria-label="查找已选课程"
            placeholder="输入课程名称"
            allowClear
            enterButton="搜索"
            maxLength={120}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onSearch={(value) => {
              setQuery(value.trim());
              setPage(1);
            }}
          />
        </label>
        <label>
          学习进度
          <Select
            aria-label="筛选学习进度"
            value={state}
            onChange={(value) => {
              setState(value);
              setPage(1);
            }}
            options={[
              {
                value: "ALL",
                label: `全部${counts ? ` (${counts.all})` : ""}`,
              },
              {
                value: "NOT_STARTED",
                label: `待开始${counts ? ` (${counts.notStarted})` : ""}`,
              },
              {
                value: "IN_PROGRESS",
                label: `学习中${counts ? ` (${counts.inProgress})` : ""}`,
              },
              {
                value: "COMPLETED",
                label: `已完成${counts ? ` (${counts.completed})` : ""}`,
              },
            ]}
          />
        </label>
        <Button
          onClick={() => {
            setDraft("");
            setQuery("");
            setState("ALL");
            setPage(1);
          }}
        >
          清空筛选
        </Button>
      </div>
      {result.loading ? (
        <Spin description="正在读取选课记录">
          <div style={{ minHeight: 100 }} />
        </Spin>
      ) : result.error ? (
        <Alert
          title={result.error}
          type="error"
          action={<Button onClick={result.reload}>重试</Button>}
        />
      ) : result.data ? (
        <>
          <p className="muted" aria-live="polite">
            符合条件 {result.data.total} 门课程
          </p>
          {!result.data.items.length ? (
            <Card>
              <Empty
                description={
                  result.data.counts.all === 0 && !query
                    ? "还没有已发布的选课记录"
                    : "当前筛选下没有课程，请调整筛选或返回前一页。"
                }
              >
                <Link className="button primary" to="/courses">
                  去挑选课程
                </Link>
              </Empty>
            </Card>
          ) : (
            <div className="learning-grid">
              {result.data.items.map((v) => (
                <Card key={v.courseId} title={v.title}>
                  <Tag>
                    {gradeOptions.find((g) => g.value === v.grade)?.label}
                  </Tag>
                  <Tag color={v.state === "COMPLETED" ? "green" : "blue"}>
                    {v.totalLessons ? stateNames[v.state] : "待开放课时"}
                  </Tag>
                  {!v.canStudy && <Tag color="orange">需要有效会员权益</Tag>}
                  {v.totalLessons > 0 ? (
                    <>
                      <Progress
                        percent={Math.round(
                          (v.completedLessons / v.totalLessons) * 100,
                        )}
                      />
                      <p>
                        已完成 {v.completedLessons} / {v.totalLessons} 课时
                      </p>
                    </>
                  ) : (
                    <p>暂无已开放课时</p>
                  )}
                  <p className="muted">
                    {v.lastStudiedAt
                      ? `最近保存：${new Date(v.lastStudiedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}（北京时间）`
                      : "暂无已保存的学习进度"}
                  </p>
                  <Link
                    className="text-link study-task-action"
                    to={
                      !v.canStudy
                        ? "/membership"
                        : v.nextLessonId
                          ? `/learn/${v.courseId}/${v.nextLessonId}`
                          : `/course/${v.courseId}`
                    }
                  >
                    {!v.canStudy
                      ? "查看权益"
                      : !v.nextLessonId
                        ? "查看课程"
                        : v.state === "COMPLETED"
                          ? "复习课程"
                          : v.state === "NOT_STARTED"
                            ? "开始学习"
                            : "继续学习"}{" "}
                    →
                  </Link>
                </Card>
              ))}
            </div>
          )}
          <Pagination
            current={page}
            pageSize={6}
            total={result.data.total}
            hideOnSinglePage
            showSizeChanger={false}
            onChange={setPage}
            className="relation-pagination"
          />
        </>
      ) : null}
    </section>
  );
}
