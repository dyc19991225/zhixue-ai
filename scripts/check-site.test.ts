import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { checkSite } from "./check-site.js";

test("巡检验证依赖、拒绝重定向与伪成功，并限制超时", async () => {
  let mode = "healthy";
  const server = createServer((request, response) => {
    if (mode === "timeout") return;
    if (mode === "redirect") {
      response.writeHead(302, { Location: "/login" });
      response.end();
      return;
    }
    if (request.url === "/dashboard")
      return void response.end('<div id="root"></div>');
    if (request.url === "/api/health")
      return void response.end(
        JSON.stringify({
          code: 0,
          data: { status: "ok", service: "zhixue-api" },
        }),
      );
    if (mode === "invalid") return void response.end("<html>success</html>");
    response.end(
      JSON.stringify({
        code: 0,
        data: {
          status: "ready",
          database: "connected",
          redis: mode === "cache-down" ? "development-memory" : "connected",
        },
      }),
    );
  });
  await new Promise<void>((accept) => server.listen(0, "127.0.0.1", accept));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const options = { origin: `http://127.0.0.1:${address.port}`, timeout: 300 };
  try {
    assert.equal((await checkSite(options)).healthy, true);
    for (const failure of ["cache-down", "redirect", "invalid", "timeout"]) {
      mode = failure;
      assert.equal((await checkSite(options)).healthy, false, failure);
    }
    await assert.rejects(checkSite({ origin: "http://example.com" }));
    await assert.rejects(
      checkSite({ origin: options.origin + "?secret=value" }),
    );
  } finally {
    server.closeAllConnections();
    await new Promise<void>((accept, reject) =>
      server.close((error) => (error ? reject(error) : accept())),
    );
  }
});
