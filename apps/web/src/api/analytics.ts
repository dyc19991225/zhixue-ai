import type { AnalyticsExport } from "@zhixue/shared";
import { api } from "@/lib/api";
export async function exportTrend(
  scope: "me" | "students" | "classes",
  days: 7 | 30,
  id?: string,
) {
  const path = trendPath(scope, days, id);
  if (!path) throw new Error("请先选择班级或学生。");
  const [base, query] = path.split("?");
  return api<AnalyticsExport>(`${base}/export?${query}`);
}
export function trendPath(
  scope: "me" | "students" | "classes",
  days: 7 | 30,
  id?: string,
) {
  return scope === "me"
    ? `/api/analytics/me/trend?days=${days}`
    : id
      ? `/api/analytics/${scope}/${encodeURIComponent(id)}/trend?days=${days}`
      : null;
}
