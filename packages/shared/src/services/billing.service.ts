/**
 * T260 + T261 + T264: Billing Service — Subscription billing via Google Play Billing API
 *
 * Core subscription billing service using react-native-iap (v12).
 * Handles connection lifecycle, subscription fetching, purchase flow,
 * restoration, expiry checking, renewal handling, and acknowledgement.
 *
 * T261 adds orchestration layer:
 * - handleSubscriptionPurchase(): Full end-to-end subscription flow
 * - processPurchaseUpdate(): Handles incoming purchase listener events
 * - checkPendingSubscriptions(): Checks pending purchases on app launch
 * - initBillingWithStore(): Initializes billing with store integration
 *
 * T264 adds restoration and expiry handling:
 * - restoreSubscription(): Restores premium on reinstall/new device
 * - checkExpiryAndRestore(): App-launch expiry check with auto-restore
 * - handleRenewalUpdate(): Processes renewal events from Play Store
 *
 * Dev mode (__DEV__) bypasses all billing operations.
 * Offline-first: subscription status is cached locally with expiry check.
 */

import { Platform, Linking } from 'react-native';
import {
  initConnection,
  endConnection,
  getSubscriptions as iapGetSubscriptions,
  requestSubscription as iapRequestSubscription,
  getAvailablePurchases,
  finishTransaction as iapFinishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  flushFailedPurchasesCachedAsPendingAndroid,
  type Subscription,
  type SubscriptionAndroid,
  type Purchase,
  type SubscriptionPurchase,
  type PurchaseError,
  PurchaseStateAndroid,
} from 'react-native-iap';
import type { EmitterSubscription } from 'react-native';
import { usePurchaseStore } from '../stores/purchase.store';

// ─── Type Definitions ────────────────────────────────────────────────────────

export type SubscriptionPlan = 'monthly' | 'quarterly' | 'annual';

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlan,
  { label: string; savings: string | null }
> = {
  monthly: { label: 'Monthly', savings: null },
  quarterly: { label: 'Quarterly', savings: '22% off' },
  annual: { label: 'Annual', savings: '44% off' },
};

export interface SubscriptionInfo {
  /** Product ID in the Play Store */
  productId: string;
  /** Plan type */
  plan: SubscriptionPlan;
  /** Localized price string (e.g. "$2.99") */
  localizedPrice: string;
  /** Price in micros for comparison */
  priceAmountMicros: string;
  /** Currency code (e.g. "USD") */
  currency: string;
  /** Billing period in ISO 8601 duration (e.g. "P1M", "P3M", "P1Y") */
  billingPeriod: string;
  /** Offer token required for Android subscription purchase */
  offerToken: string;
}

export interface SubscriptionResult {
  success: boolean;
  productId?: string;
  purchaseToken?: string;
  transactionDate?: number;
  autoRenewing?: boolean;
  error?: {
    code: string;
    message: string;
  };
}

export interface SubscriptionStatus {
  isActive: boolean;
  expiryDate: string | null;
  autoRenewing: boolean;
  subscriptionType: SubscriptionPlan | null;
  productId: string | null;
  purchaseToken: string | null;
}

// ─── SKU Configuration ───────────────────────────────────────────────────────

/**
 * Generate subscription SKU for a given exam type and plan.
 * Format: {plan}_{exam_type_lowercase_nodash}
 * e.g. "monthly_clfc02", "quarterly_saac03"
 */
export const getSubscriptionSku = (examTypeId: string, plan: SubscriptionPlan): string => {
  const normalizedId = examTypeId.toLowerCase().replace(/-/g, '');
  return `${plan}_${normalizedId}`;
};

/**
 * Get all subscription SKUs for an exam type.
 */
export const getAllSubscriptionSkus = (examTypeId: string): string[] => {
  return (['monthly', 'quarterly', 'annual'] as SubscriptionPlan[]).map((plan) =>
    getSubscriptionSku(examTypeId, plan),
  );
};

/**
 * Determine the plan type from a product ID.
 * Returns null if the product ID doesn't match any known plan format.
 */
export const getPlanFromProductId = (productId: string): SubscriptionPlan | null => {
  if (productId.startsWith('monthly_')) return 'monthly';
  if (productId.startsWith('quarterly_')) return 'quarterly';
  if (productId.startsWith('annual_')) return 'annual';
  return null;
};

// ─── Connection State ────────────────────────────────────────────────────────

