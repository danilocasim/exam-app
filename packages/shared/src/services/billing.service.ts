/**
 * T260: Billing Service — Subscription billing via Google Play Billing API
 *
 * Core subscription billing service using react-native-iap (v12).
 * Handles connection lifecycle, subscription fetching, purchase flow,
 * restoration, expiry checking, renewal handling, and acknowledgement.
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
    localizedPrice: pricingPhase?.formattedPrice ?? sub.localizedPrice ?? '$0.00',
    priceAmountMicros: pricingPhase?.priceAmountMicros ?? '0',
    currency: pricingPhase?.priceCurrencyCode ?? sub.currency ?? 'USD',
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
