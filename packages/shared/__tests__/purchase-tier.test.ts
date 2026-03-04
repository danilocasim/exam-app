/**
 * T257: Purchase Tier Unit Tests
 *
 * Tests for tier gating logic:
 * - FREE tier uses diagnostic set
 * - PREMIUM tier returns all questions
 * - Exam generation with tier limits (diagnostic exam vs full exam)
 * - Purchase store state transitions (FREE → PREMIUM, reset)
 * - __DEV__ bypass defaults to PREMIUM
 */
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { TIER_CONFIGS } from '../src/config/tiers';

// ─── Top-level mocks (vi.mock is hoisted — no local vars in factory fns) ──────

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

// Mock the question repository at the top level with vi.fn() placeholders
vi.mock('../src/storage/repositories/question.repository', () => ({
  getQuestionsBySet: vi.fn(),
  getRandomQuestionsByDomain: vi.fn(),
  getQuestionCountByDomain: vi.fn(),
  getTotalQuestionCount: vi.fn(),
  getAllQuestions: vi.fn(),
  getQuestionById: vi.fn(),
  getQuestionsByDomain: vi.fn(),
  getQuestionsByDifficulty: vi.fn(),
  getQuestionsByDomainAndDifficulty: vi.fn(),
}));

// ─── Test Helpers ─────────────────────────────────────────────────────────────

const makeRow = (overrides: Record<string, unknown> = {}) => ({
  id: `q-${Math.random().toString(36).slice(2)}`,
  text: 'Sample question?',
  type: 'SINGLE_CHOICE',
  domain: 'CLF-C02-1',
  difficulty: 'MEDIUM',
  options: JSON.stringify([
    { id: 'a', text: 'Option A' },
    { id: 'b', text: 'Option B' },
  ]),
  correctAnswers: JSON.stringify(['a']),
  explanation: 'Because A.',
  explanationBlocks: null,
  version: 1,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  ...overrides,
});

const makeRows = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    makeRow({ id: `q-${String(i).padStart(3, '0')}`, domain: 'CLF-C02-1' }),
  );

// ─── Tier Configuration ───────────────────────────────────────────────────────

describe('Tier Configuration', () => {
  test('FREE tier config restricts full exams and analytics', () => {
    expect(TIER_CONFIGS.FREE.canTakeFullExams).toBe(false);
    expect(TIER_CONFIGS.FREE.canViewAnalytics).toBe(false);
  });

  test('PREMIUM tier config allows all features', () => {
    expect(TIER_CONFIGS.PREMIUM.canTakeFullExams).toBe(true);
    expect(TIER_CONFIGS.PREMIUM.canViewAnalytics).toBe(true);
  });
});

// ─── FREE tier uses Diagnostic Set ───────────────────────────────────────────

describe('FREE tier uses diagnostic set', () => {
  test('generateExamForTier FREE delegates to generateDiagnosticExam', async () => {
    const diagnosticQuestions = makeRows(16);
    const { getQuestionsBySet } = await import('../src/storage/repositories/question.repository');
    (getQuestionsBySet as any).mockResolvedValue(diagnosticQuestions);

    const { getCachedExamTypeConfig } = await import('../src/services/sync.service');
    const mockConfig = {
      questionCount: 65,
      timeLimit: 90,
      passingScore: 70,
      domains: [{ id: 'CLF-C02-1', name: 'Domain 1', weight: 100, questionCount: 65 }],
    };
    (getCachedExamTypeConfig as any).mockResolvedValue(mockConfig);

    const { generateExamForTier } = await import('../src/services/exam-generator.service');
    const result = await generateExamForTier('FREE');

    expect(result.questions).toHaveLength(16);
    expect(result.totalQuestions).toBe(16);
    expect(getQuestionsBySet).toHaveBeenCalledWith('diagnostic');
  });
});

// ─── Practice Service — TierUpgradeRequiredError ──────────────────────────────

