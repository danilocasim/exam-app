/**
 * T248: Purchase Store (Zustand)
 *
 * Global state management for user tier and purchase status.
 * Persists to SQLite via purchase repository.
 * In __DEV__ mode defaults to PREMIUM for development convenience.
 */
import { create } from 'zustand';
import { TierLevel, TIER_CONFIGS } from '../config/tiers';
import {
  getPurchaseStatus,
  savePurchaseStatus,
  clearPurchaseStatus,
} from '../storage/repositories/purchase.repository';

// ─── Store State Interface ───────────────────────────────────────────────────

interface PurchaseStoreState {
  // State
  tierLevel: TierLevel;
  isPremium: boolean;
  productId: string | null;
  purchasedAt: string | null;
  isLoading: boolean;

  // Actions
  setPremium: (productId: string, purchaseToken: string) => Promise<void>;
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

  setPremium: async (productId: string, purchaseToken: string) => {
    const now = new Date().toISOString();

    await savePurchaseStatus({
      tier_level: 'PREMIUM',
      product_id: productId,
      purchase_token: purchaseToken,
      purchased_at: now,
    });

    set({
      tierLevel: 'PREMIUM',
      isPremium: true,
      productId,
      purchasedAt: now,
    });
  },

  reset: async () => {
    await clearPurchaseStatus();

    set({
      tierLevel: 'FREE',
      isPremium: false,
      productId: null,
      purchasedAt: null,
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
        });
      } else {
        set({
          tierLevel: 'FREE',
          isPremium: false,
          productId: null,
          purchasedAt: null,
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
