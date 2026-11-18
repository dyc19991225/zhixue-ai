CREATE TABLE "LearningReviewRound" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "total" INTEGER NOT NULL,
  "correct" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "LearningReviewRound_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "LearningReviewRound_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LearningReviewRound_userId_idx" ON "LearningReviewRound"("userId");

CREATE TABLE "LearningReviewRoundItem" (
  "roundId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "correctAt" TIMESTAMP(3),
  CONSTRAINT "LearningReviewRoundItem_pkey" PRIMARY KEY ("roundId", "questionId"),
  CONSTRAINT "LearningReviewRoundItem_roundId_fkey" FOREIGN KEY ("roundId")
    REFERENCES "LearningReviewRound"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LearningReviewRoundItem_questionId_fkey" FOREIGN KEY ("questionId")
    REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "LearningReviewRoundItem_questionId_idx" ON "LearningReviewRoundItem"("questionId");

ALTER TABLE "QuestionAttempt" ADD COLUMN "reviewRoundId" TEXT;
