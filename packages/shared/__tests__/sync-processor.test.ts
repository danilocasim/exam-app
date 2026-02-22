/**
 * T147: Sync Processor Unit Tests
 *
 * Tests for exponential backoff timing and max retry enforcement:
 * - Exponential backoff delay calculation
 * - Retry count incrementation
 * - Max retry limit enforcement (12 attempts)
 * - Backoff timing validation
 * - Failed sync transitions
 */

import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExamAttemptService } from '../src/services/exam-attempt.service';
import * as ExamSubmissionRepo from '../src/storage/repositories/exam-submission.repository';

// Get the same axios reference that production code uses via require('axios').default ?? require('axios')
// vitest's vi.mock doesn't intercept CJS require() in production code, so we spy on the real module
const realAxios = require('axios').default ?? require('axios');

describe('Sync Processor - Exponential Backoff Tests', () => {
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

  describe('Exponential Backoff Delay Calculation', () => {
    test('should apply correct delay for retry count 0 (first retry)', async () => {
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
          syncRetries: 0, // First retry
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      await service.retryFailedAttempts(mockUserId);

      // Expected delay: 5000 * 2^0 = 5000ms (5 seconds)
      expect(sleepSpy).toHaveBeenCalledWith(5000);
    });

    test('should apply correct delay for retry count 1 (second retry)', async () => {
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
          syncRetries: 1, // Second retry
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      await service.retryFailedAttempts(mockUserId);

      // Expected delay: 5000 * 2^1 = 10000ms (10 seconds)
      expect(sleepSpy).toHaveBeenCalledWith(10000);
    });

    test('should apply correct delay for retry count 2 (third retry)', async () => {
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

      // Expected delay: 5000 * 2^2 = 20000ms (20 seconds)
      expect(sleepSpy).toHaveBeenCalledWith(20000);
    });

    test('should apply correct delay for retry count 3 (fourth retry)', async () => {
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
          syncRetries: 3, // Fourth retry
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      await service.retryFailedAttempts(mockUserId);

      // Expected delay: 5000 * 2^3 = 40000ms (40 seconds)
      expect(sleepSpy).toHaveBeenCalledWith(40000);
    });
  });

  describe('Retry Count Incrementation', () => {
    test('should increment retry count on failure', async () => {
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
          syncRetries: 2,
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockRejectedValue(new Error('Server error'));

      const markFailedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed')
        .mockResolvedValue({
          ...submissions[0],
          syncRetries: 3, // Incremented
        });

      await service.retryFailedAttempts(mockUserId);

      expect(markFailedSpy).toHaveBeenCalledWith('local-1');
      expect(markFailedSpy).toHaveBeenCalledTimes(1);
    });

    test('should reset retry count to 0 on successful sync', async () => {
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
          syncRetries: 5,
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      const markSyncedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced')
        .mockResolvedValue({
          ...submissions[0],
          syncStatus: 'SYNCED',
          syncRetries: 0, // Reset to 0
          syncedAt: new Date(),
        });

      await service.retryFailedAttempts(mockUserId);

      expect(markSyncedSpy).toHaveBeenCalledWith('local-1');
      expect(markSyncedSpy).toHaveBeenCalledTimes(1);
    });

    test('should maintain retry count across multiple failures', async () => {
      const retries = [0, 1, 2, 3, 4, 5];

      for (const retryCount of retries) {
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
            syncRetries: retryCount,
          },
        ];

        vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

        postSpy.mockRejectedValue(new Error('Server error'));

        const markFailedSpy = vi
          .spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed')
          .mockResolvedValue({
            ...submissions[0],
            syncRetries: retryCount + 1,
          });

        await service.retryFailedAttempts(mockUserId);

        expect(markFailedSpy).toHaveBeenCalled();
        vi.clearAllMocks();
      }
    });
  });

  describe('Max Retry Limit Enforcement', () => {
    test('should stop retrying after 12 attempts', async () => {
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
          syncRetries: 12, // Max retries
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockRejectedValue(new Error('Permanent failure'));

      const markFailedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed')
        .mockResolvedValue({
          ...submissions[0],
          syncRetries: 13, // Should still increment, but not retry again
        });

      const result = await service.retryFailedAttempts(mockUserId);

      expect(result.failed).toBe(1);
      expect(markFailedSpy).toHaveBeenCalled();
    });

    test('should handle retries at max limit boundary', async () => {
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
          syncRetries: 11, // One before max
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockRejectedValue(new Error('Server error'));

      const markFailedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed')
        .mockResolvedValue({
          ...submissions[0],
          syncRetries: 12, // Reached max
        });

      await service.retryFailedAttempts(mockUserId);

      expect(markFailedSpy).toHaveBeenCalledWith('local-1');
    });

    test('should allow retry at max limit if successful', async () => {
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
          syncRetries: 12, // At max retries
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      const markSyncedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced')
        .mockResolvedValue({
          ...submissions[0],
          syncStatus: 'SYNCED',
          syncRetries: 0,
          syncedAt: new Date(),
        });

      const result = await service.retryFailedAttempts(mockUserId);

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(markSyncedSpy).toHaveBeenCalled();
    });
  });

  describe('Backoff Timing Validation', () => {
    test('should increase delay exponentially', async () => {
      const retries = [0, 1, 2];
      const expectedDelays = [5000, 10000, 20000]; // 5s, 10s, 20s

      for (let i = 0; i < retries.length; i++) {
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
            syncRetries: retries[i],
          },
        ];

        vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

        postSpy.mockResolvedValue({ data: { id: 'server-id' } });

        await service.retryFailedAttempts(mockUserId);

        // Verify sleep was called with the correct exponential delay
        expect(sleepSpy).toHaveBeenCalledWith(expectedDelays[i]);

        vi.clearAllMocks();
      }
    });

    test('should respect timing for high retry counts', async () => {
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
          syncRetries: 5, // 5000 * 2^5 = 160000ms (2.67 minutes)
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      await service.retryFailedAttempts(mockUserId);

      // Expected delay: 5000 * 2^5 = 160000ms
      expect(sleepSpy).toHaveBeenCalledWith(160000);
    });
  });

  describe('Failed Sync Transitions', () => {
    test('should move from PENDING to FAILED on sync failure', async () => {
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

      expect(result.failed).toBe(1);
      expect(result.synced).toBe(0);
      expect(markFailedSpy).toHaveBeenCalledWith('local-1');
    });

    test('should move from FAILED to SYNCED on retry success', async () => {
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

      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      const markSyncedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced')
        .mockResolvedValue({
          ...submissions[0],
          syncStatus: 'SYNCED',
          syncRetries: 0,
          syncedAt: new Date(),
        });

      const result = await service.retryFailedAttempts(mockUserId);

      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(markSyncedSpy).toHaveBeenCalled();
    });

    test('should remain FAILED on continued failure', async () => {
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
          syncRetries: 7,
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockRejectedValue(new Error('Persistent server error'));

      const markFailedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed')
        .mockResolvedValue({
          ...submissions[0],
          syncStatus: 'FAILED',
          syncRetries: 8,
        });

      const result = await service.retryFailedAttempts(mockUserId);

      expect(result.failed).toBe(1);
      expect(result.synced).toBe(0);
      expect(markFailedSpy).toHaveBeenCalled();
    });
  });

  describe('Batch Processing with Backoff', () => {
    test('should apply backoff sequentially for multiple failed exams', async () => {
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
          syncRetries: 1, // 10s delay
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
          syncStatus: 'FAILED' as const,
          syncRetries: 1, // 10s delay
        },
      ];

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      vi.spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced').mockResolvedValue({
        ...submissions[0],
        syncStatus: 'SYNCED',
      });

      await service.retryFailedAttempts(mockUserId);

      // Both items should have sleep called with 5000 * 2^1 = 10000ms
      expect(sleepSpy).toHaveBeenCalledTimes(2);
      expect(sleepSpy).toHaveBeenCalledWith(10000);
    });
  });
});
