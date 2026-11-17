import { readFile, writeFile, mkdir } from "node:fs/promises";
import { z } from "zod";
import { validateContentPackage } from "../apps/api/src/services/content-package";
import { manualQuestionSchema } from "../apps/api/src/modules/exam/exam.dto";
const base = "content/assessments/g7-math-linear-unit";
const text = z.string().min(1);
const schema = z
  .object({
    id: text,
    status: z.literal("DRAFT_REVIEW_REQUIRED"),
    questionPackage: text,
    durationMinutes: z.number().int().min(1).max(180),
    pointsPerQuestion: z.number().int().positive(),
    totalPoints: z.number().int().positive(),
    blueprint: z
      .array(
        z
          .object({
            questionKey: text,
            number: z.number().int().positive(),
            points: z.number().int().positive(),
            topic: text,
            sourceLessonKeys: z.array(text).min(1),
          })
          .strict(),
      )
      .min(1),
    writtenPractice: z.array(
      z
        .object({
          key: text,
          prompt: text,
          maxScore: z.number().int().positive(),
          reference: text,
          rubric: z
            .array(
              z
                .object({
                  criterion: text,
                  points: z.number().int().positive(),
                })
                .strict(),
            )
            .min(1),
        })
        .strict(),
    ),
    writtenPracticePolicy: text,
    notCovered: z.array(text),
    publicationPolicy: text,
  })
  .strict();
const load = async (path: string): Promise<unknown> =>
  JSON.parse(await readFile(path, "utf8"));
const fail = (message: string) => {
  throw new Error(message);
};
const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
async function main() {
  const pkg = validateContentPackage(await load(base + ".v1.json"));
  const plan = schema.parse(await load(base + ".blueprint.v1.json"));
  const sources = await Promise.all(
    [
      "content/courses/g7-math-linear-equations.v1.json",
      "content/courses/g7-math-equation-models.v1.json",
    ].map(async (p) => validateContentPackage(await load(p))),
  );
  const lessons = new Set(
    sources.flatMap((s) =>
      s.course.chapters.flatMap((c) => c.lessons.map((l) => l.key)),
    ),
  );
  if (plan.id !== pkg.id || plan.questionPackage !== base + ".v1.json")
    fail("试卷与蓝图标识不一致。");
  if (plan.blueprint.length !== pkg.questions.length)
    fail("题量与蓝图不一致。");
  const byKey = new Map(pkg.questions.map((q) => [q.key, q]));
  if (new Set(plan.blueprint.map((r) => r.questionKey)).size !== byKey.size)
    fail("题目覆盖存在重复或遗漏。");
  for (const [i, row] of plan.blueprint.entries()) {
    if (
      !byKey.has(row.questionKey) ||
      row.number !== i + 1 ||
      row.points !== plan.pointsPerQuestion
    )
      fail("题号、题目键或分值不一致。");
    if (byKey.get(row.questionKey)?.knowledgePoint !== row.topic)
      fail("题目知识主题与蓝图不一致。");
    if (row.sourceLessonKeys.some((key) => !lessons.has(key)))
      fail("蓝图引用了不存在的学习课时。");
  }
  if (plan.blueprint.reduce((n, r) => n + r.points, 0) !== plan.totalPoints)
    fail("单选总分不一致。");
  if (
    new Set(plan.writtenPractice.map((w) => w.key)).size !==
    plan.writtenPractice.length
  )
    fail("书面任务键重复。");
  for (const task of plan.writtenPractice)
    if (task.rubric.reduce((n, r) => n + r.points, 0) !== task.maxScore)
      fail("书面任务评分细则合计不符。");
  const questions = plan.blueprint.map((row) => {
    const q = byKey.get(row.questionKey)!;
    return manualQuestionSchema.parse({
      source: "MANUAL",
      title: q.title,
      options: q.options,
      answer: q.answer,
      explanation: q.explanation,
      points: row.points,
      diagram: q.diagram ?? null,
    });
  });
  const result = {
    id: pkg.id,
    questions: questions.length,
    totalPoints: plan.totalPoints,
    durationMinutes: plan.durationMinutes,
    automaticEquationChecks: pkg.questions.filter(
      (q) => q.check.kind === "linear-equation",
    ).length,
    manualConceptChecks: pkg.questions.filter((q) => q.check.kind === "manual")
      .length,
    diagramQuestions: pkg.questions.filter((q) => q.diagram).length,
    writtenPractice: plan.writtenPractice.length,
    writtenMaxPoints: plan.writtenPractice.reduce((n, w) => n + w.maxScore, 0),
    difficultyCounts: Object.fromEntries(
      ["EASY", "MEDIUM", "HARD"].map((d) => [
        d,
        pkg.questions.filter((q) => q.difficulty === d).length,
      ]),
    ),
    linkedLearningLessons: lessons.size,
    formalExamCreated: false,
  };
  console.log(JSON.stringify(result));
  if (process.argv[2] === "prepare") {
    await mkdir("work/content-preview", { recursive: true });
    await writeFile(
      "work/content-preview/" + pkg.id + "-exam-template.json",
      JSON.stringify(
        {
          status: "UNBOUND_DRAFT_TEMPLATE",
          requiredBeforeUse: ["classId", "opensAt", "closesAt"],
          payload: {
            title: pkg.course.title,
            durationMinutes: plan.durationMinutes,
            questions,
          },
        },
        null,
        2,
      ),
    );
    const preview = "work/content-preview/" + pkg.id + ".html";
    const html = await readFile(preview, "utf8");
    const written = `<!-- written-start --><section id="written-practice"><h2>书面任务 · 教师人工批阅</h2><p>${escape(plan.writtenPracticePolicy)}</p>${plan.writtenPractice.map((w, i) => `<article><h3>书面任务${i + 1}（${w.maxScore}分）</h3><p>${escape(w.prompt)}</p><details><summary>展开参考过程与评分细则（审阅用）</summary><p>${escape(w.reference)}</p><ul>${w.rubric.map((r) => `<li>${escape(r.criterion)}：${r.points}分</li>`).join("")}</ul></details></article>`).join("")}</section><!-- written-end -->`;
    await writeFile(
      preview,
      html
        .replace(/<!-- written-start -->[\s\S]*?<!-- written-end -->/g, "")
        .replace("<footer>", written + "<footer>"),
    );
    await writeFile(
      "work/content-preview/" + pkg.id + "-validation.json",
      JSON.stringify(result, null, 2),
    );
    console.log(
      "已生成本地审阅页和未绑定班级/日期的考试模板；未创建或发布考试。",
    );
  }
}
main().catch((error: unknown) => {
  console.error(
    error instanceof z.ZodError
      ? "测评蓝图格式错误。"
      : error instanceof Error
        ? error.message
        : "测评检查失败。",
  );
  process.exitCode = 1;
});
