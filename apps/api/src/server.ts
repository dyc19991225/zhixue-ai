import { getPort } from "./config";
import { createApp } from "./app";
import { disconnectDb } from "./lib/db";
import { disconnectRedis } from "./lib/rate-limiter";
import { startExamWorker } from "./modules/exam/exam.worker";
const stopExamWorker = startExamWorker();
const server = createApp().listen(
  getPort(),
  process.env.API_HOST ?? "127.0.0.1",
  () => {
    console.log(`知学 API：http://127.0.0.1:${getPort()}`);
  },
);
server.on("error", () => {
  console.error("API 启动失败，请检查端口是否被占用。");
  process.exitCode = 1;
});
let closing = false;
async function shutdown() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await stopExamWorker();
    await disconnectDb();
    await disconnectRedis();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10000).unref();
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
