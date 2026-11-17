import type { AnalyticsExport, AnalyticsTrend } from "@zhixue/shared";
export function exportTrend(report: AnalyticsTrend): AnalyticsExport {
  const headers =
    report.scope === "class"
      ? ["日期（北京时间）", "作业提交次数", "考试交卷次数"]
      : [
          "日期（北京时间）",
          "完成课时数",
          "练习次数",
          "正确次数",
          "练习正确率（%）",
          "作业提交次数",
          "考试交卷次数",
        ];
  const rows = report.list.map((r) =>
    report.scope === "class"
      ? [r.date, r.homeworkSubmitted, r.examsSubmitted]
      : [
          r.date,
          r.completedLessons,
          r.attempts,
          r.correctAttempts,
          r.accuracyPercent ?? "",
          r.homeworkSubmitted,
          r.examsSubmitted,
        ],
  );
  const cell = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  return {
    fileName: `zhixue-${report.scope}-trend-${report.list[0].date}-${report.list.at(-1)!.date}.csv`,
    contentType: "text/csv;charset=utf-8",
    csv:
      "\uFEFF" +
      [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n") +
      "\r\n",
    generatedAt: report.generatedAt,
  };
}
