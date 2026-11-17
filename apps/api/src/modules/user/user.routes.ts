import { Router } from "express";
import { rbac, requireAuth, requireSameOrigin } from "../../auth/middleware";
import { validate } from "../../middleware/validate";
import { changeRoleController, userOptionsController } from "./user.controller";
import { roleUpdateSchema, userOptionsSchema } from "./user.dto";

export const userRouter = Router();
userRouter.get(
  "/admin/user-options",
  requireAuth,
  rbac(["ADMIN"]),
  validate(userOptionsSchema, "query"),
  userOptionsController,
);
userRouter.patch(
  "/admin/users/:id/role",
  requireSameOrigin,
  requireAuth,
  rbac(["ADMIN"]),
  validate(roleUpdateSchema),
  changeRoleController,
);
