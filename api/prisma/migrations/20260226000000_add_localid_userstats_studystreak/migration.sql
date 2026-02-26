-- Add localId for idempotent exam submissions
ALTER TABLE "ExamAttempt" ADD COLUMN "localId" TEXT;

-- Unique constraint: one submission per (userId, localId) pair
-- NULLS are not considered equal in PostgreSQL, so multiple NULL localIds are fine
-- (unsigned/anonymous exams won't have a localId).
CREATE UNIQUE INDEX "ExamAttempt_userId_localId_key"
  ON "ExamAttempt"("userId", "localId")
  WHERE "userId" IS NOT NULL AND "localId" IS NOT NULL;

-- Index for fast localId lookups
CREATE INDEX "ExamAttempt_localId_idx" ON "ExamAttempt"("localId");

-- UserStats: persisted aggregate metrics per user
CREATE TABLE "UserStats" (
    "id"               TEXT NOT NULL,
    "userId"           TEXT NOT NULL,
    "totalExams"       INTEGER NOT NULL DEFAULT 0,
    "totalPractice"    INTEGER NOT NULL DEFAULT 0,
    "totalQuestions"   INTEGER NOT NULL DEFAULT 0,
    "totalTimeSpentMs" BIGINT NOT NULL DEFAULT 0,
    "lastActivityAt"   TIMESTAMP(3),
    "updatedAt"        TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserStats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserStats_userId_key" ON "UserStats"("userId");

ALTER TABLE "UserStats"
  ADD CONSTRAINT "UserStats_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- StudyStreak: daily streak data per user
CREATE TABLE "StudyStreak" (
    "id"                 TEXT NOT NULL,
    "userId"             TEXT NOT NULL,
    "currentStreak"      INTEGER NOT NULL DEFAULT 0,
    "longestStreak"      INTEGER NOT NULL DEFAULT 0,
    "lastCompletionDate" TEXT,
    "examDate"           TEXT,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudyStreak_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StudyStreak_userId_key" ON "StudyStreak"("userId");

ALTER TABLE "StudyStreak"
  ADD CONSTRAINT "StudyStreak_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
