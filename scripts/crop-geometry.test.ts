import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cropRectangle,
  fullCrop,
} from "../apps/web/src/features/practice/crop-geometry";
test("crop keeps pixels in image bounds and rejects empty/reversed/nonfinite boxes", () => {
  assert.deepEqual(cropRectangle(1000, 240, fullCrop), {
    x: 0,
    y: 0,
    width: 1000,
    height: 240,
  });
  assert.deepEqual(
    cropRectangle(1000, 240, { left: 10, top: 25, right: 90, bottom: 75 }),
    { x: 100, y: 60, width: 800, height: 120 },
  );
  const tiny = cropRectangle(3, 7, {
    left: 95,
    top: 95,
    right: 100,
    bottom: 100,
  });
  assert.equal(tiny.width, 1);
  assert.equal(tiny.height, 1);
  for (const box of [
    { left: 0, top: 0, right: 0, bottom: 100 },
    { left: 80, top: 0, right: 20, bottom: 100 },
    { left: -1, top: 0, right: 100, bottom: 100 },
    { left: 0, top: NaN, right: 100, bottom: 100 },
  ])
    assert.throws(() => cropRectangle(100, 100, box));
});
