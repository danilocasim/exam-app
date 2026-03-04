-- AlterTable: add isSystem and archivedAt to QuestionSet
ALTER TABLE "QuestionSet" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "QuestionSet" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Seed system sets for all existing exam types
INSERT INTO "QuestionSet" ("id", "examTypeId", "name", "slug", "description", "isSystem", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  et."id",
  'Diagnostic',
  'diagnostic',
  'Core diagnostic test — assesses overall exam readiness across all domains.',
  true,
  NOW(),
  NOW()
FROM "ExamType" et
WHERE NOT EXISTS (
  SELECT 1 FROM "QuestionSet" qs
  WHERE qs."examTypeId" = et."id" AND qs."slug" = 'diagnostic'
);

INSERT INTO "QuestionSet" ("id", "examTypeId", "name", "slug", "description", "isSystem", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  et."id",
  'Set 1',
  'set-1',
  'Default question set for general practice.',
  true,
  NOW(),
  NOW()
FROM "ExamType" et
WHERE NOT EXISTS (
  SELECT 1 FROM "QuestionSet" qs
  WHERE qs."examTypeId" = et."id" AND qs."slug" = 'set-1'
);
