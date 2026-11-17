import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateContentPackage } from "../apps/api/src/services/content-package";
import { renderDiagramSvg } from "@zhixue/shared";
const escape = (s: string) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("请指定内容包文件。");
  const pkg = validateContentPackage(JSON.parse(await readFile(file, "utf8")));
  const body = pkg.questions
    .filter((q) => q.diagram)
    .map(
      (q, i) =>
        `<article><p class="muted">图形题 ${i + 1} · 配套课时：${escape((q.lessonKeys ?? []).map((key) => pkg.course.chapters.flatMap((c) => c.lessons).find((l) => l.key === key)?.title ?? key).join("、"))}</p><h2>${escape(q.title)}</h2><figure>${renderDiagramSvg(q.diagram!)}<figcaption>${escape(q.diagram!.alt)}</figcaption></figure><ol type="A">${q.options.map((o) => `<li>${escape(o)}</li>`).join("")}</ol><details><summary>展开答案与解析（审阅用）</summary><p>正确答案：${String.fromCharCode(65 + q.answer)}</p><p>${escape(q.explanation)}</p></details></article>`,
    )
    .join("");
  const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>图形题 · 一元一次方程审阅稿</title><style>*{box-sizing:border-box}body{margin:0;background:#f3f6fb;color:#192c48;font:16px/1.8 "Microsoft YaHei",sans-serif}main{max-width:920px;margin:auto;padding:24px}h1{font-size:30px}h2{font-size:22px}article,header{background:white;padding:28px;border-radius:16px;margin:20px 0}figure{margin:20px 0;background:#edf4ff;padding:12px;border-radius:12px}svg{display:block;width:100%;max-width:560px;margin:auto}figcaption,.muted{font-size:14px;color:#60718a}a,summary{color:#175cde}summary{cursor:pointer}li{padding:6px}header p{border-left:4px solid #e9b22e;padding-left:16px}@media(max-width:600px){main{padding:12px}article,header{padding:20px}h1{font-size:26px}}</style><main><header><h1>把条件画出来，再列方程。</h1><p>3 道自编图形题 · 待人工审阅，尚未作为正式课程发布。</p><a href="${pkg.id}.html">查看完整课程与15道练习</a></header>${body}</main></html>`;
  await mkdir("work/content-preview", { recursive: true });
  const out = resolve("work/content-preview", pkg.id + "-diagrams.html");
  await writeFile(out, html);
  console.log(`图形题审阅稿：${out}`);
}
main().catch(() => {
  console.error("图形题预览生成失败，请先校验内容包。");
  process.exitCode = 1;
});
