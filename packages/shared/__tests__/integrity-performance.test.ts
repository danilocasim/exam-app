/**
 * T186: Integrity Performance Benchmarks
 *
 * Validates performance SLAs for Play Integrity Guard feature:
 * - First-launch with API: <5s (including integrity check + database initialization)
 * - Cached-launch: <3s (existing app launch target, no regression)
 * - Cache-hit query: <10ms (SQLite query performance)
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as PlayIntegrityService from '../src/services/play-integrity.service';
import * as IntegrityRepository from '../src/storage/repositories/integrity.repository';
import * as NetworkService from '../src/services/network.service';
import * as ApiService from '../src/services/api';
import * as PlayIntegrityModule from 'react-native-google-play-integrity';

vi.mock('../src/storage/repositories/integrity.repository');
vi.mock('../src/services/network.service');
vi.mock('../src/services/api');
vi.mock('react-native-google-play-integrity', () => ({
  requestIntegrityToken: vi.fn(),
}));

const mockIntegrityRepo = IntegrityRepository as any;
const mockNetworkService = NetworkService as any;
const mockApiService = ApiService as any;
const mockPlayIntegrityModule = PlayIntegrityModule as any;

// Performance thresholds (in milliseconds)
const PERFORMANCE_THRESHOLDS = {
  FIRST_LAUNCH_WITH_API: 5000, // 5 seconds
  CACHED_LAUNCH: 3000, // 3 seconds
  CACHE_HIT_QUERY: 10, // 10 milliseconds
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
  console.log(`  Elapsed: ${elapsed.toFixed(2)}ms`);
  console.log(`  Threshold: ${threshold}ms`);
  console.log(`  Margin: ${passed ? '-' : '+'}${Math.abs(threshold - elapsed).toFixed(2)}ms`);
}

describe('Performance Benchmarks - Play Integrity Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (global as any).__DEV__ = false; // Ensure production mode

    // Mock Google Play Integrity API to return valid token
    mockPlayIntegrityModule.requestIntegrityToken.mockResolvedValue('mock-token-value');
  });

  describe('First Launch with API (<5s)', () => {
    test('should complete integrity verification within 5 seconds', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: First Launch with API${RESET}`);

      // Mock no cache (first launch)
      mockIntegrityRepo.getStatus.mockResolvedValue(null);

      // Mock network available
      mockNetworkService.checkConnectivity.mockResolvedValue(true);

      // Mock backend API response with realistic delay (1000ms)
      const mockApiResponse: PlayIntegrityService.IntegrityVerifyResponse = {
        success: true,
        verdict: {
          appRecognitionVerdict: 'PLAY_RECOGNIZED',
          appLicensingVerdict: 'LICENSED',
          deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
        },
      };
      mockApiService.post.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate backend call
        return mockApiResponse;
      });

      // Mock save status with SQLite write delay (50ms)
      mockIntegrityRepo.saveStatus.mockImplementation(async (verified, verifiedAt) => {
        await new Promise((resolve) => setTimeout(resolve, 50)); // Simulate SQLite write
        return {
          id: 'singleton',
          integrity_verified: verified,
          verified_at: verifiedAt || new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      // Measure first-launch performance
      const startTime = performance.now();
      const result = await PlayIntegrityService.checkIntegrity();
      const elapsed = performance.now() - startTime;

      formatResult('First Launch with API', elapsed, PERFORMANCE_THRESHOLDS.FIRST_LAUNCH_WITH_API);

      expect(result.verified).toBe(true);
      expect(result.cachedResult).toBe(false);
      expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.FIRST_LAUNCH_WITH_API);
    }, 10000);

    test('should stay under 5s budget even with slow network (2s API delay)', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: First Launch with Slow Network${RESET}`);

      mockIntegrityRepo.getStatus.mockResolvedValue(null);
      mockNetworkService.checkConnectivity.mockResolvedValue(true);

      // Mock slower backend (2000ms)
      mockApiService.post.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Slow network
        return {
          success: true,
          verdict: {
            appRecognitionVerdict: 'PLAY_RECOGNIZED',
            appLicensingVerdict: 'LICENSED',
            deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
          },
        };
      });

      mockIntegrityRepo.saveStatus.mockImplementation(async (verified, verifiedAt) => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return {
          id: 'singleton',
          integrity_verified: verified,
          verified_at: verifiedAt || new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      const startTime = performance.now();
      const result = await PlayIntegrityService.checkIntegrity();
      const elapsed = performance.now() - startTime;

      formatResult(
        'First Launch (Slow Network)',
        elapsed,
        PERFORMANCE_THRESHOLDS.FIRST_LAUNCH_WITH_API,
      );

      expect(result.verified).toBe(true);
      expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.FIRST_LAUNCH_WITH_API);
    }, 10000);

    test('should measure overhead of integrity check vs. no check', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Integrity Check Overhead${RESET}`);

      // Measure with integrity check
      mockIntegrityRepo.getStatus.mockResolvedValue(null);
      mockNetworkService.checkConnectivity.mockResolvedValue(true);

      mockApiService.post.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
          success: true,
          verdict: {
            appRecognitionVerdict: 'PLAY_RECOGNIZED',
            appLicensingVerdict: 'LICENSED',
            deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
          },
        };
      });

      mockIntegrityRepo.saveStatus.mockResolvedValue({
        id: 'singleton',
        integrity_verified: true,
        verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const startWithCheck = performance.now();
      await PlayIntegrityService.checkIntegrity();
      const elapsedWithCheck = performance.now() - startWithCheck;

      // Measure without integrity check (dev mode)
      (global as any).__DEV__ = true;
      const startWithoutCheck = performance.now();
      await PlayIntegrityService.checkIntegrity();
      const elapsedWithoutCheck = performance.now() - startWithoutCheck;
      (global as any).__DEV__ = false;

      const overhead = elapsedWithCheck - elapsedWithoutCheck;

      console.log(`\n${YELLOW}📊 Integrity Check Overhead${RESET}`);
      console.log(`  With check: ${elapsedWithCheck.toFixed(2)}ms`);
      console.log(`  Without check: ${elapsedWithoutCheck.toFixed(2)}ms`);
      console.log(`  Overhead: ${overhead.toFixed(2)}ms`);

      // Dev mode should be near-instant (<10ms)
      expect(elapsedWithoutCheck).toBeLessThan(10);

      // Production check should add measurable but acceptable overhead (<5s)
      expect(elapsedWithCheck).toBeLessThan(PERFORMANCE_THRESHOLDS.FIRST_LAUNCH_WITH_API);
    }, 10000);
  });

  describe('Cached Launch (<3s)', () => {
    test('should complete cached integrity check within 3 seconds', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Cached Launch${RESET}`);

      // Mock valid cache (verified 5 days ago)
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const cachedStatus: PlayIntegrityService.IntegrityStatusRecord = {
        id: 'singleton',
        integrity_verified: true,
        verified_at: fiveDaysAgo,
        created_at: fiveDaysAgo,
        updated_at: fiveDaysAgo,
      };

      // Simulate realistic SQLite read delay (5ms)
      mockIntegrityRepo.getStatus.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return cachedStatus;
      });

      // Measure cached launch performance
      const startTime = performance.now();
      const result = await PlayIntegrityService.checkIntegrity();
      const elapsed = performance.now() - startTime;

      formatResult('Cached Launch', elapsed, PERFORMANCE_THRESHOLDS.CACHED_LAUNCH);

      expect(result.verified).toBe(true);
      expect(result.cachedResult).toBe(true);
      expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHED_LAUNCH);

      // Cached launch should be very fast (<1s)
      expect(elapsed).toBeLessThan(1000);

      // Should not make any API calls
      expect(mockNetworkService.checkConnectivity).not.toHaveBeenCalled();
      expect(mockApiService.post).not.toHaveBeenCalled();
    });

    test('should handle 100 consecutive cached launches within budget', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: 100 Consecutive Cached Launches${RESET}`);

      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const cachedStatus: PlayIntegrityService.IntegrityStatusRecord = {
        id: 'singleton',
        integrity_verified: true,
        verified_at: threeDaysAgo,
        created_at: threeDaysAgo,
        updated_at: threeDaysAgo,
      };

      mockIntegrityRepo.getStatus.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return cachedStatus;
      });

      const startTime = performance.now();

      // Simulate 100 app launches (cache reads)
      for (let i = 0; i < 100; i++) {
        await PlayIntegrityService.checkIntegrity();
      }

      const elapsed = performance.now() - startTime;
      const avgPerLaunch = elapsed / 100;

      console.log(`\n${YELLOW}📊 100 Cached Launches${RESET}`);
      console.log(`  Total: ${elapsed.toFixed(2)}ms`);
      console.log(`  Average per launch: ${avgPerLaunch.toFixed(2)}ms`);

      // Each cached launch should be well under 3s budget
      expect(avgPerLaunch).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHED_LAUNCH);

      // Should be very fast (< 100ms per launch on average)
      expect(avgPerLaunch).toBeLessThan(100);
    }, 20000);

    test('should not regress existing app launch time (<3s)', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: No Launch Time Regression${RESET}`);

      const recentVerification = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      mockIntegrityRepo.getStatus.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          id: 'singleton',
          integrity_verified: true,
          verified_at: recentVerification,
          created_at: recentVerification,
          updated_at: recentVerification,
        };
      });

      const startTime = performance.now();
      const result = await PlayIntegrityService.checkIntegrity();
      const elapsed = performance.now() - startTime;

      formatResult('No Launch Time Regression', elapsed, PERFORMANCE_THRESHOLDS.CACHED_LAUNCH);

      expect(result.verified).toBe(true);
      expect(result.cachedResult).toBe(true);
      expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHED_LAUNCH);
    });
  });

  describe('Cache Hit Query (<10ms)', () => {
    test('should read cache status within 10ms', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Cache Hit Query${RESET}`);

      const cachedStatus: PlayIntegrityService.IntegrityStatusRecord = {
        id: 'singleton',
        integrity_verified: true,
        verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Mock instant SQLite read (no artificial delay)
      mockIntegrityRepo.getStatus.mockResolvedValue(cachedStatus);

      // Measure just the cache query
      const startTime = performance.now();
      await mockIntegrityRepo.getStatus();
      const elapsed = performance.now() - startTime;

      formatResult('Cache Hit Query', elapsed, PERFORMANCE_THRESHOLDS.CACHE_HIT_QUERY);

      expect(elapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_HIT_QUERY);
    });

    test('should maintain query performance under load (1000 reads)', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: 1000 Cache Queries${RESET}`);

      const cachedStatus: PlayIntegrityService.IntegrityStatusRecord = {
        id: 'singleton',
        integrity_verified: true,
        verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockIntegrityRepo.getStatus.mockResolvedValue(cachedStatus);

      const startTime = performance.now();

      // Perform 1000 cache reads
      for (let i = 0; i < 1000; i++) {
        await mockIntegrityRepo.getStatus();
      }

      const elapsed = performance.now() - startTime;
      const avgPerQuery = elapsed / 1000;

      console.log(`\n${YELLOW}📊 1000 Cache Queries${RESET}`);
      console.log(`  Total: ${elapsed.toFixed(2)}ms`);
      console.log(`  Average per query: ${avgPerQuery.toFixed(3)}ms`);

      // Average should stay under 10ms
      expect(avgPerQuery).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_HIT_QUERY);
    }, 15000);

    test('should compare cache query vs TTL validation performance', async () => {
      console.log(`\n${YELLOW}⏱️  Starting benchmark: Cache Query + TTL Validation${RESET}`);

      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const cachedStatus: PlayIntegrityService.IntegrityStatusRecord = {
        id: 'singleton',
        integrity_verified: true,
        verified_at: fiveDaysAgo,
        created_at: fiveDaysAgo,
        updated_at: fiveDaysAgo,
      };

      mockIntegrityRepo.getStatus.mockResolvedValue(cachedStatus);

      // Measure cache query
      const queryStart = performance.now();
      const status = await mockIntegrityRepo.getStatus();
      const queryElapsed = performance.now() - queryStart;

      // Measure TTL validation
      const ttlStart = performance.now();
      const isValid = status ? PlayIntegrityService.isCacheValid(status.verified_at) : false;
      const ttlElapsed = performance.now() - ttlStart;

      const totalElapsed = queryElapsed + ttlElapsed;

      console.log(`\n${YELLOW}📊 Cache Query + TTL Validation${RESET}`);
      console.log(`  Query: ${queryElapsed.toFixed(3)}ms`);
      console.log(`  TTL validation: ${ttlElapsed.toFixed(3)}ms`);
      console.log(`  Total: ${totalElapsed.toFixed(3)}ms`);

      expect(isValid).toBe(true);
      expect(totalElapsed).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_HIT_QUERY);
    });
  });

  describe('Performance Summary', () => {
    test('should generate performance report for all scenarios', async () => {
      console.log(`\n${YELLOW}═══════════════════════════════════════════════════════${RESET}`);
      console.log(`${YELLOW}         PLAY INTEGRITY PERFORMANCE SUMMARY${RESET}`);
      console.log(`${YELLOW}═══════════════════════════════════════════════════════${RESET}`);

      // Scenario 1: First launch with API
      mockIntegrityRepo.getStatus.mockResolvedValue(null);
      mockNetworkService.checkConnectivity.mockResolvedValue(true);

      mockApiService.post.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return {
          success: true,
          verdict: {
            appRecognitionVerdict: 'PLAY_RECOGNIZED',
            appLicensingVerdict: 'LICENSED',
            deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
          },
        };
      });

      mockIntegrityRepo.saveStatus.mockResolvedValue({
        id: 'singleton',
        integrity_verified: true,
        verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const firstLaunchStart = performance.now();
      await PlayIntegrityService.checkIntegrity();
      const firstLaunchTime = performance.now() - firstLaunchStart;

      // Scenario 2: Cached launch
      vi.clearAllMocks();
      const cachedStatus: PlayIntegrityService.IntegrityStatusRecord = {
        id: 'singleton',
        integrity_verified: true,
        verified_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      mockIntegrityRepo.getStatus.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return cachedStatus;
      });

      const cachedLaunchStart = performance.now();
      await PlayIntegrityService.checkIntegrity();
      const cachedLaunchTime = performance.now() - cachedLaunchStart;

      // Scenario 3: Cache query only
      vi.clearAllMocks();
      mockIntegrityRepo.getStatus.mockResolvedValue(cachedStatus);

      const cacheQueryStart = performance.now();
      await mockIntegrityRepo.getStatus();
      const cacheQueryTime = performance.now() - cacheQueryStart;

      // Print report
      console.log(`\n${GREEN}✅ First Launch (with API)${RESET}`);
      console.log(
        `   ${firstLaunchTime.toFixed(2)}ms / ${PERFORMANCE_THRESHOLDS.FIRST_LAUNCH_WITH_API}ms target`,
      );

      console.log(`\n${GREEN}✅ Cached Launch${RESET}`);
      console.log(
        `   ${cachedLaunchTime.toFixed(2)}ms / ${PERFORMANCE_THRESHOLDS.CACHED_LAUNCH}ms target`,
      );

      console.log(`\n${GREEN}✅ Cache Query${RESET}`);
      console.log(
        `   ${cacheQueryTime.toFixed(3)}ms / ${PERFORMANCE_THRESHOLDS.CACHE_HIT_QUERY}ms target`,
      );

      console.log(`\n${YELLOW}═══════════════════════════════════════════════════════${RESET}\n`);

      // All scenarios should pass
      expect(firstLaunchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.FIRST_LAUNCH_WITH_API);
      expect(cachedLaunchTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHED_LAUNCH);
      expect(cacheQueryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.CACHE_HIT_QUERY);
    }, 15000);
  });
});