let isConnected = false;
let purchaseUpdateSubscription: EmitterSubscription | null = null;
let purchaseErrorSubscription: EmitterSubscription | null = null;

// Callbacks registered by consumers (e.g. purchase store)
let onPurchaseUpdate: ((purchase: Purchase) => void) | null = null;
let onPurchaseError: ((error: PurchaseError) => void) | null = null;

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Initialize IAP connection and set up purchase listeners.
 * Must be called before any other billing operation.
 * In __DEV__ mode, this is a no-op.
 */
export const initBilling = async (): Promise<void> => {
  if (__DEV__) {
    console.log('[Billing] Bypassed in development mode');
    return;
  }

  if (Platform.OS !== 'android') {
    console.log('[Billing] Skipped — only Android is supported');
    return;
  }

  if (isConnected) {
    console.log('[Billing] Already connected');
    return;
  }

  try {
    const result = await initConnection();
    console.log('[Billing] Connection initialized:', result);
    isConnected = true;

    // Flush any failed purchases cached as pending (Android-specific)
    await flushFailedPurchasesCachedAsPendingAndroid().catch((err) => {
      console.warn('[Billing] Failed to flush pending purchases:', err);
    });

    // Set up purchase listeners
    purchaseUpdateSubscription = purchaseUpdatedListener((purchase: Purchase) => {
      console.log('[Billing] Purchase updated:', purchase.productId);
      onPurchaseUpdate?.(purchase);
    });

    purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
      console.warn('[Billing] Purchase error:', error.code, error.message);
      onPurchaseError?.(error);
    });
  } catch (error) {
    console.error('[Billing] Failed to initialize connection:', error);
    isConnected = false;
    throw error;
  }
};

/**
 * End IAP connection and clean up listeners.
 * Should be called when billing is no longer needed (e.g. unmount).
 */
export const disconnectBilling = async (): Promise<void> => {
  if (__DEV__) return;

  purchaseUpdateSubscription?.remove();
  purchaseErrorSubscription?.remove();
  purchaseUpdateSubscription = null;
  purchaseErrorSubscription = null;
  onPurchaseUpdate = null;
  onPurchaseError = null;

  if (isConnected) {
    try {
      await endConnection();
      console.log('[Billing] Connection ended');
    } catch (error) {
      console.warn('[Billing] Error ending connection:', error);
    }
    isConnected = false;
  }
};

/**
 * Register callbacks for purchase events.
 * Must be called after initBilling() to receive purchase updates.
 */
export const setPurchaseListeners = (
  onUpdate: (purchase: Purchase) => void,
  onError: (error: PurchaseError) => void,
): void => {
  onPurchaseUpdate = onUpdate;
  onPurchaseError = onError;
};

/**
 * Fetch available subscription details from the Play Store.
 * Returns localized pricing information for each plan.
 *
 * @param examTypeId - The exam type ID for SKU generation (e.g. "CLF-C02")
 * @returns Array of subscription info with localized pricing
 */
export const fetchSubscriptions = async (examTypeId: string): Promise<SubscriptionInfo[]> => {
  if (__DEV__) {
    console.log('[Billing] Returning mock subscriptions in dev mode');
    return getMockSubscriptions(examTypeId);
  }

  if (!isConnected) {
    throw new Error('[Billing] Not connected. Call initBilling() first.');
  }

  const skus = getAllSubscriptionSkus(examTypeId);
  console.log('[Billing] Fetching subscriptions for SKUs:', skus);

  const subscriptions = await iapGetSubscriptions({ skus });
  console.log('[Billing] Fetched subscriptions:', subscriptions.length);

  return subscriptions.map((sub) => parseSubscription(sub, examTypeId));
};

/**
 * Initiate a subscription purchase for the specified plan.
 * Opens the Play Store subscription dialog.
 *
 * @param sku - The product ID / SKU to subscribe to
 * @param offerToken - The offer token from subscription details (Android)
 * @returns SubscriptionResult with success/failure info
 */
