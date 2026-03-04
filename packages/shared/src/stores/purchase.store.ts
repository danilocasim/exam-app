/**
 * T248 + T263: Purchase Store (Zustand)
 *
 * Global state management for user tier and purchase status.
 * Persists to SQLite via purchase repository.
 * In __DEV__ mode defaults to PREMIUM for development convenience.
 *
 * T263: Extended with subscription metadata (subscriptionType, expiryDate,
 * autoRenewing), expiry-based auto-downgrade, and subscription selectors.
 */
import { create } from 'zustand';
import { TierLevel, TIER_CONFIGS } from '../config/tiers';
import {
  getPurchaseStatus,
  savePurchaseStatus,
  clearPurchaseStatus,
} from '../storage/repositories/purchase.repository';
import type { SubscriptionPlan } from '../services/billing.service';

// ─── Store State Interface ───────────────────────────────────────────────────

interface PurchaseStoreState {
  // State
  tierLevel: TierLevel;
  isPremium: boolean;
  productId: string | null;
  purchasedAt: string | null;
  isLoading: boolean;
  // T263: Subscription metadata
  subscriptionType: SubscriptionPlan | null;
  expiryDate: string | null;
  autoRenewing: boolean;
  // T266: Pending subscription tracking
  pendingProductId: string | null;

