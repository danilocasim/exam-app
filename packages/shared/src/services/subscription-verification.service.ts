/**
 * Subscription Verification Service — Server-side subscription validation.
 *
 * Periodically verifies subscription status with the backend to prevent
 * client-side premium spoofing. Calls POST /api/billing/verify-subscription
 * on app launch + every 24 hours while the app is active.
 *
 * If the server returns valid: false, the user is downgraded to FREE tier.
 * On network failure, the current tier is preserved (offline-first principle).
 */

import { AppState, type AppStateStatus } from 'react-native';
import { post } from './api';
import { usePurchaseStore } from '../stores/purchase.store';
import { getPurchaseStatus } from '../storage/repositories/purchase.repository';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VerifySubscriptionResponse {
  valid: boolean;
  expiryTimeMillis: number;
  autoRenewing: boolean;
  paymentState: number;
  cancelReason?: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

/** How often to re-verify with the server (24 hours in ms) */
const VERIFICATION_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Minimum time between verification attempts to avoid hammering the server */
const MIN_VERIFICATION_GAP_MS = 5 * 60 * 1000; // 5 minutes

// ─── Module State ────────────────────────────────────────────────────────────

let periodicTimer: ReturnType<typeof setInterval> | null = null;
let appStateSubscription: { remove: () => void } | null = null;
let lastVerificationAttempt = 0;
let currentPackageName: string | null = null;

// ─── Core Verification ──────────────────────────────────────────────────────

/**
 * Verify subscription status with the server.
 *
 * Reads the stored purchase token from SQLite and sends it to the backend
 * for server-side validation against Google Play Developer API.
 *
 * @param packageName - Android package name (e.g., "com.danilocasim.dojoexam.clfc02")
 * @returns true if verification was performed, false if skipped
 */
export const verifySubscriptionWithServer = async (packageName: string): Promise<boolean> => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log('[SubscriptionVerify] Skipped in dev mode');
    return false;
  }

  const store = usePurchaseStore.getState();

  // Only verify if user claims PREMIUM
  if (store.tierLevel !== 'PREMIUM') {
    return false;
  }

  // Get purchase token from SQLite (authoritative local source)
  const purchaseStatus = await getPurchaseStatus();
  if (!purchaseStatus?.purchase_token) {
    // PREMIUM in store but no purchase token → suspicious, downgrade
    console.warn('[SubscriptionVerify] PREMIUM but no purchase token found — downgrading');
    await store.reset();
    return true;
  }

  // Throttle verification attempts
  const now = Date.now();
  if (now - lastVerificationAttempt < MIN_VERIFICATION_GAP_MS) {
    return false;
  }
  lastVerificationAttempt = now;

  try {
    const response = await post<VerifySubscriptionResponse>('/api/billing/verify-subscription', {
      packageName,
      purchaseToken: purchaseStatus.purchase_token,
      productId: purchaseStatus.product_id ?? '',
    });

    if (!response.valid) {
      // Server says subscription is invalid → downgrade to FREE
      console.warn('[SubscriptionVerify] Server says subscription INVALID — downgrading', {
        paymentState: response.paymentState,
        cancelReason: response.cancelReason,
      });
      await store.reset();
      return true;
    }

    // Server confirmed valid — update local metadata if it differs
    const serverExpiryDate = response.expiryTimeMillis
      ? new Date(response.expiryTimeMillis).toISOString()
      : purchaseStatus.expiry_date;

    const needsUpdate =
      serverExpiryDate !== purchaseStatus.expiry_date ||
      response.autoRenewing !== purchaseStatus.auto_renewing;

    if (needsUpdate && purchaseStatus.product_id && purchaseStatus.subscription_type) {
      await store.setSubscription(
        purchaseStatus.product_id,
        purchaseStatus.purchase_token,
        purchaseStatus.subscription_type,
        serverExpiryDate ?? purchaseStatus.expiry_date ?? new Date().toISOString(),
        response.autoRenewing,
      );
    }

    // Persist last verification timestamp
    await saveLastVerifiedTimestamp();

    return true;
  } catch (error) {
    // Network error or server error — preserve current tier (offline-first)
    console.warn(
      '[SubscriptionVerify] Server verification failed (keeping current tier):',
      error instanceof Error ? error.message : 'Unknown error',
    );
    return false;
  }
};

