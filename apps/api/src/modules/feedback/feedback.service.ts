import { getDb } from "../../lib/db";
import { HttpError } from "../../lib/http";
import { Prisma } from "../../generated/prisma/client";
import type { z } from "zod";
import type { submitSchema, listSchema, updateSchema } from "./feedback.dto";
const view = {
  id: true,
  area: true,
  severity: true,
  detail: true,
  status: true,
  reply: true,
  revision: true,
  createdAt: true,
  updatedAt: true,
} as const;
export async function submit(
  userId: string,
  input: z.infer<typeof submitSchema>,
) {
  const db = getDb();
  try {
    return await db.trialFeedback.create({
      data: { userId, ...input },
      select: view,
    });
  } catch (error) {
    if (
      !(error instanceof Prisma.PrismaClientKnownRequestError) ||
      error.code !== "P2002"
    )
      throw error;
    const prior = await db.trialFeedback.findUnique({
      where: { userId_requestId: { userId, requestId: input.requestId } },
    });
    if (
      !prior ||
      prior.area !== input.area ||
      prior.severity !== input.severity ||
      prior.detail !== input.detail
    )
      throw new HttpError(409, "提交标识已使用，请重新填写后提交。");
    return db.trialFeedback.findUniqueOrThrow({
      where: { id: prior.id },
      select: view,
    });
  }
}
export async function list(
  userId: string | undefined,
  input: z.infer<typeof listSchema>,
) {
  const where = {
    ...(userId ? { userId } : {}),
    ...(input.status ? { status: input.status } : {}),
  };
  const [total, items] = await getDb().$transaction([
    getDb().trialFeedback.count({ where }),
    getDb().trialFeedback.findMany({
      where,
      select: view,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (input.page - 1) * 20,
      take: 20,
    }),
  ]);
  return { items, total, page: input.page, pageSize: 20 };
}
export async function update(
  actorUserId: string,
  id: string,
  input: z.infer<typeof updateSchema>,
) {
  return getDb().$transaction(async (tx) => {
    const current = await tx.trialFeedback.findUnique({
      where: { id },
      select: { revision: true },
    });
    if (!current) throw new HttpError(404, "反馈不存在。");
    const changed = await tx.trialFeedback.updateMany({
      where: { id, revision: input.revision },
      data: {
        status: input.status,
        reply: input.reply,
        revision: { increment: 1 },
      },
    });
    if (!changed.count)
      throw new HttpError(409, "反馈已被更新，请刷新后重新处理。");
    await tx.feedbackChange.create({
      data: {
        feedbackId: id,
        actorUserId,
        status: input.status,
        reply: input.reply,
        revision: input.revision + 1,
      },
    });
    return tx.trialFeedback.findUniqueOrThrow({ where: { id }, select: view });
  });
}
