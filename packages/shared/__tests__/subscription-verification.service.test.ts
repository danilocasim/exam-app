/**
 * Subscription Verification Service Unit Tests
 *
 * Tests for server-side subscription verification:
 * - Skips for FREE tier users
 * - Downgrades when no purchase token found
 * - Downgrades when server returns invalid
 * - Updates metadata when server returns valid with new data
 * - Preserves tier on network error (offline-first)
 * - Periodic verification lifecycle (start/stop)
 * - Verification interval check (24h)
 */
import { describe, test, expect, beforeEach, vi, type Mock } from 'vitest';

// ─── Top-level mocks ──────────────────────────────────────────────────────────

vi.mock('../src/services/api', () => ({
  post: vi.fn(),
}));

vi.mock('../src/storage/database', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../src/storage/repositories/purchase.repository', () => ({
  getPurchaseStatus: vi.fn(),
  savePurchaseStatus: vi.fn(),
  clearPurchaseStatus: vi.fn(),
}));

vi.mock('react-native', () => ({
  AppState: {
    addEventListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PACKAGE_NAME = 'com.danilocasim.dojoexam.clfc02';

const mockPurchaseStatus = (overrides: Record<string, unknown> = {}) => ({
  id: 'singleton',
  tier_level: 'PREMIUM',
  product_id: 'quarterly_clf_c02',
  purchase_token: 'mock-purchase-token-123',
  purchased_at: '2025-01-01T00:00:00.000Z',
  subscription_type: 'quarterly' as const,
  expiry_date: '2025-04-01T00:00:00.000Z',
  auto_renewing: true,
  created_at: '2025-01-01T00:00:00.000Z',
  updated_at: '2025-01-01T00:00:00.000Z',
  ...overrides,
});

const mockServerResponse = (overrides: Record<string, unknown> = {}) => ({
  valid: true,
  expiryTimeMillis: new Date('2025-04-01T00:00:00.000Z').getTime(),
  autoRenewing: true,
  paymentState: 1,
  ...overrides,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Subscription Verification Service', () => {
  // Dynamically-imported references — populated in beforeEach after __DEV__ set
  let verifySubscriptionWithServer: typeof import('../src/services/subscription-verification.service').verifySubscriptionWithServer;
  let isVerificationNeeded: typeof import('../src/services/subscription-verification.service').isVerificationNeeded;
  let stopPeriodicVerification: typeof import('../src/services/subscription-verification.service').stopPeriodicVerification;
  let usePurchaseStore: typeof import('../src/stores/purchase.store').usePurchaseStore;
  let post: typeof import('../src/services/api').post;
  let getPurchaseStatus: typeof import('../src/storage/repositories/purchase.repository').getPurchaseStatus;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();

    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;

    // Dynamically import modules after __DEV__ is set
    const verifyMod = await import('../src/services/subscription-verification.service');
    verifySubscriptionWithServer = verifyMod.verifySubscriptionWithServer;
    isVerificationNeeded = verifyMod.isVerificationNeeded;
    stopPeriodicVerification = verifyMod.stopPeriodicVerification;

    const storeMod = await import('../src/stores/purchase.store');
    usePurchaseStore = storeMod.usePurchaseStore;

    const apiMod = await import('../src/services/api');
    post = apiMod.post;

    const repoMod = await import('../src/storage/repositories/purchase.repository');
    getPurchaseStatus = repoMod.getPurchaseStatus;

    // Reset purchase store to FREE
    usePurchaseStore.setState({
      tierLevel: 'FREE',
      isPremium: false,
      productId: null,
      purchasedAt: null,
      subscriptionType: null,
      expiryDate: null,
      autoRenewing: false,
      pendingProductId: null,
    });
  });

  describe('verifySubscriptionWithServer', () => {
    test('skips verification for FREE tier users', async () => {
      const result = await verifySubscriptionWithServer(PACKAGE_NAME);

      expect(result).toBe(false);
      expect(post).not.toHaveBeenCalled();
    });

    test('downgrades when PREMIUM but no purchase token in SQLite', async () => {
      usePurchaseStore.setState({ tierLevel: 'PREMIUM', isPremium: true });
      (getPurchaseStatus as Mock).mockResolvedValue(null);

      const result = await verifySubscriptionWithServer(PACKAGE_NAME);

      expect(result).toBe(true);
      expect(usePurchaseStore.getState().tierLevel).toBe('FREE');
      expect(usePurchaseStore.getState().isPremium).toBe(false);
    });

    test('downgrades when server returns valid: false', async () => {
      usePurchaseStore.setState({ tierLevel: 'PREMIUM', isPremium: true });
      (getPurchaseStatus as Mock).mockResolvedValue(mockPurchaseStatus());
      (post as Mock).mockResolvedValue(
        mockServerResponse({ valid: false, paymentState: 0, cancelReason: 1 }),
      );

      const result = await verifySubscriptionWithServer(PACKAGE_NAME);

      expect(result).toBe(true);
      expect(usePurchaseStore.getState().tierLevel).toBe('FREE');
      expect(usePurchaseStore.getState().isPremium).toBe(false);
    });

    test('keeps PREMIUM when server confirms valid', async () => {
      usePurchaseStore.setState({
        tierLevel: 'PREMIUM',
        isPremium: true,
        productId: 'quarterly_clf_c02',
      });
      (getPurchaseStatus as Mock).mockResolvedValue(mockPurchaseStatus());
      (post as Mock).mockResolvedValue(mockServerResponse());

      const result = await verifySubscriptionWithServer(PACKAGE_NAME);

      expect(result).toBe(true);
      expect(usePurchaseStore.getState().tierLevel).toBe('PREMIUM');
      expect(usePurchaseStore.getState().isPremium).toBe(true);
    });

    test('sends correct payload to server', async () => {
      usePurchaseStore.setState({ tierLevel: 'PREMIUM', isPremium: true });
      const status = mockPurchaseStatus();
      (getPurchaseStatus as Mock).mockResolvedValue(status);
      (post as Mock).mockResolvedValue(mockServerResponse());

      await verifySubscriptionWithServer(PACKAGE_NAME);

      expect(post).toHaveBeenCalledWith('/api/billing/verify-subscription', {
        packageName: PACKAGE_NAME,
        purchaseToken: status.purchase_token,
        productId: status.product_id,
      });
    });

    test('preserves PREMIUM on network error (offline-first)', async () => {
      usePurchaseStore.setState({ tierLevel: 'PREMIUM', isPremium: true });
      (getPurchaseStatus as Mock).mockResolvedValue(mockPurchaseStatus());
      (post as Mock).mockRejectedValue(new Error('Network request failed'));

      const result = await verifySubscriptionWithServer(PACKAGE_NAME);

      expect(result).toBe(false);
      expect(usePurchaseStore.getState().tierLevel).toBe('PREMIUM');
      expect(usePurchaseStore.getState().isPremium).toBe(true);
    });

    test('updates local metadata when server expiry differs', async () => {
      const newExpiry = new Date('2025-07-01T00:00:00.000Z');
      usePurchaseStore.setState({
        tierLevel: 'PREMIUM',
        isPremium: true,
        productId: 'quarterly_clf_c02',
        subscriptionType: 'quarterly',
        expiryDate: '2025-04-01T00:00:00.000Z',
        autoRenewing: true,
      });
      (getPurchaseStatus as Mock).mockResolvedValue(mockPurchaseStatus());
      (post as Mock).mockResolvedValue(
        mockServerResponse({
          expiryTimeMillis: newExpiry.getTime(),
          autoRenewing: true,
        }),
      );

      await verifySubscriptionWithServer(PACKAGE_NAME);

      const state = usePurchaseStore.getState();
      expect(state.tierLevel).toBe('PREMIUM');
      expect(state.expiryDate).toBe(newExpiry.toISOString());
    });
  });

  describe('isVerificationNeeded', () => {
    test('returns false for FREE tier', async () => {
      const result = await isVerificationNeeded();
      expect(result).toBe(false);
    });

    test('returns true for PREMIUM user never verified', async () => {
      usePurchaseStore.setState({ tierLevel: 'PREMIUM', isPremium: true });

      const { getDatabase } = await import('../src/storage/database');
      (getDatabase as Mock).mockResolvedValue({
        getFirstAsync: vi.fn().mockResolvedValue(null),
      });

      const result = await isVerificationNeeded();
      expect(result).toBe(true);
    });
  });

  describe('stopPeriodicVerification', () => {
    test('cleans up without throwing when not started', () => {
      expect(() => stopPeriodicVerification()).not.toThrow();
    });
  });
});
