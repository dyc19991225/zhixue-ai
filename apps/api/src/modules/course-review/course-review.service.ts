import { createHash } from "node:crypto";
import type {
  CourseReviewPage,
  CourseReviewRecord,
  CourseReviewSnapshot,
  CourseReviewQueue,
} from "@zhixue/shared";
import type { CourseReview } from "../../generated/prisma/client";
import { AppError } from "../../lib/http";
import { reviewRepository as repo } from "./course-review.repository";
import type { ReviewTransaction as Tx } from "./course-review.types";
import type { ReviewDecision, ReviewSubmit } from "./course-review.dto";
import { queueRecords, queueTransaction } from "./review-queue.repository";

export function reviewQueue(
  actorId: string,
  page: number,
  pageSize: number,
): Promise<CourseReviewQueue> {
  return queueTransaction(async (tx) => {
    const actor = await repo.actor(tx, actorId);
    if (!actor || actor.status !== "ACTIVE" || actor.role !== "ADMIN")
      throw new AppError(403, "仅管理员可查看课程审核队列。");
    const r = await queueRecords(tx, page, pageSize);
    const list: CourseReviewQueue["list"] = [];
    for (const row of r.rows) {
      const course = await repo.course(tx, row.courseId);
      if (!course) throw new AppError(409, "课程已变化，请刷新队列。");
      const versionCurrent = row.contentHash === hash(course);
      const submittedBySelf = row.submittedById === actorId;
      list.push({
        courseId: row.courseId,
        reviewId: row.reviewId,
        title: course.title,
        submittedAt: row.submittedAt.toISOString(),
        submittedByName: row.submittedByName,
        versionCurrent,
        submittedBySelf,
        canDecide: versionCurrent && !submittedBySelf,
      });
    }
    return { page, pageSize, total: r.total, list };
  });
}
type Course = NonNullable<Awaited<ReturnType<typeof repo.course>>>;
function snapshot(c: Course): CourseReviewSnapshot {
  return {
    title: c.title,
    slug: c.slug,
    grade: c.grade,
    subject: c.subject,
    access: c.access,
    description: c.description,
    region: c.region,
    textbookEdition: c.textbookEdition,
    term: c.term,
    chapters: c.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      position: ch.position,
      lessons: ch.lessons.map((l) => ({
        id: l.id,
        title: l.title,
        content: l.content,
        mediaId: l.mediaId,
        position: l.position,
      })),
    })),
  };
}
const hash = (c: Course) =>
  createHash("sha256")
    .update(JSON.stringify(snapshot(c)))
    .digest("hex");
const view = (r: CourseReview): CourseReviewRecord => ({
  ...r,
  submittedAt: r.submittedAt.toISOString(),
  reviewedAt: r.reviewedAt?.toISOString() ?? null,
  snapshot: r.snapshot as unknown as CourseReviewSnapshot,
  checks: r.checks as CourseReviewRecord["checks"],
});
function ready(c: Course) {
  if (
    !c.description?.trim() ||
    !c.chapters.length ||
    c.chapters.some(
      (ch) =>
        !ch.lessons.length ||
        ch.lessons.some((l) => !l.content?.trim() && !l.mediaId),
    )
  )
    throw new AppError(
      400,
      "提交审核或发布前，请填写简介并为每章添加有正文或视频的课时。",
    );
}
async function scope(
  tx: Tx,
  actorId: string,
  courseId: string,
  adminOnly = false,
) {
  await repo.lockActor(tx, actorId);
  const actor = await repo.actor(tx, actorId);
  if (
    !actor ||
    actor.status !== "ACTIVE" ||
    (adminOnly
      ? actor.role !== "ADMIN"
      : !["ADMIN", "TEACHER"].includes(actor.role))
  )
    throw new AppError(403, "无权操作课程审核。");
  await repo.lockCourse(tx, courseId);
  const course = await repo.course(tx, courseId);
  if (!course) throw new AppError(404, "课程不存在。");
  if (actor.role === "TEACHER" && course.ownerTeacherId !== actor.id)
    throw new AppError(403, "只能查看和提交自己负责的课程。");
  return { actor, course };
}
function editable(c: Course, updatedAt: string) {
  if (c.status !== "DRAFT") throw new AppError(409, "请先将课程转为草稿。");
  if (c.updatedAt.toISOString() !== updatedAt)
    throw new AppError(409, "课程已更新，请刷新后重试。");
}
export function reviews(
  actorId: string,
  courseId: string,
  page: number,
  pageSize: number,
): Promise<CourseReviewPage> {
  return repo.transaction(async (tx) => {
    const { course } = await scope(tx, actorId, courseId);
    const latest = await repo.latest(tx, courseId),
      contentHash = hash(course);
    return {
      page,
      pageSize,
      total: await repo.count(tx, courseId),
      list: (await repo.page(tx, courseId, page, pageSize)).map(view),
      current: {
        state: !latest
          ? "NOT_SUBMITTED"
          : latest.contentHash !== contentHash
            ? "STALE"
            : latest.status,
        contentHash,
        updatedAt: course.updatedAt.toISOString(),
        courseStatus: course.status,
        snapshot: snapshot(course),
        latest: latest ? view(latest) : null,
      },
    };
  });
}
export function submitReview(
  actorId: string,
  courseId: string,
  input: ReviewSubmit,
) {
  return repo.transaction(async (tx) => {
    const { actor, course } = await scope(tx, actorId, courseId);
    editable(course, input.updatedAt);
    ready(course);
    const contentHash = hash(course),
      latest = await repo.latest(tx, courseId);
    if (latest?.contentHash === contentHash && latest.status !== "RETURNED")
      throw new AppError(409, "当前内容已提交或通过审核，请查看审核记录。");
    return view(
      await repo.create(tx, {
        courseId,
        contentHash,
        snapshot: snapshot(course),
        submittedById: actor.id,
        submittedByName: actor.displayName,
      }),
    );
  });
}
export function decideReview(
  actorId: string,
  courseId: string,
  input: ReviewDecision,
) {
  return repo.transaction(async (tx) => {
    const { actor, course } = await scope(tx, actorId, courseId, true);
    editable(course, input.updatedAt);
    const latest = await repo.latest(tx, courseId);
    if (
      !latest ||
      latest.id !== input.reviewId ||
      latest.status !== "PENDING" ||
      latest.contentHash !== hash(course)
    )
      throw new AppError(409, "审核版本已失效或已有结论，请刷新并重新提交。");
    if (latest.submittedById === actor.id)
      throw new AppError(
        403,
        "提交人不能审核自己的提交，请由另一位管理员审核。",
      );
    return view(
      await repo.decide(tx, latest.id, {
        status: input.status,
        feedback: input.feedback,
        ...(input.status === "APPROVED" ? { checks: input.checks } : {}),
        reviewerId: actor.id,
        reviewerName: actor.displayName,
        reviewedAt: new Date(),
      }),
    );
  });
}
export function changeCourseStatus(
  actorId: string,
  courseId: string,
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED",
) {
  return repo.transaction(async (tx) => {
    const { course } = await scope(tx, actorId, courseId, true);
    if (status === "PUBLISHED") {
      ready(course);
      const latest = await repo.latest(tx, courseId);
      if (
        !latest ||
        latest.status !== "APPROVED" ||
        latest.contentHash !== hash(course)
      )
        throw new AppError(
          409,
          "当前课程内容尚未审核通过，或审核后内容已修改，请先完成审核。",
        );
    }
    return repo.setStatus(tx, courseId, status);
  });
}
