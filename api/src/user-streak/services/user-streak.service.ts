import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { StudyStreak } from '@prisma/client';

export interface UpsertStreakDto {
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string | null; // YYYY-MM-DD
  examDate: string | null; // YYYY-MM-DD
}

/**
 * Service for StudyStreak persistence.
 *
 * Merge rules on upsert:
 * - lastCompletionDate: keep the more recent date (client wins if newer)
 * - currentStreak: use the value from whichever device has the more recent
 *   completion date; if dates match, take the higher streak
 * - longestStreak: always MAX — never lose an all-time best
 * - examDate: keep client value if provided, otherwise preserve server value
 */
@Injectable()
export class UserStreakService {
  constructor(private prisma: PrismaService) {}

  async getByUserId(userId: string): Promise<StudyStreak | null> {
    return this.prisma.studyStreak.findUnique({ where: { userId } });
  }

  async upsert(userId: string, dto: UpsertStreakDto): Promise<StudyStreak> {
    const existing = await this.prisma.studyStreak.findUnique({ where: { userId } });

    if (!existing) {
      return this.prisma.studyStreak.create({
        data: {
          userId,
          currentStreak: dto.currentStreak,
          longestStreak: dto.longestStreak,
          lastCompletionDate: dto.lastCompletionDate,
          examDate: dto.examDate,
        },
      });
    }

    // Determine which completion date is more recent
    const clientDate = dto.lastCompletionDate;
    const serverDate = existing.lastCompletionDate;

    let newCurrent: number;
    let newLastDate: string | null;

    if (!clientDate && !serverDate) {
      newCurrent = Math.max(existing.currentStreak, dto.currentStreak);
      newLastDate = null;
    } else if (!serverDate || (clientDate && clientDate >= serverDate)) {
      // Client is more recent or server has no data → use client's current streak
      newCurrent = dto.currentStreak;
      newLastDate = clientDate;
    } else {
      // Server is more recent → keep server's current streak
      newCurrent = existing.currentStreak;
      newLastDate = serverDate;
    }

    return this.prisma.studyStreak.update({
      where: { userId },
      data: {
        currentStreak: newCurrent,
        longestStreak: Math.max(existing.longestStreak, dto.longestStreak),
        lastCompletionDate: newLastDate,
        // Client exam date wins if provided; otherwise preserve server value
        examDate: dto.examDate !== undefined ? dto.examDate : existing.examDate,
      },
    });
  }
}
