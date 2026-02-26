// eslint-disable-next-line @typescript-eslint/no-require-imports
const getAxios = () => require('axios').default ?? require('axios');
import * as ExamSubmissionRepo from '../storage/repositories/exam-submission.repository';
import { getAPIURL } from '../config';

export interface ExamAttempt {
  id?: string;
  userId?: string;
  examTypeId: string;
  score: number;
  passed: boolean;
  duration: number; // Seconds
  submittedAt?: Date;
  createdAt?: Date;
  syncStatus?: 'PENDING' | 'SYNCED' | 'FAILED';
  syncRetries?: number;
  syncedAt?: Date;
}

export interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors?: Array<{ id: string; error: string }>;
}

/**
 * Mobile ExamAttempt Service
 * Handles local storage of exam submissions and cloud sync
 * Offline-first: All submissions stored locally, synced when connection available
 */
export class ExamAttemptService {
  constructor(private apiUrl: string = getAPIURL()) {}

  /**
   * Submit exam attempt (local storage)
   * Stored with PENDING status for later cloud sync
   * @param attempt - Exam submission data
   * @returns Stored attempt with local ID
   */
  async submitExam(attempt: ExamAttempt): Promise<ExamAttempt> {
    // Generate a stable UUID for this submission — also used as localId so the
    // server can deduplicate retried HTTP requests.
    const id = attempt.id || `local-${Date.now()}-${Math.random()}`;

    const storedAttempt: ExamSubmissionRepo.ExamSubmission = {
      id,
      userId: attempt.userId,
      examTypeId: attempt.examTypeId,
      score: attempt.score,
      passed: attempt.passed,
      duration: attempt.duration,
      submittedAt: attempt.submittedAt || new Date(),
      createdAt: new Date(),
      syncStatus: 'PENDING',
      syncRetries: 0,
      localId: id, // Reused as idempotency key for the server
    };

    // Store in local database
    await ExamSubmissionRepo.saveExamSubmission(storedAttempt);

    return storedAttempt;
  }

  /**
   * Get all exam attempts from local storage
   * @returns Array of stored exam attempts
   */
  async getLocalAttempts(): Promise<ExamAttempt[]> {
    const submissions = await ExamSubmissionRepo.getAllExamSubmissions();
    return submissions as ExamAttempt[];
  }

  /**
   * Get pending exam attempts waiting for sync
   * @returns Array of PENDING exam attempts
   */
  async getPendingAttempts(): Promise<ExamAttempt[]> {
    const submissions = await ExamSubmissionRepo.getPendingExamSubmissions();
    return submissions as ExamAttempt[];
  }

  /**
   * Get failed exam attempts for retry
   * @returns Array of FAILED exam attempts
   */
  async getFailedAttempts(): Promise<ExamAttempt[]> {
    const submissions = await ExamSubmissionRepo.getFailedExamSubmissions();
    return submissions as ExamAttempt[];
  }

