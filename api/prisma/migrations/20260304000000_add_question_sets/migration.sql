-- CreateTable
CREATE TABLE "QuestionSet" (
    "id" TEXT NOT NULL,
    "examTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionSet_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Question" ADD COLUMN "set" TEXT;

-- CreateIndex
CREATE INDEX "QuestionSet_examTypeId_idx" ON "QuestionSet"("examTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionSet_examTypeId_slug_key" ON "QuestionSet"("examTypeId", "slug");

-- CreateIndex
CREATE INDEX "Question_set_idx" ON "Question"("set");

-- CreateIndex
CREATE INDEX "Question_examTypeId_set_idx" ON "Question"("examTypeId", "set");

-- AddForeignKey
ALTER TABLE "QuestionSet" ADD CONSTRAINT "QuestionSet_examTypeId_fkey" FOREIGN KEY ("examTypeId") REFERENCES "ExamType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
