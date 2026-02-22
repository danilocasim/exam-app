import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest';
import { ExamAttemptService } from '../src/services/exam-attempt.service';
import * as ExamSubmissionRepo from '../src/storage/repositories/exam-submission.repository';

// Get the same axios reference that production code uses via require('axios').default ?? require('axios')
// vitest's vi.mock doesn't intercept CJS require() in production code, so we spy on the real module
const realAxios = require('axios').default ?? require('axios');

describe('ExamAttemptService Integration Tests', () => {
  let service: ExamAttemptService;
  let postSpy: any;
  const mockApiUrl = 'http://localhost:3000';

  beforeEach(() => {
    service = new ExamAttemptService(mockApiUrl);
    vi.spyOn(service as any, 'sleep').mockResolvedValue(undefined);
    postSpy = vi.spyOn(realAxios, 'post');
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('submitExam', () => {
    test('should create a new exam submission with PENDING status', async () => {
      const attempt = {
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: 2400,
      };

      const result = await service.submitExam(attempt);

      expect(result.examTypeId).toBe('aws-ccp');
      expect(result.score).toBe(75);
      expect(result.passed).toBe(true);
      expect(result.duration).toBe(2400);
      expect(result.syncStatus).toBe('PENDING');
      expect(result.syncRetries).toBe(0);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
    });

    test('should store submission in local database', async () => {
      const attempt = {
        examTypeId: 'aws-ccp',
        score: 80,
        passed: true,
        duration: 2400,
      };

      const saveSpy = vi.spyOn(ExamSubmissionRepo, 'saveExamSubmission');

      await service.submitExam(attempt);

      expect(saveSpy).toHaveBeenCalledTimes(1);
      const savedData = saveSpy.mock.calls[0][0];
      expect(savedData.examTypeId).toBe('aws-ccp');
      expect(savedData.syncStatus).toBe('PENDING');
    });
  });

  describe('getPendingAttempts', () => {
    test('should return only PENDING submissions', async () => {
      const getAllSpy = vi
        .spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions')
        .mockResolvedValue([
          {
            id: '1',
            examTypeId: 'aws-ccp',
            score: 75,
            passed: true,
            duration: 2400,
            submittedAt: new Date(),
            createdAt: new Date(),
            syncStatus: 'PENDING',
            syncRetries: 0,
          },
        ]);

      const pending = await service.getPendingAttempts();

      expect(pending).toHaveLength(1);
      expect(pending[0].syncStatus).toBe('PENDING');
      expect(getAllSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('syncPendingAttempts', () => {
    test('should sync pending exams to cloud API', async () => {
      const userId = 'user-123';
      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      vi.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue([
        {
          id: 'local-1',
          userId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING',
          syncRetries: 0,
        },
      ]);

      const markSyncedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced')
        .mockResolvedValue({
          id: 'local-1',
          userId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'SYNCED',
          syncedAt: new Date(),
          syncRetries: 0,
        });

      const result = await service.syncPendingAttempts(userId);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(postSpy).toHaveBeenCalledWith(
        `${mockApiUrl}/exam-attempts/submit-authenticated`,
        expect.objectContaining({
          examTypeId: 'aws-ccp',
          score: 75,
        }),
        expect.any(Object),
      );
      expect(markSyncedSpy).toHaveBeenCalledTimes(1);
    });

    test('should not sync if no user ID provided', async () => {
      const result = await service.syncPendingAttempts();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(0);
      expect(postSpy).not.toHaveBeenCalled();
    });

    test('should handle sync errors gracefully', async () => {
      const userId = 'user-123';
      const error = new Error('Network error');
      postSpy.mockRejectedValue(error);

      vi.spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions').mockResolvedValue([
        {
          id: 'local-1',
          userId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'PENDING',
          syncRetries: 0,
        },
      ]);

      const markFailedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed')
        .mockResolvedValue({
          id: 'local-1',
          userId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'FAILED',
          syncRetries: 1,
        });

      const result = await service.syncPendingAttempts(userId);

      expect(result.success).toBe(false);
      expect(result.failed).toBe(1);
      expect(result.synced).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0].error).toContain('Network error');
      expect(markFailedSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('retryFailedAttempts', () => {
    test('should retry failed exams with exponential backoff', async () => {
      const userId = 'user-123';
      postSpy.mockResolvedValue({ data: { id: 'server-id' } });

      vi.spyOn(ExamSubmissionRepo, 'getFailedExamSubmissions').mockResolvedValue([
        {
          id: 'local-1',
          userId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'FAILED',
          syncRetries: 2,
        },
      ]);

      const markSyncedSpy = vi
        .spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced')
        .mockResolvedValue({
          id: 'local-1',
          userId,
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          submittedAt: new Date(),
          createdAt: new Date(),
          syncStatus: 'SYNCED',
          syncedAt: new Date(),
          syncRetries: 0,
        });

      const result = await service.retryFailedAttempts(userId);

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(markSyncedSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getAnalytics', () => {
    test('should calculate analytics from synced submissions only', async () => {
      (service as any).db = {
        getAllExamAttempts: vi.fn().mockResolvedValue([
          {
            id: '1',
            examTypeId: 'aws-ccp',
            score: 75,
            passed: true,
            duration: 2400,
            submittedAt: new Date('2024-01-01'),
            createdAt: new Date('2024-01-01'),
            syncStatus: 'SYNCED',
            syncRetries: 0,
            syncedAt: new Date('2024-01-01'),
          },
          {
            id: '2',
            examTypeId: 'aws-ccp',
            score: 85,
            passed: true,
            duration: 2200,
            submittedAt: new Date('2024-01-02'),
            createdAt: new Date('2024-01-02'),
            syncStatus: 'SYNCED',
            syncRetries: 0,
            syncedAt: new Date('2024-01-02'),
          },
          {
            id: '3',
            examTypeId: 'aws-ccp',
            score: 60,
            passed: false,
            duration: 2500,
            submittedAt: new Date('2024-01-03'),
            createdAt: new Date('2024-01-03'),
            syncStatus: 'PENDING', // Should not be included
            syncRetries: 0,
          },
        ]),
      };

      const analytics = await service.getAnalytics();

      expect(analytics.totalAttempts).toBe(2);
      expect(analytics.totalPassed).toBe(2);
      expect(analytics.passRate).toBe(1);
      expect(analytics.averageScore).toBe(80);
      expect(analytics.averageDuration).toBe(2300);
    });

    test('should filter by exam type', async () => {
      (service as any).db = {
        getAllExamAttempts: vi.fn().mockResolvedValue([
          {
            id: '1',
            examTypeId: 'aws-ccp',
            score: 75,
            passed: true,
            duration: 2400,
            submittedAt: new Date(),
            createdAt: new Date(),
            syncStatus: 'SYNCED',
            syncRetries: 0,
            syncedAt: new Date(),
          },
          {
            id: '2',
            examTypeId: 'aws-saa',
            score: 85,
            passed: true,
            duration: 2200,
            submittedAt: new Date(),
            createdAt: new Date(),
            syncStatus: 'SYNCED',
            syncRetries: 0,
            syncedAt: new Date(),
          },
        ]),
      };

      const analytics = await service.getAnalytics('aws-ccp');

      expect(analytics.totalAttempts).toBe(1);
      expect(analytics.averageScore).toBe(75);
    });
  });

  describe('deleteAttempt', () => {
    test('should delete an exam attempt by ID', async () => {
      const deleteSpy = vi
        .spyOn(ExamSubmissionRepo, 'deleteExamSubmission')
        .mockResolvedValue(undefined);

      await service.deleteAttempt('local-1');

      expect(deleteSpy).toHaveBeenCalledWith('local-1');
    });
  });

  describe('clearAll', () => {
    test('should delete all exam submissions', async () => {
      const clearSpy = vi
        .spyOn(ExamSubmissionRepo, 'deleteAllExamSubmissions')
        .mockResolvedValue(undefined);

      await service.clearAll();

      expect(clearSpy).toHaveBeenCalledTimes(1);
    });
  });
});
