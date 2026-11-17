import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { verifyBundle } from "./backup-bundle.js";

test("联合备份校验拒绝文件修改、缺失、额外文件及目录逃逸清单", async () => {
  const directory = await mkdtemp(join(tmpdir(), "zhixue-bundle-test-"));
  const entry = (path: string, content: string) => ({
    path,
    bytes: Buffer.byteLength(content),
    sha256: createHash("sha256").update(content).digest("hex"),
  });
  try {
    await mkdir(join(directory, "media"));
    await writeFile(join(directory, "database.dump"), "synthetic-dump");
    await writeFile(join(directory, "media/video.mp4"), "synthetic-media");
    const files = [
      entry("database.dump", "synthetic-dump"),
      entry("media/video.mp4", "synthetic-media"),
    ];
    const manifest = join(directory, "manifest.json");
    await writeFile(manifest, JSON.stringify({ version: 1, files }));
    assert.equal((await verifyBundle(directory)).length, 2);
    await writeFile(join(directory, "media/video.mp4"), "changed");
    await assert.rejects(verifyBundle(directory), /完整性/);
    await writeFile(join(directory, "media/video.mp4"), "synthetic-media");
    await writeFile(join(directory, "extra"), "extra");
    await assert.rejects(verifyBundle(directory), /完整性/);
    await rm(join(directory, "extra"));
    await rm(join(directory, "database.dump"));
    await assert.rejects(verifyBundle(directory), /完整性/);
    await writeFile(
      manifest,
      JSON.stringify({ version: 1, files: [entry("../outside", "secret")] }),
    );
    await assert.rejects(verifyBundle(directory), /完整性/);
  } finally {
    await rm(directory, { recursive: true }); // Only this test's mkdtemp directory.
  }
});
