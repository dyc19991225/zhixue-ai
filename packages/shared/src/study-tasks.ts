export type StudyTask = {
  id: string;
  title: string;
  className: string;
  deadline: string;
  opensAt?: string;
  state: "PENDING" | "UPCOMING" | "IN_PROGRESS";
};
export type StudyTasks = {
  generatedAt: string;
  homework: { total: number; items: StudyTask[] };
  exams: { total: number; items: StudyTask[] };
};
