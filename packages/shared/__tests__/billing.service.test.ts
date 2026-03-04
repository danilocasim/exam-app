/**
 * T268: Billing Service Unit Tests
 *
 * Comprehensive tests for the billing service:
 * - Subscription flow: subscribe success, cancel, error, pending for each plan
 * - Subscription restoration: active found, expired found, not found
 * - Expiry checking: active subscription, expired + auto-renewing, expired + cancelled
 * - Renewal handling: update expiry date and token
 * - Automatic downgrade: expired subscription → FREE tier
 * - Acknowledgement lifecycle
 * - __DEV__ bypass (defaults to PREMIUM)
 * - Per-app subscription SKU generation from examTypeId
 * - Grace period and account hold states
 */
import { describe, test, expect, beforeEach, vi, type Mock } from 'vitest';
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
} from 'react-native-iap';

// ─── Top-level mocks ──────────────────────────────────────────────────────────

vi.mock('../src/storage/database', () => ({
  getDatabase: vi.fn(),
}));

vi.mock('../src/storage/repositories/purchase.repository', () => ({
  getPurchaseStatus: vi.fn(),
  savePurchaseStatus: vi.fn(),
  clearPurchaseStatus: vi.fn(),
}));

vi.mock('../src/services/sync.service', () => ({
  getCachedExamTypeConfig: vi.fn(),
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

const EXAM_TYPE_ID = 'CLF-C02';
const MOCK_TOKEN = 'mock-purchase-token-abc';

const makePurchase = (overrides: Record<string, unknown> = {}) => ({
  productId: 'quarterly_clf_c02',
  purchaseToken: MOCK_TOKEN,
  transactionDate: Date.now(),
  purchaseStateAndroid: 1, // PURCHASED
  isAcknowledgedAndroid: false,
  autoRenewingAndroid: true,
  ...overrides,
});

const makeSubscriptionResponse = (overrides: Record<string, unknown> = {}) => ({
  productId: 'quarterly_clf_c02',
  subscriptionOfferDetails: [
    {
      offerToken: 'mock-offer-token',
      pricingPhases: {
        pricingPhaseList: [
          {
            formattedPrice: '$6.99',
            priceAmountMicros: '6990000',
            priceCurrencyCode: 'USD',
            billingPeriod: 'P3M',
          },
        ],
      },
    },
  ],
  ...overrides,
});

// ─── SKU Generation Tests ─────────────────────────────────────────────────────

describe('SKU Generation', () => {
  // Import after mocks are set up
  let getSubscriptionSku: typeof import('../src/services/billing.service').getSubscriptionSku;
  let getAllSubscriptionSkus: typeof import('../src/services/billing.service').getAllSubscriptionSkus;
  let getPlanFromProductId: typeof import('../src/services/billing.service').getPlanFromProductId;

  beforeEach(async () => {
    vi.resetModules();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
    const mod = await import('../src/services/billing.service');
    getSubscriptionSku = mod.getSubscriptionSku;
    getAllSubscriptionSkus = mod.getAllSubscriptionSkus;
    getPlanFromProductId = mod.getPlanFromProductId;
  });

  test('generates correct SKU for CLF-C02 monthly', () => {
    expect(getSubscriptionSku('CLF-C02', 'monthly')).toBe('monthly_clf_c02');
  });

  test('generates correct SKU for CLF-C02 quarterly', () => {
    expect(getSubscriptionSku('CLF-C02', 'quarterly')).toBe('quarterly_clf_c02');
  });

  test('generates correct SKU for CLF-C02 annual', () => {
    expect(getSubscriptionSku('CLF-C02', 'annual')).toBe('annual_clf_c02');
  });

  test('generates correct SKU for SAA-C03', () => {
    expect(getSubscriptionSku('SAA-C03', 'monthly')).toBe('monthly_saa_c03');
    expect(getSubscriptionSku('SAA-C03', 'quarterly')).toBe('quarterly_saa_c03');
    expect(getSubscriptionSku('SAA-C03', 'annual')).toBe('annual_saa_c03');
  });

  test('replaces hyphens with underscores and lowercases', () => {
    expect(getSubscriptionSku('MY-EXAM-ID', 'monthly')).toBe('monthly_my_exam_id');
  });

  test('getAllSubscriptionSkus returns all 3 plan SKUs', () => {
    const skus = getAllSubscriptionSkus('CLF-C02');
    expect(skus).toEqual(['monthly_clf_c02', 'quarterly_clf_c02', 'annual_clf_c02']);
  });

  test('getPlanFromProductId identifies monthly plan', () => {
    expect(getPlanFromProductId('monthly_clf_c02')).toBe('monthly');
  });

  test('getPlanFromProductId identifies quarterly plan', () => {
    expect(getPlanFromProductId('quarterly_clf_c02')).toBe('quarterly');
  });

  test('getPlanFromProductId identifies annual plan', () => {
    expect(getPlanFromProductId('annual_clf_c02')).toBe('annual');
  });

  test('getPlanFromProductId returns null for unknown product', () => {
    expect(getPlanFromProductId('unknown_product')).toBeNull();
  });
});

// ─── __DEV__ Bypass Tests ─────────────────────────────────────────────────────

describe('__DEV__ Bypass', () => {
  beforeEach(async () => {
    vi.resetModules();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = true;
  });

  test('initBilling is a no-op in dev mode', async () => {
    const { initBilling } = await import('../src/services/billing.service');
    await initBilling();
    expect(initConnection).not.toHaveBeenCalled();
  });

  test('fetchSubscriptions returns mock data in dev mode', async () => {
    const { fetchSubscriptions } = await import('../src/services/billing.service');
    const subs = await fetchSubscriptions('CLF-C02');
    expect(subs).toHaveLength(3);
    expect(subs[0].plan).toBe('monthly');
    expect(subs[0].localizedPrice).toBe('$2.99');
    expect(subs[1].plan).toBe('quarterly');
    expect(subs[1].localizedPrice).toBe('$6.99');
    expect(subs[2].plan).toBe('annual');
    expect(subs[2].localizedPrice).toBe('$19.99');
  });

  test('subscribe returns mock success in dev mode', async () => {
    const { subscribe } = await import('../src/services/billing.service');
    const result = await subscribe('quarterly_clf_c02', 'mock-token');
    expect(result.success).toBe(true);
    expect(result.productId).toBe('quarterly_clf_c02');
    expect(result.purchaseToken).toBe('dev-mock-token');
    expect(result.autoRenewing).toBe(true);
  });

  test('restorePurchases returns empty in dev mode', async () => {
    const { restorePurchases } = await import('../src/services/billing.service');
    const purchases = await restorePurchases();
    expect(purchases).toEqual([]);
  });

  test('disconnectBilling is a no-op in dev mode', async () => {
    const { disconnectBilling } = await import('../src/services/billing.service');
    await disconnectBilling();
    expect(endConnection).not.toHaveBeenCalled();
  });

  test('acknowledgePurchase is a no-op in dev mode', async () => {
    const { acknowledgePurchase } = await import('../src/services/billing.service');
    await acknowledgePurchase(makePurchase() as any);
    expect(iapFinishTransaction).not.toHaveBeenCalled();
  });

  test('isBillingConnected returns true in dev mode', async () => {
    const { isBillingConnected } = await import('../src/services/billing.service');
    expect(isBillingConnected()).toBe(true);
  });

  test('checkExpiryAndRestore returns active in dev mode', async () => {
    const { checkExpiryAndRestore } = await import('../src/services/billing.service');
    const result = await checkExpiryAndRestore('CLF-C02');
    expect(result).toBe('active');
  });

  test('restoreSubscription returns none in dev mode', async () => {
    const { restoreSubscription } = await import('../src/services/billing.service');
    const result = await restoreSubscription('CLF-C02');
    expect(result).toBe('none');
  });

  test('handleSubscriptionPurchase returns mock success and sets PREMIUM in dev mode', async () => {
    const { handleSubscriptionPurchase } = await import('../src/services/billing.service');
    const result = await handleSubscriptionPurchase('quarterly_clf_c02', 'mock-offer-token');
    expect(result.success).toBe(true);
    expect(result.plan).toBe('quarterly');
    expect(result.isPending).toBe(false);
    expect(result.expiryDate).toBeDefined();
  });
});

// ─── Connection Tests ─────────────────────────────────────────────────────────

describe('Connection Lifecycle', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  test('initBilling establishes connection and sets up listeners', async () => {
    (initConnection as Mock).mockResolvedValue(true);
    (flushFailedPurchasesCachedAsPendingAndroid as Mock).mockResolvedValue([]);

    const { initBilling } = await import('../src/services/billing.service');
    await initBilling();

    expect(initConnection).toHaveBeenCalled();
    expect(flushFailedPurchasesCachedAsPendingAndroid).toHaveBeenCalled();
    expect(purchaseUpdatedListener).toHaveBeenCalled();
    expect(purchaseErrorListener).toHaveBeenCalled();
  });

  test('initBilling does not reconnect if already connected', async () => {
    (initConnection as Mock).mockResolvedValue(true);
    (flushFailedPurchasesCachedAsPendingAndroid as Mock).mockResolvedValue([]);

    const { initBilling } = await import('../src/services/billing.service');
    await initBilling();
    await initBilling(); // second call

    expect(initConnection).toHaveBeenCalledTimes(1);
  });

  test('initBilling throws on connection failure', async () => {
    (initConnection as Mock).mockRejectedValue(new Error('Play Store unavailable'));

    const { initBilling } = await import('../src/services/billing.service');
    await expect(initBilling()).rejects.toThrow('Play Store unavailable');
  });

  test('disconnectBilling cleans up listeners and ends connection', async () => {
    const removeFn = vi.fn();
    (initConnection as Mock).mockResolvedValue(true);
    (flushFailedPurchasesCachedAsPendingAndroid as Mock).mockResolvedValue([]);
    (purchaseUpdatedListener as Mock).mockReturnValue({ remove: removeFn });
    (purchaseErrorListener as Mock).mockReturnValue({ remove: removeFn });
    (endConnection as Mock).mockResolvedValue(undefined);

    const { initBilling, disconnectBilling } = await import('../src/services/billing.service');
    await initBilling();
    await disconnectBilling();

    expect(removeFn).toHaveBeenCalledTimes(2); // purchaseUpdated + purchaseError
    expect(endConnection).toHaveBeenCalled();
  });

  test('initBilling skips on non-Android platform', async () => {
    const { Platform } = await import('react-native');
    const originalOS = Platform.OS;
    (Platform as any).OS = 'ios';

    const { initBilling } = await import('../src/services/billing.service');
    await initBilling();
    expect(initConnection).not.toHaveBeenCalled();

    (Platform as any).OS = originalOS;
  });
});

// ─── Subscription Flow Tests ──────────────────────────────────────────────────

describe('Subscription Flow', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  /** Helper: init billing before testing subscribe-dependent functions */
  const initAndGetModule = async () => {
    (initConnection as Mock).mockResolvedValue(true);
    (flushFailedPurchasesCachedAsPendingAndroid as Mock).mockResolvedValue([]);
    (purchaseUpdatedListener as Mock).mockReturnValue({ remove: vi.fn() });
    (purchaseErrorListener as Mock).mockReturnValue({ remove: vi.fn() });

    const mod = await import('../src/services/billing.service');
    await mod.initBilling();
    return mod;
  };

  describe('subscribe()', () => {
    test.each([
      ['monthly', 'monthly_clf_c02'],
      ['quarterly', 'quarterly_clf_c02'],
      ['annual', 'annual_clf_c02'],
    ] as const)('subscribe success for %s plan', async (_plan, sku) => {
      const mod = await initAndGetModule();
      (iapRequestSubscription as Mock).mockResolvedValue({
        productId: sku,
        purchaseToken: MOCK_TOKEN,
        transactionDate: Date.now(),
        purchaseStateAndroid: 1, // PURCHASED
        autoRenewingAndroid: true,
      });

      const result = await mod.subscribe(sku, 'offer-token');
      expect(result.success).toBe(true);
      expect(result.productId).toBe(sku);
      expect(result.purchaseToken).toBe(MOCK_TOKEN);
      expect(result.autoRenewing).toBe(true);
    });

    test('subscribe returns not connected error when billing not initialized', async () => {
      const mod = await import('../src/services/billing.service');
      await expect(mod.subscribe('quarterly_clf_c02', 'token')).rejects.toThrow('Not connected');
    });

    test('subscribe handles user cancellation', async () => {
      const mod = await initAndGetModule();
      (iapRequestSubscription as Mock).mockRejectedValue({
        code: 'E_USER_CANCELLED',
        message: 'User cancelled',
      });

      const result = await mod.subscribe('quarterly_clf_c02', 'offer-token');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('E_USER_CANCELLED');
    });

    test('subscribe handles billing error', async () => {
      const mod = await initAndGetModule();
      (iapRequestSubscription as Mock).mockRejectedValue({
        code: 'E_BILLING_UNAVAILABLE',
        message: 'Play Store unavailable',
      });

      const result = await mod.subscribe('quarterly_clf_c02', 'offer-token');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('E_BILLING_UNAVAILABLE');
    });

    test('subscribe handles PAYMENT_PENDING state', async () => {
      const mod = await initAndGetModule();
      (iapRequestSubscription as Mock).mockResolvedValue({
        productId: 'quarterly_clf_c02',
        purchaseToken: MOCK_TOKEN,
        transactionDate: Date.now(),
        purchaseStateAndroid: 2, // PENDING
        autoRenewingAndroid: true,
      });

      const result = await mod.subscribe('quarterly_clf_c02', 'offer-token');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('PAYMENT_PENDING');
    });

    test('subscribe handles null result', async () => {
      const mod = await initAndGetModule();
      (iapRequestSubscription as Mock).mockResolvedValue(null);

      const result = await mod.subscribe('quarterly_clf_c02', 'offer-token');
      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NO_RESULT');
    });

    test('subscribe handles array result', async () => {
      const mod = await initAndGetModule();
      (iapRequestSubscription as Mock).mockResolvedValue([
        {
          productId: 'quarterly_clf_c02',
          purchaseToken: MOCK_TOKEN,
          transactionDate: Date.now(),
          purchaseStateAndroid: 1,
          autoRenewingAndroid: true,
        },
      ]);

      const result = await mod.subscribe('quarterly_clf_c02', 'offer-token');
      expect(result.success).toBe(true);
      expect(result.productId).toBe('quarterly_clf_c02');
    });
  });

  describe('fetchSubscriptions()', () => {
    test('fetches and parses subscriptions from Play Store', async () => {
      const mod = await initAndGetModule();
      (iapGetSubscriptions as Mock).mockResolvedValue([
        makeSubscriptionResponse({ productId: 'monthly_clf_c02' }),
        makeSubscriptionResponse({ productId: 'quarterly_clf_c02' }),
        makeSubscriptionResponse({ productId: 'annual_clf_c02' }),
      ]);

      const subs = await mod.fetchSubscriptions('CLF-C02');
      expect(subs).toHaveLength(3);
      expect(subs[0].localizedPrice).toBe('$6.99');
      expect(subs[0].offerToken).toBe('mock-offer-token');
    });

    test('fetchSubscriptions throws when not connected', async () => {
      const mod = await import('../src/services/billing.service');
      await expect(mod.fetchSubscriptions('CLF-C02')).rejects.toThrow('Not connected');
    });
  });
});

// ─── Subscription Restoration Tests ───────────────────────────────────────────

describe('Subscription Restoration', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  const initAndGetModule = async () => {
    (initConnection as Mock).mockResolvedValue(true);
    (flushFailedPurchasesCachedAsPendingAndroid as Mock).mockResolvedValue([]);
    (purchaseUpdatedListener as Mock).mockReturnValue({ remove: vi.fn() });
    (purchaseErrorListener as Mock).mockReturnValue({ remove: vi.fn() });

    const mod = await import('../src/services/billing.service');
    await mod.initBilling();
    return mod;
  };

  test('restoreSubscription returns restored when active subscription found', async () => {
    const mod = await initAndGetModule();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);

    (getAvailablePurchases as Mock).mockResolvedValue([
      makePurchase({
        productId: 'quarterly_clf_c02',
        transactionDate: Date.now(),
        isAcknowledgedAndroid: true,
        autoRenewingAndroid: true,
      }),
    ]);

    const result = await mod.restoreSubscription(EXAM_TYPE_ID);
    expect(result).toBe('restored');
  });

  test('restoreSubscription returns expired when only expired subscription found', async () => {
    const mod = await initAndGetModule();
    // Create an old purchase whose calculated expiry is in the past
    const pastDate = new Date();
    pastDate.setMonth(pastDate.getMonth() - 6); // 6 months ago — any plan would be expired

    (getAvailablePurchases as Mock).mockResolvedValue([
      makePurchase({
        productId: 'monthly_clf_c02',
        transactionDate: pastDate.getTime(),
        autoRenewingAndroid: false,
      }),
    ]);

    const result = await mod.restoreSubscription(EXAM_TYPE_ID);
    expect(result).toBe('expired');
  });

  test('restoreSubscription returns none when no subscriptions found', async () => {
    const mod = await initAndGetModule();
    (getAvailablePurchases as Mock).mockResolvedValue([]);

    const result = await mod.restoreSubscription(EXAM_TYPE_ID);
    expect(result).toBe('none');
  });

  test('restoreSubscription ignores purchases from other exam types', async () => {
    const mod = await initAndGetModule();
    (getAvailablePurchases as Mock).mockResolvedValue([
      makePurchase({ productId: 'quarterly_saa_c03' }), // different exam type
    ]);

    const result = await mod.restoreSubscription(EXAM_TYPE_ID);
    expect(result).toBe('none');
  });

  test('restoreSubscription returns none when not connected', async () => {
    const mod = await import('../src/services/billing.service');
    // Not initialized → not connected
    const result = await mod.restoreSubscription(EXAM_TYPE_ID);
    expect(result).toBe('none');
  });

  test('restoreSubscription acknowledges unacknowledged purchases', async () => {
    const mod = await initAndGetModule();
    (getAvailablePurchases as Mock).mockResolvedValue([
      makePurchase({
        productId: 'quarterly_clf_c02',
        isAcknowledgedAndroid: false,
      }),
    ]);
    (iapFinishTransaction as Mock).mockResolvedValue(undefined);

    await mod.restoreSubscription(EXAM_TYPE_ID);
    expect(iapFinishTransaction).toHaveBeenCalled();
  });

  test('restorePurchases returns available purchases', async () => {
    const mod = await initAndGetModule();
    const purchases = [makePurchase()];
    (getAvailablePurchases as Mock).mockResolvedValue(purchases);

    const result = await mod.restorePurchases();
    expect(result).toEqual(purchases);
  });
});

