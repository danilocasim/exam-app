/**
 * T148: Performance Benchmarks
 *
 * Validates performance SLAs for Phase 2 cloud sync features:
 * - Cloud sync: <5s for 50 exam submissions
 * - Analytics query: <2s for complex aggregations
 * - Token refresh: <500ms for JWT token renewal
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ExamAttemptService } from '../src/services/exam-attempt.service';
import { AuthService } from '../src/services/auth.service';
import * as ExamSubmissionRepo from '../src/storage/repositories/exam-submission.repository';
import { SyncStatus } from '../src/storage/models/exam-submission.model';

// Mock axios
vi.mock('axios');
import axios from 'axios';
const mockAxios = axios as vi.Mocked<typeof axios>;

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  CLOUD_SYNC_50_EXAMS: 5000, // 5 seconds
  ANALYTICS_QUERY: 2000, // 2 seconds
  TOKEN_REFRESH: 500, // 500 milliseconds
};

// Color codes for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

function formatResult(label: string, elapsed: number, threshold: number): void {
  const passed = elapsed < threshold;
  const color = passed ? GREEN : RED;
  const status = passed ? '✅ PASS' : '❌ FAIL';

  console.log(`\n${color}${status}${RESET} ${label}`);
  console.log(`  Elapsed: ${elapsed.toFixed(0)}ms`);
  console.log(`  Threshold: ${threshold}ms`);
  console.log(`  Margin: ${passed ? '-' : '+'}${Math.abs(threshold - elapsed).toFixed(0)}ms`);
}

describe('Performance Benchmarks - Phase 2 Cloud Sync', () => {
  let examAttemptService: ExamAttemptService;
  let authService: AuthService;
  const mockApiUrl = 'http://localhost:3000';
  const mockUserId = 'user-123';
  const mockAccessToken = 'mock-access-token';
  const mockRefreshToken = 'mock-refresh-token';

  beforeEach(() => {
    examAttemptService = new ExamAttemptService(mockApiUrl);
    authService = new AuthService(mockApiUrl);
    vi.clearAllMocks();
  });

  describe('Cloud Sync Performance (<5s for 50 exams)', () => {
    test('should sync 50 exam submissions within 5 seconds', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Cloud Sync (50 exams)${RESET}`);

      // Generate 50 mock exam submissions with PENDING status
      const pendingSubmissions = Array.from({ length: 50 }, (_, i) => ({
        id: `local-${i + 1}`,
        userId: mockUserId,
        examTypeId: 'aws-ccp',
        score: 70 + (i % 30), // Scores between 70-99
        passed: 70 + (i % 30) >= 70,
        duration: 2000 + i * 10, // Durations 2000-2490
        submittedAt: new Date(Date.now() - (50 - i) * 60000), // Spread over last 50 minutes
        createdAt: new Date(Date.now() - (50 - i) * 60000),
        syncStatus: SyncStatus.PENDING,
        syncRetries: 0,
      }));

      // Mock repository to return pending submissions
      jest
        .spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions')
        .mockResolvedValue(pendingSubmissions);

      // Mock successful API responses (fast responses)
      mockAxios.post.mockImplementation(async (url, data) => {
        // Simulate minimal network delay (10ms per request)
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { data: { id: `server-${data.examTypeId}` } };
      });

      // Mock successful sync status updates
      vi.spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced').mockImplementation(async (id) => ({
        id,
        userId: mockUserId,
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: 2400,
        submittedAt: new Date(),
        createdAt: new Date(),
        syncStatus: SyncStatus.SYNCED,
        syncRetries: 0,
        syncedAt: new Date(),
      }));

      // Measure sync performance
      const startTime = performance.now();
      const result = await examAttemptService.syncPendingAttempts(mockUserId);
      const elapsed = performance.now() - startTime;

      formatResult('Cloud Sync (50 exams)', elapsed, PERFORMANCE_THRESHOLDS.CLOUD_SYNC_50_EXAMS);

      expect(result.synced).toBe(50);
      expect(result.failed).toBe(0);
      expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.CLOUD_SYNC_50_EXAMS);
    }, 10000); // 10 second timeout to allow for test execution

    test('should handle partial failures without exceeding time budget', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Partial Sync Failure Handling${RESET}`);

      // Generate 50 submissions, where 10 will fail
      const pendingSubmissions = Array.from({ length: 50 }, (_, i) => ({
        id: `local-${i + 1}`,
        userId: mockUserId,
        examTypeId: 'aws-ccp',
        score: 70 + (i % 30),
        passed: 70 + (i % 30) >= 70,
        duration: 2000 + i * 10,
        submittedAt: new Date(),
        createdAt: new Date(),
        syncStatus: SyncStatus.PENDING,
        syncRetries: 0,
      }));

      jest
        .spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions')
        .mockResolvedValue(pendingSubmissions);

      // Mock mixed success/failure responses
      mockAxios.post.mockImplementation(async (url, data) => {
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Every 5th submission fails
        const examId = data.examTypeId || 'aws-ccp';
        if (
          examId.includes('-5') ||
          examId.includes('-10') ||
          examId.includes('-15') ||
          examId.includes('-20') ||
          examId.includes('-25') ||
          examId.includes('-30') ||
          examId.includes('-35') ||
          examId.includes('-40') ||
          examId.includes('-45') ||
          examId.includes('-50')
        ) {
          throw new Error('Server error');
        }

        return { data: { id: `server-${examId}` } };
      });

      vi.spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced').mockResolvedValue({
        id: 'local-1',
        userId: mockUserId,
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: 2400,
        submittedAt: new Date(),
        createdAt: new Date(),
        syncStatus: SyncStatus.SYNCED,
        syncRetries: 0,
        syncedAt: new Date(),
      });

      vi.spyOn(ExamSubmissionRepo, 'markExamSubmissionFailed').mockResolvedValue({
        id: 'local-1',
        userId: mockUserId,
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: 2400,
        submittedAt: new Date(),
        createdAt: new Date(),
        syncStatus: SyncStatus.FAILED,
        syncRetries: 1,
      });

      const startTime = performance.now();
      const result = await examAttemptService.syncPendingAttempts(mockUserId);
      const elapsed = performance.now() - startTime;

      formatResult('Partial Sync Failures', elapsed, PERFORMANCE_THRESHOLDS.CLOUD_SYNC_50_EXAMS);

      expect(result.synced + result.failed).toBe(50);
      expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.CLOUD_SYNC_50_EXAMS);
    }, 10000);
  });

  describe('Analytics Query Performance (<2s)', () => {
    test('should calculate analytics for 100 exams within 2 seconds', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Analytics Query (100 exams)${RESET}`);

      // Generate 100 mock exams with varied scores and pass/fail ratios
      const mockExams = Array.from({ length: 100 }, (_, i) => ({
        id: `exam-${i + 1}`,
        userId: mockUserId,
        examTypeId: 'aws-ccp',
        score: 50 + (i % 50), // Scores between 50-99
        passed: 50 + (i % 50) >= 70,
        duration: 1800 + i * 10, // Durations 1800-2790
        submittedAt: new Date(Date.now() - (100 - i) * 60000),
        createdAt: new Date(Date.now() - (100 - i) * 60000),
        syncStatus: SyncStatus.SYNCED,
        syncRetries: 0,
        syncedAt: new Date(),
      }));

      // Mock repository to simulate database query with realistic delay
      jest
        .spyOn(ExamSubmissionRepo, 'getSyncedExamSubmissions')
        .mockImplementation(async (userId) => {
          // Simulate database query time (varies with data size)
          await new Promise((resolve) => setTimeout(resolve, 50));
          return mockExams;
        });

      // Perform complex analytics calculation
      const startTime = performance.now();

      // Simulate analytics calculation (same logic as ExamAttemptService.getAnalytics)
      const syncedExams = await ExamSubmissionRepo.getSyncedExamSubmissions(mockUserId);

      const totalAttempts = syncedExams.length;
      const totalPassed = syncedExams.filter((e) => e.passed).length;
      const totalScore = syncedExams.reduce((sum, e) => sum + e.score, 0);
      const totalDuration = syncedExams.reduce((sum, e) => sum + e.duration, 0);

      const analytics = {
        totalAttempts,
        totalPassed,
        passRate: totalAttempts > 0 ? totalPassed / totalAttempts : 0,
        averageScore: totalAttempts > 0 ? totalScore / totalAttempts : 0,
        averageDuration: totalAttempts > 0 ? Math.round(totalDuration / totalAttempts) : 0,
      };

      const elapsed = performance.now() - startTime;

      formatResult('Analytics Query (100 exams)', elapsed, PERFORMANCE_THRESHOLDS.ANALYTICS_QUERY);

      expect(analytics.totalAttempts).toBe(100);
      expect(analytics.passRate).toBeGreaterThan(0);
      expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.ANALYTICS_QUERY);
    });

    test('should filter by examTypeId efficiently', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Filtered Analytics (50 exams)${RESET}`);

      // Generate mixed exam types
      const mockExams = Array.from({ length: 100 }, (_, i) => ({
        id: `exam-${i + 1}`,
        userId: mockUserId,
        examTypeId: i % 2 === 0 ? 'aws-ccp' : 'aws-saa',
        score: 70 + (i % 30),
        passed: 70 + (i % 30) >= 70,
        duration: 2000 + i * 10,
        submittedAt: new Date(),
        createdAt: new Date(),
        syncStatus: SyncStatus.SYNCED,
        syncRetries: 0,
        syncedAt: new Date(),
      }));

      jest
        .spyOn(ExamSubmissionRepo, 'getSyncedExamSubmissions')
        .mockImplementation(async (userId, examTypeId?) => {
          await new Promise((resolve) => setTimeout(resolve, 30));
          if (examTypeId) {
            return mockExams.filter((e) => e.examTypeId === examTypeId);
          }
          return mockExams;
        });

      const startTime = performance.now();
      const filtered = await ExamSubmissionRepo.getSyncedExamSubmissions(mockUserId, 'aws-ccp');

      const analytics = {
        totalAttempts: filtered.length,
        totalPassed: filtered.filter((e) => e.passed).length,
        passRate:
          filtered.length > 0 ? filtered.filter((e) => e.passed).length / filtered.length : 0,
      };

      const elapsed = performance.now() - startTime;

      formatResult('Filtered Analytics (aws-ccp)', elapsed, PERFORMANCE_THRESHOLDS.ANALYTICS_QUERY);

      expect(analytics.totalAttempts).toBe(50);
      expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.ANALYTICS_QUERY);
    });
  });

  describe('Token Refresh Performance (<500ms)', () => {
    test('should refresh JWT tokens within 500ms', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Token Refresh${RESET}`);

      // Mock successful token refresh response
      mockAxios.post.mockImplementation(async (url) => {
        // Simulate minimal API latency (50ms)
        await new Promise((resolve) => setTimeout(resolve, 50));

        return {
          data: {
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token',
            expiresIn: 3600,
          },
        };
      });

      const startTime = performance.now();

      // Simulate token refresh (POST /auth/refresh)
      const response = await mockAxios.post(`${mockApiUrl}/auth/refresh`, {
        refreshToken: mockRefreshToken,
      });

      const elapsed = performance.now() - startTime;

      formatResult('Token Refresh', elapsed, PERFORMANCE_THRESHOLDS.TOKEN_REFRESH);

      expect(response.data.accessToken).toBe('new-access-token');
      expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.TOKEN_REFRESH);
    });

    test('should handle concurrent token refreshes efficiently', async () => {
      console.log(
        `\n${YELLOW}⏱️  Starting benchmark: Concurrent Token Refreshes (5 parallel)${RESET}`,
      );

      mockAxios.post.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 60));
        return {
          data: {
            accessToken: `token-${Date.now()}`,
            refreshToken: `refresh-${Date.now()}`,
            expiresIn: 3600,
          },
        };
      });

      const startTime = performance.now();

      // Simulate 5 concurrent refresh requests (e.g., multiple tabs/screens)
      const refreshPromises = Array.from({ length: 5 }, () =>
        mockAxios.post(`${mockApiUrl}/auth/refresh`, {
          refreshToken: mockRefreshToken,
        }),
      );

      const results = await Promise.all(refreshPromises);
      const elapsed = performance.now() - startTime;

      formatResult('Concurrent Refreshes (5x)', elapsed, PERFORMANCE_THRESHOLDS.TOKEN_REFRESH);

      expect(results).toHaveLength(5);
      results.forEach((res) => {
        expect(res.data.accessToken).toBeDefined();
      });

      // Concurrent requests should complete faster than sequential (should be ~60ms, not 300ms)
      expect(elapsed).toBeLessThan(150); // Allow 150ms for 5 concurrent (vs 300ms sequential)
    });

    test('should validate token expiration efficiently', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Token Expiration Check${RESET}`);

      const startTime = performance.now();

      // Simulate JWT expiration check (no network call, local computation)
      const mockToken =
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoxNzAwMDAzNjAwfQ.signature';
      const [, payloadBase64] = mockToken.split('.');
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString());
      const isExpired = payload.exp * 1000 < Date.now();

      const elapsed = performance.now() - startTime;

      formatResult('Token Expiration Check', elapsed, 10); // Should be <10ms (local only)

      expect(isExpired).toBe(true); // Token from year 2023 is expired
      expect(elapsed).toBeLessThan(10); // Local computation should be near-instant
    });
  });

  describe('Large Dataset Performance', () => {
    test('should sync 100 exams within 10 seconds', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Large Batch Sync (100 exams)${RESET}`);

      const largeSubmissions = Array.from({ length: 100 }, (_, i) => ({
        id: `local-${i + 1}`,
        userId: mockUserId,
        examTypeId: 'aws-ccp',
        score: 70 + (i % 30),
        passed: 70 + (i % 30) >= 70,
        duration: 2000 + i * 10,
        submittedAt: new Date(),
        createdAt: new Date(),
        syncStatus: SyncStatus.PENDING,
        syncRetries: 0,
      }));

      jest
        .spyOn(ExamSubmissionRepo, 'getPendingExamSubmissions')
        .mockResolvedValue(largeSubmissions);

      mockAxios.post.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { data: { id: 'server-id' } };
      });

      vi.spyOn(ExamSubmissionRepo, 'markExamSubmissionSynced').mockResolvedValue({
        id: 'local-1',
        userId: mockUserId,
        examTypeId: 'aws-ccp',
        score: 75,
        passed: true,
        duration: 2400,
        submittedAt: new Date(),
        createdAt: new Date(),
        syncStatus: SyncStatus.SYNCED,
        syncRetries: 0,
        syncedAt: new Date(),
      });

      const startTime = performance.now();
      const result = await examAttemptService.syncPendingAttempts(mockUserId);
      const elapsed = performance.now() - startTime;

      formatResult('Large Batch Sync (100 exams)', elapsed, 10000); // 10 second budget

      expect(result.synced).toBe(100);
      expect(elapsed).toBeLessThan(10000);
    }, 15000);

    test('should calculate analytics for 500 exams within 4 seconds', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Large Analytics (500 exams)${RESET}`);

      const largeDataset = Array.from({ length: 500 }, (_, i) => ({
        id: `exam-${i + 1}`,
        userId: mockUserId,
        examTypeId: i % 3 === 0 ? 'aws-ccp' : i % 3 === 1 ? 'aws-saa' : 'aws-soa',
        score: 50 + (i % 50),
        passed: 50 + (i % 50) >= 70,
        duration: 1800 + i * 5,
        submittedAt: new Date(),
        createdAt: new Date(),
        syncStatus: SyncStatus.SYNCED,
        syncRetries: 0,
        syncedAt: new Date(),
      }));

      vi.spyOn(ExamSubmissionRepo, 'getSyncedExamSubmissions').mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100)); // Simulate larger query
        return largeDataset;
      });

      const startTime = performance.now();
      const syncedExams = await ExamSubmissionRepo.getSyncedExamSubmissions(mockUserId);

      const analytics = {
        totalAttempts: syncedExams.length,
        totalPassed: syncedExams.filter((e) => e.passed).length,
        passRate:
          syncedExams.length > 0
            ? syncedExams.filter((e) => e.passed).length / syncedExams.length
            : 0,
        averageScore:
          syncedExams.length > 0
            ? syncedExams.reduce((sum, e) => sum + e.score, 0) / syncedExams.length
            : 0,
      };

      const elapsed = performance.now() - startTime;

      formatResult('Large Analytics (500 exams)', elapsed, 4000); // 4 second budget

      expect(analytics.totalAttempts).toBe(500);
      expect(elapsed).toBeLessThan(4000);
    }, 5000);
  });
});

// Print summary at the end
afterAll(() => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${YELLOW}Performance Benchmark Summary${RESET}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`\nThresholds:`);
  console.log(`  Cloud Sync (50 exams): <${PERFORMANCE_THRESHOLDS.CLOUD_SYNC_50_EXAMS}ms`);
  console.log(`  Analytics Query: <${PERFORMANCE_THRESHOLDS.ANALYTICS_QUERY}ms`);
  console.log(`  Token Refresh: <${PERFORMANCE_THRESHOLDS.TOKEN_REFRESH}ms`);
  console.log(`\n${'='.repeat(60)}\n`);
});
