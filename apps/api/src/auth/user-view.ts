import type { User } from "../generated/prisma/client";
export function userView(user: User) {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    grade: user.grade,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