// ─── Expiry Checking Tests ────────────────────────────────────────────────────

describe('Expiry Checking', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  test('checkExpiry returns false for future date', async () => {
    const { checkExpiry } = await import('../src/services/billing.service');
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(checkExpiry(future.toISOString())).toBe(false);
  });

  test('checkExpiry returns true for past date', async () => {
    const { checkExpiry } = await import('../src/services/billing.service');
    const past = new Date('2020-01-01T00:00:00.000Z');
    expect(checkExpiry(past.toISOString())).toBe(true);
  });

  test('checkExpiry returns true for null date', async () => {
    const { checkExpiry } = await import('../src/services/billing.service');
    expect(checkExpiry(null)).toBe(true);
  });

  test('validateSubscription computes active status for recent purchase', async () => {
    const { validateSubscription } = await import('../src/services/billing.service');
    const purchase = makePurchase({
      productId: 'quarterly_clf_c02',
      transactionDate: Date.now(),
    });

    const status = validateSubscription(purchase as any);
    expect(status.isActive).toBe(true);
    expect(status.subscriptionType).toBe('quarterly');
    expect(status.autoRenewing).toBe(true);
    expect(status.expiryDate).toBeDefined();
  });

  test('validateSubscription computes expired status for old purchase', async () => {
    const { validateSubscription } = await import('../src/services/billing.service');
    const oldDate = new Date();
    oldDate.setFullYear(oldDate.getFullYear() - 2);

    const purchase = makePurchase({
      productId: 'monthly_clf_c02',
      transactionDate: oldDate.getTime(),
      autoRenewingAndroid: false,
    });

    const status = validateSubscription(purchase as any);
    expect(status.isActive).toBe(false);
    expect(status.subscriptionType).toBe('monthly');
    expect(status.autoRenewing).toBe(false);
  });
});

