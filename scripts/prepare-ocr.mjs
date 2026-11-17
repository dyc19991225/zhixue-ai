import { cp, mkdir, readdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(root, "apps/web/public/ocr");
await mkdir(out, { recursive: true });
await cp(
  resolve(root, "content/sources/ocr/tessdata-LICENSE.txt"),
  resolve(out, "tessdata-LICENSE.txt"),
);
await mkdir(resolve(out, "core"), { recursive: true });
await mkdir(resolve(out, "lang"), { recursive: true });
for (const dependency of ["tesseract.js", "tesseract.js-core"])
  await cp(
    resolve(
      root,
      "node_modules",
      dependency,
      dependency === "tesseract.js" ? "LICENSE.md" : "LICENSE",
    ),
    resolve(out, `${dependency}-LICENSE.txt`),
  );
await cp(
  resolve(root, "node_modules/tesseract.js/dist/worker.min.js"),
  resolve(out, "worker.min.js"),
);
for (const name of await readdir(
  resolve(root, "node_modules/tesseract.js-core"),
)) {
  if (/^tesseract-core.*\.wasm(\.js)?$/.test(name))
    await cp(
      resolve(root, "node_modules/tesseract.js-core", name),
      resolve(out, "core", name),
    );
}
for (const lang of ["eng", "chi_sim"])
  await cp(
    resolve(
      root,
      `node_modules/@tesseract.js-data/${lang}/4.0.0/${lang}.traineddata.gz`,
    ),
    resolve(out, "lang", `${lang}.traineddata.gz`),
  );
console.log("本地OCR资源已准备（不使用外部CDN）。");
