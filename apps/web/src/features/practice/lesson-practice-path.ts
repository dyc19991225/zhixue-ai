type LessonPracticeOptions = {
  mode?: "questions" | "wrong";
  state?: "active" | "resolved";
  page?: number;
  roundId?: string;
};

export function learnLessonPath(courseId: string, lessonId: string) {
  return `/learn/${encodeURIComponent(courseId)}/${encodeURIComponent(lessonId)}`;
}

export function lessonPracticePath(
  courseId: string,
  lessonId: string,
  {
    mode = "questions",
    state = "active",
    page = 1,
    roundId,
  }: LessonPracticeOptions = {},
) {
  const params = new URLSearchParams({ courseId, lessonId });
  if (mode === "wrong") {
    params.set("mode", mode);
    if (roundId) params.set("roundId", roundId);
  }
  if (mode === "wrong" && state === "resolved") params.set("state", state);
  if (page > 1) params.set("page", String(page));
  return `/practice?${params}`;
}
