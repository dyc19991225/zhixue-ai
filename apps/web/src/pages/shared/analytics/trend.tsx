import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Empty,
  Segmented,
  Space,
  Spin,
  Table,
} from "antd";
import type { AnalyticsTrend, TrendDay } from "@zhixue/shared";
import { useApiData } from "@/hooks/use-api-data";
import { trendPath, exportTrend } from "@/api/analytics";
const metrics = [
  { key: "completedLessons", label: "完成课时", color: "#2158d5" },
  { key: "attempts", label: "练习次数", color: "#0d8577" },
  { key: "homeworkSubmitted", label: "作业提交", color: "#e29b18" },
  { key: "examsSubmitted", label: "考试交卷", color: "#8b57b8" },
] as const;
export default function Trend({
  scope,
  id,
  refreshKey = 0,
}: {
  scope: "me" | "students" | "classes";
  id?: string;
  refreshKey?: number;
}) {
  const [days, setDays] = useState<7 | 30>(7);
  const [exporting, setExporting] = useState(false),
    [exportError, setExportError] = useState("");
  const generation = useRef(0);
  useEffect(
    () => () => {
      generation.current++;
    },
    [scope, id, days],
  );
  async function download() {
    const current = ++generation.current;
    setExporting(true);
    setExportError("");
    try {
      const file = await exportTrend(scope, days, id);
      if (current !== generation.current) return;
      const url = URL.createObjectURL(
        new Blob([file.csv], { type: file.contentType }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = file.fileName;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (cause: unknown) {
      if (current === generation.current)
        setExportError(
          cause instanceof Error ? cause.message : "导出失败，请重试。",
        );
    } finally {
      if (current === generation.current) setExporting(false);
    }
  }
  const report = useApiData<AnalyticsTrend>(
    trendPath(scope, days, id),
    refreshKey,
  );
  const visible: readonly (typeof metrics)[number][] =
    scope === "classes" ? metrics.slice(2) : metrics;
  const total = (r: TrendDay) => visible.reduce((sum, m) => sum + r[m.key], 0);
  const max = Math.max(1, ...(report.data?.list.map(total) ?? []));
  return (
    <Card
      title="学习趋势"
      style={{ marginTop: 24 }}
      extra={
        <Segmented
          options={[
            { label: "近7天", value: 7 },
            { label: "近30天", value: 30 },
          ]}
          value={days}
          onChange={(v) => {
            setDays(v as 7 | 30);
            setExportError("");
            setExporting(false);
          }}
        />
      }
    >
      <Space wrap>
        <Button
          onClick={() => void download()}
          loading={exporting}
          disabled={report.loading || !report.data}
        >
          导出近{days}天 CSV
        </Button>
        <span className="muted">导出完整日期范围，不受明细分页影响。</span>
      </Space>
      {exportError && (
        <Alert style={{ marginTop: 12 }} type="error" title={exportError} />
      )}
      <p className="muted">
        按北京时间记录每日完成与提交次数，今天统计到报告生成时刻。
        {scope === "classes"
          ? "仅汇总当前有效学生在本班的测评提交。"
          : "重复练习按次计入，完成课时按首次完成时间计入。"}
      </p>
      {report.error ? (
        <Alert
          type="error"
          title={report.error}
          action={<Button onClick={report.reload}>重试</Button>}
        />
      ) : report.loading ? (
        <Spin />
      ) : (
        report.data && (
          <>
            <Space wrap>
              {visible.map((m) => (
                <span key={m.key}>
                  <span
                    aria-hidden
                    style={{
                      display: "inline-block",
                      width: 10,
                      height: 10,
                      background: m.color,
                      marginRight: 6,
                    }}
                  />
                  {m.label}
                </span>
              ))}
            </Space>
            {!report.data.list.some((r) => total(r) > 0) ? (
              <Empty
                style={{ margin: "24px 0" }}
                description="这段时间还没有记录。完成学习后，回来看看你的足迹。"
              />
            ) : (
              <div style={{ overflowX: "auto", margin: "24px 0" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "end",
                    gap: 8,
                    minWidth: days === 30 ? 900 : 280,
                    height: 190,
                  }}
                  role="img"
                  aria-label={`近${days}天每日学习活动柱状图，详细数值见下表`}
                >
                  {report.data.list.map((r) => (
                    <div
                      key={r.date}
                      title={`${r.date}：${visible.map((m) => `${m.label}${r[m.key]}`).join("，")}`}
                      style={{ flex: 1, minWidth: 20, textAlign: "center" }}
                    >
                      <div
                        style={{
                          height: 155,
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "end",
                        }}
                      >
                        {visible.map((m) => (
                          <div
                            key={m.key}
                            style={{
                              height: (r[m.key] / max) * 150,
                              background: m.color,
                            }}
                          />
                        ))}
                      </div>
                      <small style={{ whiteSpace: "nowrap", fontSize: 10 }}>
                        {r.date.slice(5)}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Table<TrendDay>
              size="small"
              rowKey="date"
              dataSource={report.data.list}
              scroll={{ x: scope === "classes" ? 420 : 680 }}
              pagination={{
                pageSize: 7,
                showSizeChanger: false,
                hideOnSinglePage: true,
              }}
              columns={[
                { title: "日期", dataIndex: "date" },
                ...visible.map((m) => ({ title: m.label, dataIndex: m.key })),
                ...(scope !== "classes"
                  ? [
                      {
                        title: "练习正确率",
                        render: (_: unknown, r: TrendDay) =>
                          r.accuracyPercent === null
                            ? "暂无数据"
                            : `${r.accuracyPercent}%`,
                      },
                    ]
                  : []),
              ]}
            />
            <p className="muted">
              {report.data.timezone} · 更新于{" "}
              {new Date(report.data.generatedAt).toLocaleString("zh-CN")}
            </p>
          </>
        )
      )}
    </Card>
  );
}
