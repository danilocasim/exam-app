-- AlterTable
ALTER TABLE "UserStats" ADD COLUMN     "dailyQuizLastCompletedAt" TIMESTAMP(3),
ADD COLUMN     "missedQuizLastCompletedAt" TIMESTAMP(3);