  // Actions
  setPremium: (productId: string, purchaseToken: string) => Promise<void>;
  setSubscription: (
    productId: string,
    purchaseToken: string,
    subscriptionType: SubscriptionPlan,
    expiryDate: string,
    autoRenewing: boolean,
  ) => Promise<void>;
  setPendingSubscription: (productId: string | null) => void;
  checkAndDowngrade: () => Promise<boolean>;
  reset: () => Promise<void>;
  loadFromStorage: () => Promise<void>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getInitialTier = (): TierLevel => {
  // In dev mode always grant PREMIUM so billing setup isn't needed locally
  if (__DEV__) {
    return 'PREMIUM';
  }
  return 'FREE';
};

// ─── Store Implementation ────────────────────────────────────────────────────

export const usePurchaseStore = create<PurchaseStoreState>((set, get) => ({
  tierLevel: getInitialTier(),
  isPremium: __DEV__,
  productId: null,
  purchasedAt: null,
  isLoading: false,
  subscriptionType: null,
  expiryDate: null,
  autoRenewing: false,
  pendingProductId: null,

  /**
   * Set PREMIUM tier with basic product info (backward-compatible).
   * Internally delegates to setSubscription when subscription metadata isn't available.
   */
  setPremium: async (productId: string, purchaseToken: string) => {
    const now = new Date().toISOString();

    await savePurchaseStatus({
      tier_level: 'PREMIUM',
      product_id: productId,
      purchase_token: purchaseToken,
      purchased_at: now,
      subscription_type: null,
      expiry_date: null,
      auto_renewing: false,
    });

    set({
      tierLevel: 'PREMIUM',
      isPremium: true,
      productId,
      purchasedAt: now,
    });
  },

  /**
   * T263: Set PREMIUM + subscription metadata, persists to SQLite.
   */
  setSubscription: async (
    productId: string,
    purchaseToken: string,
    subscriptionType: SubscriptionPlan,
    expiryDate: string,
    autoRenewing: boolean,
  ) => {
    const now = new Date().toISOString();

    await savePurchaseStatus({
      tier_level: 'PREMIUM',
      product_id: productId,
      purchase_token: purchaseToken,
      purchased_at: now,
      subscription_type: subscriptionType,
      expiry_date: expiryDate,
      auto_renewing: autoRenewing,
    });

    set({
      tierLevel: 'PREMIUM',
      isPremium: true,
      productId,
      purchasedAt: now,
      subscriptionType,
      expiryDate,
      autoRenewing,
      pendingProductId: null, // Clear pending on successful subscription
    });
  },

  /**
   * T266: Track a pending subscription (PAYMENT_PENDING).
   * Set to null to clear pending state.
   */
  setPendingSubscription: (productId: string | null) => {
    set({ pendingProductId: productId });
  },

  /**
   * T263: Check if subscription has expired and downgrade to FREE if needed.
   * Returns true if downgrade occurred.
   *
   * - If expiryDate is past and autoRenewing is false → reset to FREE.
   * - If expiryDate is past and autoRenewing is true → caller should
   *   attempt restorePurchases() to check renewal status.
   */
  checkAndDowngrade: async (): Promise<boolean> => {
    const { expiryDate, autoRenewing, tierLevel } = get();

    // Only check subscribers
    if (tierLevel !== 'PREMIUM' || !expiryDate) {
      return false;
    }

    const isExpired = new Date(expiryDate) <= new Date();
    if (!isExpired) {
      return false;
    }

    // Expired + not auto-renewing → definitive downgrade
    if (!autoRenewing) {
      console.log('[PurchaseStore] Subscription expired (not auto-renewing) → downgrading to FREE');
      await get().reset();
      return true;
    }

    // Expired + auto-renewing → caller should try restorePurchases()
    // We do NOT downgrade here — let the billing service decide after checking renewal
    console.log(
      '[PurchaseStore] Subscription expired but auto-renewing — deferring to billing service',
    );
    return false;
  },

  reset: async () => {
    await clearPurchaseStatus();

    set({
      tierLevel: 'FREE',
      isPremium: false,
      productId: null,
      purchasedAt: null,
      subscriptionType: null,
      expiryDate: null,
      autoRenewing: false,
      pendingProductId: null,
    });
  },

  loadFromStorage: async () => {
    // Dev mode always stays PREMIUM — skip storage load
    if (__DEV__) {
      return;
    }

    set({ isLoading: true });
    try {
      const stored = await getPurchaseStatus();
      if (stored && stored.tier_level === 'PREMIUM') {
        set({
          tierLevel: 'PREMIUM',
          isPremium: true,
          productId: stored.product_id,
          purchasedAt: stored.purchased_at,
          subscriptionType: stored.subscription_type,
          expiryDate: stored.expiry_date,
          autoRenewing: stored.auto_renewing,
        });
      } else {
        set({
          tierLevel: 'FREE',
          isPremium: false,
          productId: null,
          purchasedAt: null,
          subscriptionType: null,
          expiryDate: null,
          autoRenewing: false,
        });
      }
    } catch (error) {
      console.error('[PurchaseStore] Failed to load from storage:', error);
      // Default to FREE on error — safer than granting access
      set({ tierLevel: 'FREE', isPremium: false });
    } finally {
      set({ isLoading: false });
    }
  },
}));

// ─── Selectors ────────────────────────────────────────────────────────────────

/**
 * Check if user has premium access
 */
export const useIsPremium = () => usePurchaseStore((state) => state.isPremium);

/**
 * Get the current tier level ('FREE' | 'PREMIUM')
 */
export const useTierLevel = () => usePurchaseStore((state) => state.tierLevel);

/**
 * Get the question limit for the current tier (null = unlimited)
 */
export const useQuestionLimit = () =>
  usePurchaseStore((state) => TIER_CONFIGS[state.tierLevel].questionLimit);

// ─── T263: Subscription Selectors ─────────────────────────────────────────────

/**
 * Get the current subscription plan type.
 */
export const useSubscriptionType = () => usePurchaseStore((state) => state.subscriptionType);

/**
 * Get the subscription expiry date (ISO 8601).
 */
export const useExpiryDate = () => usePurchaseStore((state) => state.expiryDate);

/**
 * Get whether the subscription is auto-renewing.
 */
export const useIsAutoRenewing = () => usePurchaseStore((state) => state.autoRenewing);

/**
 * T266: Get the pending subscription product ID (if any).
 */
export const usePendingProductId = () => usePurchaseStore((state) => state.pendingProductId);
