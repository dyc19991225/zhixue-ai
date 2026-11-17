type LessonPracticeOptions = {
  mode?: "questions" | "wrong";
  state?: "active" | "resolved";
  page?: number;
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
  }: LessonPracticeOptions = {},
) {
  const params = new URLSearchParams({ courseId, lessonId });
  if (mode === "wrong") params.set("mode", mode);
  if (mode === "wrong" && state === "resolved") params.set("state", state);
  if (page > 1) params.set("page", String(page));
  return `/practice?${params}`;
}
