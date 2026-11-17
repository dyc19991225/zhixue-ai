import { getDb } from "../lib/db";
import { HttpError } from "../lib/http";
export function activeMembershipWhere(userId: string) {
  const now = new Date();
  return {
    userId,
    revokedAt: null,
    startsAt: { lte: now },
    expiresAt: { gt: now },
    plan: { active: true },
  };
}
export async function hasMembership(userId: string) {
  return !!(await getDb().membership.findFirst({
    where: activeMembershipWhere(userId),
    select: { id: true },
  }));
}
export async function requireCourseEntitlement(userId: string, access: string) {
  if (access === "MEMBER" && !(await hasMembership(userId)))
    throw new HttpError(403, "这门课程需要有效会员权益。当前不提供在线购买。");
}