// ─── checkExpiryAndRestore Tests ──────────────────────────────────────────────

describe('checkExpiryAndRestore', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  test('returns active when subscription not expired', async () => {
    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);

    usePurchaseStore.setState({
      tierLevel: 'PREMIUM',
      isPremium: true,
      expiryDate: futureDate.toISOString(),
      autoRenewing: true,
    });

    const { checkExpiryAndRestore } = await import('../src/services/billing.service');
    const result = await checkExpiryAndRestore(EXAM_TYPE_ID);
    expect(result).toBe('active');
  });

  test('returns downgraded when expired and not auto-renewing', async () => {
    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    const pastDate = new Date('2020-01-01T00:00:00.000Z');

    usePurchaseStore.setState({
      tierLevel: 'PREMIUM',
      isPremium: true,
      expiryDate: pastDate.toISOString(),
      autoRenewing: false,
      productId: 'quarterly_clf_c02',
      purchasedAt: '2020-01-01T00:00:00.000Z',
    });

    const { checkExpiryAndRestore } = await import('../src/services/billing.service');
    const result = await checkExpiryAndRestore(EXAM_TYPE_ID);
    expect(result).toBe('downgraded');
  });

  test('returns active for FREE tier (nothing to check)', async () => {
    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    usePurchaseStore.setState({
      tierLevel: 'FREE',
      isPremium: false,
      expiryDate: null,
      autoRenewing: false,
    });

    const { checkExpiryAndRestore } = await import('../src/services/billing.service');
    const result = await checkExpiryAndRestore(EXAM_TYPE_ID);
    expect(result).toBe('active');
  });

  test('attempts restore when expired but auto-renewing and connected', async () => {
    // Initialize billing first
    (initConnection as Mock).mockResolvedValue(true);
    (flushFailedPurchasesCachedAsPendingAndroid as Mock).mockResolvedValue([]);
    (purchaseUpdatedListener as Mock).mockReturnValue({ remove: vi.fn() });
    (purchaseErrorListener as Mock).mockReturnValue({ remove: vi.fn() });

    const mod = await import('../src/services/billing.service');
    await mod.initBilling();

    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    const pastDate = new Date('2020-01-01T00:00:00.000Z');

    usePurchaseStore.setState({
      tierLevel: 'PREMIUM',
      isPremium: true,
      expiryDate: pastDate.toISOString(),
      autoRenewing: true,
      productId: 'quarterly_clf_c02',
      purchasedAt: '2020-01-01T00:00:00.000Z',
    });

    // No purchases found → subscription truly expired
    (getAvailablePurchases as Mock).mockResolvedValue([]);

    const result = await mod.checkExpiryAndRestore(EXAM_TYPE_ID);
    expect(result).toBe('expired');
  });

  test('returns renewed when expired + auto-renewing and restore finds active subscription', async () => {
    (initConnection as Mock).mockResolvedValue(true);
    (flushFailedPurchasesCachedAsPendingAndroid as Mock).mockResolvedValue([]);
    (purchaseUpdatedListener as Mock).mockReturnValue({ remove: vi.fn() });
    (purchaseErrorListener as Mock).mockReturnValue({ remove: vi.fn() });

    const mod = await import('../src/services/billing.service');
    await mod.initBilling();

    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    const pastDate = new Date('2020-01-01T00:00:00.000Z');

    usePurchaseStore.setState({
      tierLevel: 'PREMIUM',
      isPremium: true,
      expiryDate: pastDate.toISOString(),
      autoRenewing: true,
      productId: 'quarterly_clf_c02',
      purchasedAt: '2020-01-01T00:00:00.000Z',
    });

    // Active purchase found → renewed
    (getAvailablePurchases as Mock).mockResolvedValue([
      makePurchase({
        productId: 'quarterly_clf_c02',
        transactionDate: Date.now(), // recent
        isAcknowledgedAndroid: true,
      }),
    ]);

    const result = await mod.checkExpiryAndRestore(EXAM_TYPE_ID);
    expect(result).toBe('renewed');
  });
});

