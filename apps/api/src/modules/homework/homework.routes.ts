import { Router } from "express";
import { rbac, requireAuth, requireSameOrigin } from "../../auth/middleware";
import { validate } from "../../middleware/validate";
import * as dto from "./homework.dto";
import * as controller from "./homework.controller";
export const homeworkRouter = Router();
const managers = [requireAuth, rbac(["ADMIN", "TEACHER"])];
const writers = [requireSameOrigin, ...managers];
homeworkRouter.get(
  "/homework",
  requireAuth,
  rbac(["ADMIN", "TEACHER", "STUDENT"]),
  validate(dto.homeworkQuerySchema, "query"),
  controller.list,
);
homeworkRouter.post(
  "/homework",
  ...writers,
  validate(dto.homeworkCreateSchema),
  controller.create,
);
homeworkRouter.get(
  "/homework/:id",
  requireAuth,
  rbac(["ADMIN", "TEACHER", "STUDENT"]),
  controller.detail,
);
homeworkRouter.put(
  "/homework/:id",
  ...writers,
  validate(dto.homeworkUpdateSchema),
  controller.update,
);
homeworkRouter.patch(
  "/homework/:id/status",
  ...writers,
  validate(dto.homeworkStatusSchema),
  controller.status,
);
homeworkRouter.post(
  "/homework/:id/submissions",
  requireSameOrigin,
  requireAuth,
  rbac(["STUDENT"]),
  validate(dto.homeworkSubmitSchema),
  controller.submit,
);
homeworkRouter.get(
  "/homework/:id/submissions",
  ...managers,
  validate(dto.homeworkPageSchema, "query"),
  controller.submissions,
);
homeworkRouter.post(
  "/homework/:id/submissions/:submissionId/grade",
  ...writers,
  validate(dto.homeworkGradeSchema),
  controller.grade,
);
