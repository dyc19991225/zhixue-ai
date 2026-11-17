import "../apps/api/src/config";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  validateContentPackage,
  importContentPackage,
  linkContentPackage,
} from "../apps/api/src/services/content-package";
import { disconnectDb } from "../apps/api/src/lib/db";
import { HttpError } from "../apps/api/src/lib/http";
import { renderDiagramSvg } from "@zhixue/shared";
const [mode, file] = process.argv.slice(2);
function escape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
async function main() {
  if (!file || !["check", "import", "preview", "link"].includes(mode))
    throw new Error("用法：content:<check|import|preview> -- <内容包 JSON>");
  const pkg = validateContentPackage(
    JSON.parse(await readFile(resolve(file), "utf8")),
  );
  const lessons = pkg.course.chapters.flatMap((c) => c.lessons),
    automated = pkg.questions.filter(
      (q) => q.check.kind === "linear-equation",
    ).length;
  console.log(
    `内容校验通过：${pkg.course.chapters.length} 章、${lessons.length} 课时、${pkg.questions.length} 题；方程校验 ${automated} 题，人工核对 ${pkg.questions.length - automated} 题。`,
  );
  if (mode === "import") {
    console.log(JSON.stringify(await importContentPackage(pkg)));
    return;
  }
  if (mode === "link") {
    console.log(JSON.stringify(await linkContentPackage(pkg)));
    return;
  }
  if (mode === "preview") {
    const body = pkg.course.chapters
      .map(
        (c) =>
          `<section><h2>${escape(c.title)}</h2>${c.lessons.map((l) => `<article id="${l.key}"><h3>${escape(l.title)}</h3><div class="prose">${escape(l.content)}</div></article>`).join("")}</section>`,
      )
      .join("");
    const questions = pkg.questions
      .map(
        (q, i) =>
          `<article id="question-${q.key}"><h3>${i + 1}. ${escape(q.title)}</h3>${q.diagram ? `<figure style="margin:16px 0;max-width:560px">${renderDiagramSvg(q.diagram)}<figcaption>${escape(q.diagram.alt)}</figcaption></figure>` : ""}<p>配套课时：${escape((q.lessonKeys ?? []).map((key) => pkg.course.chapters.flatMap((c) => c.lessons).find((l) => l.key === key)?.title ?? key).join("、") || "未关联")}</p><ol type="A">${q.options.map((o) => `<li>${escape(o)}</li>`).join("")}</ol><details><summary>展开答案与解析（审阅用）</summary><p>答案：${String.fromCharCode(65 + q.answer)}</p><div class="prose">${escape(q.explanation)}</div></details></article>`,
      )
      .join("");
    const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(pkg.course.title)} · 审阅稿</title><style>body{margin:0;color:#192c48;font:16px/1.9 "Microsoft YaHei",sans-serif;background:#f3f6fb}main{max-width:920px;margin:auto;padding:32px 20px}header,article{background:white;border-radius:16px;padding:28px;margin:20px 0}h1{font-size:32px;line-height:1.4}h2{margin-top:48px}h3{font-size:21px}.note{border-left:5px solid #e9b22e;background:#fff7dd;padding:18px}.prose{white-space:pre-wrap;overflow-wrap:anywhere}a{color:#175cde}summary{cursor:pointer;color:#175cde}li{padding:5px}nav a{display:block;padding:4px} @media print{body{background:white}article{break-inside:avoid}details{display:block}}</style><main><header><p>知学 AI · 课程审阅稿</p><h1>${escape(pkg.course.title)}</h1><p class="note">内容草稿，待人工教研审阅；来源见下方说明，未指定教材版本，未发布为正式课程。</p><p>${escape(pkg.provenance)}</p><p>${escape(pkg.course.description)}</p><nav>${lessons.map((l) => `<a href="#${l.key}">${escape(l.title)}</a>`).join("")}</nav></header>${body}<section><h2>配套练习与解析</h2>${questions}</section><footer>审阅顺序：知识准确性 → 例题过程 → 选项与解析 → 教材适配与表述 → 决定是否发布。AI 校验与算术校验不替代教研审核。</footer></main></html>`;
    await mkdir("work/content-preview", { recursive: true });
    const path = resolve("work/content-preview", pkg.id + ".html");
    await writeFile(path, html);
    console.log(`审阅稿：${path}`);
  }
}
main()
  .catch((error) => {
    console.error(
      error instanceof HttpError
        ? error.message
        : error instanceof SyntaxError
          ? "内容包 JSON 格式无效。"
          : "内容操作失败，请检查文件、数据库和迁移状态；未输出内部异常。",
    );
    process.exitCode = 1;
  })
  .finally(disconnectDb);