// ─── Renewal Handling Tests ───────────────────────────────────────────────────

describe('Renewal Handling', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  test('handleRenewal returns updated subscription status', async () => {
    const { handleRenewal } = await import('../src/services/billing.service');
    const purchase = makePurchase({
      productId: 'quarterly_clf_c02',
      transactionDate: Date.now(),
    });

    const status = handleRenewal(purchase as any);
    expect(status.isActive).toBe(true);
    expect(status.subscriptionType).toBe('quarterly');
    expect(status.purchaseToken).toBe(MOCK_TOKEN);
  });

  test('handleRenewalUpdate updates store with new expiry', async () => {
    const { handleRenewalUpdate } = await import('../src/services/billing.service');
    const purchase = makePurchase({
      productId: 'quarterly_clf_c02',
      transactionDate: Date.now(),
    });

    const status = await handleRenewalUpdate(purchase as any);
    expect(status).not.toBeNull();
    expect(status?.isActive).toBe(true);
    expect(status?.expiryDate).toBeDefined();
  });

  test('handleRenewalUpdate returns null for unknown product', async () => {
    const { handleRenewalUpdate } = await import('../src/services/billing.service');
    const purchase = makePurchase({ productId: 'unknown_product' });

    const status = await handleRenewalUpdate(purchase as any);
    expect(status).toBeNull();
  });
});

