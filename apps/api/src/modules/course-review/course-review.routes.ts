import { Router } from "express";
import { requireAuth, requireSameOrigin, rbac } from "../../auth/middleware";
import { validate } from "../../middleware/validate";
import * as dto from "./course-review.dto";
import * as controller from "./course-review.controller";
export const courseReviewRouter = Router();
courseReviewRouter.get(
  "/admin/course-review-queue",
  requireAuth,
  rbac(["ADMIN"]),
  validate(dto.reviewQueueSchema, "query"),
  controller.queue,
);
const managers = [requireAuth, rbac(["ADMIN", "TEACHER"])];
courseReviewRouter.get(
  "/courses/:id/reviews",
  ...managers,
  validate(dto.reviewPageSchema, "query"),
  controller.list,
);
courseReviewRouter.post(
  "/courses/:id/reviews",
  requireSameOrigin,
  ...managers,
  validate(dto.reviewSubmitSchema),
  controller.submit,
);
courseReviewRouter.post(
  "/courses/:id/reviews/decision",
  requireSameOrigin,
  requireAuth,
  rbac(["ADMIN"]),
  validate(dto.reviewDecisionSchema),
  controller.decide,
);
