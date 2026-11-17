import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "./app";
import { isInternalHref } from "@zhixue/shared";
const app = createApp();
test("navigation rejects external, protocol-relative and encoded backslash URLs", () => {
  for (const href of [
    "https://example.com",
    "//example.com",
    "/\\example.com",
    "/%5cexample.com",
    "/%255cexample.com",
    "javascript:alert(1)",
    "/%0a/path",
  ])
    assert.equal(isInternalHref(href), false, href);
  for (const href of ["/", "/courses/math?grade=高一", "#subjects"])
    assert.equal(isInternalHref(href), true, href);
});
test("unconfigured database returns 503 instead of pretending courses exist", async () => {
  const previous = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    const response = await request(app)
      .get("/api/courses")
      .query({ grade: "高一" })
      .expect(503);
    assert.equal(response.body.code, 503);
    assert.equal(response.body.data, null);
    assert.ok(!JSON.stringify(response.body).includes("postgresql://"));
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous;
  }
});
test("health reports application only, not database readiness", async () => {
  const response = await request(app).get("/api/health").expect(200);
  assert.equal(response.body.code, 0);
  assert.equal(response.body.data.database, "not-checked");
  assert.equal(response.headers["x-powered-by"], undefined);
});
test("catalog preserves grade and stage-specific subject names", async () => {
  const response = await request(app)
    .get("/api/catalog")
    .query({ grade: "高一" })
    .expect(200);
  assert.equal(response.body.data.mode, "preview");
  assert.equal(response.body.data.grade, "高一");
  const names = response.body.data.subjects.map(
    (s: { name: string }) => s.name,
  );
  assert.ok(names.includes("思想政治"));
  assert.ok(!names.includes("道德与法治"));
});
test("invalid or repeated grade parameters return a consistent 400", async () => {
  for (const path of [
    "/api/catalog",
    "/api/catalog?grade=bad",
    "/api/catalog?grade=高一&grade=高二",
    "/api/courses?grade=bad",
  ]) {
    const response = await request(app).get(encodeURI(path)).expect(400);
    assert.equal(response.body.code, 400);
    assert.equal(response.body.data, null);
  }
});
test("unknown API and unsupported methods return JSON 404 without a stack", async () => {
  const response = await request(app).post("/api/login").expect(404);
  assert.deepEqual(response.body, {
    code: 404,
    message: "接口不存在。",
    data: null,
  });
  assert.ok(!JSON.stringify(response.body).includes("stack"));
});