/**
 * Check if verification is needed based on the last verified timestamp.
 * Returns true if more than VERIFICATION_INTERVAL_MS has elapsed.
 */
export const isVerificationNeeded = async (): Promise<boolean> => {
  if (__DEV__) return false;

  const store = usePurchaseStore.getState();
  if (store.tierLevel !== 'PREMIUM') return false;

  const lastVerified = await getLastVerifiedTimestamp();
  if (!lastVerified) return true; // Never verified

  const elapsed = Date.now() - lastVerified;
  return elapsed >= VERIFICATION_INTERVAL_MS;
};

/**
 * Verify subscription if the interval has elapsed.
 * Called on app launch and periodically.
 */
export const verifyIfNeeded = async (packageName: string): Promise<void> => {
  const needed = await isVerificationNeeded();
  if (needed) {
    await verifySubscriptionWithServer(packageName);
  }
};

// ─── Periodic Verification ──────────────────────────────────────────────────

/**
 * Start periodic subscription verification.
 *
 * Sets up:
 * 1. Immediate verification on call (if interval has elapsed)
 * 2. Periodic timer every 24 hours
 * 3. App foreground listener to re-verify when app resumes
 *
 * @param packageName - Android package name for Google Play API
 */
export const startPeriodicVerification = async (packageName: string): Promise<void> => {
  if (__DEV__) {
    return;
  }

  currentPackageName = packageName;

  // Stop any existing timers
  stopPeriodicVerification();

  // Verify on launch (if needed)
  await verifyIfNeeded(packageName);

  // Set up periodic check every 24 hours
  periodicTimer = setInterval(() => {
    if (currentPackageName) {
      verifySubscriptionWithServer(currentPackageName).catch((err) => {
        console.warn('[SubscriptionVerify] Periodic verification failed:', err);
      });
    }
  }, VERIFICATION_INTERVAL_MS);

  // Re-verify when app comes to foreground (if interval has elapsed)
  const handleAppState = (state: AppStateStatus) => {
    if (state === 'active' && currentPackageName) {
      verifyIfNeeded(currentPackageName).catch((err) => {
        console.warn('[SubscriptionVerify] Foreground verification failed:', err);
      });
    }
  };

  appStateSubscription = AppState.addEventListener('change', handleAppState);
};

/**
 * Stop periodic verification and clean up timers/listeners.
 */
export const stopPeriodicVerification = (): void => {
  if (periodicTimer) {
    clearInterval(periodicTimer);
    periodicTimer = null;
  }
  if (appStateSubscription) {
    appStateSubscription.remove();
    appStateSubscription = null;
  }
  currentPackageName = null;
};

// ─── Timestamp Persistence (SQLite) ─────────────────────────────────────────

/**
 * Save the current time as the last server verification timestamp.
 * Stored as last_server_verified column in PurchaseStatus table.
 */
const saveLastVerifiedTimestamp = async (): Promise<void> => {
  try {
    const { getDatabase } = await import('../storage/database');
    const db = await getDatabase();
    const now = new Date().toISOString();
    const sql = `UPDATE PurchaseStatus SET last_server_verified = ? WHERE id = 'singleton'`;
    await db.runAsync(sql, [now]);
  } catch (error) {
    console.warn('[SubscriptionVerify] Failed to save verification timestamp:', error);
  }
};

/**
 * Get the last server verification timestamp.
 * Returns epoch millis, or null if never verified.
 */
const getLastVerifiedTimestamp = async (): Promise<number | null> => {
  try {
    const { getDatabase } = await import('../storage/database');
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ last_server_verified: string | null }>(
      `SELECT last_server_verified FROM PurchaseStatus WHERE id = 'singleton'`,
    );
    if (row?.last_server_verified) {
      return new Date(row.last_server_verified).getTime();
    }
    return null;
  } catch {
    return null;
  }
};
