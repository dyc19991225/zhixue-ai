import { randomBytes, randomUUID } from "node:crypto";
import { mkdir, open, unlink, stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import type { Request, Response } from "express";
import { getDb } from "../lib/db";
import { HttpError } from "../lib/http";
import { tokenHash } from "../auth/tokens";
import { learning } from "./learning-service";
export const mediaDirectory = () =>
  resolve(
    process.env.MEDIA_DIRECTORY ||
      fileURLToPath(new URL("../../../../.local-media/", import.meta.url)),
  );
const maxBytes = 200 * 1024 * 1024;
function displayFilename(header: string | undefined) {
  if (!header) return `视频 ${new Date().toLocaleString("zh-CN")}`;
  try {
    const name = decodeURIComponent(header)
      .replaceAll("\\", "/")
      .split("/")
      .at(-1)
      ?.trim();
    if (
      !name ||
      name.length > 180 ||
      !name.toLowerCase().endsWith(".mp4") ||
      Array.from(name).some(
        (c) => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127,
      )
    )
      throw new Error();
    return name;
  } catch {
    throw new HttpError(
      400,
      "视频文件名无效，请使用不超过 180 个字符的 MP4 文件名。",
    );
  }
}
export async function uploadMedia(req: Request) {
  const filename = displayFilename(req.get("x-file-name"));
  if (req.is("video/mp4") !== "video/mp4")
    throw new HttpError(415, "目前仅支持 MP4 视频。");
  if (Number(req.get("content-length") ?? 0) > maxBytes)
    throw new HttpError(413, "视频不能超过 200MB。");
  const storageKey = randomUUID() + ".mp4",
    path = resolve(mediaDirectory(), storageKey);
  await mkdir(mediaDirectory(), { recursive: true });
  const file = await open(path, "wx");
  let size = 0,
    header = Buffer.alloc(0);
  try {
    for await (const data of req) {
      const chunk = Buffer.from(data);
      size += chunk.length;
      if (size > maxBytes) throw new HttpError(413, "视频不能超过 200MB。");
      if (header.length < 12)
        header = Buffer.concat([header, chunk.subarray(0, 12 - header.length)]);
      await file.writeFile(chunk);
    }
    if (size < 12 || header.toString("ascii", 4, 8) !== "ftyp")
      throw new HttpError(415, "文件不符合 MP4 格式。");
    await file.close();
    return await getDb().mediaAsset.create({
      data: {
        filename,
        storageKey,
        size,
      },
      select: { id: true, filename: true, size: true, createdAt: true },
    });
  } catch (error) {
    await file.close().catch(() => {});
    await unlink(path).catch(() => {});
    throw error;
  }
}
export async function issuePlayback(
  userId: string,
  sessionId: string,
  courseId: string,
  lessonId: string,
  res: Response,
) {
  await learning(userId, courseId);
  const lesson = await getDb().lesson.findFirst({
    where: { id: lessonId, publishedAt: { not: null }, chapter: { courseId } },
    select: { mediaId: true },
  });
  if (!lesson?.mediaId) throw new HttpError(404, "这个课时尚未添加视频。");
  const token = randomBytes(32).toString("hex"),
    path = `/api/media/${lesson.mediaId}/content`;
  await getDb().playbackTicket.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  await getDb().playbackTicket.create({
    data: {
      tokenHash: tokenHash(token),
      userId,
      sessionId,
      lessonId,
      mediaId: lesson.mediaId,
      expiresAt: new Date(Date.now() + 30 * 60000),
    },
  });
  res.cookie("zhixue_media", token, {
    httpOnly: true,
    sameSite: "strict",
    secure:
      process.env.NODE_ENV === "production" ||
      process.env.AUTH_COOKIE_SECURE === "true",
    path,
    maxAge: 30 * 60000,
  });
  return { url: path, expiresIn: 1800 };
}
export function mediaRange(value: string | undefined, size: number) {
  if (!value) return { start: 0, end: size - 1, partial: false };
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2]))
    throw new HttpError(416, "视频分段范围无效。");
  const start = match[1]
    ? Number(match[1])
    : Math.max(0, size - Number(match[2]));
  const end =
    match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    throw new HttpError(416, "视频分段范围无效。");
  return { start, end, partial: true };
}
export async function streamMedia(req: Request, res: Response) {
  const cookie = req.cookies?.zhixue_media;
  if (typeof cookie !== "string")
    throw new HttpError(401, "请从课时页面加载视频。");
  const ticket = await getDb().playbackTicket.findUnique({
    where: { tokenHash: tokenHash(cookie) },
    include: { lesson: { include: { chapter: true } }, media: true },
  });
  if (
    !ticket ||
    ticket.expiresAt <= new Date() ||
    ticket.mediaId !== String(req.params.id) ||
    ticket.lesson.mediaId !== ticket.mediaId
  )
    throw new HttpError(401, "视频授权已过期，请重新加载视频。");
  const session = await getDb().authSession.findUnique({
    where: { id: ticket.sessionId },
    include: { user: true },
  });
  if (
    !session ||
    session.userId !== ticket.userId ||
    session.revokedAt ||
    session.expiresAt <= new Date() ||
    session.user.status !== "ACTIVE"
  )
    throw new HttpError(401, "登录已失效，请重新登录。");
  await learning(ticket.userId, ticket.lesson.chapter.courseId);
  const path = resolve(mediaDirectory(), ticket.media.storageKey);
  let size: number;
  try {
    size = (await stat(path)).size;
  } catch {
    throw new HttpError(404, "视频文件暂不可用。");
  }
  res.set({
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
    "Content-Type": "video/mp4",
    "Content-Disposition": "inline",
  });
  let range;
  try {
    range = mediaRange(req.get("range"), size);
  } catch (error) {
    res.set("Content-Range", `bytes */${size}`);
    throw error;
  }
  res
    .status(range.partial ? 206 : 200)
    .set("Content-Length", String(range.end - range.start + 1));
  if (range.partial)
    res.set("Content-Range", `bytes ${range.start}-${range.end}/${size}`);
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  try {
    await pipeline(
      createReadStream(path, { start: range.start, end: range.end }),
      res,
    );
  } catch {
    if (!res.headersSent) throw new HttpError(503, "视频读取失败。");
  }
}
