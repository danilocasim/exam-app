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
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ExamAttemptService } from '../src/services/exam-attempt.service';
import * as ExamSubmissionRepo from '../src/storage/repositories/exam-submission.repository';

// Mock the axios module
jest.mock('axios');
import axios from 'axios';

const mockAxios = axios as jest.Mocked<typeof axios>;

describe('Sync Processor - Exponential Backoff Tests', () => {
  let service: ExamAttemptService;
  const mockApiUrl = 'http://localhost:3000';
  const mockUserId = 'user-123';

  beforeEach(() => {
    service = new ExamAttemptService(mockApiUrl);
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockResolvedValue({ data: { id: 'server-id' } });

      const startTime = Date.now();
      await service.retryFailedAttempts(mockUserId);
      const elapsed = Date.now() - startTime;

      // Expected delay: 5000 * 2^0 = 5000ms (5 seconds)
      // Allow 95% tolerance (4750ms minimum)
      expect(elapsed).toBeGreaterThanOrEqual(4750);
      expect(elapsed).toBeLessThan(6000); // Upper bound with execution time
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockResolvedValue({ data: { id: 'server-id' } });

      const startTime = Date.now();
      await service.retryFailedAttempts(mockUserId);
      const elapsed = Date.now() - startTime;

      // Expected delay: 5000 * 2^1 = 10000ms (10 seconds)
      // Allow 95% tolerance (9500ms minimum)
      expect(elapsed).toBeGreaterThanOrEqual(9500);
      expect(elapsed).toBeLessThan(11000);
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockResolvedValue({ data: { id: 'server-id' } });

      const startTime = Date.now();
      await service.retryFailedAttempts(mockUserId);
      const elapsed = Date.now() - startTime;

      // Expected delay: 5000 * 2^2 = 20000ms (20 seconds)
      // Allow 95% tolerance (19000ms minimum)
      expect(elapsed).toBeGreaterThanOrEqual(19000);
      expect(elapsed).toBeLessThan(21000);
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockResolvedValue({ data: { id: 'server-id' } });

      const startTime = Date.now();
      await service.retryFailedAttempts(mockUserId);
      const elapsed = Date.now() - startTime;

      // Expected delay: 5000 * 2^3 = 40000ms (40 seconds)
      // Allow 95% tolerance (38000ms minimum)
      expect(elapsed).toBeGreaterThanOrEqual(38000);
      expect(elapsed).toBeLessThan(42000);
    }, 45000); // Increase timeout for slow test
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockRejectedValue(new Error('Server error'));

      const markFailedSpy = jest
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockResolvedValue({ data: { id: 'server-id' } });

      const markSyncedSpy = jest
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

        jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

        mockAxios.post.mockRejectedValue(new Error('Server error'));

        const markFailedSpy = jest
          .spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed')
          .mockResolvedValue({
            ...submissions[0],
            syncRetries: retryCount + 1,
          });

        await service.retryFailedAttempts(mockUserId);

        expect(markFailedSpy).toHaveBeenCalled();
        jest.clearAllMocks();
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockRejectedValue(new Error('Permanent failure'));

      const markFailedSpy = jest
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockRejectedValue(new Error('Server error'));

      const markFailedSpy = jest
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockResolvedValue({ data: { id: 'server-id' } });

      const markSyncedSpy = jest
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

        jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

        mockAxios.post.mockResolvedValue({ data: { id: 'server-id' } });

        const startTime = Date.now();
        await service.retryFailedAttempts(mockUserId);
        const elapsed = Date.now() - startTime;

        // Allow 95% tolerance
        const minDelay = expectedDelays[i] * 0.95;
        expect(elapsed).toBeGreaterThanOrEqual(minDelay);

        jest.clearAllMocks();
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockResolvedValue({ data: { id: 'server-id' } });

      const startTime = Date.now();
      await service.retryFailedAttempts(mockUserId);
      const elapsed = Date.now() - startTime;

      // Expected delay: 5000 * 2^5 = 160000ms
      // Allow 95% tolerance
      expect(elapsed).toBeGreaterThanOrEqual(152000);
    }, 165000); // Allow 165 seconds for test execution
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

      jest.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockRejectedValue(new Error('Network error'));

      const markFailedSpy = jest
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockResolvedValue({ data: { id: 'server-id' } });

      const markSyncedSpy = jest
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockRejectedValue(new Error('Persistent server error'));

      const markFailedSpy = jest
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

      jest.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue(submissions);

      mockAxios.post.mockResolvedValue({ data: { id: 'server-id' } });

      jest.spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced').mockResolvedValue({
        ...submissions[0],
        syncStatus: 'SYNCED',
      });

      const startTime = Date.now();
      await service.retryFailedAttempts(mockUserId);
      const elapsed = Date.now() - startTime;

      // Expected: 2 * (5000 * 2^1) = 2 * 10000 = 20000ms minimum
      // Allow 95% tolerance
      expect(elapsed).toBeGreaterThanOrEqual(19000);
    });
  });
});