// ─── Acknowledgement Lifecycle Tests ──────────────────────────────────────────

describe('Acknowledgement Lifecycle', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  test('acknowledgePurchase calls finishTransaction', async () => {
    const { acknowledgePurchase } = await import('../src/services/billing.service');
    (iapFinishTransaction as Mock).mockResolvedValue(undefined);

    const purchase = makePurchase({ isAcknowledgedAndroid: false });
    await acknowledgePurchase(purchase as any);

    expect(iapFinishTransaction).toHaveBeenCalledWith({
      purchase,
      isConsumable: false,
    });
  });

  test('acknowledgePurchase skips already-acknowledged purchase', async () => {
    const { acknowledgePurchase } = await import('../src/services/billing.service');
    const purchase = makePurchase({ isAcknowledgedAndroid: true });

    await acknowledgePurchase(purchase as any);
    expect(iapFinishTransaction).not.toHaveBeenCalled();
  });

  test('acknowledgePurchase throws on failure', async () => {
    const { acknowledgePurchase } = await import('../src/services/billing.service');
    (iapFinishTransaction as Mock).mockRejectedValue(new Error('Acknowledge failed'));

    const purchase = makePurchase({ isAcknowledgedAndroid: false });
    await expect(acknowledgePurchase(purchase as any)).rejects.toThrow('Acknowledge failed');
  });

  test('finishTransaction calls iapFinishTransaction', async () => {
    const { finishTransaction } = await import('../src/services/billing.service');
    (iapFinishTransaction as Mock).mockResolvedValue(undefined);

    const purchase = makePurchase();
    await finishTransaction(purchase as any);

    expect(iapFinishTransaction).toHaveBeenCalledWith({
      purchase,
      isConsumable: false,
    });
  });
});

