import { Prisma } from "../../generated/prisma/client";
import { getDb } from "../../lib/db";
import type { ReviewTransaction as Tx } from "./course-review.types";

export function queueTransaction<T>(work: (tx: Tx) => Promise<T>) {
  return getDb().$transaction(work, {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    timeout: 20000,
  });
}
export async function queueRecords(tx: Tx, page: number, pageSize: number) {
  // A historical pending record must not reappear after a newer decision/submission.
  const predicate = Prisma.sql`
    FROM "course_reviews" r JOIN "Course" c ON c.id = r.course_id
    WHERE c.status = 'DRAFT' AND r.status = 'PENDING'
      AND NOT EXISTS (
        SELECT 1 FROM "course_reviews" newer WHERE newer.course_id = r.course_id
          AND (newer.submitted_at > r.submitted_at
            OR (newer.submitted_at = r.submitted_at AND newer.id > r.id))
      )`;
  const [count, rows] = await Promise.all([
    tx.$queryRaw<{ total: bigint }[]>(
      Prisma.sql`SELECT COUNT(*) AS total ${predicate}`,
    ),
    tx.$queryRaw<
      {
        courseId: string;
        reviewId: string;
        submittedAt: Date;
        submittedById: string;
        submittedByName: string;
        contentHash: string;
      }[]
    >(Prisma.sql`
      SELECT r.course_id AS "courseId", r.id AS "reviewId", r.submitted_at AS "submittedAt",
        r.submitted_by_id AS "submittedById", r.submitted_by_name AS "submittedByName", r.content_hash AS "contentHash"
      ${predicate} ORDER BY r.submitted_at ASC, r.id ASC LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`),
  ]);
  return { total: Number(count[0].total), rows };
}
