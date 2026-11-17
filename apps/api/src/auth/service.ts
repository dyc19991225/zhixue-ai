import bcrypt from "bcrypt";
import { randomBytes, randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client";
import { getDb } from "../lib/db";
import { HttpError } from "../lib/http";
import { issueTokens, tokenHash, verifyToken, REFRESH_SECONDS } from "./tokens";
import { userView } from "./user-view";
import {
  registerSchema,
  loginSchema,
  recoverySchema,
  passphraseSchema,
  profileSchema,
  parseInput,
} from "./validation";

let dummyHash: Promise<string> | undefined;
async function beginSession(userId: string, expectedHash: string) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_SECONDS * 1000);
  const tokens = await issueTokens(userId, id, expiresAt);
  await getDb().$transaction(async (tx) => {
    // 锁定同一用户行；与改密/停用串行，防止旧密码验证完成后另建会话。
    const checked = await tx.user.updateMany({
      where: { id: userId, passwordHash: expectedHash, status: "ACTIVE" },
      data: { updatedAt: new Date() },
    });
    if (checked.count !== 1)
      throw new HttpError(401, "账户状态已变化，请重新登录。");
    await tx.authSession.create({
      data: {
        id,
        userId,
        expiresAt,
        refreshTokenHash: tokenHash(tokens.refreshToken),
      },
    });
  });
  return tokens;
}
export async function register(value: unknown) {
  const input = parseInput(registerSchema, value);
  const userId = randomUUID(),
    sessionId = randomUUID();
  const expiresAt = new Date(Date.now() + REFRESH_SECONDS * 1000);
  const tokens = await issueTokens(userId, sessionId, expiresAt);
  const recoveryCode = randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(input.passphrase, 12);
  try {
    const user = await getDb().$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          id: userId,
          username: input.username,
          displayName: input.displayName,
          grade: input.grade,
          passwordHash,
          recoveryCodeHash: tokenHash(recoveryCode),
        },
      });
      await tx.authSession.create({
        data: {
          id: sessionId,
          userId,
          expiresAt,
          refreshTokenHash: tokenHash(tokens.refreshToken),
        },
      });
      return created;
    });
    return {
      user: userView(user),
      ...tokens,
      recoveryCode,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new HttpError(409, "这个账号已被使用，请换一个。");
    throw error;
  }
}
export async function login(value: unknown) {
  const input = parseInput(loginSchema, value);
  const user = await getDb().user.findUnique({
    where: { username: input.username },
  });
  dummyHash ??= bcrypt.hash(randomBytes(24).toString("hex"), 12);
  const matches = await bcrypt.compare(
    input.passphrase,
    user?.passwordHash ?? (await dummyHash),
  );
  if (!user || !matches || user.status !== "ACTIVE")
    throw new HttpError(401, "账号或密码不正确，或账号暂不可用。");
  return {
    user: userView(user),
    ...(await beginSession(user.id, user.passwordHash)),
  };
}
export async function refresh(value: string) {
  const claims = await verifyToken(value, "refresh");
  const db = getDb();
  const session = await db.authSession.findUnique({
    where: { id: claims.sessionId },
    include: { user: true },
  });
  if (
    !session ||
    session.userId !== claims.userId ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE"
  )
    throw new HttpError(401, "登录已失效，请重新登录。");
  const tokens = await issueTokens(
    session.userId,
    session.id,
    session.expiresAt,
  );
  const result = await db.authSession.updateMany({
    where: {
      id: session.id,
      refreshTokenHash: tokenHash(value),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    data: {
      refreshTokenHash: tokenHash(tokens.refreshToken),
      lastUsedAt: new Date(),
    },
  });
  if (result.count !== 1) {
    // 已使用令牌再次出现，撤销同一会话，阻止旧令牌继续换取 access token。
    await db.authSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new HttpError(401, "会话验证失败，请重新登录。");
  }
  return { user: userView(session.user), ...tokens };
}
export async function logout(value: string | undefined) {
  if (!value) return;
  try {
    const claims = await verifyToken(value, "refresh");
    await getDb().authSession.updateMany({
      where: { id: claims.sessionId, userId: claims.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  } catch (error) {
    if (!(error instanceof HttpError && error.status === 401)) throw error;
  }
}
export async function revokeAll(userId: string) {
  await getDb().authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
export async function updateProfile(userId: string, value: unknown) {
  const data = parseInput(profileSchema, value);
  return userView(await getDb().user.update({ where: { id: userId }, data }));
}
export async function changePassword(userId: string, value: unknown) {
  const input = parseInput(passphraseSchema, value);
  const db = getDb();
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await bcrypt.compare(input.currentPassword, user.passwordHash)))
    throw new HttpError(400, "当前密码不正确。");
  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await db.$transaction(async (tx) => {
    const changed = await tx.user.updateMany({
      where: { id: user.id, passwordHash: user.passwordHash, status: "ACTIVE" },
      data: { passwordHash },
    });
    if (changed.count !== 1)
      throw new HttpError(409, "账户状态发生变化，请重新登录。");
    await tx.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
}
export async function recoverAccount(value: unknown) {
  const input = parseInput(recoverySchema, value);
  const db = getDb();
  const user = await db.user.findUnique({
    where: { username: input.username },
  });
  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.recoveryCodeHash !== tokenHash(input.recoveryCode)
  )
    throw new HttpError(400, "账号或恢复码无效。");
  const recoveryCode = randomBytes(32).toString("hex");
  const passwordHash = await bcrypt.hash(input.newPassword, 12);
  await db.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: {
        id: user.id,
        recoveryCodeHash: tokenHash(input.recoveryCode),
        status: "ACTIVE",
      },
      data: { passwordHash, recoveryCodeHash: tokenHash(recoveryCode) },
    });
    if (updated.count !== 1) throw new HttpError(400, "账号或恢复码无效。");
    await tx.authSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  });
  return { recoveryCode };
}
