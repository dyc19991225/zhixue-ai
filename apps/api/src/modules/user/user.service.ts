import { AppError } from "../../lib/http";
import { Prisma } from "../../generated/prisma/client";
import { userView } from "../../auth/user-view";
import type { RoleUpdate } from "./user.dto";
import { userRepository as users } from "./user.repository";

export async function changeUserRole(
  actorId: string,
  targetId: string,
  input: RoleUpdate,
) {
  if (actorId === targetId) throw new AppError(400, "不能修改自己的角色。");
  try {
    return await users.transaction(async (tx) => {
      await users.lock(tx, actorId, targetId);
      const actor = await users.find(tx, actorId);
      if (actor?.role !== "ADMIN" || actor.status !== "ACTIVE")
        throw new AppError(403, "管理员权限已失效。");
      const target = await users.find(tx, targetId);
      if (!target) throw new AppError(404, "用户不存在。");
      if (target.updatedAt.toISOString() !== input.updatedAt)
        throw new AppError(409, "用户信息已更新，请刷新后重试。");
      if (target.role === input.role) return userView(target);
      if (
        target.role === "ADMIN" &&
        target.status === "ACTIVE" &&
        input.role !== "ADMIN" &&
        (await users.activeAdminCount(tx)) <= 1
      )
        throw new AppError(400, "不能移除最后一个有效管理员。");
      if (target.role === "TEACHER") await users.clearTeaching(tx, targetId);
      if (target.role === "STUDENT")
        await users.revokeStudentLinks(tx, targetId);
      if (target.role === "PARENT") await users.revokeParentLinks(tx, targetId);
      const updated = await users.setRole(tx, targetId, input.role);
      await users.revokeSessions(tx, targetId);
      await users.audit(tx, actorId, targetId, target.role, input.role);
      return userView(updated);
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    )
      throw new AppError(409, "用户权限正在变更，请刷新后重试。");
    throw error;
  }
}
