-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "diagram" JSONB;

-- CreateTable
CREATE TABLE "LessonQuestion" (
    "lessonId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "LessonQuestion_pkey" PRIMARY KEY ("lessonId","questionId")
);

-- CreateIndex
CREATE INDEX "LessonQuestion_questionId_idx" ON "LessonQuestion"("questionId");

-- AddForeignKey
ALTER TABLE "LessonQuestion" ADD CONSTRAINT "LessonQuestion_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "Lesson"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LessonQuestion" ADD CONSTRAINT "LessonQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