export const subscribe = async (sku: string, offerToken: string): Promise<SubscriptionResult> => {
  if (__DEV__) {
    console.log('[Billing] Mock subscription in dev mode:', sku);
    return {
      success: true,
      productId: sku,
      purchaseToken: 'dev-mock-token',
      transactionDate: Date.now(),
      autoRenewing: true,
    };
  }

  if (!isConnected) {
    throw new Error('[Billing] Not connected. Call initBilling() first.');
  }

  try {
    console.log('[Billing] Requesting subscription:', sku);

    // Android requires subscriptionOffers with sku + offerToken
    const result = await iapRequestSubscription({
      subscriptionOffers: [{ sku, offerToken }],
    });

    if (!result) {
      return {
        success: false,
        error: { code: 'NO_RESULT', message: 'Subscription request returned no result' },
      };
    }

    // result can be a single purchase or array — normalize
    const purchase: SubscriptionPurchase = Array.isArray(result) ? result[0] : result;

    if (!purchase) {
      return {
        success: false,
        error: { code: 'NO_PURCHASE', message: 'No purchase returned from subscription request' },
      };
    }

    // Check for pending state (PAYMENT_PENDING)
    if (purchase.purchaseStateAndroid === PurchaseStateAndroid.PENDING) {
      console.log('[Billing] Subscription pending payment:', sku);
      return {
        success: false,
        productId: purchase.productId,
        purchaseToken: purchase.purchaseToken ?? undefined,
        error: {
          code: 'PAYMENT_PENDING',
          message: 'Subscription is pending payment. It will activate once payment is confirmed.',
        },
      };
    }

    return {
      success: true,
      productId: purchase.productId,
      purchaseToken: purchase.purchaseToken ?? undefined,
      transactionDate: purchase.transactionDate,
      autoRenewing: purchase.autoRenewingAndroid ?? true,
    };
  } catch (error: unknown) {
    const purchaseError = error as PurchaseError;
    console.error('[Billing] Subscription error:', purchaseError.code, purchaseError.message);

    return {
      success: false,
      error: {
        code: purchaseError.code ?? 'UNKNOWN',
        message: purchaseError.message ?? 'An unknown error occurred during subscription',
      },
    };
  }
};

/**
 * Restore active subscriptions from the Play Store.
 * Used on reinstall or new device to recover premium status.
 *
 * @returns Array of active purchases found
 */
export const restorePurchases = async (): Promise<Purchase[]> => {
  if (__DEV__) {
    console.log('[Billing] Mock restore in dev mode — returning empty');
    return [];
  }

  if (!isConnected) {
    throw new Error('[Billing] Not connected. Call initBilling() first.');
  }

  try {
    console.log('[Billing] Restoring purchases...');
    const purchases = await getAvailablePurchases();
    console.log('[Billing] Restored purchases:', purchases.length);
    return purchases;
  } catch (error) {
    console.error('[Billing] Failed to restore purchases:', error);
    throw error;
  }
};

/**
 * Validate subscription status from a purchase.
 * Uses local purchase data to determine if subscription is active.
 * For server-side validation, use the optional T262.5 API endpoint.
 *
 * @param purchase - The purchase to validate
 * @returns SubscriptionStatus with expiry and renewal info
 */
export const validateSubscription = (purchase: Purchase): SubscriptionStatus => {
  const plan = getPlanFromProductId(purchase.productId);
  const autoRenewing = (purchase as SubscriptionPurchase).autoRenewingAndroid ?? false;
  const purchaseToken = purchase.purchaseToken ?? null;

  // Calculate expiry from transaction date + billing period
  const transactionDate = new Date(purchase.transactionDate);
  const expiryDate = calculateExpiryDate(transactionDate, plan);

  const isActive = expiryDate ? new Date(expiryDate) > new Date() : false;

  return {
    isActive,
    expiryDate,
    autoRenewing,
    subscriptionType: plan,
    productId: purchase.productId,
    purchaseToken,
  };
};

/**
 * Check if a cached subscription has expired.
 * Compares the stored expiry date against current time.
 *
 * @param expiryDate - ISO 8601 expiry timestamp
 * @returns true if subscription has expired
 */
export const checkExpiry = (expiryDate: string | null): boolean => {
  if (!expiryDate) return true;
  return new Date(expiryDate) <= new Date();
};

/**
 * Process a subscription renewal.
 * Called when the purchase listener receives a renewal event.
 * Returns updated subscription status for persistence.
 *
 * @param purchase - The renewed purchase
 * @returns Updated SubscriptionStatus
 */
export const handleRenewal = (purchase: Purchase): SubscriptionStatus => {
  console.log('[Billing] Processing renewal for:', purchase.productId);
  return validateSubscription(purchase);
};

/**
 * Acknowledge a purchase (required by Google Play).
 * Must be called after delivering content to the user.
 * Unacknowledged purchases are refunded after 3 days.
 *
 * @param purchase - The purchase to acknowledge
 */
