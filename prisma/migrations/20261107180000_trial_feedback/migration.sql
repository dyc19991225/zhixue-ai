CREATE TYPE "FeedbackStatus" AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED');
CREATE TABLE "TrialFeedback" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "requestId" TEXT NOT NULL,
  "area" TEXT NOT NULL, "severity" TEXT NOT NULL, "detail" TEXT NOT NULL,
  "status" "FeedbackStatus" NOT NULL DEFAULT 'NEW', "reply" TEXT NOT NULL DEFAULT '',
  "revision" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "TrialFeedback_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TrialFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "TrialFeedback_userId_requestId_key" ON "TrialFeedback"("userId", "requestId");
CREATE INDEX "TrialFeedback_userId_createdAt_id_idx" ON "TrialFeedback"("userId", "createdAt", "id");
CREATE INDEX "TrialFeedback_status_createdAt_id_idx" ON "TrialFeedback"("status", "createdAt", "id");
CREATE TABLE "FeedbackChange" (
  "id" TEXT NOT NULL, "feedbackId" TEXT NOT NULL, "actorUserId" TEXT NOT NULL,
  "status" "FeedbackStatus" NOT NULL, "reply" TEXT NOT NULL, "revision" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "FeedbackChange_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FeedbackChange_feedbackId_fkey" FOREIGN KEY ("feedbackId") REFERENCES "TrialFeedback"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FeedbackChange_feedbackId_revision_key" ON "FeedbackChange"("feedbackId", "revision");
