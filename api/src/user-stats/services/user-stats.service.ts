import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserStats } from '@prisma/client';

export interface UpsertUserStatsDto {
  totalExams: number;
  totalPractice: number;
  totalQuestions: number;
  totalTimeSpentMs: number;
  lastActivityAt?: Date | null;
  dailyQuizLastCompletedAt?: Date | null;
  missedQuizLastCompletedAt?: Date | null;
}

/**
 * Service for UserStats CRUD — merge-safe upsert prioritises the higher value
 * for each cumulative counter so offline work from multiple devices converges
 * correctly without data loss.
 */
@Injectable()
export class UserStatsService {
  constructor(private prisma: PrismaService) {}

  /** Get stats for a user, or return zeros if none recorded yet. */
  async getByUserId(userId: string): Promise<UserStats | null> {
    return this.prisma.userStats.findUnique({ where: { userId } });
  }

  /**
   * Upsert user stats using a MAX-merge strategy.
   *
   * Rule: each cumulative counter is set to MAX(existing, incoming).
   * This is safe for single-device use (always wins) and for the common
   * multi-device case where devices sync independently — the highest
   * counter seen wins.  lastActivityAt is kept as the most recent value.
   */
  async upsert(userId: string, dto: UpsertUserStatsDto): Promise<UserStats> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.userStats.findUnique({ where: { userId } });

      if (!existing) {
        return tx.userStats.create({
          data: {
            userId,
            totalExams: dto.totalExams,
            totalPractice: dto.totalPractice,
            totalQuestions: dto.totalQuestions,
            totalTimeSpentMs: dto.totalTimeSpentMs,
            lastActivityAt: dto.lastActivityAt ?? null,
            dailyQuizLastCompletedAt: dto.dailyQuizLastCompletedAt ?? null,
            missedQuizLastCompletedAt: dto.missedQuizLastCompletedAt ?? null,
          },
        });
      }

      // Take MAX of each counter so neither device's offline work is lost
      const totalTimeSpentMs = BigInt(dto.totalTimeSpentMs);

      // Helper: most-recent-wins merge for nullable DateTime fields
      const mergeDate = (
        incoming: Date | null | undefined,
        server: Date | null,
      ): Date | null => {
        if (incoming && server) return incoming > server ? incoming : server;
        return incoming ?? server;
      };

      return tx.userStats.update({
        where: { userId },
        data: {
          totalExams: Math.max(existing.totalExams, dto.totalExams),
          totalPractice: Math.max(existing.totalPractice, dto.totalPractice),
          totalQuestions: Math.max(existing.totalQuestions, dto.totalQuestions),
          totalTimeSpentMs:
            totalTimeSpentMs > existing.totalTimeSpentMs
              ? totalTimeSpentMs
              : existing.totalTimeSpentMs,
          // Keep the most recent activity timestamp
          lastActivityAt: mergeDate(
            dto.lastActivityAt,
            existing.lastActivityAt,
          ),
          // Keep the most recent cooldown timestamps (most-recent-wins)
          dailyQuizLastCompletedAt: mergeDate(
            dto.dailyQuizLastCompletedAt,
            existing.dailyQuizLastCompletedAt,
          ),
          missedQuizLastCompletedAt: mergeDate(
            dto.missedQuizLastCompletedAt,
            existing.missedQuizLastCompletedAt,
          ),
        },
      });
    });
  }
}
