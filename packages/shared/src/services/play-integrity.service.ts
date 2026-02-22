/**
 * T152: Play Integrity Service (Phase 3 - Play Integrity Guard)
 *
 * Handles device integrity verification using Google Play Integrity API.
 * Provides one-time verification with 30-day cache TTL.
 * Supports development mode bypass for testing.
 */

import * as Crypto from 'expo-crypto';
import { post } from './api';
import { checkConnectivity } from './network.service';
import { getStatus, saveStatus } from '../storage/repositories/integrity.repository';
import * as PlayIntegrityModule from 'react-native-google-play-integrity';

// ─── Type Definitions ────────────────────────────────────────────────────────

export interface IntegrityStatusRecord {
  id: string; // 'singleton'
  integrity_verified: boolean;
  verified_at: string; // ISO 8601 timestamp
  created_at: string;
  updated_at: string;
}

export interface PlayIntegrityVerdict {
  // Response from Google Play Integrity API (decrypted by backend)
  appRecognitionVerdict: 'PLAY_RECOGNIZED' | 'UNRECOGNIZED_VERSION' | 'UNKNOWN';
  appLicensingVerdict: 'LICENSED' | 'UNLICENSED' | 'UNKNOWN';
  deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY' | 'MEETS_STRONG_INTEGRITY' | 'UNKNOWN';
  [key: string]: unknown; // Other fields from Google (not used for verification)
}

export interface IntegrityCheckResult {
  verified: boolean; // true if all verdicts PASS
  verdict?: PlayIntegrityVerdict; // Full verdict from server (for debugging)
  error?: {
    type: 'TRANSIENT' | 'DEFINITIVE' | 'NETWORK'; // Error category
    message: string; // User-facing message
    code?: string; // Google API error code
  };
  cachedResult?: boolean; // true if result was from local storage
}

export interface PlayIntegrityTokenRequest {
  // Sent from mobile client to backend
  token: string; // Encrypted token from Google Play Integrity API
}

export interface IntegrityVerifyResponse {
  // Received from backend after decryption
  success: boolean;
  verdict?: PlayIntegrityVerdict;
  error?: string;
}

// ─── Service Functions (Stubs) ───────────────────────────────────────────────

/**
 * Check device integrity (main entry point)
 *
 * Flow:
 * 1. If __DEV__ mode → bypass and return verified=true
 * 2. Check cache → if valid (< 30 days) → return cached result
 * 3. Request new token from Google Play Integrity API
 * 4. Send token to backend for decryption
 * 5. Validate verdict and store result
 *
 * @returns IntegrityCheckResult with verified status and optional error
 */
export const checkIntegrity = async (): Promise<IntegrityCheckResult> => {
  // T174/T175: Development mode bypass (FR-011, FR-012)
  if (__DEV__) {
    console.warn('[PlayIntegrity] Bypassed in development mode');
    return {
      verified: true,
      cachedResult: true,
    };
  }

  // Extra logging for network and backend diagnostics
  console.log('[PlayIntegrity] Starting integrity check (not __DEV__)');

  // T176: Cache check logging
  console.log('[PlayIntegrity] Checking cached integrity status...');
  let cachedStatus: IntegrityStatusRecord | null = null;
  try {
    cachedStatus = await getStatus();
  } catch (error) {
    console.warn('[PlayIntegrity] Failed to read cache status:', error);
  }

  if (cachedStatus?.integrity_verified && isCacheValid(cachedStatus.verified_at)) {
    console.log(
      '[PlayIntegrity] Cache hit: integrity verified, TTL:',
      getCacheTTL(cachedStatus.verified_at),
      'seconds',
    );
    return {
      verified: true,
      cachedResult: true,
    };
  } else {
    console.log('[PlayIntegrity] Cache miss or expired');
  }

  const isOnline = await checkConnectivity();
  if (!isOnline) {
    console.error('[PlayIntegrity] Device is offline. Cannot verify integrity.');
    return {
      verified: false,
      error: {
        type: 'NETWORK',
        message: 'Please connect to the internet for first-time verification.',
      },
    };
  } else {
    console.log('[PlayIntegrity] Device is online. Proceeding with token request.');
  }

  let token: string;
  try {
    token = await requestToken();
    console.log('[PlayIntegrity] Token successfully requested. Length:', token?.length);
  } catch (err) {
    console.error('[PlayIntegrity] Error requesting token:', err);
    return {
      verified: false,
      error: {
        type: 'TRANSIENT',
        message: 'Unable to request integrity token. Please try again.',
      },
    };
  }

  let response: IntegrityVerifyResponse;
  try {
    response = await post<IntegrityVerifyResponse, PlayIntegrityTokenRequest>(
      INTEGRITY_VERIFY_ENDPOINT,
      { token },
    );
    console.log('[PlayIntegrity] Backend verification response:', response);
  } catch (err) {
    console.error('[PlayIntegrity] Error posting token to backend:', err);
    return {
      verified: false,
      error: {
        type: 'TRANSIENT',
        message: 'Unable to verify integrity. Please try again.',
      },
    };
  }

  if (!response.success || !response.verdict) {
    return {
      verified: false,
      error: {
        type: 'TRANSIENT',
        message: response.error || 'Token verification failed.',
      },
    };
  }

  const isDefinitiveFailure =
    response.verdict.appRecognitionVerdict === 'UNRECOGNIZED_VERSION' ||
    response.verdict.appLicensingVerdict === 'UNLICENSED' ||
    response.verdict.deviceRecognitionVerdict === 'UNKNOWN';

  if (isDefinitiveFailure) {
    console.warn('[PlayIntegrity] Definitive integrity failure:', {
      appRecognitionVerdict: response.verdict.appRecognitionVerdict,
      appLicensingVerdict: response.verdict.appLicensingVerdict,
      deviceRecognitionVerdict: response.verdict.deviceRecognitionVerdict,
    });
    // Extra: Show verdict values in error message for debugging
    return {
      verified: false,
      verdict: response.verdict,
      error: {
        type: 'DEFINITIVE',
        message:
          'For security reasons, this app must be downloaded from Google Play.\n' +
          'Debug: ' +
          'appRecognitionVerdict=' +
          response.verdict.appRecognitionVerdict +
          ', ' +
          'appLicensingVerdict=' +
          response.verdict.appLicensingVerdict +
          ', ' +
          'deviceRecognitionVerdict=' +
          response.verdict.deviceRecognitionVerdict,
      },
    };
  }

  const verified = validateVerdict(response.verdict);
  if (verified) {
    await saveStatus(true, new Date().toISOString());
    return {
      verified: true,
      verdict: response.verdict,
      cachedResult: false,
    };
  }

  return {
    verified: false,
    verdict: response.verdict,
    error: {
      type: 'TRANSIENT',
      message: 'Integrity check could not be completed. Please try again.',
    },
  };
};

