// eslint-disable-next-line @typescript-eslint/no-require-imports
const getAxios = () => require('axios').default ?? require('axios');
import * as ExamSubmissionRepo from '../storage/repositories/exam-submission.repository';
import { getAnswersByExamAttemptId } from '../storage/repositories/exam-answer.repository';
import { getQuestionsByIds } from '../storage/repositories/question.repository';
import { calculateDomainBreakdown } from './scoring.service';
import { getCachedExamTypeConfig } from './sync.service';
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

    // Compute per-domain breakdown from ExamAnswer rows (same id as the ExamAttempt).
    let domainScores: ExamSubmissionRepo.DomainScore[] | undefined;
    try {
      const config = await getCachedExamTypeConfig();
      if (config) {
        const answers = await getAnswersByExamAttemptId(id);
        if (answers.length > 0) {
          const questionIds = answers.map((a) => a.questionId);
          const questions = await getQuestionsByIds(questionIds);
          const questionsById = new Map(questions.map((q) => [q.id, q]));
          domainScores = calculateDomainBreakdown(answers, questionsById, config).map(
            ({ domainId, correct, total }) => ({ domainId, correct, total }),
          );
        }
      }
    } catch {
      // Non-fatal — submission still goes through without domain scores
    }

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
      domainScores,
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
   * Sync pending exam attempts with cloud.
   * Called when network connection is available.
   * Uses offline-first strategy: retry until success.
   *
   * @param accessToken - JWT access token for the authenticated user.
   *                      If omitted, sync is skipped and attempts remain local-only.
   * @returns Sync result with counts.
   */
  async syncPendingAttempts(accessToken?: string): Promise<SyncResult> {
    const pending = await this.getPendingAttempts();

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    // If we don't have an access token, we can't talk to the authenticated API.
    // In that case, keep all attempts local-only until the user signs in.
    if (!accessToken) {
      console.log('[ExamAttemptService] No access token, keeping exams local only');
      return result;
    }

    const axios = getAxios();

    for (const attempt of pending) {
      try {
        // Send to cloud API — include localId for server-side idempotency
        const sub = attempt as ExamSubmissionRepo.ExamSubmission;

        // Fetch per-question answers for this attempt (keyed by localId = attemptId)
        let answers: Array<{ questionId: string; selectedAnswers: string[]; isCorrect: boolean; orderIndex: number }> | undefined;
        try {
          const attemptId = sub.localId ?? sub.id!;
          const rawAnswers = await getAnswersByExamAttemptId(attemptId);
          if (rawAnswers.length > 0) {
            answers = rawAnswers.map((a) => ({
              questionId: a.questionId,
              selectedAnswers: a.selectedAnswers,
              isCorrect: a.isCorrect ?? false,
              orderIndex: a.orderIndex,
            }));
          }
        } catch {
          // Non-fatal — sync still proceeds without answers
        }

        await axios.post(
          `${this.apiUrl}/exam-attempts/submit-authenticated`,
          {
            examTypeId: attempt.examTypeId,
            score: attempt.score,
            passed: attempt.passed,
            duration: attempt.duration,
            submittedAt: attempt.submittedAt,
            localId: sub.localId,
            domainScores: sub.domainScores,
            answers,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        // Update local record as synced
        await ExamSubmissionRepo.markExamSubmissionSynced(attempt.id!);

        result.synced++;
      } catch (error) {
        // Mark as failed on server error
        let errorMsg = 'Unknown error';
        if (axios.isAxiosError(error)) {
          console.error('[ExamAttemptService] Failed to sync attempt', attempt.id, {
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
          });
          errorMsg = error.message;
        } else if (error instanceof Error) {
          errorMsg = error.message;
        }

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
   * Retry failed exam attempts.
   * Uses exponential backoff for retry delay.
   *
   * @param accessToken - JWT access token for the authenticated user.
   *                      If omitted, retries are skipped.
   * @returns Sync result.
   */
  async retryFailedAttempts(accessToken?: string): Promise<SyncResult> {
    const failed = await this.getFailedAttempts();
    const axios = getAxios();

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    if (!accessToken) {
      console.log('[ExamAttemptService] No access token, cannot retry failed sync');
      return result;
    }

    for (const attempt of failed) {
      try {
        // Exponential backoff based on retry count
        const delayMs = 5000 * Math.pow(2, attempt.syncRetries || 0);
        await this.sleep(delayMs);

        // Retry sync — include localId so server won't create a duplicate
        const sub = attempt as ExamSubmissionRepo.ExamSubmission;

        let retryAnswers: Array<{ questionId: string; selectedAnswers: string[]; isCorrect: boolean; orderIndex: number }> | undefined;
        try {
          const attemptId = sub.localId ?? sub.id!;
          const rawAnswers = await getAnswersByExamAttemptId(attemptId);
          if (rawAnswers.length > 0) {
            retryAnswers = rawAnswers.map((a) => ({
              questionId: a.questionId,
              selectedAnswers: a.selectedAnswers,
              isCorrect: a.isCorrect ?? false,
              orderIndex: a.orderIndex,
            }));
          }
        } catch {
          // Non-fatal
        }

        await axios.post(
          `${this.apiUrl}/exam-attempts/submit-authenticated`,
          {
            examTypeId: attempt.examTypeId,
            score: attempt.score,
            passed: attempt.passed,
            duration: attempt.duration,
            submittedAt: attempt.submittedAt,
            localId: sub.localId,
            domainScores: sub.domainScores,
            answers: retryAnswers,
          },
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          },
        );

        // Mark as synced
        await ExamSubmissionRepo.markExamSubmissionSynced(attempt.id!);

        result.synced++;
      } catch (error) {
        let errorMsg = 'Unknown error';
        if (axios.isAxiosError(error)) {
          console.error('[ExamAttemptService] Failed to retry attempt', attempt.id, {
            url: error.config?.url,
            status: error.response?.status,
            data: error.response?.data,
          });
          errorMsg = error.message;
        } else if (error instanceof Error) {
          errorMsg = error.message;
        }

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
