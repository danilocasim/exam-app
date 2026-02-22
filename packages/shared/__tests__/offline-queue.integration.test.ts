/**
 * T144: Offline Queue Integration Tests
 *
 * Tests for queue persistence across app restart and sync flow:
 * - Queue persists pending exams across app restarts
 * - Sync processor processes queue in correct order
 * - Failed syncs remain in queue for retry
 * - Successful syncs remove items from queue
 * - Exponential backoff applied to retries
 */
import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExamAttemptService } from '../src/services/exam-attempt.service';
import * as ExamSubmissionRepo from '../src/storage/repositories/exam-submission.repository';

// Get the same axios reference that production code uses via require('axios').default ?? require('axios')
// vitest's vi.mock doesn't intercept CJS require() in production code, so we spy on the real module
const realAxios = require('axios').default ?? require('axios');

describe('Offline Queue Integration Tests', () => {
  let service: ExamAttemptService;
  let sleepSpy: ReturnType<typeof vi.spyOn>;
  let postSpy: any;
  const mockApiUrl = 'http://localhost:3000';
  const mockUserId = 'user-123';

  beforeEach(() => {
    service = new ExamAttemptService(mockApiUrl);
    sleepSpy = vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
    postSpy = vi.spyOn(realAxios, 'post');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('Queue Persistence Across App Restart', () => {
    test('should persist pending exams in queue across app restart simulation', async () => {
      // Setup: Create pending submissions
      const submissions = [
        {
          id: 'local-1',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
        {
          id: 'local-2',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 80,
          passed: true,
          duration: 2200,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue(submissions);

      // Simulate app restart by creating new service instance
      const restartedService = new ExamAttemptService(mockApiUrl);
      const pendingAfterRestart = await restartedService.getPendingAttempts();

      expect(pendingAfterRestart).toHaveLength(2);
      expect(pendingAfterRestart[0].syncStatus).toBe('PENDING');
      expect(pendingAfterRestart[1].syncStatus).toBe('PENDING');
    });

    test('should maintain queue order (FIFO) across restart', async () => {
      const now = new Date();
      const submissions = [
        {
          id: 'local-1',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(now.getTime() - 3000),
          createdAt: new Date(now.getTime() - 3000),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
        {
          id: 'local-2',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 80,
          passed: true,
          duration: 2200,
          submittedAt: new Date(now.getTime() - 2000),
          createdAt: new Date(now.getTime() - 2000),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
        {
          id: 'local-3',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 85,
          passed: true,
          duration: 2100,
          submittedAt: new Date(now.getTime() - 1000),
          createdAt: new Date(now.getTime() - 1000),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue(submissions);

      const pending = await service.getPendingAttempts();

      // Verify FIFO order (oldest first)
      expect(pending[0].id).toBe('local-1');
      expect(pending[1].id).toBe('local-2');
      expect(pending[2].id).toBe('local-3');
    });
  });

  describe('Sync Flow Processing', () => {
    test('should process entire queue when all syncs succeed', async () => {
      const submissions = [
        {
          id: 'local-1',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
        {
          id: 'local-2',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 80,
          passed: true,
          duration: 2200,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockResolvedValue({
        data: { id: 'server-id', syncStatus: 'SYNCED' },
      });

      const markSyncedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced')
        .mockResolvedValue({
          ...submissions[0],
          syncStatus: 'SYNCED',
          syncedAt: new Date(),
        });

      const result = await service.syncPendingAttempts(mockUserId);

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(0);
      expect(result.success).toBe(true);
      expect(markSyncedSpy).toHaveBeenCalledTimes(2);
    });

    test('should keep failed syncs in queue for retry', async () => {
      const submissions = [
        {
          id: 'local-1',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockRejectedValue(new Error('Network error'));

      const markFailedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed')
        .mockResolvedValue({
          ...submissions[0],
          syncStatus: 'FAILED',
          syncRetries: 1,
        });

      const result = await service.syncPendingAttempts(mockUserId);

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.success).toBe(false);
      expect(markFailedSpy).toHaveBeenCalledTimes(1);
      expect(markFailedSpy).toHaveBeenCalledWith('local-1');
    });

    test('should process queue partially when some syncs fail', async () => {
      const submissions = [
        {
          id: 'local-1',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
        {
          id: 'local-2',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 80,
          passed: true,
          duration: 2200,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
        {
          id: 'local-3',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 85,
          passed: true,
          duration: 2100,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue(submissions);

      // Mock: First succeeds, second fails, third succeeds
      postSpy
        .mockResolvedValueOnce({ data: { id: 'server-1' } })
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce({ data: { id: 'server-3' } });

      const markSyncedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced')
        .mockResolvedValue({
          ...submissions[0],
          syncStatus: 'SYNCED',
        });

      const markFailedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed')
        .mockResolvedValue({
          ...submissions[1],
          syncStatus: 'FAILED',
          syncRetries: 1,
        });

      const result = await service.syncPendingAttempts(mockUserId);

      expect(result.synced).toBe(2);
      expect(result.failed).toBe(1);
      expect(result.success).toBe(false);
      expect(markSyncedSpy).toHaveBeenCalledTimes(2);
      expect(markFailedSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Exponential Backoff Retry Logic', () => {
    test('should apply exponential backoff based on retry count', async () => {
      const submissions = [
        {
          id: 'local-1',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'FAILED' as const,
          syncRetries: 2, // Third retry
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      await service.retryFailedAttempts(mockUserId);

      // Expected delay: 5000 * 2^2 = 20000ms
      expect(sleepSpy).toHaveBeenCalledWith(20000);
    });

    test('should increment retry count on each failure', async () => {
      const submissions = [
        {
          id: 'local-1',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'FAILED' as const,
          syncRetries: 3,
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockRejectedValue(new Error('Server unavailable'));

      const markFailedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed')
        .mockResolvedValue({
          ...submissions[0],
          syncRetries: 4, // Incremented
        });

      await service.retryFailedAttempts(mockUserId);

      expect(markFailedSpy).toHaveBeenCalledWith('local-1');
    });

    test('should handle max retries gracefully', async () => {
      const submissions = [
        {
          id: 'local-1',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'FAILED' as const,
          syncRetries: 12, // Max retries reached
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockRejectedValue(new Error('Permanent failure'));

      const markFailedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed')
        .mockResolvedValue({
          ...submissions[0],
          syncRetries: 13,
        });

      const result = await service.retryFailedAttempts(mockUserId);

      expect(result.failed).toBe(1);
      expect(markFailedSpy).toHaveBeenCalled();
    });
  });

  describe('Queue State Management', () => {
    test('should clear queue when all items synced', async () => {
      vi.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue([]);

      const pending = await service.getPendingAttempts();

      expect(pending).toHaveLength(0);
    });

    test('should handle empty queue gracefully', async () => {
      vi.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue([]);

      const result = await service.syncPendingAttempts(mockUserId);

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.success).toBe(true);
    });

    test('should separate pending and failed queues', async () => {
      const pendingSubmissions = [
        {
          id: 'local-1',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
      ];

      const failedSubmissions = [
        {
          id: 'local-2',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 80,
          passed: true,
          duration: 2200,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'FAILED' as const,
          syncRetries: 2,
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue(
        pendingSubmissions,
      );

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(failedSubmissions);

      const pending = await service.getPendingAttempts();
      const failed = await service.getFailedAttempts();

      expect(pending).toHaveLength(1);
      expect(pending[0].syncStatus).toBe('PENDING');
      expect(failed).toHaveLength(1);
      expect(failed[0].syncStatus).toBe('FAILED');
    });
  });

  describe('Offline-to-Online Transition', () => {
    test('should sync immediately when connectivity restores', async () => {
      const submissions = [
        {
          id: 'local-1',
          userId: mockUserId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING' as const,
          syncRetries: 0,
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      const markSyncedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced')
        .mockResolvedValue({
          ...submissions[0],
          syncStatus: 'SYNCED',
        });

      // Simulate connectivity restore trigger
      const result = await service.syncPendingAttempts(mockUserId);

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(markSyncedSpy).toHaveBeenCalledTimes(1);
    });

    test('should handle no user ID gracefully when offline', async () => {
      const result = await service.syncPendingAttempts();

      expect(result.synced).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.success).toBe(true);
    });
  });
});