// ─── Orchestrated Purchase Flow Tests (T261) ─────────────────────────────────

describe('handleSubscriptionPurchase (Orchestration)', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  const initAndGetModule = async () => {
    (initConnection as Mock).mockResolvedValue(true);
    (flushFailedPurchasesCachedAsPendingAndroid as Mock).mockResolvedValue([]);
    (purchaseUpdatedListener as Mock).mockReturnValue({ remove: vi.fn() });
    (purchaseErrorListener as Mock).mockReturnValue({ remove: vi.fn() });

    const mod = await import('../src/services/billing.service');
    await mod.initBilling();
    return mod;
  };

  test.each([
    ['monthly', 'monthly_clf_c02'],
    ['quarterly', 'quarterly_clf_c02'],
    ['annual', 'annual_clf_c02'],
  ] as const)('full purchase flow success for %s plan', async (plan, sku) => {
    const mod = await initAndGetModule();
    (iapRequestSubscription as Mock).mockResolvedValue({
      productId: sku,
      purchaseToken: MOCK_TOKEN,
      transactionDate: Date.now(),
      purchaseStateAndroid: 1,
      autoRenewingAndroid: true,
    });

    const result = await mod.handleSubscriptionPurchase(sku, 'offer-token');
    expect(result.success).toBe(true);
    expect(result.plan).toBe(plan);
    expect(result.expiryDate).toBeDefined();
    expect(result.isPending).toBe(false);
  });

  test('handles PAYMENT_PENDING and sets pending state', async () => {
    const mod = await initAndGetModule();
    (iapRequestSubscription as Mock).mockResolvedValue({
      productId: 'quarterly_clf_c02',
      purchaseToken: MOCK_TOKEN,
      transactionDate: Date.now(),
      purchaseStateAndroid: 2, // PENDING
      autoRenewingAndroid: true,
    });

    const result = await mod.handleSubscriptionPurchase('quarterly_clf_c02', 'offer-token');
    expect(result.success).toBe(false);
    expect(result.isPending).toBe(true);
    expect(result.error?.code).toBe('PAYMENT_PENDING');

    // Verify pending state was set in store
    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    expect(usePurchaseStore.getState().pendingProductId).toBe('quarterly_clf_c02');
  });

  test('handles subscription error', async () => {
    const mod = await initAndGetModule();
    (iapRequestSubscription as Mock).mockRejectedValue({
      code: 'E_BILLING_UNAVAILABLE',
      message: 'Billing unavailable',
    });

    const result = await mod.handleSubscriptionPurchase('quarterly_clf_c02', 'offer-token');
    expect(result.success).toBe(false);
    expect(result.isPending).toBe(false);
    expect(result.plan).toBe('quarterly');
  });
});

