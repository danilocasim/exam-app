import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ExamAttempt, SyncStatus } from '@prisma/client';

export interface CreateExamAttemptDto {
  userId?: string; // Optional for unsigned users
  examTypeId: string;
  score: number;
  passed: boolean;
  duration: number;
  submittedAt?: Date;
  localId?: string; // Client-generated UUID for idempotent re-submission
  domainScores?: Array<{ domainId: string; correct: number; total: number }>;
}

export interface ExamAttemptFilter {
  userId?: string;
  examTypeId?: string;
  syncStatus?: SyncStatus;
  page?: number;
  limit?: number;
}

/**
 * Service for ExamAttempt CRUD operations and sync status management
 * Handles exam submissions, retrieval, and cloud sync tracking
 */
@Injectable()
export class ExamAttemptService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create (or idempotently upsert) an exam attempt.
   *
   * When a localId is provided and the (userId, localId) pair already exists
   * on the server, the existing record is returned unchanged.  This prevents
   * duplicate rows when the mobile client retries a submission after a network
   * timeout where the server had already persisted the first request.
   */
  async create(data: CreateExamAttemptDto): Promise<ExamAttempt> {
    // If we have a localId and userId, deduplicate manually — Prisma's upsert
    // generates ON CONFLICT without the WHERE predicate required by the partial
    // unique index, causing a PostgreSQL constraint-matching error.
    if (data.localId && data.userId) {
      const existing = await this.prisma.examAttempt.findFirst({
        where: { userId: data.userId, localId: data.localId },
      });

      if (existing) {
        // Backfill domainScores if the client is supplying them for the first time.
        if (data.domainScores && !existing.domainScores) {
          return this.prisma.examAttempt.update({
            where: { id: existing.id },
            data: { domainScores: data.domainScores },
          });
        }
        return existing;
      }

      return this.prisma.examAttempt.create({
        data: {
          userId: data.userId,
          examTypeId: data.examTypeId,
          score: data.score,
          passed: data.passed,
          duration: data.duration,
          submittedAt: data.submittedAt || new Date(),
          syncStatus: SyncStatus.PENDING,
          localId: data.localId,
          domainScores: data.domainScores ?? undefined,
        },
      });
    }

    // Anonymous / unsigned exams (no user association or localId) are created
    // as standalone rows; they are considered already "synced".
    return this.prisma.examAttempt.create({
      data: {
        userId: data.userId || undefined,
        examTypeId: data.examTypeId,
        score: data.score,
        passed: data.passed,
        duration: data.duration,
        submittedAt: data.submittedAt || new Date(),
        syncStatus: data.userId ? SyncStatus.PENDING : SyncStatus.SYNCED,
        localId: data.localId || undefined,
        domainScores: data.domainScores ?? undefined,
      },
    });
  }

  /**
   * Get exam attempts with pagination and filtering
   * @param filter - Filter options
   * @returns Array of exam attempts + pagination metadata
   */
  async findByUserId(
    userId: string,
    filter: ExamAttemptFilter = {},
  ): Promise<{
    data: ExamAttempt[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = filter.page || 1;
    const limit = Math.min(filter.limit || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    const where: any = { userId };
    if (filter.examTypeId) {
      where.examTypeId = filter.examTypeId;
    }
    if (filter.syncStatus) {
      where.syncStatus = filter.syncStatus;
    }

    const [data, total] = await Promise.all([
      this.prisma.examAttempt.findMany({
        where,
        orderBy: { submittedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.examAttempt.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get single exam attempt by ID
   * @param id - ExamAttempt primary key
   * @returns ExamAttempt or null if not found
   */
  async findById(id: string): Promise<ExamAttempt | null> {
    return this.prisma.examAttempt.findUnique({
      where: { id },
    });
  }

  /**
   * Mark exam attempt as synced to backend
   * @param id - ExamAttempt primary key
   * @returns Updated ExamAttempt
   */
  async markSynced(id: string): Promise<ExamAttempt> {
    return this.prisma.examAttempt.update({
      where: { id },
      data: {
        syncStatus: SyncStatus.SYNCED,
        syncedAt: new Date(),
        syncRetries: 0,
      },
    });
  }

  /**
   * Mark exam attempt as failed sync with retry tracking
   * @param id - ExamAttempt primary key
   * @param errorMessage - Optional error details
   * @returns Updated ExamAttempt
   */
  async markFailed(id: string, errorMessage?: string): Promise<ExamAttempt> {
    const attempt = await this.prisma.examAttempt.findUnique({
      where: { id },
    });

    if (!attempt) {
      throw new Error(`ExamAttempt not found: ${id}`);
    }

    // Increment retry count
    const newRetryCount = attempt.syncRetries + 1;

    return this.prisma.examAttempt.update({
      where: { id },
      data: {
        syncStatus: SyncStatus.FAILED,
        syncRetries: newRetryCount,
      },
    });
  }

  /**
   * Get pending exam attempts waiting for sync
   * Used by background sync processor
   * @param limit - Maximum records to fetch
   * @returns Array of pending ExamAttempts
   */
  async getPendingSync(limit: number = 100): Promise<ExamAttempt[]> {
    return this.prisma.examAttempt.findMany({
      where: {
        syncStatus: SyncStatus.PENDING,
        userId: { not: null }, // Only signed-in user exams
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  /**
   * Get failed sync attempts for retry
   * @param maxRetries - Only return attempts below this retry count
   * @param limit - Maximum records to fetch
   * @returns Array of failed ExamAttempts
   */
  async getFailedSync(
    maxRetries: number = 12,
    limit: number = 100,
  ): Promise<ExamAttempt[]> {
    return this.prisma.examAttempt.findMany({
      where: {
        syncStatus: SyncStatus.FAILED,
        userId: { not: null },
        syncRetries: { lt: maxRetries },
      },
      orderBy: { syncRetries: 'asc' },
      take: limit,
    });
  }

  /**
   * Update retry count for sync attempt
   * @param id - ExamAttempt primary key
   * @param retryCount - New retry count
   * @returns Updated ExamAttempt
   */
  async updateRetryCount(id: string, retryCount: number): Promise<ExamAttempt> {
    return this.prisma.examAttempt.update({
      where: { id },
      data: { syncRetries: retryCount },
    });
  }

  /**
   * Get analytics data for user
   * Aggregates all exam attempts for performance metrics
   * @param userId - User primary key
   * @param examTypeId - Optional filter by exam type
   * @returns Aggregated analytics
   */
  async getAnalytics(userId: string, examTypeId?: string) {
    const where: any = {
      userId,
      syncStatus: SyncStatus.SYNCED, // Only count synced exams
    };

    if (examTypeId) {
      where.examTypeId = examTypeId;
    }

    const attempts = await this.prisma.examAttempt.findMany({
      where,
    });

    if (attempts.length === 0) {
      return {
        totalAttempts: 0,
        totalPassed: 0,
        passRate: 0,
        averageScore: 0,
        averageDuration: 0,
      };
    }

    const totalPassed = attempts.filter((a) => a.passed).length;
    const totalScore = attempts.reduce((sum, a) => sum + a.score, 0);
    const totalDuration = attempts.reduce((sum, a) => sum + a.duration, 0);

    return {
      totalAttempts: attempts.length,
      totalPassed,
      passRate: totalPassed / attempts.length,
      averageScore: totalScore / attempts.length,
      averageDuration: Math.round(totalDuration / attempts.length),
    };
  }
}