export const acknowledgePurchase = async (purchase: Purchase): Promise<void> => {
  if (__DEV__) {
    console.log('[Billing] Mock acknowledge in dev mode');
    return;
  }

  // Already acknowledged — skip
  if ((purchase as SubscriptionPurchase).isAcknowledgedAndroid) {
    console.log('[Billing] Purchase already acknowledged:', purchase.productId);
    return;
  }

  try {
    console.log('[Billing] Acknowledging purchase:', purchase.productId);
    await iapFinishTransaction({ purchase, isConsumable: false });
    console.log('[Billing] Purchase acknowledged successfully');
  } catch (error) {
    console.error('[Billing] Failed to acknowledge purchase:', error);
    throw error;
  }
};

/**
 * Complete the transaction lifecycle.
 * Wrapper around finishTransaction for consistency.
 *
 * @param purchase - The purchase to finish
 */
export const finishTransaction = async (purchase: Purchase): Promise<void> => {
  if (__DEV__) return;

  try {
    await iapFinishTransaction({ purchase, isConsumable: false });
    console.log('[Billing] Transaction finished:', purchase.productId);
  } catch (error) {
    console.error('[Billing] Failed to finish transaction:', error);
    throw error;
  }
};

/**
 * Open the Google Play Store subscription management page.
 * Allows users to cancel, pause, or change their subscription.
 */
export const cancelSubscription = (): void => {
  const url = 'https://play.google.com/store/account/subscriptions';
  Linking.openURL(url).catch((err) => {
    console.error('[Billing] Failed to open subscription management:', err);
  });
};

/**
 * Check if billing is currently connected.
 */
export const isBillingConnected = (): boolean => {
  if (__DEV__) return true;
  return isConnected;
};

// ─── T261: Subscription Purchase Flow Orchestration ──────────────────────────

/**
 * Result of a full subscription purchase flow (orchestrated).
 * Extends SubscriptionResult with subscription metadata.
 */
export interface SubscriptionPurchaseResult extends SubscriptionResult {
  /** The plan that was purchased */
  plan?: SubscriptionPlan;
  /** Calculated expiry date for the subscription */
  expiryDate?: string;
  /** Whether the purchase is pending (PAYMENT_PENDING) */
  isPending?: boolean;
}

/**
 * T261: Full end-to-end subscription purchase flow.
 *
 * Orchestrates: connect → fetch → subscribe → acknowledge → update store → persist.
 *
 * Steps:
 * 1. Validates billing is connected
 * 2. Initiates subscription via Play Store dialog
 * 3. On success: acknowledges purchase, updates purchase store to PREMIUM, persists to SQLite
 * 4. On cancel: returns no-op result (no side effects)
 * 5. On error: returns error details for UI to display
 * 6. On pending: returns pending status for check on next launch
 *
 * @param sku - The subscription product ID (e.g. "quarterly_clf_c02")
 * @param offerToken - The offer token from subscription details (required for Android)
 * @returns SubscriptionPurchaseResult with full flow outcome
 */
export const handleSubscriptionPurchase = async (
  sku: string,
  offerToken: string,
): Promise<SubscriptionPurchaseResult> => {
  const plan = getPlanFromProductId(sku);

  if (__DEV__) {
    console.log('[Billing] Mock subscription purchase in dev mode:', sku);
    const mockExpiry = calculateExpiryDate(new Date(), plan);

    // Update store to PREMIUM in dev mode
    await usePurchaseStore.getState().setPremium(sku, 'dev-mock-token');

    return {
      success: true,
      productId: sku,
      purchaseToken: 'dev-mock-token',
      transactionDate: Date.now(),
      autoRenewing: true,
      plan: plan ?? undefined,
      expiryDate: mockExpiry ?? undefined,
      isPending: false,
    };
  }

  // Step 1: Initiate subscription flow
  const result = await subscribe(sku, offerToken);

  // Step 2: Handle pending payment
  if (!result.success && result.error?.code === 'PAYMENT_PENDING') {
    console.log('[Billing] Purchase pending — will check on next launch');
    return {
      ...result,
      plan: plan ?? undefined,
      isPending: true,
    };
  }

  // Step 3: Handle failure or cancellation
  if (!result.success) {
    return {
      ...result,
      plan: plan ?? undefined,
      isPending: false,
    };
  }

  // Step 4: Purchase succeeded — acknowledge and update store
  // Note: The purchase listener (processPurchaseUpdate) also handles this,
  // but we acknowledge here immediately for reliability
  if (result.purchaseToken && result.productId) {
    const transactionDate = new Date(result.transactionDate ?? Date.now());
    const expiryDate = calculateExpiryDate(transactionDate, plan);

    // Update purchase store to PREMIUM with subscription data
    if (plan && expiryDate) {
      await usePurchaseStore
        .getState()
        .setSubscription(
          result.productId,
          result.purchaseToken,
          plan,
          expiryDate,
          result.autoRenewing ?? true,
        );
    } else {
      await usePurchaseStore.getState().setPremium(result.productId, result.purchaseToken);
    }

    console.log('[Billing] Subscription purchase complete:', {
      productId: result.productId,
      plan,
      expiryDate,
      autoRenewing: result.autoRenewing,
    });

    return {
      ...result,
      plan: plan ?? undefined,
      expiryDate: expiryDate ?? undefined,
      isPending: false,
    };
  }

  return {
    ...result,
    plan: plan ?? undefined,
    isPending: false,
  };
};

