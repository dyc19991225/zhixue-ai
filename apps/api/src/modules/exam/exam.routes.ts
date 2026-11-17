import { Router } from "express";
import { rbac, requireAuth, requireSameOrigin } from "../../auth/middleware";
import { validate } from "../../middleware/validate";
import * as dto from "./exam.dto";
import * as controller from "./exam.controller";
export const examRouter = Router();
const managers = [requireAuth, rbac(["ADMIN", "TEACHER"])],
  write = [requireSameOrigin, ...managers],
  student = [requireAuth, rbac(["STUDENT"])],
  studentWrite = [requireSameOrigin, ...student];
examRouter.post(
  "/exams/template-preview",
  ...write,
  validate(dto.examTemplateSchema),
  controller.previewTemplate,
);
examRouter.get(
  "/exams/question-options",
  ...managers,
  validate(dto.bankQuerySchema, "query"),
  controller.bank,
);
examRouter.get(
  "/exams",
  requireAuth,
  rbac(["ADMIN", "TEACHER", "STUDENT"]),
  validate(dto.examQuerySchema, "query"),
  controller.list,
);
examRouter.post(
  "/exams",
  ...write,
  validate(dto.examCreateSchema),
  controller.create,
);
examRouter.get(
  "/exams/:id",
  requireAuth,
  rbac(["ADMIN", "TEACHER", "STUDENT"]),
  controller.detail,
);
examRouter.put(
  "/exams/:id",
  ...write,
  validate(dto.examUpdateSchema),
  controller.update,
);
examRouter.patch(
  "/exams/:id/status",
  ...write,
  validate(dto.examStatusSchema),
  controller.status,
);
examRouter.post(
  "/exams/:id/attempt/start",
  ...studentWrite,
  validate(dto.startExamSchema),
  controller.start,
);
examRouter.get("/exams/:id/attempt", ...student, controller.attempt);
examRouter.put(
  "/exams/:id/attempt/answers",
  ...studentWrite,
  validate(dto.saveAnswersSchema),
  controller.save,
);
examRouter.post(
  "/exams/:id/attempt/submit",
  ...studentWrite,
  validate(dto.submitExamSchema),
  controller.submit,
);
examRouter.get(
  "/exams/:id/results",
  ...managers,
  validate(dto.examPageSchema, "query"),
  controller.results,
);