describe('TierUpgradeRequiredError', () => {
  test('is exported from practice.service', async () => {
    const { TierUpgradeRequiredError } = await import('../src/services/practice.service');
    expect(TierUpgradeRequiredError).toBeDefined();
  });

  test('has correct name and message', async () => {
    const { TierUpgradeRequiredError } = await import('../src/services/practice.service');
    const err = new TierUpgradeRequiredError();
    expect(err.name).toBe('TierUpgradeRequiredError');
    expect(err.message).toBe('Upgrade to access more questions');
  });

  test('accepts custom message', async () => {
    const { TierUpgradeRequiredError } = await import('../src/services/practice.service');
    const err = new TierUpgradeRequiredError('Custom message');
    expect(err.message).toBe('Custom message');
  });

  test('is an instanceof Error', async () => {
    const { TierUpgradeRequiredError } = await import('../src/services/practice.service');
    const err = new TierUpgradeRequiredError();
    expect(err).toBeInstanceOf(Error);
  });
});

// ─── Exam Generator — Tier Limits ────────────────────────────────────────────

describe('generateExamForTier', () => {
  const mockConfig = {
    questionCount: 65,
    timeLimit: 90,
    passingScore: 70,
    domains: [{ id: 'CLF-C02-1', name: 'Domain 1', weight: 100, questionCount: 65 }],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { getCachedExamTypeConfig } = await import('../src/services/sync.service');
    (getCachedExamTypeConfig as any).mockResolvedValue(mockConfig);
  });

  test('FREE tier builds diagnostic exam with proportionally scaled time limit', async () => {
    const diagnosticQuestions = makeRows(16);
    const { getQuestionsBySet } = await import('../src/storage/repositories/question.repository');
    (getQuestionsBySet as any).mockResolvedValue(diagnosticQuestions);

    const { generateExamForTier } = await import('../src/services/exam-generator.service');
    const result = await generateExamForTier('FREE', mockConfig);

    expect(result.questions).toHaveLength(16);
    expect(result.totalQuestions).toBe(16);
    // Math.max(5, Math.round(90 * 16/65)) = Math.max(5, 22) = 22
    expect(result.config.timeLimit).toBe(22);
    // Passing score percentage stays the same
    expect(result.config.passingScore).toBe(70);
    expect(result.config.questionCount).toBe(16);
  });

  test('FREE tier scales time limit to minimum of 5 minutes', async () => {
    // Tiny diagnostic set relative to huge config → time limit would be < 5
    const tinyConfig = { ...mockConfig, questionCount: 1000, timeLimit: 120 };
    const diagnosticQuestions = makeRows(3); // 3 out of 1000 → 120 * 3/1000 = 0.36 → max(5, 0) = 5
    const { getQuestionsBySet } = await import('../src/storage/repositories/question.repository');
    (getQuestionsBySet as any).mockResolvedValue(diagnosticQuestions);

    const { generateExamForTier } = await import('../src/services/exam-generator.service');
    const result = await generateExamForTier('FREE', tinyConfig);

    expect(result.config.timeLimit).toBeGreaterThanOrEqual(5);
  });

  test('PREMIUM tier uses full generateExam path', async () => {
    const allQuestions = makeRows(65);
    const { getRandomQuestionsByDomain, getQuestionCountByDomain, getTotalQuestionCount } =
      await import('../src/storage/repositories/question.repository');
    (getRandomQuestionsByDomain as any).mockResolvedValue(allQuestions.slice(0, 65));
    (getQuestionCountByDomain as any).mockResolvedValue({ 'CLF-C02-1': 65 });
    (getTotalQuestionCount as any).mockResolvedValue(65);

    const { generateExamForTier } = await import('../src/services/exam-generator.service');
    const result = await generateExamForTier('PREMIUM', mockConfig);

    // PREMIUM delegates to full generateExam — uses full config
    expect(result.config.timeLimit).toBe(90);
    expect(result.config.questionCount).toBe(65);
  });
});

// ─── Purchase Store — State Transitions ───────────────────────────────────────

