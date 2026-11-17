export type TeacherTasks = {
  generatedAt: string;
  grading: {
    total: number;
    homeworkTotal: number;
    items: {
      id: string;
      title: string;
      className: string;
      pendingCount: number;
      oldestSubmittedAt: string;
    }[];
  };
  drafts: {
    total: number;
    items: { id: string; title: string; updatedAt: string }[];
  };
};