/**
 * T261: Process an incoming purchase update from the purchase listener.
 *
 * Called automatically when the Play Store emits a purchase event (new subscription,
 * renewal, or re-delivery of unacknowledged purchase).
 *
 * Steps:
 * 1. Validate the purchase state (purchased vs pending)
 * 2. Acknowledge the purchase (required by Google — unacknowledged purchases refund after 3 days)
 * 3. Update the purchase store to PREMIUM
 * 4. Return subscription status for logging/display
 *
 * @param purchase - The purchase event from Play Store
 * @returns SubscriptionStatus with subscription details, or null if pending/invalid
 */
export const processPurchaseUpdate = async (
  purchase: Purchase,
): Promise<SubscriptionStatus | null> => {
  if (__DEV__) {
    console.log('[Billing] Mock purchase update in dev mode');
    return null;
  }

  const subscriptionPurchase = purchase as SubscriptionPurchase;

  // Check for pending payment state
  if (subscriptionPurchase.purchaseStateAndroid === PurchaseStateAndroid.PENDING) {
    console.log('[Billing] Purchase pending payment:', purchase.productId);
    return null;
  }

  // Acknowledge the purchase (must happen within 3 days or Google will refund)
  try {
    await acknowledgePurchase(purchase);
  } catch (error) {
    console.error('[Billing] Failed to acknowledge purchase update:', error);
    // Don't throw — we still want to update the store
    // Acknowledgement will be retried on next purchase event or app launch
  }

  // Validate and extract subscription metadata
  const status = validateSubscription(purchase);

  if (status.isActive && status.productId && status.purchaseToken) {
    // Update store to PREMIUM with subscription metadata
    const plan = getPlanFromProductId(status.productId);
    if (plan && status.expiryDate) {
      await usePurchaseStore
        .getState()
        .setSubscription(
          status.productId,
          status.purchaseToken,
          plan,
          status.expiryDate,
          status.autoRenewing,
        );
    } else {
      // Fallback for non-subscription purchases or unknown plan
      await usePurchaseStore.getState().setPremium(status.productId, status.purchaseToken);
    }

    console.log('[Billing] Purchase update processed → PREMIUM:', {
      productId: status.productId,
      plan: status.subscriptionType,
      expiryDate: status.expiryDate,
      autoRenewing: status.autoRenewing,
    });
  }

  return status;
};

/**
 * T261: Process a purchase error from the purchase error listener.
 *
 * Called automatically when the Play Store emits a purchase error event
 * (user cancelled, billing unavailable, etc.).
 *
 * @param error - The purchase error from Play Store
 * @returns Error details for UI display, or null if user cancelled (no error to show)
 */
export const processPurchaseError = (
  error: PurchaseError,
): { code: string; message: string; isUserCancel: boolean } | null => {
  // Error code 'E_USER_CANCELLED' means user dismissed the dialog
  const errorCode = String(error.code ?? '');
  const isUserCancel =
    errorCode === 'E_USER_CANCELLED' ||
    errorCode === '1' ||
    error.message?.includes('cancelled') ||
    error.message?.includes('canceled');

  if (isUserCancel) {
    console.log('[Billing] User cancelled subscription dialog');
    return null;
  }

  console.warn('[Billing] Purchase error:', error.code, error.message);
  return {
    code: error.code ?? 'UNKNOWN',
    message: error.message ?? 'An error occurred during purchase',
    isUserCancel: false,
  };
};