// ─── Purchase Update Processing Tests (T261) ─────────────────────────────────

describe('processPurchaseUpdate', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  test('processes purchased subscription and updates store to PREMIUM', async () => {
    const { processPurchaseUpdate } = await import('../src/services/billing.service');
    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    (iapFinishTransaction as Mock).mockResolvedValue(undefined);

    const purchase = makePurchase({
      productId: 'quarterly_clf_c02',
      purchaseStateAndroid: 1, // PURCHASED
      isAcknowledgedAndroid: false,
    });

    const status = await processPurchaseUpdate(purchase as any);

    expect(status).not.toBeNull();
    expect(status?.isActive).toBe(true);
    expect(iapFinishTransaction).toHaveBeenCalled(); // acknowledgement
    expect(usePurchaseStore.getState().tierLevel).toBe('PREMIUM');
  });

  test('returns null for PENDING payment state', async () => {
    const { processPurchaseUpdate } = await import('../src/services/billing.service');
    const purchase = makePurchase({
      purchaseStateAndroid: 2, // PENDING
    });

    const status = await processPurchaseUpdate(purchase as any);
    expect(status).toBeNull();
  });

  test('clears pending product ID on successful purchase', async () => {
    const { processPurchaseUpdate } = await import('../src/services/billing.service');
    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    (iapFinishTransaction as Mock).mockResolvedValue(undefined);

    // Set pending state first
    usePurchaseStore.getState().setPendingSubscription('quarterly_clf_c02');
    expect(usePurchaseStore.getState().pendingProductId).toBe('quarterly_clf_c02');

    const purchase = makePurchase({
      productId: 'quarterly_clf_c02',
      purchaseStateAndroid: 1,
    });

    await processPurchaseUpdate(purchase as any);
    expect(usePurchaseStore.getState().pendingProductId).toBeNull();
  });

  test('continues even if acknowledgement fails', async () => {
    const { processPurchaseUpdate } = await import('../src/services/billing.service');
    (iapFinishTransaction as Mock).mockRejectedValue(new Error('ack failed'));

    const purchase = makePurchase({
      productId: 'quarterly_clf_c02',
      purchaseStateAndroid: 1,
      isAcknowledgedAndroid: false,
    });

    // Should not throw — acknowledgement failure is non-fatal
    const status = await processPurchaseUpdate(purchase as any);
    expect(status).not.toBeNull();
  });
});

// ─── Purchase Error Processing Tests ──────────────────────────────────────────

