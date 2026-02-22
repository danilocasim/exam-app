/**
 * T181: Play Integrity Service Unit Tests
 *
 * Tests for Play Integrity Service core logic:
 * - Verdict parsing and validation
 * - Cache TTL logic (30-day expiration)
 * - Definitive vs. transient error distinction
 * - Development mode bypass
 * - Mock Google API responses and SQLite queries
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import * as PlayIntegrityService from '../src/services/play-integrity.service';
import * as IntegrityRepository from '../src/storage/repositories/integrity.repository';
import * as NetworkService from '../src/services/network.service';
import * as ApiService from '../src/services/api';
import * as PlayIntegrityModule from 'react-native-google-play-integrity';

// Mock dependencies
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

describe('Play Integrity Service - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset __DEV__ to false for most tests
    (global as any).__DEV__ = false;
  });

  describe('Verdict Validation', () => {
    test('should validate verdict when all checks pass (PLAY_RECOGNIZED + LICENSED + MEETS_DEVICE_INTEGRITY)', () => {
      const verdict: PlayIntegrityService.PlayIntegrityVerdict = {
        appRecognitionVerdict: 'PLAY_RECOGNIZED',
        appLicensingVerdict: 'LICENSED',
        deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
      };

      const result = PlayIntegrityService.validateVerdict(verdict);
      expect(result).toBe(true);
    });

    test('should validate verdict when all checks pass (PLAY_RECOGNIZED + LICENSED + MEETS_STRONG_INTEGRITY)', () => {
      const verdict: PlayIntegrityService.PlayIntegrityVerdict = {
        appRecognitionVerdict: 'PLAY_RECOGNIZED',
        appLicensingVerdict: 'LICENSED',
        deviceRecognitionVerdict: 'MEETS_STRONG_INTEGRITY',
      };

      const result = PlayIntegrityService.validateVerdict(verdict);
      expect(result).toBe(true);
    });

    test('should reject verdict when app is UNRECOGNIZED_VERSION', () => {
      const verdict: PlayIntegrityService.PlayIntegrityVerdict = {
        appRecognitionVerdict: 'UNRECOGNIZED_VERSION',
        appLicensingVerdict: 'LICENSED',
        deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
      };

      const result = PlayIntegrityService.validateVerdict(verdict);
      expect(result).toBe(false);
    });

    test('should reject verdict when app is UNLICENSED (sideloaded)', () => {
      const verdict: PlayIntegrityService.PlayIntegrityVerdict = {
        appRecognitionVerdict: 'PLAY_RECOGNIZED',
        appLicensingVerdict: 'UNLICENSED',
        deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
      };

      const result = PlayIntegrityService.validateVerdict(verdict);
      expect(result).toBe(false);
    });

    test('should reject verdict when device integrity is UNKNOWN (rooted device)', () => {
      const verdict: PlayIntegrityService.PlayIntegrityVerdict = {
        appRecognitionVerdict: 'PLAY_RECOGNIZED',
        appLicensingVerdict: 'LICENSED',
        deviceRecognitionVerdict: 'UNKNOWN',
      };

      const result = PlayIntegrityService.validateVerdict(verdict);
      expect(result).toBe(false);
    });

    test('should reject verdict when multiple checks fail', () => {
      const verdict: PlayIntegrityService.PlayIntegrityVerdict = {
        appRecognitionVerdict: 'UNKNOWN',
        appLicensingVerdict: 'UNLICENSED',
        deviceRecognitionVerdict: 'UNKNOWN',
      };

      const result = PlayIntegrityService.validateVerdict(verdict);
      expect(result).toBe(false);
    });
  });

  describe('Cache TTL Logic', () => {
    test('should consider cache valid if verified less than 30 days ago', () => {
      // Verified 15 days ago
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const result = PlayIntegrityService.isCacheValid(fifteenDaysAgo);
      expect(result).toBe(true);
    });

    test('should consider cache valid if verified 29 days ago (edge case)', () => {
      // Verified 29 days ago
      const twentyNineDaysAgo = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString();
      const result = PlayIntegrityService.isCacheValid(twentyNineDaysAgo);
      expect(result).toBe(true);
    });

    test('should consider cache invalid if verified 31 days ago', () => {
      // Verified 31 days ago
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
      const result = PlayIntegrityService.isCacheValid(thirtyOneDaysAgo);
      expect(result).toBe(false);
    });

    test('should consider cache invalid if timestamp is malformed', () => {
      const result = PlayIntegrityService.isCacheValid('invalid-timestamp');
      expect(result).toBe(false);
    });

    test('should consider cache invalid if timestamp is empty string', () => {
      const result = PlayIntegrityService.isCacheValid('');
      expect(result).toBe(false);
    });

    test('should calculate correct TTL for recent verification (15 days ago)', () => {
      const fifteenDaysAgo = new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString();
      const ttl = PlayIntegrityService.getCacheTTL(fifteenDaysAgo);

      // Expected: 15 days remaining (approximately)
      const expectedSeconds = 15 * 24 * 60 * 60;
      expect(ttl).toBeGreaterThan(expectedSeconds - 100); // Allow 100s tolerance
      expect(ttl).toBeLessThan(expectedSeconds + 100);
    });

    test('should return 0 TTL for expired cache', () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      const ttl = PlayIntegrityService.getCacheTTL(fortyDaysAgo);
      expect(ttl).toBe(0);
    });

    test('should return 0 TTL for malformed timestamp', () => {
      const ttl = PlayIntegrityService.getCacheTTL('not-a-timestamp');
      expect(ttl).toBe(0);
    });
  });

  describe('checkIntegrity - Development Mode Bypass', () => {
    test('should bypass integrity check in __DEV__ mode', async () => {
      (global as any).__DEV__ = true;

      const result = await PlayIntegrityService.checkIntegrity();

      expect(result.verified).toBe(true);
      expect(result.cachedResult).toBe(true);
      expect(result.error).toBeUndefined();

      // Should not call any external services
      expect(mockIntegrityRepo.getStatus).not.toHaveBeenCalled();
      expect(mockNetworkService.checkConnectivity).not.toHaveBeenCalled();
    });
  });

  describe('checkIntegrity - Cache Hit', () => {
    test('should return cached result if verification is valid (< 30 days)', async () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const cachedStatus: PlayIntegrityService.IntegrityStatusRecord = {
        id: 'singleton',
        integrity_verified: true,
        verified_at: tenDaysAgo,
        created_at: tenDaysAgo,
        updated_at: tenDaysAgo,
      };

      mockIntegrityRepo.getStatus.mockResolvedValue(cachedStatus);

      const result = await PlayIntegrityService.checkIntegrity();

      expect(result.verified).toBe(true);
      expect(result.cachedResult).toBe(true);
      expect(result.error).toBeUndefined();
      expect(mockIntegrityRepo.getStatus).toHaveBeenCalledTimes(1);

      // Should not make network calls if cache hit
      expect(mockNetworkService.checkConnectivity).not.toHaveBeenCalled();
      expect(mockApiService.post).not.toHaveBeenCalled();
    });

    test('should ignore expired cache (> 30 days) and proceed to API verification', async () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      const expiredStatus: PlayIntegrityService.IntegrityStatusRecord = {
        id: 'singleton',
        integrity_verified: true,
        verified_at: fortyDaysAgo,
        created_at: fortyDaysAgo,
        updated_at: fortyDaysAgo,
      };

      mockIntegrityRepo.getStatus.mockResolvedValue(expiredStatus);
      mockNetworkService.checkConnectivity.mockResolvedValue(true);

      // Mock token request
      mockPlayIntegrityModule.requestIntegrityToken.mockResolvedValue({
        integrityToken: 'mock-token-123',
      });

      // Mock API response
      const mockApiResponse: PlayIntegrityService.IntegrityVerifyResponse = {
        success: true,
        verdict: {
          appRecognitionVerdict: 'PLAY_RECOGNIZED',
          appLicensingVerdict: 'LICENSED',
          deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
        },
      };
      mockApiService.post.mockResolvedValue(mockApiResponse);
      mockIntegrityRepo.saveStatus.mockResolvedValue({
        id: 'singleton',
        integrity_verified: true,
        verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      const result = await PlayIntegrityService.checkIntegrity();

      expect(result.verified).toBe(true);
      expect(result.cachedResult).toBe(false); // Fresh verification
      expect(mockNetworkService.checkConnectivity).toHaveBeenCalled();
      expect(mockApiService.post).toHaveBeenCalled();
    });
  });

  describe('checkIntegrity - Network Errors', () => {
    test('should return NETWORK error when offline and no cache available', async () => {
      mockIntegrityRepo.getStatus.mockResolvedValue(null); // No cache
      mockNetworkService.checkConnectivity.mockResolvedValue(false); // Offline

      const result = await PlayIntegrityService.checkIntegrity();

      expect(result.verified).toBe(false);
      expect(result.error?.type).toBe('NETWORK');
      expect(result.error?.message).toContain('connect to the internet');
    });

    test('should return TRANSIENT error when token request fails', async () => {
      mockIntegrityRepo.getStatus.mockResolvedValue(null);
      mockNetworkService.checkConnectivity.mockResolvedValue(true);

      // Mock token request failure
      mockPlayIntegrityModule.requestIntegrityToken.mockRejectedValue(
        new Error('Token request failed'),
      );

      const result = await PlayIntegrityService.checkIntegrity();

      expect(result.verified).toBe(false);
      expect(result.error?.type).toBe('TRANSIENT');
      expect(result.error?.message).toContain('Unable to request integrity token');
    });

    test('should return TRANSIENT error when API call fails', async () => {
      mockIntegrityRepo.getStatus.mockResolvedValue(null);
      mockNetworkService.checkConnectivity.mockResolvedValue(true);

      // Mock token request success
      mockPlayIntegrityModule.requestIntegrityToken.mockResolvedValue({
        integrityToken: 'mock-token-123',
      });

      // Mock API failure
      mockApiService.post.mockRejectedValue(new Error('API timeout'));

      const result = await PlayIntegrityService.checkIntegrity();

      expect(result.verified).toBe(false);
      expect(result.error?.type).toBe('TRANSIENT');
      expect(result.error?.message).toContain('Unable to verify integrity');
    });
  });

  describe('checkIntegrity - Definitive vs. Transient Errors', () => {
    beforeEach(() => {
      mockIntegrityRepo.getStatus.mockResolvedValue(null);
      mockNetworkService.checkConnectivity.mockResolvedValue(true);
    });

    test('should return DEFINITIVE error for UNLICENSED app (sideloaded)', async () => {
      // Mock token request
      mockPlayIntegrityModule.requestIntegrityToken.mockResolvedValue({
        integrityToken: 'mock-token-123',
      });

      // Mock API response with UNLICENSED verdict
      const mockApiResponse: PlayIntegrityService.IntegrityVerifyResponse = {
        success: true,
        verdict: {
          appRecognitionVerdict: 'PLAY_RECOGNIZED',
          appLicensingVerdict: 'UNLICENSED',
          deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
        },
      };
      mockApiService.post.mockResolvedValue(mockApiResponse);

      const result = await PlayIntegrityService.checkIntegrity();

      expect(result.verified).toBe(false);
      expect(result.error?.type).toBe('DEFINITIVE');
      expect(result.error?.message).toContain('downloaded from Google Play');
      expect(mockIntegrityRepo.saveStatus).not.toHaveBeenCalled(); // Should not cache failure
    });

    test('should return DEFINITIVE error for UNRECOGNIZED_VERSION', async () => {
      mockPlayIntegrityModule.requestIntegrityToken.mockResolvedValue({
        integrityToken: 'mock-token-123',
      });

      const mockApiResponse: PlayIntegrityService.IntegrityVerifyResponse = {
        success: true,
        verdict: {
          appRecognitionVerdict: 'UNRECOGNIZED_VERSION',
          appLicensingVerdict: 'LICENSED',
          deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
        },
      };
      mockApiService.post.mockResolvedValue(mockApiResponse);

      const result = await PlayIntegrityService.checkIntegrity();

      expect(result.verified).toBe(false);
      expect(result.error?.type).toBe('DEFINITIVE');
      expect(result.error?.message).toContain('downloaded from Google Play');
    });

    test('should return DEFINITIVE error for device with UNKNOWN integrity (rooted)', async () => {
      mockPlayIntegrityModule.requestIntegrityToken.mockResolvedValue({
        integrityToken: 'mock-token-123',
      });

      const mockApiResponse: PlayIntegrityService.IntegrityVerifyResponse = {
        success: true,
        verdict: {
          appRecognitionVerdict: 'PLAY_RECOGNIZED',
          appLicensingVerdict: 'LICENSED',
          deviceRecognitionVerdict: 'UNKNOWN',
        },
      };
      mockApiService.post.mockResolvedValue(mockApiResponse);

      const result = await PlayIntegrityService.checkIntegrity();

      expect(result.verified).toBe(false);
      expect(result.error?.type).toBe('DEFINITIVE');
      expect(result.error?.message).toContain('downloaded from Google Play');
    });

    test('should return TRANSIENT error for UNKNOWN verdicts (API transient error)', async () => {
      mockPlayIntegrityModule.requestIntegrityToken.mockResolvedValue({
        integrityToken: 'mock-token-123',
      });

      // API returns success but with UNKNOWN verdicts (not definitive - could retry)
      const mockApiResponse: PlayIntegrityService.IntegrityVerifyResponse = {
        success: true,
        verdict: {
          appRecognitionVerdict: 'UNKNOWN',
          appLicensingVerdict: 'UNKNOWN',
          deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
        },
      };
      mockApiService.post.mockResolvedValue(mockApiResponse);

      const result = await PlayIntegrityService.checkIntegrity();

      expect(result.verified).toBe(false);
      expect(result.error?.type).toBe('TRANSIENT');
      expect(result.error?.message).toContain('could not be completed');
    });
  });

  describe('checkIntegrity - Successful Verification', () => {
    test('should save verification result and return success for valid verdict', async () => {
      mockIntegrityRepo.getStatus.mockResolvedValue(null);
      mockNetworkService.checkConnectivity.mockResolvedValue(true);

      mockPlayIntegrityModule.requestIntegrityToken.mockResolvedValue({
        integrityToken: 'mock-token-123',
      });

      const mockApiResponse: PlayIntegrityService.IntegrityVerifyResponse = {
        success: true,
        verdict: {
          appRecognitionVerdict: 'PLAY_RECOGNIZED',
          appLicensingVerdict: 'LICENSED',
          deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY',
        },
      };
      mockApiService.post.mockResolvedValue(mockApiResponse);

      const mockSavedStatus: PlayIntegrityService.IntegrityStatusRecord = {
        id: 'singleton',
        integrity_verified: true,
        verified_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockIntegrityRepo.saveStatus.mockResolvedValue(mockSavedStatus);

      const result = await PlayIntegrityService.checkIntegrity();

      expect(result.verified).toBe(true);
      expect(result.cachedResult).toBe(false);
      expect(result.verdict).toEqual(mockApiResponse.verdict);
      expect(mockIntegrityRepo.saveStatus).toHaveBeenCalledWith(
        true,
        expect.any(String), // ISO timestamp
      );
    });
  });

  describe('Constants', () => {
    test('CACHE_TTL_SECONDS should be 30 days in seconds', () => {
      expect(PlayIntegrityService.CACHE_TTL_SECONDS).toBe(30 * 24 * 60 * 60);
      expect(PlayIntegrityService.CACHE_TTL_SECONDS).toBe(2592000);
    });

    test('INTEGRITY_VERIFY_ENDPOINT should be correct API path', () => {
      expect(PlayIntegrityService.INTEGRITY_VERIFY_ENDPOINT).toBe('/api/integrity/verify');
    });
  });
});