/**
 * T261: Check for pending subscriptions on app launch.
 *
 * On app start, checks if there are any pending purchases that completed
 * while the app was closed (e.g., PAYMENT_PENDING that was later approved).
 * Also re-acknowledges any unacknowledged purchases.
 *
 * @param examTypeId - The exam type ID to filter relevant SKUs
 * @returns Array of processed subscription statuses
 */
export const checkPendingSubscriptions = async (
  examTypeId: string,
): Promise<SubscriptionStatus[]> => {
  if (__DEV__) {
    console.log('[Billing] Skipping pending subscription check in dev mode');
    return [];
  }

  if (!isConnected) {
    console.warn('[Billing] Cannot check pending subscriptions — not connected');
    return [];
  }

  try {
    const purchases = await getAvailablePurchases();
    console.log('[Billing] Checking pending/unacked subscriptions:', purchases.length);

    const relevantSkus = getAllSubscriptionSkus(examTypeId);
    const results: SubscriptionStatus[] = [];

    for (const purchase of purchases) {
      // Only process purchases for this exam type's subscriptions
      if (!relevantSkus.includes(purchase.productId)) {
        continue;
      }

      const subscriptionPurchase = purchase as SubscriptionPurchase;

      // Acknowledge unacknowledged purchases
      if (!subscriptionPurchase.isAcknowledgedAndroid) {
        try {
          await acknowledgePurchase(purchase);
          console.log('[Billing] Acknowledged pending purchase:', purchase.productId);
        } catch (err) {
          console.warn('[Billing] Failed to acknowledge pending purchase:', err);
        }
      }

      // Validate and potentially update store
      const status = validateSubscription(purchase);

      if (status.isActive && status.productId && status.purchaseToken) {
        const plan = getPlanFromProductId(status.productId);
        if (plan && status.expiryDate) {
          await usePurchaseStore
            .getState()
            .setSubscription(
              status.productId,
              status.purchaseToken,
              plan,
              status.expiryDate,
              status.autoRenewing,
            );
        } else {
          await usePurchaseStore.getState().setPremium(status.productId, status.purchaseToken);
        }
        console.log('[Billing] Restored pending subscription → PREMIUM:', status.productId);
      }

      results.push(status);
    }

    return results;
  } catch (error) {
    console.error('[Billing] Failed to check pending subscriptions:', error);
    return [];
  }
};

/**
 * T261: Initialize billing with purchase store integration.
 *
 * Combines initBilling() with automatic purchase listener wiring.
 * Purchase updates are automatically processed → acknowledged → store updated.
 * Purchase errors are forwarded to the optional error callback.
 *
 * Should be called during app initialization (after database init, before sync).
 *
 * @param examTypeId - The exam type ID for SKU filtering
 * @param onError - Optional callback for purchase errors (for UI display)
 * @returns Cleanup function to disconnect billing
 */
export const initBillingWithStore = async (
  examTypeId: string,
  onError?: (error: { code: string; message: string }) => void,
): Promise<() => Promise<void>> => {
  if (__DEV__) {
    console.log('[Billing] initBillingWithStore bypassed in dev mode');
    return async () => {};
  }

  // Initialize IAP connection
  await initBilling();

  // Wire up purchase listeners to store integration
  setPurchaseListeners(
    // On purchase update: acknowledge + update store
    async (purchase: Purchase) => {
      try {
        await processPurchaseUpdate(purchase);
      } catch (err) {
        console.error('[Billing] Failed to process purchase update:', err);
      }
    },
    // On purchase error: forward to callback
    (error: PurchaseError) => {
      const processed = processPurchaseError(error);
      if (processed && !processed.isUserCancel && onError) {
        onError({ code: processed.code, message: processed.message });
      }
    },
  );

  // Check for pending/unacknowledged subscriptions from previous sessions
  await checkPendingSubscriptions(examTypeId).catch((err) => {
    console.warn('[Billing] Pending subscription check failed (non-fatal):', err);
  });

  console.log('[Billing] Billing initialized with store integration for:', examTypeId);

  // Return cleanup function
  return async () => {
    await disconnectBilling();
  };
};

// ─── T264: Subscription Restoration & Expiry Handling ────────────────────────

