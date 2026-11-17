import { Router } from "express";
import { ok } from "../lib/http";
import { catalogController } from "../controllers/catalog-controller";
import { courseController } from "../controllers/course-controller";
import { getDb } from "../lib/db";
import { HttpError } from "../lib/http";
import { checkRedis } from "../lib/rate-limiter";
export const apiRouter = Router();
apiRouter.get("/ready", async (_request, response) => {
  try {
    if (process.env.NODE_ENV === "production" && !process.env.REDIS_URL)
      throw new HttpError(503, "生产缓存尚未配置。");
    await Promise.all([
      getDb().user.count(),
      getDb().question.count(),
      getDb().mediaAsset.count(),
      getDb().aiTurn.count(),
      getDb().lessonQuestion.count(),
      getDb().schoolClass.count(),
      getDb().classStudent.count(),
      getDb().parentStudent.count(),
      getDb().homework.count(),
      getDb().homeworkRecipient.count(),
      getDb().homeworkSubmission.count(),
      getDb().exam.count(),
      getDb().examQuestion.count(),
      getDb().examRecipient.count(),
      getDb().examAttempt.count(),
      getDb().courseReview.count(),
      getDb().course.findFirst({ select: { ownerTeacherId: true } }),
      getDb().question.findFirst({
        select: { diagram: true, restrictToLessons: true },
      }),
    ]);
    if (process.env.REDIS_URL) await checkRedis();
    ok(response, {
      status: "ready",
      database: "connected",
      schema: "course-review-foundation",
      redis: process.env.REDIS_URL ? "connected" : "development-memory",
    });
  } catch {
    throw new HttpError(503, "数据库连接或迁移尚未就绪。");
  }
});
apiRouter.get("/health", (_request, response) => {
  ok(response, {
    status: "ok",
    service: "zhixue-api",
    mode: "prototype",
    database: "not-checked",
    redis: "not-connected",
  });
});
apiRouter.get("/catalog", catalogController);
apiRouter.get("/courses", courseController);