  /**
   * Sync pending exam attempts with cloud
   * Called when network connection is available
   * Uses offline-first strategy: retry until success
   * @returns Sync result with counts
   */
  async syncPendingAttempts(userId?: string): Promise<SyncResult> {
    const pending = await this.getPendingAttempts();

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    // If no user ID, can't sync to cloud (only store locally)
    if (!userId) {
      console.log('[ExamAttemptService] No user ID, keeping exams local only');
      return result;
    }

    for (const attempt of pending) {
      try {
        // Send to cloud API — include localId for server-side idempotency
        await getAxios().post(
          `${this.apiUrl}/exam-attempts/submit-authenticated`,
          {
            examTypeId: attempt.examTypeId,
            score: attempt.score,
            passed: attempt.passed,
            duration: attempt.duration,
            submittedAt: attempt.submittedAt,
            localId: (attempt as ExamSubmissionRepo.ExamSubmission).localId,
          },
          {
            headers: {
              Authorization: `Bearer ${userId}`,
            },
          },
        );

        // Update local record as synced
        await ExamSubmissionRepo.markExamSubmissionSynced(attempt.id!);

        result.synced++;
      } catch (error) {
        // Mark as failed on server error
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        await ExamSubmissionRepo.markExamSubmissionFailed(attempt.id!);

        result.failed++;
        result.errors?.push({
          id: attempt.id!,
          error: errorMsg,
        });

        console.error(`[ExamAttemptService] Failed to sync attempt ${attempt.id}: ${errorMsg}`);
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Retry failed exam attempts
   * Uses exponential backoff for retry delay
   * @returns Sync result
   */
  async retryFailedAttempts(userId?: string): Promise<SyncResult> {
    const failed = await this.getFailedAttempts();

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    if (!userId) {
      console.log('[ExamAttemptService] No user ID, cannot retry');
      return result;
    }

    for (const attempt of failed) {
      try {
        // Exponential backoff based on retry count
        const delayMs = 5000 * Math.pow(2, attempt.syncRetries || 0);
        await this.sleep(delayMs);

        // Retry sync — include localId so server won't create a duplicate
        await getAxios().post(
          `${this.apiUrl}/exam-attempts/submit-authenticated`,
          {
            examTypeId: attempt.examTypeId,
            score: attempt.score,
            passed: attempt.passed,
            duration: attempt.duration,
            submittedAt: attempt.submittedAt,
            localId: (attempt as ExamSubmissionRepo.ExamSubmission).localId,
          },
          {
            headers: {
              Authorization: `Bearer ${userId}`,
            },
          },
        );

        // Mark as synced
        await ExamSubmissionRepo.markExamSubmissionSynced(attempt.id!);

        result.synced++;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';

        await ExamSubmissionRepo.markExamSubmissionFailed(attempt.id!);

        result.failed++;
        result.errors?.push({
          id: attempt.id!,
          error: errorMsg,
        });
      }
    }

    result.success = result.failed === 0;
    return result;
  }

  /**
   * Get exam history with filtering
   * @param examTypeId - Optional filter by exam type
   * @returns Filtered exam attempts
   */
  async getExamHistory(examTypeId?: string): Promise<ExamAttempt[]> {
    const attempts = await this.db.getAllExamAttempts();

    if (examTypeId) {
      return attempts.filter((a) => a.examTypeId === examTypeId);
    }

    return attempts;
  }

  /**
   * Get analytics summary
   * Aggregates exam data for performance metrics
   * @param examTypeId - Optional filter by exam type
   * @returns Analytics data
   */
  async getAnalytics(examTypeId?: string): Promise<{
    totalAttempts: number;
    totalPassed: number;
    passRate: number;
    averageScore: number;
    averageDuration: number;
    lastAttemptDate?: Date;
  }> {
    let attempts = await this.db.getAllExamAttempts();

    // Filter by exam type if provided
    if (examTypeId) {
      attempts = attempts.filter((a) => a.examTypeId === examTypeId);
    }

    // Only count synced attempts (offline exams don't count)
    const syncedAttempts = attempts.filter((a) => a.syncStatus === 'SYNCED');

    if (syncedAttempts.length === 0) {
      return {
        totalAttempts: 0,
        totalPassed: 0,
        passRate: 0,
        averageScore: 0,
        averageDuration: 0,
      };
    }

    const passed = syncedAttempts.filter((a) => a.passed).length;
    const totalScore = syncedAttempts.reduce((sum, a) => sum + a.score, 0);
    const totalDuration = syncedAttempts.reduce((sum, a) => sum + a.duration, 0);
    const lastAttempt = syncedAttempts[syncedAttempts.length - 1];

    return {
      totalAttempts: syncedAttempts.length,
      totalPassed: passed,
      passRate: passed / syncedAttempts.length,
      averageScore: totalScore / syncedAttempts.length,
      averageDuration: Math.round(totalDuration / syncedAttempts.length),
      lastAttemptDate: lastAttempt.submittedAt,
    };
  }

  /**
   * Delete exam attempt from local storage
   * @param id - Exam attempt ID
   */
  async deleteAttempt(id: string): Promise<void> {
    await ExamSubmissionRepo.deleteExamSubmission(id);
  }

  /**
   * Clear all attempt data
   * Used for app reset or logout
   */
  async clearAll(): Promise<void> {
    await ExamSubmissionRepo.deleteAllExamSubmissions();
  }

  // === Helper ===

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