/**
 * T264: Restore subscription on reinstall or new device.
 *
 * Called during initialization (after login, before question sync).
 * Queries Play Store for active subscriptions on this account.
 *
 * Returns:
 * - 'restored' if an active subscription was found and PREMIUM granted
 * - 'expired' if only expired subscriptions found → stays FREE
 * - 'none' if no subscriptions found → stays FREE
 *
 * @param examTypeId - The exam type ID for SKU filtering
 */
export const restoreSubscription = async (
  examTypeId: string,
): Promise<'restored' | 'expired' | 'none'> => {
  if (__DEV__) {
    console.log('[Billing] Restore bypassed in dev mode — already PREMIUM');
    return 'none';
  }

  if (!isConnected) {
    console.warn('[Billing] Cannot restore subscriptions — not connected');
    return 'none';
  }

  try {
    const purchases = await getAvailablePurchases();
    console.log('[Billing] Restore: found', purchases.length, 'purchases');

    const relevantSkus = getAllSubscriptionSkus(examTypeId);
    let foundExpired = false;

    for (const purchase of purchases) {
      if (!relevantSkus.includes(purchase.productId)) {
        continue;
      }

      const status = validateSubscription(purchase);
      const plan = getPlanFromProductId(purchase.productId);

      if (status.isActive && status.productId && status.purchaseToken && plan) {
        // Active subscription found → restore PREMIUM with full metadata
        await usePurchaseStore
          .getState()
          .setSubscription(
            status.productId,
            status.purchaseToken,
            plan,
            status.expiryDate!,
            status.autoRenewing,
          );

        // Acknowledge if needed
        const subPurchase = purchase as SubscriptionPurchase;
        if (!subPurchase.isAcknowledgedAndroid) {
          try {
            await acknowledgePurchase(purchase);
          } catch (err) {
            console.warn('[Billing] Failed to acknowledge restored purchase:', err);
          }
        }

        console.log('[Billing] Subscription restored → PREMIUM:', {
          productId: status.productId,
          plan,
          expiryDate: status.expiryDate,
          autoRenewing: status.autoRenewing,
        });
        return 'restored';
      } else {
        foundExpired = true;
      }
    }

    if (foundExpired) {
      console.log('[Billing] Only expired subscriptions found — staying FREE');
      return 'expired';
    }

    console.log('[Billing] No subscriptions found for this exam type');
    return 'none';
  } catch (error) {
    console.error('[Billing] Failed to restore subscription:', error);
    return 'none';
  }
};

/**
 * T264: Check subscription expiry on app launch and attempt restoration if needed.
 *
 * Called on each app launch after loadFromStorage().
 *
 * Logic:
 * 1. If expiryDate is past + autoRenewing is false → downgrade to FREE
 * 2. If expiryDate is past + autoRenewing is true → try restorePurchases() to detect renewal
 *    - If renewed → update expiry date
 *    - If not renewed → downgrade to FREE
 * 3. If expiryDate is in the future → no action (still PREMIUM)
 *
 * @param examTypeId - The exam type ID for SKU filtering when restoring
 * @returns 'active' | 'renewed' | 'expired' | 'downgraded'
 */
export const checkExpiryAndRestore = async (
  examTypeId: string,
): Promise<'active' | 'renewed' | 'expired' | 'downgraded'> => {
  if (__DEV__) {
    return 'active';
  }

  const store = usePurchaseStore.getState();

  // Not a subscriber — nothing to check
  if (store.tierLevel !== 'PREMIUM' || !store.expiryDate) {
    return 'active';
  }

  const isExpired = new Date(store.expiryDate) <= new Date();

  if (!isExpired) {
    console.log('[Billing] Subscription still active, expires:', store.expiryDate);
    return 'active';
  }

  // Expired + not auto-renewing → definitive downgrade
  if (!store.autoRenewing) {
    console.log('[Billing] Subscription expired (not auto-renewing) → downgrading');
    await store.checkAndDowngrade();
    return 'downgraded';
  }

  // Expired + auto-renewing → check Play Store for renewal
  console.log('[Billing] Subscription expired but auto-renewing — checking Play Store...');

  if (!isConnected) {
    console.warn('[Billing] Cannot check renewal — not connected. Keeping PREMIUM until online.');
    return 'active';
  }

  try {
    const result = await restoreSubscription(examTypeId);

    if (result === 'restored') {
      console.log('[Billing] Subscription renewed → keeping PREMIUM');
      return 'renewed';
    }

    // Renewal not found despite auto-renewing flag → subscription was cancelled
    console.log('[Billing] Renewal not found → downgrading to FREE');
    await store.reset();
    return 'expired';
  } catch (error) {
    console.error('[Billing] Failed to check renewal:', error);
    // On error, keep PREMIUM — offline-first principle
    // Next launch will re-check
    return 'active';
  }
};

