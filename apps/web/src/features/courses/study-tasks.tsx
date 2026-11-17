import { useEffect } from "react";
import { Alert, Button, Card, Empty, Space, Spin, Tag } from "antd";
import { Link } from "react-router-dom";
import type { StudyTask, StudyTasks } from "@zhixue/shared";
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
export function StudyTaskPanel({ studentId }: { studentId?: string }) {
  const parentView = !!studentId;
  const { data, loading, error, reload } = useApiData<StudyTasks>(
    parentView
      ? `/api/analytics/students/${encodeURIComponent(studentId)}/tasks`
      : "/api/analytics/me/tasks",
  );
  useEffect(() => {
    const interval = window.setInterval(reload, 60000);
    window.addEventListener("focus", reload);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", reload);
    };
  }, [reload]);
  function group(kind: "homework" | "exams", title: string) {
    const tasks = data![kind];
    return (
      <Card
        title={`${title} · ${tasks.total}`}
        extra={!parentView && <Link to={`/${kind}`}>查看全部</Link>}
      >
        {!tasks.items.length ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={`暂无${title}`}
          />
        ) : (
          <ul className="study-task-list">
            {tasks.items.map((task: StudyTask) => (
              <li key={task.id}>
                <div className="study-task-copy">
                  <Tag
                    color={
                      task.state === "IN_PROGRESS"
                        ? "orange"
                        : task.state === "UPCOMING"
                          ? "default"
                          : "blue"
                    }
                  >
                    {task.state === "IN_PROGRESS"
                      ? "答题中"
                      : task.state === "UPCOMING"
                        ? "未开考"
                        : kind === "homework"
                          ? "待提交"
                          : "可参加"}
                  </Tag>
                  <strong>{task.title}</strong>
                  <p className="muted">{task.className}</p>
                  <p className="muted">
                    截止：
                    <time dateTime={task.deadline}>{time(task.deadline)}</time>
                  </p>
                  {task.state === "UPCOMING" && task.opensAt && (
                    <p className="muted">开考：{time(task.opensAt)}</p>
                  )}
                </div>
                {!parentView && (
                  <Link
                    className="text-link study-task-action"
                    to={
                      kind === "homework"
                        ? `/homework?homeworkId=${encodeURIComponent(task.id)}`
                        : `/exams/${encodeURIComponent(task.id)}/take`
                    }
                  >
                    {kind === "homework"
                      ? "查看作业"
                      : task.state === "UPCOMING"
                        ? "查看安排"
                        : task.state === "IN_PROGRESS"
                          ? "继续答题"
                          : "查看考试"}{" "}
                    →
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {tasks.total > tasks.items.length && (
          <p className="muted">
            按截止时间显示最近 {tasks.items.length} 项，共 {tasks.total} 项。
          </p>
        )}
      </Card>
    );
  }
  return (
    <section
      className="study-tasks"
      aria-labelledby="study-tasks-title"
      aria-busy={loading}
    >
      <div className="study-task-heading">
        <h2 id="study-tasks-title">
          {parentView ? "孩子的学习待办" : "学习待办"}
        </h2>
        <Button onClick={reload} loading={loading}>
          刷新待办
        </Button>
      </div>
      <p className="muted">
        显示尚未截止的作业和考试，每分钟更新；时间为北京时间。
        {parentView
          ? "家长可查看安排，作答与提交由学生账号完成。"
          : "进入考试后需确认才会开始计时。"}
      </p>
      {loading ? (
        <Spin tip="正在读取待办">
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
            {group("homework", "待交作业")}
            {group("exams", "待参加考试")}
          </div>
          <Space className="muted">更新于 {time(data.generatedAt)}</Space>
        </>
      ) : null}
    </section>
  );
}
