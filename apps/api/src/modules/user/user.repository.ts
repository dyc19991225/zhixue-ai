import { getDb } from "../../lib/db";
import { Prisma } from "../../generated/prisma/client";
import { AppError } from "../../lib/http";
import type { Role } from "@zhixue/shared";
import type { UserTransaction } from "./user.types";
import type { UserOptionsQuery } from "./user.dto";

export const userRepository = {
  async options({ role, q, id }: UserOptionsQuery) {
    const where = {
      role,
      status: "ACTIVE" as const,
      ...(id ? { id } : {}),
      ...(q
        ? {
            OR: [
              {
                username: {
                  contains: q.toLowerCase(),
                  mode: "insensitive" as const,
                },
              },
              { displayName: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    };
    const db = getDb();
    const [total, list] = await db.$transaction([
      db.user.count({ where }),
      db.user.findMany({
        where,
        take: 20,
        orderBy: { id: "asc" },
        select: { id: true, username: true, displayName: true, role: true },
      }),
    ]);
    return { page: 1, pageSize: 20, total, list };
  },
  async transaction<T>(work: (tx: UserTransaction) => Promise<T>) {
    try {
      return await getDb().$transaction(work, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const adapter = error.meta?.driverAdapterError as
          { cause?: { originalCode?: string } } | undefined;
        if (
          error.code === "P2034" ||
          (error.code === "P2010" &&
            ["40001", "40P01"].includes(adapter?.cause?.originalCode ?? ""))
        )
          throw new AppError(409, "用户权限正在变更，请刷新后重试。");
      }
      throw error;
    }
  },
  lock(tx: UserTransaction, actorId: string, targetId: string) {
    return tx.$queryRaw`SELECT id FROM "User" WHERE id IN (${actorId}, ${targetId}) ORDER BY id FOR UPDATE`;
  },
  find(tx: UserTransaction, id: string) {
    return tx.user.findUnique({ where: { id } });
  },
  activeAdminCount(tx: UserTransaction) {
    return tx.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
  },
  setRole(tx: UserTransaction, id: string, role: Role) {
    return tx.user.update({ where: { id }, data: { role } });
  },
  async clearTeaching(tx: UserTransaction, userId: string) {
    await tx.course.updateMany({
      where: { ownerTeacherId: userId },
      data: { ownerTeacherId: null },
    });
    await tx.schoolClass.updateMany({
      where: { teacherId: userId, archivedAt: null },
      data: { archivedAt: new Date() },
    });
  },
  async revokeStudentLinks(tx: UserTransaction, studentId: string) {
    await tx.classStudent.updateMany({
      where: { studentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await tx.parentStudent.updateMany({
      where: { studentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
  revokeParentLinks(tx: UserTransaction, parentId: string) {
    return tx.parentStudent.updateMany({
      where: { parentId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
  revokeSessions(tx: UserTransaction, userId: string) {
    return tx.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  },
  audit(
    tx: UserTransaction,
    actorUserId: string,
    targetUserId: string,
    from: Role,
    to: Role,
  ) {
    return tx.adminAuditLog.create({
      data: { actorUserId, targetUserId, action: `USER_ROLE_${from}_TO_${to}` },
    });
  },
};
