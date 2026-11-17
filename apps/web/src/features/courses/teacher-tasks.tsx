import { useEffect } from "react";
import { Alert, Button, Card, Empty, Spin, Tag } from "antd";
import { Link } from "react-router-dom";
import type { TeacherTasks } from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";

const time = (value: string) =>
  new Date(value).toLocaleString("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
export function TeacherTaskPanel() {
  const { data, loading, error, reload } = useApiData<TeacherTasks>(
    "/api/analytics/teacher/tasks",
  );
  useEffect(() => {
    const interval = window.setInterval(reload, 60000);
    window.addEventListener("focus", reload);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", reload);
    };
  }, [reload]);
  return (
    <section
      className="study-tasks"
      aria-labelledby="teacher-tasks-title"
      aria-busy={loading}
    >
      <div className="study-task-heading">
        <h2 id="teacher-tasks-title">教学待办</h2>
        <Button onClick={reload} loading={loading}>
          刷新待办
        </Button>
      </div>
      <p className="muted">
        待批改按最早提交时间排列，课程草稿按最近修改排列；每分钟更新，时间为北京时间。
      </p>
      {loading ? (
        <Spin tip="正在读取教学待办">
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
          <div className="learning-grid">
            <Card
              title={`待批改 · ${data.grading.total} 份`}
              extra={<Link to="/homework">作业管理</Link>}
            >
              <p className="muted">
                涉及 {data.grading.homeworkTotal} 项作业，优先显示最早提交的 5
                项。
              </p>
              {!data.grading.items.length ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无待批改作业"
                />
              ) : (
                <ul className="study-task-list">
                  {data.grading.items.map((h) => (
                    <li key={h.id}>
                      <div className="study-task-copy">
                        <Tag color="orange">待批改 {h.pendingCount} 份</Tag>
                        <strong>{h.title}</strong>
                        <p className="muted">{h.className}</p>
                        <p className="muted">
                          最早提交：
                          <time dateTime={h.oldestSubmittedAt}>
                            {time(h.oldestSubmittedAt)}
                          </time>
                        </p>
                      </div>
                      <Link
                        className="text-link study-task-action"
                        to={`/homework?homeworkId=${encodeURIComponent(h.id)}`}
                      >
                        查看与批改 →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card
              title={`课程草稿 · ${data.drafts.total} 门`}
              extra={<Link to="/teacher/courses">教学课程</Link>}
            >
              <p className="muted">
                展示归属于你的草稿，审核进度请进入课程查看。
              </p>
              {!data.drafts.items.length ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="暂无课程草稿"
                />
              ) : (
                <ul className="study-task-list">
                  {data.drafts.items.map((c) => (
                    <li key={c.id}>
                      <div className="study-task-copy">
                        <Tag>草稿</Tag>
                        <strong>{c.title}</strong>
                        <p className="muted">
                          修改于：
                          <time dateTime={c.updatedAt}>
                            {time(c.updatedAt)}
                          </time>
                        </p>
                      </div>
                      <Link
                        className="text-link study-task-action"
                        to={`/teacher/courses?courseId=${encodeURIComponent(c.id)}`}
                      >
                        查看与改稿 →
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {data.drafts.total > data.drafts.items.length && (
                <p className="muted">
                  显示最近 {data.drafts.items.length} 门，共 {data.drafts.total}{" "}
                  门。
                </p>
              )}
            </Card>
          </div>
          <p className="muted">更新于 {time(data.generatedAt)}</p>
        </>
      ) : null}
    </section>
  );
}
