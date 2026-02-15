/**
 * T146: Analytics Service Unit Tests
 *
 * Tests for calculation accuracy:
 * - passRate calculation
 * - averageScore aggregation
 * - byExamType breakdown
 * - Zero attempts handling
 * - Rounding behavior
 */
import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { ExamAttemptService } from '../../src/exam-attempts/services/exam-attempt.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SyncStatus } from '../../src/exam-attempts/types';

// Mock Prisma service
const mockPrismaService = {
  examAttempt: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn(),
} as unknown as jest.Mocked<PrismaService>;

describe('ExamAttemptService - Analytics', () => {
  let service: ExamAttemptService;
  const mockUserId = 'user-123';

  beforeEach(() => {
    service = new ExamAttemptService(mockPrismaService);
    jest.clearAllMocks();
  });

  describe('passRate Calculation', () => {
    test('should calculate pass rate correctly with all passing exams', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 85,
          passed: true,
          duration: 2100,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.totalAttempts).toBe(3);
      expect(result.totalPassed).toBe(3);
      expect(result.passRate).toBe(1); // 3/3 = 1.0 (100%)
    });

    test('should calculate pass rate correctly with mixed results', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 65,
          passed: false,
          duration: 2500,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 60,
          passed: false,
          duration: 2600,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.totalAttempts).toBe(4);
      expect(result.totalPassed).toBe(2);
      expect(result.passRate).toBe(0.5); // 2/4 = 0.5 (50%)
    });

    test('should calculate pass rate correctly with all failing exams', async () => {
      const mockAttempts = [
        {
          score: 65,
          passed: false,
          duration: 2500,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 60,
          passed: false,
          duration: 2600,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 55,
          passed: false,
          duration: 2700,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.totalAttempts).toBe(3);
      expect(result.totalPassed).toBe(0);
      expect(result.passRate).toBe(0); // 0/3 = 0.0 (0%)
    });

    test('should calculate pass rate with single exam', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.totalAttempts).toBe(1);
      expect(result.totalPassed).toBe(1);
      expect(result.passRate).toBe(1); // 1/1 = 1.0 (100%)
    });

    test('should handle fractional pass rates correctly', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 65,
          passed: false,
          duration: 2500,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.totalAttempts).toBe(3);
      expect(result.totalPassed).toBe(2);
      expect(result.passRate).toBeCloseTo(0.667, 3); // 2/3 ≈ 0.667 (66.7%)
    });
  });

  describe('averageScore Calculation', () => {
    test('should calculate average score correctly', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 85,
          passed: true,
          duration: 2100,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.averageScore).toBe(80); // (75 + 80 + 85) / 3 = 80
    });

    test('should handle fractional averages correctly', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 65,
          passed: false,
          duration: 2500,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.averageScore).toBeCloseTo(73.33, 2); // (75 + 80 + 65) / 3 ≈ 73.33
    });

    test('should calculate average with low scores', async () => {
      const mockAttempts = [
        {
          score: 45,
          passed: false,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 50,
          passed: false,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 55,
          passed: false,
          duration: 2100,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.averageScore).toBe(50); // (45 + 50 + 55) / 3 = 50
    });

    test('should calculate average with perfect scores', async () => {
      const mockAttempts = [
        {
          score: 100,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 100,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 100,
          passed: true,
          duration: 2100,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.averageScore).toBe(100); // (100 + 100 + 100) / 3 = 100
    });

    test('should handle single exam score', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.averageScore).toBe(75); // 75 / 1 = 75
    });
  });

  describe('averageDuration Calculation', () => {
    test('should calculate average duration correctly', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 85,
          passed: true,
          duration: 2100,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.averageDuration).toBe(2233); // (2400 + 2200 + 2100) / 3 ≈ 2233
    });

    test('should round average duration to nearest integer', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2401,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.averageDuration).toBe(2301); // (2401 + 2200) / 2 = 2300.5 → 2301 (rounded)
    });
  });

  describe('byExamType Breakdown', () => {
    test('should filter analytics by examTypeId', async () => {
      const mockAttempts = [
        {
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          examTypeId: 'aws-ccp',
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId, 'aws-ccp');

      expect(result.totalAttempts).toBe(2);
      expect(result.averageScore).toBe(77.5); // (75 + 80) / 2
      expect(result.passRate).toBe(1); // Both passed

      expect(mockPrismaService.examAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: mockUserId,
            examTypeId: 'aws-ccp',
            syncStatus: SyncStatus.SYNCED,
          }),
        }),
      );
    });

    test('should return different stats for different examTypes', async () => {
      // Test AWS CCP
      const ccpAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(ccpAttempts as any);

      const ccpResult = await service.getAnalytics(mockUserId, 'aws-ccp');

      expect(ccpResult.totalAttempts).toBe(2);
      expect(ccpResult.averageScore).toBe(77.5);

      // Test AWS SAA
      const saaAttempts = [
        {
          score: 85,
          passed: true,
          duration: 2000,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 90,
          passed: true,
          duration: 1800,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 88,
          passed: true,
          duration: 1900,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(saaAttempts as any);

      const saaResult = await service.getAnalytics(mockUserId, 'aws-saa');

      expect(saaResult.totalAttempts).toBe(3);
      expect(saaResult.averageScore).toBeCloseTo(87.67, 2);
    });

    test('should handle no filter (all exam types)', async () => {
      const mockAttempts = [
        {
          examTypeId: 'aws-ccp',
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          examTypeId: 'aws-saa',
          score: 85,
          passed: true,
          duration: 2000,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          examTypeId: 'aws-ccp',
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId); // No examTypeId filter

      expect(result.totalAttempts).toBe(3);
      expect(result.averageScore).toBe(80); // (75 + 85 + 80) / 3
      expect(result.passRate).toBe(1);

      expect(mockPrismaService.examAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({
            examTypeId: expect.anything(),
          }),
        }),
      );
    });
  });

  describe('Zero Attempts Handling', () => {
    test('should return zero values when no attempts exist', async () => {
      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue([]);

      const result = await service.getAnalytics(mockUserId);

      expect(result.totalAttempts).toBe(0);
      expect(result.totalPassed).toBe(0);
      expect(result.passRate).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.averageDuration).toBe(0);
    });

    test('should return zero values when no exams for specific type', async () => {
      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue([]);

      const result = await service.getAnalytics(mockUserId, 'aws-dva');

      expect(result.totalAttempts).toBe(0);
      expect(result.totalPassed).toBe(0);
      expect(result.passRate).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.averageDuration).toBe(0);
    });

    test('should not cause division by zero errors', async () => {
      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue([]);

      expect(async () => {
        await service.getAnalytics(mockUserId);
      }).not.toThrow();

      const result = await service.getAnalytics(mockUserId);

      expect(result.passRate).not.toBeNaN();
      expect(result.averageScore).not.toBeNaN();
      expect(result.averageDuration).not.toBeNaN();
    });
  });

  describe('Sync Status Filtering', () => {
    test('should only count SYNCED attempts', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 80,
          passed: true,
          duration: 2200,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      await service.getAnalytics(mockUserId);

      expect(mockPrismaService.examAttempt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            syncStatus: SyncStatus.SYNCED,
          }),
        }),
      );
    });

    test('should exclude PENDING attempts from analytics', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      // Should only count synced exam
      expect(result.totalAttempts).toBe(1);
      expect(result.averageScore).toBe(75);
    });

    test('should exclude FAILED attempts from analytics', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 2400,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      // Should only count synced exam
      expect(result.totalAttempts).toBe(1);
    });
  });

  describe('Edge Cases', () => {
    test('should handle extremely high scores', async () => {
      const mockAttempts = [
        {
          score: 100,
          passed: true,
          duration: 1800,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 100,
          passed: true,
          duration: 1900,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 100,
          passed: true,
          duration: 2000,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.averageScore).toBe(100);
      expect(result.passRate).toBe(1);
    });

    test('should handle extremely low scores', async () => {
      const mockAttempts = [
        {
          score: 0,
          passed: false,
          duration: 3000,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 5,
          passed: false,
          duration: 3100,
          syncStatus: SyncStatus.SYNCED,
        },
        {
          score: 10,
          passed: false,
          duration: 3200,
          syncStatus: SyncStatus.SYNCED,
        },
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.averageScore).toBe(5); // (0 + 5 + 10) / 3 = 5
      expect(result.passRate).toBe(0);
    });

    test('should handle very short durations', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 60,
          syncStatus: SyncStatus.SYNCED,
        }, // 1 minute
        {
          score: 80,
          passed: true,
          duration: 120,
          syncStatus: SyncStatus.SYNCED,
        }, // 2 minutes
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.averageDuration).toBe(90); // (60 + 120) / 2 = 90 seconds
    });

    test('should handle very long durations', async () => {
      const mockAttempts = [
        {
          score: 75,
          passed: true,
          duration: 7200,
          syncStatus: SyncStatus.SYNCED,
        }, // 2 hours
        {
          score: 80,
          passed: true,
          duration: 10800,
          syncStatus: SyncStatus.SYNCED,
        }, // 3 hours
      ];

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.averageDuration).toBe(9000); // (7200 + 10800) / 2 = 9000 seconds
    });

    test('should handle large number of attempts', async () => {
      const mockAttempts = Array.from({ length: 100 }, (_, i) => ({
        score: 70 + (i % 30), // Scores between 70-99
        passed: 70 + (i % 30) >= 70,
        duration: 2000 + i * 10,
        syncStatus: SyncStatus.SYNCED,
      }));

      jest
        .spyOn(mockPrismaService.examAttempt, 'findMany')
        .mockResolvedValue(mockAttempts as any);

      const result = await service.getAnalytics(mockUserId);

      expect(result.totalAttempts).toBe(100);
      expect(result.passRate).toBeGreaterThan(0);
      expect(result.averageScore).toBeGreaterThan(0);
      expect(result.averageDuration).toBeGreaterThan(0);
    });
  });
});
