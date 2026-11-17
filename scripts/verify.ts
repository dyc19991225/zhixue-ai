import { spawnSync } from "node:child_process";
const tasks = [
  "db:validate",
  "typecheck",
  "lint",
  "test:backup",
  "test:ops",
  "test:ocr",
  "test:crop",
  "test:photo-correction",
  "test:question-search",
  "test:admin-question-search",
  "test",
  "test:auth",
  "test:feedback",
  "test:rbac",
  "test:relations",
  "test:homework",
  "test:exam",
  "test:analytics",
  "test:tasks",
  "test:teacher-tasks",
  "test:learning",
  "test:library",
  "test:catalog",
  "test:readiness",
  "test:lesson-readiness",
  "test:question-review",
  "test:practice",
  "test:foundation",
  "test:ai-images",
  "test:content",
  "assessment:check",
  "test:diagrams",
  "test:journey",
  "test:review",
  "test:review-queue",
  "test:teacher-edit",
  "build",
];
const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("请通过 npm run verify 运行验证。");
for (const task of tasks) {
  console.log(`\n验证：${task}`);
  const run = spawnSync(process.execPath, [npmCli, "run", task], {
    stdio: "inherit",
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
console.log("全部本地检查通过。");
