import "../config";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import {
  validateContentPackage,
  importContentPackage,
  contentId,
} from "./content-package";
import { getDb, disconnectDb } from "../lib/db";
const source = JSON.parse(
  await readFile(
    new URL(
      "../../../../content/courses/g7-math-linear-equations.v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const supplement = JSON.parse(
  await readFile(
    new URL(
      "../../../../content/courses/g7-gsm8k-applications.v1.json",
      import.meta.url,
    ),
    "utf8",
  ),
);

test("unit paper has unique scenario-correct choices including concept and error analysis", async () => {
  const pkg = validateContentPackage(
    JSON.parse(
      await readFile(
        new URL(
          "../../../../content/assessments/g7-math-linear-unit.v1.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  assert.equal(pkg.questions.length, 20);
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-10;
  const equations: Record<string, (x: number) => boolean> = {
    "negative-coefficient": (x) => -3 * x === 15,
    "both-sides-unit": (x) => 7 * x - 4 === 3 * x + 12,
    "negative-denominator": (x) => x / -4 === 3,
    "distribute-unit": (x) => 2 * (3 * x - 4) === 16,
    "minus-bracket": (x) => 9 - (2 * x - 3) === 4 * x,
    "two-fractions": (x) => close((x - 2) / 3 + (x + 1) / 2, 4),
    "rectangle-unit": (x) => 2 * (x + x + 3) === 26 && x > 0,
    segment: (x) => x + 5 === 18 && x > 0,
    "angles-unit": (x) => x + 72 === 180 && x > 0 && x < 180,
    "purchase-unit": (x) => 5 * x + 9 === 54 && x > 0,
    "discount-before": (x) => close((x - 10) * 0.8, 56) && x > 10,
    "catch-up-minutes": (x) => close(5 * x, 3 * (x + 1 / 3)) && x > 0,
    "meeting-unit": (x) => 4 * x + 5 * x === 45 && x > 0,
    "joint-work": (x) => close(x / 8 + x / 12, 1) && x > 0 && x < 8,
    "number-relation": (x) => x + (2 * x - 3) === 36 && 2 * x - 3 > x,
    "mixed-fractions": (x) => close((2 * x - 1) / 3 - (x + 2) / 4, 1),
  };
  const conceptual: Record<string, string> = {
    concept: "3x-2=7",
    "solution-check": "2x+1=7",
    "equality-rule": "a×c=b×c",
    "missing-multiplier": "常数项-1也应乘2",
  };
  for (const q of pkg.questions) {
    if (conceptual[q.key]) {
      assert.equal(q.options[q.answer], conceptual[q.key]);
      continue;
    }
    assert.ok(equations[q.key], q.key);
    const matches = q.options.flatMap((o, i) => {
      const [n, d] = o.split("/");
      return equations[q.key](Number(n) / Number(d ?? 1)) ? [i] : [];
    });
    assert.deepEqual(matches, [q.answer], q.key);
  }
  assert.deepEqual(
    [2 * 3 + 1 === 7, 3 + 2 === 7, 3 * 3 === 6, 4 * 3 - 1 === 7],
    [true, false, false, false],
  );
  assert.equal((13 + 3) / 2 - (13 - 1) / 3, 4);
  assert.equal(12 * 5 + 6, 15 * 5 - 9);
  assert.equal(2 * (10 - 3), 10 + 4);
  assert.notEqual(2 * (7 - 3), 7 + 4);
});

test("original modelling questions preserve scenario equations and unique answers", async () => {
  const pkg = validateContentPackage(
    JSON.parse(
      await readFile(
        new URL(
          "../../../../content/courses/g7-math-equation-models.v1.json",
          import.meta.url,
        ),
        "utf8",
      ),
    ),
  );
  const models: Record<string, (x: number) => boolean> = {
    "notebook-total": (x) => 3 * x + 8 === 38,
    "discount-order": (x) => Math.abs(0.8 * x - 6 - 42) < 1e-10,
    "money-before": (x) => x - 4 * 5 === 12,
    meeting: (x) => 4 * x + 6 * x === 35,
    "catch-up": (x) => 6 * x === 4 * (x + 0.5),
    "round-trip": (x) => Math.abs(x / 3 + x / 2 - 2.5) < 1e-10,
    "work-together": (x) => Math.abs(x / 6 + x / 3 - 1) < 1e-10,
    "work-after-one-day": (x) => Math.abs((1 + x) / 6 + x / 3 - 1) < 1e-10,
    machines: (x) => 30 * x + 45 * x === 300,
  };
  for (const q of pkg.questions) {
    assert.ok(models[q.key], q.key);
    const matches = q.options.flatMap((option, index) => {
      const [n, d] = option.split("/");
      const x = Number(n) / Number(d ?? 1);
      return x > 0 && models[q.key](x) ? [index] : [];
    });
    assert.deepEqual(matches, [q.answer], q.key);
  }
});

test("reviewed questions satisfy original expressions, geometry and licensed source answers", async () => {
  // Independent original expressions, not the package's normalized ax+b checks.
  const equations: Record<string, (x: number) => boolean> = {
    addition: (x) => x + 5 === 12,
    negative: (x) => 3 * x === -12,
    "two-steps": (x) => 2 * x - 3 === 7,
    "both-sides": (x) => 5 * x + 2 === 2 * x + 14,
    distribute: (x) => 3 * (x - 2) === 9,
    combine: (x) => 2 * (x + 3) - x === 10,
    "fraction-one": (x) => x / 3 + 1 === 4,
    "fraction-two": (x) => (x - 1) / 2 === (x + 3) / 3,
    notebooks: (x) => 3 * x + 2 === 23,
    rectangle: (x) => 2 * (x + 6) === 30 && x > 6,
    "coefficient-sign": (x) => -2 * x === 8,
    "figure-rectangle": (x) => 2 * (x + 5) === 24 && x > 5,
    "figure-segment": (x) => x + 4 === 12 && x > 0,
    "figure-adjacent": (x) => x + 60 === 180 && x > 0 && x < 180,
    "gsm8k-test-0013": (x) =>
      ((x * 2) / 3 - 2) / 2 === 5 && Number.isInteger(x),
    "gsm8k-test-0024": (x) => x * 0.75 === 19.5,
    "gsm8k-test-0025": (x) =>
      12 + 5 * 3 + 4 * 1.5 + 8.5 * x === 50 && Number.isInteger(x),
    "gsm8k-test-0028": (x) => 20 + x + 15 === 60,
    "gsm8k-test-0033": (x) =>
      x + (x - 30) === 110 && x - 30 >= 0 && Number.isInteger(x),
    "gsm8k-test-0046": (x) => 80 + x - 220 === 23 && Number.isInteger(x),
  };
  for (const pkg of [
    validateContentPackage(source),
    validateContentPackage(supplement),
  ]) {
    for (const q of pkg.questions) {
      if (q.key === "recognize") {
        assert.equal(q.options[q.answer], "2x + 3 = 7");
        continue;
      }
      assert.ok(equations[q.key], q.key);
      const matches = q.options.flatMap((option, index) =>
        equations[q.key](Number(option)) ? [index] : [],
      );
      assert.deepEqual(matches, [q.answer], q.key);
    }
  }
  const manifest = JSON.parse(
    await readFile(
      new URL(
        "../../../../content/sources/gsm8k/manifest.json",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const license = await readFile(
    new URL("../../../../content/sources/gsm8k/LICENSE", import.meta.url),
    "utf8",
  );
  for (const q of supplement.questions) {
    const record = manifest.records.find(
      (r: { key: string }) => r.key === q.key,
    );
    assert.ok(record);
    assert.equal(
      q.options[q.answer],
      record.original.answer.split("####").at(-1).trim(),
    );
    assert.ok(
      q.explanation
        .replaceAll("\r\n", "\n")
        .includes(license.replaceAll("\r\n", "\n").trim()),
    );
    assert.ok(q.explanation.includes(record.sourceUrl));
  }
  const figure = source.questions.find(
    (q: { key: string }) => q.key === "figure-rectangle",
  );
  assert.equal(figure.diagram.heightLabel, "5 厘米");
  assert.match(figure.diagram.note, /24厘米/);
});
test("content package checks arithmetic, unique keys and publication boundary", () => {
  const valid = validateContentPackage(source);
  assert.equal(valid.questions.length, source.questions.length);
  const wrong = structuredClone(source);
  wrong.questions[1].answer = 1;
  assert.throws(() => validateContentPackage(wrong), /校验结果/);
  const repeated = structuredClone(source);
  const almost = structuredClone(source);
  almost.questions[1].options[0] = "7.0000000001";
  assert.throws(() => validateContentPackage(almost), /校验结果/);
  repeated.course.chapters[1].lessons[0].key =
    repeated.course.chapters[0].lessons[0].key;
  assert.throws(() => validateContentPackage(repeated), /重复/);
  const promoted = structuredClone(source);
  promoted.editorialStatus = "PUBLISHED";
  assert.throws(() => validateContentPackage(promoted));
});
test(
  "content import is atomic, idempotent, draft-only and preserves edits",
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const db = getDb(),
      pkg = structuredClone(source),
      suffix = randomBytes(6).toString("hex");
    pkg.id = "qa-content-" + suffix;
    pkg.course.slug = "qa-content-" + suffix;
    const id = contentId(pkg.id, "course"),
      questionIds = pkg.questions.map((q: { key: string }) =>
        contentId(pkg.id, "question:" + q.key),
      );
    t.after(async () => {
      await db.question.deleteMany({ where: { id: { in: questionIds } } });
      await db.course.deleteMany({ where: { id } });
      await disconnectDb();
    });
    const imported = await importContentPackage(pkg);
    assert.equal(imported.createdQuestions, source.questions.length);
    assert.equal(imported.createdCourse, true);
    assert.equal(
      (await db.course.findUniqueOrThrow({ where: { id } })).status,
      "DRAFT",
    );
    assert.equal(
      await db.question.count({
        where: { id: { in: questionIds }, status: "PUBLISHED" },
      }),
      0,
    );
    await db.course.update({
      where: { id },
      data: { title: "人工修改后保留" },
    });
    await db.question.update({
      where: { id: questionIds[0] },
      data: { explanation: "人工修订解析" },
    });
    const repeat = await importContentPackage(pkg);
    assert.equal(repeat.createdQuestions, 0);
    assert.equal(repeat.createdCourse, false);
    assert.equal(
      (await db.course.findUniqueOrThrow({ where: { id } })).title,
      "人工修改后保留",
    );
    assert.equal(
      (await db.question.findUniqueOrThrow({ where: { id: questionIds[0] } }))
        .explanation,
      "人工修订解析",
    );
    const conflicting = structuredClone(pkg);
    conflicting.id = "qa-collision-" + suffix;
    await assert.rejects(() => importContentPackage(conflicting));
    assert.equal(
      await db.question.count({
        where: {
          id: {
            in: conflicting.questions.map((q: { key: string }) =>
              contentId(conflicting.id, "question:" + q.key),
            ),
          },
        },
      }),
      0,
    );
  },
);