/**
 * T264: Process a subscription renewal event from the purchase listener.
 *
 * When Play Store sends a renewal event, update the expiry date and
 * purchase token in the store and SQLite.
 *
 * @param purchase - The renewed purchase from Play Store
 * @returns Updated subscription status, or null if not a valid renewal
 */
export const handleRenewalUpdate = async (
  purchase: Purchase,
): Promise<SubscriptionStatus | null> => {
  if (__DEV__) {
    console.log('[Billing] Mock renewal update in dev mode');
    return null;
  }

  const plan = getPlanFromProductId(purchase.productId);
  if (!plan) {
    console.warn('[Billing] Renewal for unknown product:', purchase.productId);
    return null;
  }

  const status = validateSubscription(purchase);

  if (status.isActive && status.productId && status.purchaseToken && status.expiryDate) {
    // Update store with new expiry and token
    await usePurchaseStore
      .getState()
      .setSubscription(
        status.productId,
        status.purchaseToken,
        plan,
        status.expiryDate,
        status.autoRenewing,
      );

    console.log('[Billing] Renewal processed → updated expiry:', {
      productId: status.productId,
      plan,
      expiryDate: status.expiryDate,
      autoRenewing: status.autoRenewing,
    });
  }

  return status;
};

// ─── Internal Helpers ────────────────────────────────────────────────────────

/**
 * Parse a raw subscription from react-native-iap into our SubscriptionInfo format.
 * Handles Android SubscriptionOfferDetails structure (Billing Library v5+).
 */
const parseSubscription = (sub: Subscription, examTypeId: string): SubscriptionInfo => {
  const plan = getPlanFromProductId(sub.productId);

  // Android subscriptions use subscriptionOfferDetails with pricingPhases
  const androidSub = sub as SubscriptionAndroid;
  const offerDetails = androidSub.subscriptionOfferDetails?.[0];
  const pricingPhase = offerDetails?.pricingPhases?.pricingPhaseList?.[0];

  return {
    productId: sub.productId,
    plan: plan ?? 'monthly',
    localizedPrice: pricingPhase?.formattedPrice ?? '$0.00',
    priceAmountMicros: pricingPhase?.priceAmountMicros ?? '0',
    currency: pricingPhase?.priceCurrencyCode ?? 'USD',
    billingPeriod: pricingPhase?.billingPeriod ?? 'P1M',
    offerToken: offerDetails?.offerToken ?? '',
  };
};

/**
 * Calculate subscription expiry date based on transaction date and plan type.
 */
const calculateExpiryDate = (
  transactionDate: Date,
  plan: SubscriptionPlan | null,
): string | null => {
  if (!plan) return null;

  const expiry = new Date(transactionDate);

  switch (plan) {
    case 'monthly':
      expiry.setMonth(expiry.getMonth() + 1);
      break;
    case 'quarterly':
      expiry.setMonth(expiry.getMonth() + 3);
      break;
    case 'annual':
      expiry.setFullYear(expiry.getFullYear() + 1);
      break;
  }

  return expiry.toISOString();
};

/**
 * Generate mock subscription info for development mode.
 */
const getMockSubscriptions = (examTypeId: string): SubscriptionInfo[] => {
  return [
    {
      productId: getSubscriptionSku(examTypeId, 'monthly'),
      plan: 'monthly',
      localizedPrice: '$2.99',
      priceAmountMicros: '2990000',
      currency: 'USD',
      billingPeriod: 'P1M',
      offerToken: 'mock-monthly-token',
    },
    {
      productId: getSubscriptionSku(examTypeId, 'quarterly'),
      plan: 'quarterly',
      localizedPrice: '$6.99',
      priceAmountMicros: '6990000',
      currency: 'USD',
      billingPeriod: 'P3M',
      offerToken: 'mock-quarterly-token',
    },
    {
      productId: getSubscriptionSku(examTypeId, 'annual'),
      plan: 'annual',
      localizedPrice: '$19.99',
      priceAmountMicros: '19990000',
      currency: 'USD',
      billingPeriod: 'P1Y',
      offerToken: 'mock-annual-token',
    },
  ];
};
