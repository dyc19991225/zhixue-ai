import { test } from "node:test";
import assert from "node:assert/strict";
import {
  rotatedSize,
  enhanceText,
} from "../apps/web/src/features/practice/photo-correction";

test("photo correction retains rotated corners, rejects invalid inputs and preserves alpha", () => {
  for (const angle of [-15, -5, 0, 5, 15]) {
    const { width, height } = rotatedSize(1000, 720, angle);
    const radians = (angle * Math.PI) / 180;
    for (const x of [-500, 500])
      for (const y of [-360, 360]) {
        assert.ok(
          Math.abs(x * Math.cos(radians) - y * Math.sin(radians)) <= width / 2,
        );
        assert.ok(
          Math.abs(x * Math.sin(radians) + y * Math.cos(radians)) <= height / 2,
        );
      }
  }
  for (const invalid of [NaN, Infinity, 16, -16])
    assert.throws(() => rotatedSize(1000, 720, invalid));
  assert.throws(() => rotatedSize(0, 720, 0));
  const pixels = new Uint8ClampedArray([
    30, 30, 30, 128, 220, 220, 220, 255, 0, 0, 0, 255, 255, 255, 255, 255,
  ]);
  enhanceText(pixels);
  assert.ok(pixels[0] < 30 && pixels[4] > 220);
  assert.equal(pixels[3], 128);
  assert.equal(pixels[7], 255);
  assert.equal(pixels[8], 0);
  assert.equal(pixels[12], 255);
});
