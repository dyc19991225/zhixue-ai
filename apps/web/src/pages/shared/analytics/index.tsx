import { useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Pagination,
  Progress,
  Row,
  Space,
  Spin,
  Statistic,
  Table,
} from "antd";
import { useSearchParams } from "react-router-dom";
import type {
  AssessmentSummary,
  ClassAnalytics,
  ClassView,
  LearningAnalytics,
  PageResult,
  RelatedStudent,
} from "@zhixue/shared";
import { useAuth } from "@/auth/auth-provider";
import { useApiData } from "@/hooks/use-api-data";
import Trend from "./trend";
const rate = (value: number | null) =>
  value === null ? "暂无数据" : `${value}%`;
function Assessments({ data: d }: { data: AssessmentSummary }) {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} md={12}>
        <Card title="作业记录">
          <Space wrap>
            <Statistic
              title="已提交 / 已布置"
              value={`${d.homeworkSubmitted} / ${d.homeworkAssigned}`}
            />
            <Statistic title="已批改" value={d.homeworkGraded} />
            <Statistic
              title="累计得分率"
              value={rate(d.homeworkScorePercent)}
            />
          </Space>
        </Card>
      </Col>
      <Col xs={24} md={12}>
        <Card title="考试记录">
          <Space wrap>
            <Statistic
              title="已交卷 / 已安排"
              value={`${d.examsSubmitted} / ${d.examsAssigned}`}
            />
            <Statistic title="已公布成绩" value={d.examsReleased} />
            <Statistic title="累计得分率" value={rate(d.examScorePercent)} />
          </Space>
        </Card>
      </Col>
    </Row>
  );
}
export default function Analytics() {
  const { user } = useAuth(),
    [params] = useSearchParams();
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState(params.get("classId") ?? "");
  const manager = user?.role === "ADMIN" || user?.role === "TEACHER",
    parent = user?.role === "PARENT";
  const options = useApiData<PageResult<ClassView | RelatedStudent>>(
    manager
      ? `/api/classes?page=${page}&pageSize=6`
      : parent
        ? `/api/parent/students?page=${page}&pageSize=6`
        : null,
  );
  const target = manager ? "classId" : "studentId",
    active = params.get(target) ?? selected;
  const personal = useApiData<LearningAnalytics>(
    user?.role === "STUDENT"
      ? "/api/analytics/me"
      : parent && active
        ? `/api/analytics/students/${encodeURIComponent(active)}`
        : null,
  );
  const [rosterPage, setRosterPage] = useState(1);
  const [trendRefresh, setTrendRefresh] = useState(0);
  const roster = useApiData<ClassAnalytics>(
    manager && active
      ? `/api/analytics/classes/${encodeURIComponent(active)}?page=${rosterPage}&pageSize=10`
      : null,
  );
  const d = personal.data;
  return (
    <section className="wrap account-page relation-page">
      <div className="account-heading">
        <div>
          <p className="eyebrow">学习足迹</p>
          <h1>{manager ? "班级学情" : "学习报告"}</h1>
          <p className="muted">
            {manager
              ? "只汇总当前班级的作业和考试，不展示学生私人练习。"
              : "回看已经完成的学习，把下一步安排得更清楚。"}
          </p>
        </div>
        <Button
          onClick={() => {
            options.reload();
            personal.reload();
            roster.reload();
            setTrendRefresh((v) => v + 1);
          }}
        >
          刷新报告
        </Button>
      </div>
      <Alert
        type="info"
        showIcon
        title="累计记录 · 考试成绩公布后才计入得分率"
        description="得分率按已评分记录的总得分 ÷ 对应总满分计算。暂无数据不代表零分；这些记录不等同于知识点掌握度或能力评级。"
      />
      {[options.error, personal.error, roster.error]
        .filter(Boolean)
        .map((e, i) => (
          <Alert key={i} type="error" title={e} />
        ))}
      {(manager || parent) && (
        <Card
          title={manager ? "选择班级" : "选择已绑定的孩子"}
          style={{ marginTop: 24 }}
        >
          {options.loading ? (
            <Spin />
          ) : !options.data?.list.length ? (
            <Empty
              description={
                manager
                  ? "暂无可查看班级，请先建立班级。"
                  : "暂无绑定学生，请联系管理员。"
              }
            />
          ) : (
            <Space wrap>
              {options.data.list.map((o) => (
                <Button
                  key={o.id}
                  type={active === o.id ? "primary" : "default"}
                  href={
                    params.has(target)
                      ? `/analytics?${target}=${encodeURIComponent(o.id)}`
                      : undefined
                  }
                  onClick={() => {
                    setSelected(o.id);
                    setRosterPage(1);
                  }}
                >
                  {"name" in o ? o.name : o.displayName}
                </Button>
              ))}
            </Space>
          )}
          <Pagination
            style={{ marginTop: 16 }}
            current={page}
            pageSize={6}
            total={options.data?.total ?? 0}
            showSizeChanger={false}
            onChange={setPage}
          />
        </Card>
      )}
      {(personal.loading || roster.loading) && <Spin />}
      {(user?.role === "STUDENT" || active) && (
        <Trend
          refreshKey={trendRefresh}
          key={`${user?.id}:${active}`}
          scope={manager ? "classes" : parent ? "students" : "me"}
          id={active}
        />
      )}
      {d && (
        <>
          <h2 style={{ marginTop: 28 }}>{d.student.displayName}的学习足迹</h2>
          <Row gutter={[16, 16]}>
            <Col xs={12} md={6}>
              <Card>
                <Statistic title="已选发布课程" value={d.learning.courses} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title="已完成发布课时"
                  value={d.learning.completedLessons}
                />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic title="累计练习次数" value={d.learning.attempts} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card>
                <Statistic
                  title="待复习错题"
                  value={d.learning.unresolvedWrongQuestions}
                />
              </Card>
            </Col>
          </Row>
          <Card title="练习正确率" style={{ margin: "16px 0" }}>
            {d.learning.accuracyPercent === null ? (
              <Empty description="还没有练习记录，先去完成一道题吧。" />
            ) : (
              <Progress
                percent={d.learning.accuracyPercent}
                strokeColor="#2158d5"
              />
            )}
            {user?.role === "STUDENT" && (
              <Button href="/practice">进入练习中心</Button>
            )}
          </Card>
          <Assessments data={d.assessments} />
          <p className="muted">
            生成时间：{new Date(d.generatedAt).toLocaleString("zh-CN")}
          </p>
        </>
      )}
      {roster.data && (
        <Card
          title={`${roster.data.className} · 当前学生`}
          style={{ marginTop: 24 }}
        >
          <Table
            rowKey={(r) => r.student.id}
            dataSource={roster.data.list}
            scroll={{ x: 760 }}
            pagination={{
              current: rosterPage,
              pageSize: 10,
              total: roster.data.total,
              showSizeChanger: false,
              onChange: setRosterPage,
            }}
            columns={[
              { title: "学生", render: (_, r) => r.student.displayName },
              {
                title: "作业提交 / 布置",
                render: (_, r) =>
                  `${r.assessments.homeworkSubmitted} / ${r.assessments.homeworkAssigned}`,
              },
              {
                title: "作业得分率",
                render: (_, r) => rate(r.assessments.homeworkScorePercent),
              },
              {
                title: "考试交卷 / 安排",
                render: (_, r) =>
                  `${r.assessments.examsSubmitted} / ${r.assessments.examsAssigned}`,
              },
              {
                title: "已公布考试得分率",
                render: (_, r) => rate(r.assessments.examScorePercent),
              },
            ]}
          />
          <p className="muted">
            仅当前有效学生；包含本班已归档测评。不提供跨班排行。
          </p>
        </Card>
      )}
    </section>
  );
}