/**
 * Request Play Integrity token from Google
 *
 * Generates a nonce and requests an encrypted token from Google's
 * Play Integrity API. Token must be sent to backend for decryption.
 *
 * @returns Encrypted token string
 * @throws Error if token request fails
 */
export const requestToken = async (): Promise<string> => {
  const nonce = Crypto.randomUUID();

  const requestFn =
    PlayIntegrityModule.requestIntegrityToken || PlayIntegrityModule.getIntegrityToken;

  if (!requestFn) {
    throw new Error('Play Integrity module not available');
  }

  const response = await requestFn(nonce);
  const token = typeof response === 'string' ? response : response?.integrityToken;

  if (!token) {
    throw new Error('Failed to obtain integrity token');
  }

  return token;
};

/**
 * Validate Play Integrity verdict
 *
 * Checks if all verdict fields pass the integrity requirements:
 * - appRecognitionVerdict: PLAY_RECOGNIZED
 * - appLicensingVerdict: LICENSED
 * - deviceRecognitionVerdict: MEETS_DEVICE_INTEGRITY or MEETS_STRONG_INTEGRITY
 *
 * @param verdict - Decrypted verdict from backend
 * @returns true if all checks pass
 */
export const validateVerdict = (verdict: PlayIntegrityVerdict): boolean => {
  const appRecognized = verdict.appRecognitionVerdict === 'PLAY_RECOGNIZED';
  const appLicensed = verdict.appLicensingVerdict === 'LICENSED';
  const deviceTrusted =
    verdict.deviceRecognitionVerdict === 'MEETS_DEVICE_INTEGRITY' ||
    verdict.deviceRecognitionVerdict === 'MEETS_STRONG_INTEGRITY';

  return appRecognized && appLicensed && deviceTrusted;
};

/**
 * Check if cached verification is still valid
 *
 * Verifies the cached result exists and is less than 30 days old.
 *
 * @param verifiedAt - ISO 8601 timestamp of last verification
 * @returns true if cache is valid (< 30 days old)
 */
export const isCacheValid = (verifiedAt: string): boolean => {
  const verifiedDate = new Date(verifiedAt);
  if (Number.isNaN(verifiedDate.getTime())) {
    return false;
  }

  const ageInSeconds = (Date.now() - verifiedDate.getTime()) / 1000;
  return ageInSeconds < CACHE_TTL_SECONDS;
};

/**
 * Get cache TTL in seconds
 *
 * Returns the number of seconds remaining until cache expires.
 * Used for debugging and UI display.
 *
 * @param verifiedAt - ISO 8601 timestamp of last verification
 * @returns Seconds until expiry (0 if already expired)
 */
export const getCacheTTL = (verifiedAt: string): number => {
  const verifiedDate = new Date(verifiedAt);
  if (Number.isNaN(verifiedDate.getTime())) {
    return 0;
  }

  const ageInSeconds = (Date.now() - verifiedDate.getTime()) / 1000;
  const remaining = CACHE_TTL_SECONDS - ageInSeconds;
  return Math.max(0, Math.floor(remaining));
};

// ─── Constants ───────────────────────────────────────────────────────────────

/**
 * Cache TTL in seconds (30 days)
 */
export const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 2592000 seconds

/**
 * Backend endpoint for integrity verification
 */
export const INTEGRITY_VERIFY_ENDPOINT = '/api/integrity/verify';
