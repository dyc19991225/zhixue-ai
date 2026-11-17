export const feedbackAreas = [
  "课程与内容",
  "练习与错题",
  "照片识别",
  "登录与权限",
  "学习报告",
  "隐私或数据问题",
] as const;
export const feedbackSeverities = [
  "一般问题",
  "影响使用",
  "无法继续",
  "疑似隐私或权限问题",
] as const;
export const feedbackStatuses = [
  "NEW",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
] as const;
export const feedbackStatusLabels: Record<
  (typeof feedbackStatuses)[number],
  string
> = {
  NEW: "已接收",
  IN_PROGRESS: "处理中",
  RESOLVED: "已解决",
  CLOSED: "已关闭",
};
export type TrialFeedbackView = {
  id: string;
  area: string;
  severity: string;
  detail: string;
  status: (typeof feedbackStatuses)[number];
  reply: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type FeedbackPage = {
  items: TrialFeedbackView[];
  total: number;
  page: number;
  pageSize: number;
};
