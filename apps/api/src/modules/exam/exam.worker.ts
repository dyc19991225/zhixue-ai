import { expireExamAttempts } from "./exam.service";
export function startExamWorker() {
  let busy = false;
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      await expireExamAttempts();
    } catch {
      console.error("考试超时结算暂未完成，将在下一周期重试。");
    } finally {
      busy = false;
    }
  };
  const timer = setInterval(() => {
    void tick();
  }, 5000);
  timer.unref();
  void tick();
  return async () => {
    clearInterval(timer);
    while (busy) await new Promise((resolve) => setTimeout(resolve, 20));
  };
}
