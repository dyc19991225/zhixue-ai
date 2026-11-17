CREATE TYPE "CourseReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'RETURNED');
CREATE TABLE "course_reviews" (
  "id" TEXT NOT NULL,
  "course_id" TEXT NOT NULL,
  "content_hash" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "status" "CourseReviewStatus" NOT NULL DEFAULT 'PENDING',
  "submitted_by_id" TEXT NOT NULL,
  "submitted_by_name" TEXT NOT NULL,
  "submitted_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewer_id" TEXT,
  "reviewer_name" TEXT,
  "reviewed_at" TIMESTAMPTZ(3),
  "feedback" TEXT,
  "checks" JSONB,
  CONSTRAINT "course_reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "course_reviews_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "course_reviews_course_id_submitted_at_id_idx" ON "course_reviews"("course_id", "submitted_at", "id");