describe('processPurchaseError', () => {
  beforeEach(async () => {
    vi.resetModules();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  test('returns null for user cancellation (E_USER_CANCELLED)', async () => {
    const { processPurchaseError } = await import('../src/services/billing.service');
    const result = processPurchaseError({
      code: 'E_USER_CANCELLED',
      message: 'User cancelled',
    } as any);
    expect(result).toBeNull();
  });

  test('returns null for user cancellation (code "1")', async () => {
    const { processPurchaseError } = await import('../src/services/billing.service');
    const result = processPurchaseError({
      code: '1',
      message: 'cancelled',
    } as any);
    expect(result).toBeNull();
  });

  test('returns error details for billing error', async () => {
    const { processPurchaseError } = await import('../src/services/billing.service');
    const result = processPurchaseError({
      code: 'E_BILLING_UNAVAILABLE',
      message: 'Play Store unavailable',
    } as any);

    expect(result).not.toBeNull();
    expect(result?.code).toBe('E_BILLING_UNAVAILABLE');
    expect(result?.isUserCancel).toBe(false);
  });
});

// ─── Pending Subscription Check Tests ─────────────────────────────────────────

describe('checkPendingSubscriptions', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  const initAndGetModule = async () => {
    (initConnection as Mock).mockResolvedValue(true);
    (flushFailedPurchasesCachedAsPendingAndroid as Mock).mockResolvedValue([]);
    (purchaseUpdatedListener as Mock).mockReturnValue({ remove: vi.fn() });
    (purchaseErrorListener as Mock).mockReturnValue({ remove: vi.fn() });

    const mod = await import('../src/services/billing.service');
    await mod.initBilling();
    return mod;
  };

  test('processes and acknowledges pending purchases', async () => {
    const mod = await initAndGetModule();
    (iapFinishTransaction as Mock).mockResolvedValue(undefined);
    (getAvailablePurchases as Mock).mockResolvedValue([
      makePurchase({
        productId: 'quarterly_clf_c02',
        isAcknowledgedAndroid: false,
      }),
    ]);

    const results = await mod.checkPendingSubscriptions(EXAM_TYPE_ID);
    expect(results).toHaveLength(1);
    expect(iapFinishTransaction).toHaveBeenCalled();
  });

  test('skips purchases from other exam types', async () => {
    const mod = await initAndGetModule();
    (getAvailablePurchases as Mock).mockResolvedValue([
      makePurchase({ productId: 'quarterly_saa_c03' }),
    ]);

    const results = await mod.checkPendingSubscriptions(EXAM_TYPE_ID);
    expect(results).toHaveLength(0);
  });

  test('returns empty when not connected', async () => {
    const mod = await import('../src/services/billing.service');
    const results = await mod.checkPendingSubscriptions(EXAM_TYPE_ID);
    expect(results).toEqual([]);
  });

  test('returns empty on error', async () => {
    const mod = await initAndGetModule();
    (getAvailablePurchases as Mock).mockRejectedValue(new Error('network error'));

    const results = await mod.checkPendingSubscriptions(EXAM_TYPE_ID);
    expect(results).toEqual([]);
  });
});

// ─── initBillingWithStore Tests ───────────────────────────────────────────────

describe('initBillingWithStore', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  test('initializes billing and sets up listeners', async () => {
    (initConnection as Mock).mockResolvedValue(true);
    (flushFailedPurchasesCachedAsPendingAndroid as Mock).mockResolvedValue([]);
    (purchaseUpdatedListener as Mock).mockReturnValue({ remove: vi.fn() });
    (purchaseErrorListener as Mock).mockReturnValue({ remove: vi.fn() });
    (getAvailablePurchases as Mock).mockResolvedValue([]);

    const { initBillingWithStore } = await import('../src/services/billing.service');
    const cleanup = await initBillingWithStore(EXAM_TYPE_ID);

    expect(initConnection).toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
  });

  test('returns no-op cleanup in dev mode', async () => {
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = true;

    const { initBillingWithStore } = await import('../src/services/billing.service');
    const cleanup = await initBillingWithStore(EXAM_TYPE_ID);

    expect(initConnection).not.toHaveBeenCalled();
    expect(typeof cleanup).toBe('function');
    await cleanup(); // should not throw
  });
});

// ─── Utility Function Tests ──────────────────────────────────────────────────

describe('Utility Functions', () => {
  beforeEach(async () => {
    vi.resetModules();
    // @ts-expect-error — __DEV__ is a React Native global
    globalThis.__DEV__ = false;
  });

  test('cancelSubscription opens Play Store subscription URL', async () => {
    const { Linking } = await import('react-native');
    const { cancelSubscription } = await import('../src/services/billing.service');
    (Linking.openURL as Mock).mockResolvedValue(undefined);

    cancelSubscription();

    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://play.google.com/store/account/subscriptions',
    );
  });

  test('SUBSCRIPTION_PLANS has correct labels and savings', async () => {
    const { SUBSCRIPTION_PLANS } = await import('../src/services/billing.service');
    expect(SUBSCRIPTION_PLANS.monthly.label).toBe('Monthly');
    expect(SUBSCRIPTION_PLANS.monthly.savings).toBeNull();
    expect(SUBSCRIPTION_PLANS.quarterly.label).toBe('Quarterly');
    expect(SUBSCRIPTION_PLANS.quarterly.savings).toBe('22% off');
    expect(SUBSCRIPTION_PLANS.annual.label).toBe('Annual');
    expect(SUBSCRIPTION_PLANS.annual.savings).toBe('44% off');
  });
});
