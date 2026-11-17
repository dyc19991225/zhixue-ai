import { test } from "node:test";
import assert from "node:assert/strict";
import { resolve } from "node:path";
import { createWorker, OEM } from "tesseract.js";

test(
  "local OCR recognizes synthetic printed Chinese and algebra without a model provider",
  { timeout: 60000 },
  async () => {
    const worker = await createWorker(["chi_sim", "eng"], OEM.LSTM_ONLY, {
      langPath: resolve("apps/web/public/ocr/lang"),
      cacheMethod: "none",
    });
    try {
      const result = await worker.recognize(
        resolve("apps/web/test-fixtures/ocr-printed.png"),
      );
      const compact = result.data.text.replace(/\s+/g, "");
      assert.ok(
        compact.includes("3x+2=11"),
        "printed equation must be readable",
      );
      assert.ok(
        compact.includes("求解方程"),
        "printed Chinese must be readable",
      );
    } finally {
      await worker.terminate();
    }
  },
);