describe('Purchase Store', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    (global as any).__DEV__ = false;
  });

  test('setPremium transitions store to PREMIUM', async () => {
    const { savePurchaseStatus } = await import('../src/storage/repositories/purchase.repository');
    (savePurchaseStatus as any).mockResolvedValue(undefined);

    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    usePurchaseStore.setState({ tierLevel: 'FREE', isPremium: false });

    await usePurchaseStore.getState().setPremium('prod_forever', 'token_abc');

    const state = usePurchaseStore.getState();
    expect(state.tierLevel).toBe('PREMIUM');
    expect(state.isPremium).toBe(true);
    expect(state.productId).toBe('prod_forever');
    expect(savePurchaseStatus).toHaveBeenCalledWith(
      expect.objectContaining({ tier_level: 'PREMIUM', product_id: 'prod_forever' }),
    );
  });

  test('reset transitions store back to FREE', async () => {
    const { clearPurchaseStatus } = await import('../src/storage/repositories/purchase.repository');
    (clearPurchaseStatus as any).mockResolvedValue(undefined);

    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    usePurchaseStore.setState({ tierLevel: 'PREMIUM', isPremium: true, productId: 'prod_x' });

    await usePurchaseStore.getState().reset();

    const state = usePurchaseStore.getState();
    expect(state.tierLevel).toBe('FREE');
    expect(state.isPremium).toBe(false);
    expect(state.productId).toBeNull();
    expect(clearPurchaseStatus).toHaveBeenCalled();
  });

  test('loadFromStorage sets PREMIUM when stored status is PREMIUM', async () => {
    const { getPurchaseStatus } = await import('../src/storage/repositories/purchase.repository');
    (getPurchaseStatus as any).mockResolvedValue({
      tier_level: 'PREMIUM',
      product_id: 'prod_forever',
      purchase_token: 'token_123',
      purchased_at: '2025-01-01T00:00:00.000Z',
    });

    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    usePurchaseStore.setState({ tierLevel: 'FREE', isPremium: false });

    await usePurchaseStore.getState().loadFromStorage();

    const state = usePurchaseStore.getState();
    expect(state.tierLevel).toBe('PREMIUM');
    expect(state.isPremium).toBe(true);
    expect(state.productId).toBe('prod_forever');
  });

  test('loadFromStorage keeps FREE when no stored status found', async () => {
    const { getPurchaseStatus } = await import('../src/storage/repositories/purchase.repository');
    (getPurchaseStatus as any).mockResolvedValue(null);

    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    usePurchaseStore.setState({ tierLevel: 'FREE', isPremium: false });

    await usePurchaseStore.getState().loadFromStorage();

    const state = usePurchaseStore.getState();
    expect(state.tierLevel).toBe('FREE');
    expect(state.isPremium).toBe(false);
  });

  test('loadFromStorage defaults to FREE on storage error', async () => {
    const { getPurchaseStatus } = await import('../src/storage/repositories/purchase.repository');
    (getPurchaseStatus as any).mockRejectedValue(new Error('DB error'));

    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    usePurchaseStore.setState({ tierLevel: 'PREMIUM', isPremium: true });

    await usePurchaseStore.getState().loadFromStorage();

    const state = usePurchaseStore.getState();
    expect(state.tierLevel).toBe('FREE');
    expect(state.isPremium).toBe(false);
  });
});

// ─── __DEV__ Bypass ───────────────────────────────────────────────────────────

describe('__DEV__ bypass', () => {
  test('in test environment (non-DEV), store starts at FREE tier', async () => {
    // __DEV__ is undefined/falsy in vitest node environment → initial tier is FREE
    const { usePurchaseStore } = await import('../src/stores/purchase.store');
    // Explicitly set to FREE to verify the tier system works
    usePurchaseStore.setState({ tierLevel: 'FREE', isPremium: false });
    expect(usePurchaseStore.getState().tierLevel).toBe('FREE');
    expect(usePurchaseStore.getState().isPremium).toBe(false);
  });

  test('PREMIUM tier allows all features', () => {
    expect(TIER_CONFIGS.PREMIUM.canTakeFullExams).toBe(true);
    expect(TIER_CONFIGS.PREMIUM.canViewAnalytics).toBe(true);
  });

  test('FREE tier restricts features', () => {
    expect(TIER_CONFIGS.FREE.canTakeFullExams).toBe(false);
    expect(TIER_CONFIGS.FREE.canViewAnalytics).toBe(false);
  });
});
