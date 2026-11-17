import { Router } from "express";
import { rbac, requireAuth, requireSameOrigin } from "../../auth/middleware";
import { validate } from "../../middleware/validate";
import {
  classCreateSchema,
  emptySchema,
  parentLinkSchema,
  parentLinksQuerySchema,
  memberUsernameSchema,
  relationPageSchema,
  teacherAssignmentSchema,
  teacherCourseRevisionSchema,
} from "./relations.dto";
import * as controller from "./relations.controller";
export const relationsRouter = Router();
const adminWrite = [requireSameOrigin, requireAuth, rbac(["ADMIN"])];
const classWrite = [requireSameOrigin, requireAuth, rbac(["ADMIN", "TEACHER"])];
relationsRouter.put(
  "/teacher/courses/:id/content",
  requireSameOrigin,
  requireAuth,
  rbac(["TEACHER"]),
  validate(teacherCourseRevisionSchema),
  controller.reviseTeacherCourse,
);
relationsRouter.get(
  "/admin/parent-links",
  requireAuth,
  rbac(["ADMIN"]),
  validate(parentLinksQuerySchema, "query"),
  controller.parentLinks,
);
relationsRouter.post(
  "/classes/:id/students",
  ...classWrite,
  validate(memberUsernameSchema),
  controller.addMemberByUsername,
);
relationsRouter.put(
  "/admin/courses/:id/teacher",
  ...adminWrite,
  validate(teacherAssignmentSchema),
  controller.assignTeacher,
);
relationsRouter.get(
  "/teacher/courses",
  requireAuth,
  rbac(["TEACHER"]),
  validate(relationPageSchema, "query"),
  controller.teacherCourses,
);
relationsRouter.get(
  "/teacher/courses/:id",
  requireAuth,
  rbac(["TEACHER"]),
  controller.teacherCourse,
);
relationsRouter.post(
  "/classes",
  ...classWrite,
  validate(classCreateSchema),
  controller.createClass,
);
relationsRouter.get(
  "/classes",
  requireAuth,
  rbac(["ADMIN", "TEACHER", "STUDENT"]),
  validate(relationPageSchema, "query"),
  controller.classes,
);
relationsRouter.get(
  "/classes/:id/students",
  requireAuth,
  rbac(["ADMIN", "TEACHER"]),
  validate(relationPageSchema, "query"),
  controller.roster,
);
relationsRouter.put(
  "/classes/:id/students/:studentId",
  ...classWrite,
  validate(emptySchema),
  controller.addMember,
);
relationsRouter.delete(
  "/classes/:id/students/:studentId",
  ...classWrite,
  controller.removeMember,
);
relationsRouter.delete("/classes/:id", ...classWrite, controller.archiveClass);
relationsRouter.post(
  "/admin/parent-links",
  ...adminWrite,
  validate(parentLinkSchema),
  controller.bindParent,
);
relationsRouter.delete(
  "/admin/parent-links/:parentId/:studentId",
  ...adminWrite,
  controller.unbindParent,
);
relationsRouter.get(
  "/parent/students",
  requireAuth,
  rbac(["PARENT"]),
  validate(relationPageSchema, "query"),
  controller.children,
);
relationsRouter.get(
  "/parent/students/:studentId/overview",
  requireAuth,
  rbac(["PARENT"]),
  controller.childOverview,
);
