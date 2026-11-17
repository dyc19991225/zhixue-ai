import { Router } from "express";
import { requireAuth, rbac } from "../../auth/middleware";
import { validate } from "../../middleware/validate";
import {
  analyticsQuerySchema,
  emptyQuerySchema,
  trendQuerySchema,
} from "./analytics.dto";
import * as controller from "./analytics.controller";
export const analyticsRouter = Router();
analyticsRouter.get(
  "/analytics/students/:studentId/tasks",
  requireAuth,
  rbac(["PARENT"]),
  validate(emptyQuerySchema, "query"),
  controller.childTasks,
);
analyticsRouter.get(
  "/analytics/teacher/tasks",
  requireAuth,
  rbac(["TEACHER"]),
  validate(emptyQuerySchema, "query"),
  controller.teachingTasks,
);
analyticsRouter.get(
  "/analytics/me/tasks",
  requireAuth,
  rbac(["STUDENT"]),
  validate(emptyQuerySchema, "query"),
  controller.tasks,
);
analyticsRouter.get(
  "/analytics/me/trend/export",
  requireAuth,
  rbac(["STUDENT"]),
  validate(trendQuerySchema, "query"),
  controller.exportMine,
);
analyticsRouter.get(
  "/analytics/students/:studentId/trend/export",
  requireAuth,
  rbac(["ADMIN", "PARENT"]),
  validate(trendQuerySchema, "query"),
  controller.exportStudent,
);
analyticsRouter.get(
  "/analytics/classes/:classId/trend/export",
  requireAuth,
  rbac(["ADMIN", "TEACHER"]),
  validate(trendQuerySchema, "query"),
  controller.exportClass,
);
analyticsRouter.get(
  "/analytics/me/trend",
  requireAuth,
  rbac(["STUDENT"]),
  validate(trendQuerySchema, "query"),
  controller.myTrend,
);
analyticsRouter.get(
  "/analytics/students/:studentId/trend",
  requireAuth,
  rbac(["ADMIN", "PARENT"]),
  validate(trendQuerySchema, "query"),
  controller.studentTrend,
);
analyticsRouter.get(
  "/analytics/classes/:classId/trend",
  requireAuth,
  rbac(["ADMIN", "TEACHER"]),
  validate(trendQuerySchema, "query"),
  controller.classTrend,
);
analyticsRouter.get(
  "/analytics/me",
  requireAuth,
  rbac(["STUDENT"]),
  validate(emptyQuerySchema, "query"),
  controller.me,
);
analyticsRouter.get(
  "/analytics/students/:studentId",
  requireAuth,
  rbac(["ADMIN", "PARENT"]),
  validate(emptyQuerySchema, "query"),
  controller.student,
);
analyticsRouter.get(
  "/analytics/classes/:classId",
  requireAuth,
  rbac(["ADMIN", "TEACHER"]),
  validate(analyticsQuerySchema, "query"),
  controller.schoolClass,
);
