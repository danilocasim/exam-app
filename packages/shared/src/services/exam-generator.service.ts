// T037: ExamGeneratorService - Weighted random selection by domain
import {
  getRandomQuestions,
  getRandomQuestionsByDomain,
  getRandomQuestionsByDomainAndSets,
  getQuestionCountByDomain,
  getQuestionCountByDomainAndSets,
  getTotalQuestionCount,
  getQuestionsBySet,
  getRandomQuestionsFiltered,
} from '../storage/repositories';
import { getMissedQuestions } from '../storage/repositories/missed-questions.repository';
import {
  Question,
  ExamTypeConfig,
  ExamDomain,
  DomainId,
  CustomExamOptions,
} from '../storage/schema';
import { getCachedExamTypeConfig } from './sync.service';
import { TierLevel, DAILY_QUESTION_LIMIT } from '../config/tiers';
import { EXAM_CONFIG } from '../config/app.config';

/**
 * Result of exam generation
 */
export interface GeneratedExam {
  questions: Question[];
  totalQuestions: number;
  config: ExamTypeConfig;
  domainDistribution: Record<DomainId, number>;
}

/**
 * Domain quota with target and actual counts
 */
interface DomainQuota {
  domain: ExamDomain;
  targetCount: number;
  actualCount: number;
}

/**
 * Calculate question quotas per domain based on weight percentages
 * Ensures the total equals totalRequired by adjusting the largest domain
 */
const calculateDomainQuotas = (
  domains: ExamDomain[],
  totalRequired: number,
  availableByDomain: Record<string, number>,
): DomainQuota[] => {
  // Calculate initial quotas based on weights
  const totalWeight = domains.reduce((sum, d) => sum + d.weight, 0);

  const quotas: DomainQuota[] = domains.map((domain) => {
    const targetByWeight = Math.round((domain.weight / totalWeight) * totalRequired);
    const available = availableByDomain[domain.id] ?? 0;
    // Use domain.questionCount as hint, but cap at available
    const hintedTarget = domain.questionCount;
    const targetCount = Math.min(targetByWeight, available, hintedTarget);

    return {
      domain,
      targetCount,
      actualCount: 0,
    };
  });

  // Adjust to ensure total equals totalRequired
  let currentTotal = quotas.reduce((sum, q) => sum + q.targetCount, 0);

  // If we're short, add to domains with available questions (largest first)
  while (currentTotal < totalRequired) {
    const sortedByAvailable = [...quotas].sort((a, b) => {
      const aRemaining = (availableByDomain[a.domain.id] ?? 0) - a.targetCount;
      const bRemaining = (availableByDomain[b.domain.id] ?? 0) - b.targetCount;
      return bRemaining - aRemaining;
    });

    const quota = sortedByAvailable.find(
      (q) => (availableByDomain[q.domain.id] ?? 0) > q.targetCount,
    );

    if (!quota) break; // No more questions available
    quota.targetCount++;
    currentTotal++;
  }

  // If we're over, reduce from domains with the most questions (preserving weights)
  while (currentTotal > totalRequired) {
    const sortedByCount = [...quotas].sort((a, b) => b.targetCount - a.targetCount);
    const quota = sortedByCount.find((q) => q.targetCount > 0);
    if (!quota) break;
    quota.targetCount--;
    currentTotal--;
  }

  return quotas;
};

/**
 * Deduplicate questions by id, preserving first occurrence order.
 */
const uniqueQuestions = (questions: Question[]): Question[] => {
  const seen = new Set<string>();
  const result: Question[] = [];
  for (const q of questions) {
    if (!seen.has(q.id)) {
      seen.add(q.id);
      result.push(q);
    }
  }
  return result;
};

/**
 * Shuffle an array using Fisher-Yates algorithm
 */
const shuffleArray = <T>(array: T[]): T[] => {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/**
 * Generate a new exam with weighted random question selection
 *
 * Algorithm:
 * 1. Load exam config to get domain weights and question count
 * 2. Calculate quota per domain based on weights
 * 3. For each domain, select random questions up to quota
 * 4. Shuffle final question set
 * 5. Return generated exam
 */
export const generateExam = async (selectedSets?: string[]): Promise<GeneratedExam> => {
  console.warn(
    '[ExamGenerator] generateExam called',
    selectedSets?.length ? `sets=${selectedSets.join(',')}` : '(all sets)',
  );

  // Get exam configuration
  const config = await getCachedExamTypeConfig();
  if (!config) {
    console.error('[ExamGenerator] No exam configuration found');
    throw new Error('Exam configuration not found. Please sync before starting an exam.');
  }
  console.warn(
    `[ExamGenerator] Config loaded: ${config.questionCount} questions, ${config.domains.length} domains`,
  );

  // Get available question counts per domain (optionally filtered by sets)
  const hasSetsFilter = selectedSets && selectedSets.length > 0;
  const availableByDomain = hasSetsFilter
    ? await getQuestionCountByDomainAndSets(selectedSets)
    : await getQuestionCountByDomain();
  const totalAvailable = Object.values(availableByDomain).reduce((sum, c) => sum + c, 0);
  console.warn(`[ExamGenerator] Available questions: ${totalAvailable}`);
  console.warn('[ExamGenerator] By domain:', JSON.stringify(availableByDomain));

  if (totalAvailable === 0) {
    throw new Error('No questions available for the selected sets.');
  }

  // Target is always the standard exam size (65), capped by available
  const standardExamSize = EXAM_CONFIG.QUESTIONS_PER_EXAM;
  const targetTotal = Math.min(standardExamSize, totalAvailable);
  const quotas = calculateDomainQuotas(config.domains, targetTotal, availableByDomain);
  console.warn(
    '[ExamGenerator] Quotas:',
    quotas.map((q) => `${q.domain.id}:${q.targetCount}`).join(', '),
  );

  // Select questions for each domain
  const allQuestions: Question[] = [];
  const domainDistribution: Record<DomainId, number> = {};

  for (const quota of quotas) {
    if (quota.targetCount > 0) {
      const questions = hasSetsFilter
        ? await getRandomQuestionsByDomainAndSets(quota.domain.id, quota.targetCount, selectedSets)
        : await getRandomQuestionsByDomain(quota.domain.id, quota.targetCount);
      console.warn(
        `[ExamGenerator] Domain ${quota.domain.id}: requested ${quota.targetCount}, got ${questions.length}`,
      );
      allQuestions.push(...questions);
      quota.actualCount = questions.length;
      domainDistribution[quota.domain.id] = questions.length;
    } else {
      domainDistribution[quota.domain.id] = 0;
    }
  }

  // Deduplicate and shuffle the combined question set
  const dedupedQuestions = uniqueQuestions(allQuestions);
  const shuffledQuestions = shuffleArray(dedupedQuestions);

  // Hard cap at the standard exam size (65)
  const capped = shuffledQuestions.slice(0, standardExamSize);
  console.warn(
    `[ExamGenerator] Generated exam with ${capped.length} questions (cap=${standardExamSize})`,
  );

  // Recalculate domain distribution after cap
  const finalDistribution: Record<DomainId, number> = {};
  for (const q of capped) {
    finalDistribution[q.domain] = (finalDistribution[q.domain] ?? 0) + 1;
  }

  return {
    questions: capped,
    totalQuestions: capped.length,
    config,
    domainDistribution: finalDistribution,
  };
};

/**
 * T253: Generate an exam respecting the user's tier.
 *
 * PREMIUM: delegates to the full weighted generateExam() — all questions, full timer.
 * FREE: delegates to generateDiagnosticExam() — diagnostic set questions with
 *       proportionally scaled time limit. Passing score percentage stays the same.
 *
 * @param tier - The user's current tier level
 * @param examTypeConfig - Optional config override (fetched from cache if omitted)
 */
export const generateExamForTier = async (
  tier: TierLevel,
  examTypeConfig?: ExamTypeConfig,
  selectedSets?: string[],
): Promise<GeneratedExam> => {
  if (tier === 'PREMIUM') {
    return generateExam(selectedSets);
  }

  // FREE tier — use diagnostic set instead of old fixed pool
  return generateDiagnosticExam();
};

/**
 * Generate a Daily Quiz — DAILY_QUESTION_LIMIT random questions from the
 * full question bank, deduplicated and shuffled.
 *
 * Unlike the FREE mini-exam (which always returns the same deterministic set),
 * the daily quiz picks a fresh random sample each day so users see new
 * questions on every attempt.
 */
export const generateDailyQuiz = async (): Promise<GeneratedExam> => {
  const config = await getCachedExamTypeConfig();
  if (!config) {
    throw new Error('Exam configuration not found. Please sync before starting an exam.');
  }

  // Pick DAILY_QUESTION_LIMIT random questions from the full bank
  const rawQuestions = await getRandomQuestions(DAILY_QUESTION_LIMIT);
  const questions = shuffleArray(uniqueQuestions(rawQuestions));

  if (questions.length === 0) {
    throw new Error('No questions available. Please sync or load bundled questions.');
  }

  // Build domain distribution
  const domainDistribution: Record<DomainId, number> = {};
  for (const q of questions) {
    domainDistribution[q.domain] = (domainDistribution[q.domain] ?? 0) + 1;
  }

  // Proportionally scale the time limit (minimum 5 minutes)
  const timeFraction = questions.length / config.questionCount;
  const dailyConfig: ExamTypeConfig = {
    ...config,
    questionCount: questions.length,
    timeLimit: Math.max(5, Math.round(config.timeLimit * timeFraction)),
  };

  console.log(
    `[ExamGenerator] Daily quiz: ${questions.length} questions, ${dailyConfig.timeLimit} min`,
  );

  return {
    questions,
    totalQuestions: questions.length,
    config: dailyConfig,
    domainDistribution,
  };
};

/**
 * Generate a Diagnostic Test from the 'diagnostic' question set.
 *
 * Pulls all questions assigned to the 'diagnostic' set, shuffles them,
 * and builds a proportionally-timed config. This is the primary free-tier
 * exam mode replacing the Daily Quiz.
 */
export const generateDiagnosticExam = async (): Promise<GeneratedExam> => {
  const config = await getCachedExamTypeConfig();
  if (!config) {
    throw new Error('Exam configuration not found. Please sync before starting an exam.');
  }

  const diagnosticQuestions = await getQuestionsBySet('diagnostic');
  if (diagnosticQuestions.length === 0) {
    throw new Error('No diagnostic questions available. Please sync first.');
  }

  const questions = shuffleArray(uniqueQuestions(diagnosticQuestions));

  // Build domain distribution
  const domainDistribution: Record<DomainId, number> = {};
  for (const q of questions) {
    domainDistribution[q.domain] = (domainDistribution[q.domain] ?? 0) + 1;
  }

  // Proportionally scale the time limit (minimum 5 minutes)
  const timeFraction = questions.length / config.questionCount;
  const diagnosticConfig: ExamTypeConfig = {
    ...config,
    questionCount: questions.length,
    timeLimit: Math.max(5, Math.round(config.timeLimit * timeFraction)),
  };

  console.log(
    `[ExamGenerator] Diagnostic exam: ${questions.length} questions, ${diagnosticConfig.timeLimit} min`,
  );

  return {
    questions,
    totalQuestions: questions.length,
    config: diagnosticConfig,
    domainDistribution,
  };
};

/**
 * Generate an exam from previously missed (incorrect) questions.
 *
 * Queries distinct question IDs where the user's most recent answer was wrong,
 * selects `count` of them at random, and builds a proportionally-timed config.
 *
 * @param count - Number of missed questions to include
 */
export const generateExamFromMissed = async (count: number): Promise<GeneratedExam> => {
  const config = await getCachedExamTypeConfig();
  if (!config) {
    throw new Error('Exam configuration not found. Please sync before starting an exam.');
  }

  const rawQuestions = await getMissedQuestions(count);
  const questions = uniqueQuestions(rawQuestions);
  if (questions.length === 0) {
    throw new Error('No missed questions found.');
  }

  // Build domain distribution
  const domainDistribution: Record<DomainId, number> = {};
  for (const q of questions) {
    domainDistribution[q.domain] = (domainDistribution[q.domain] ?? 0) + 1;
  }

  // Proportionally scale the time limit (minimum 5 minutes)
  const timeFraction = questions.length / config.questionCount;
  const missedConfig: ExamTypeConfig = {
    ...config,
    questionCount: questions.length,
    timeLimit: Math.max(5, Math.round(config.timeLimit * timeFraction)),
  };

  console.log(
    `[ExamGenerator] Missed quiz: ${questions.length} questions, ${missedConfig.timeLimit} min`,
  );

  return {
    questions,
    totalQuestions: questions.length,
    config: missedConfig,
    domainDistribution,
  };
};

/**
 * Generate a custom exam with user-selected domains, question count, and timed/untimed mode.
 *
 * PREMIUM: selects from the full question pool filtered by selected domains.
 * FREE: selects from the diagnostic question set filtered by selected domains.
 *
 * @param options - Custom exam configuration (questionCount, selectedDomains, isTimed)
 * @param tier    - The user's current tier level
 */
export const generateCustomExam = async (
  options: CustomExamOptions,
  tier: TierLevel,
): Promise<GeneratedExam> => {
  const config = await getCachedExamTypeConfig();
  if (!config) {
    throw new Error('Exam configuration not found. Please sync before starting an exam.');
  }

  const { selectedDomains, selectedSets, isTimed } = options;
  let requestedCount = options.questionCount;

  let allQuestions: Question[];

  if (tier === 'FREE') {
    // FREE tier: draw from the diagnostic set filtered by selected domains
    const diagnosticQuestions = await getQuestionsBySet('diagnostic');
    allQuestions = diagnosticQuestions.filter((q) => {
      const domainMatch = selectedDomains.length === 0 || selectedDomains.includes(q.domain);
      return domainMatch;
    });
    requestedCount = Math.min(requestedCount, allQuestions.length);
  } else {
    // PREMIUM tier: draw from the full pool, filtered by selected domains and sets
    if (selectedSets.length > 0 || selectedDomains.length > 0) {
      allQuestions = await getRandomQuestionsFiltered(
        requestedCount * 2, // Fetch extra for shuffling
        selectedSets.length > 0 ? selectedSets : undefined,
        selectedDomains.length > 0 ? selectedDomains : undefined,
      );
    } else {
      allQuestions = await getRandomQuestions(requestedCount);
    }
    requestedCount = Math.min(requestedCount, allQuestions.length);
  }

  if (allQuestions.length === 0) {
    throw new Error('No questions available for the selected domains.');
  }

  // Deduplicate, shuffle, and take the requested count
  const deduped = uniqueQuestions(allQuestions);
  const shuffled = shuffleArray(deduped);
  const selected = shuffled.slice(0, requestedCount);

  // Build domain distribution from selected questions
  const domainDistribution: Record<DomainId, number> = {};
  for (const q of selected) {
    domainDistribution[q.domain] = (domainDistribution[q.domain] ?? 0) + 1;
  }

  // Build config: timed uses proportional scaling, untimed uses 24h (matches exam expiry)
  const timeFraction = selected.length / config.questionCount;
  const customConfig: ExamTypeConfig = {
    ...config,
    questionCount: selected.length,
    timeLimit: isTimed ? Math.max(5, Math.round(config.timeLimit * timeFraction)) : 1440,
  };

  console.log(
    `[ExamGenerator] Custom exam: ${selected.length} questions, ${customConfig.timeLimit} min, timed=${isTimed}`,
  );

  return {
    questions: selected,
    totalQuestions: selected.length,
    config: customConfig,
    domainDistribution,
  };
};

/**
 * Check if enough questions are available to generate an exam
 */
export const canGenerateExam = async (): Promise<{
  canGenerate: boolean;
  totalAvailable: number;
  totalRequired: number;
  shortfall: number;
  reason?: string;
}> => {
  const config = await getCachedExamTypeConfig();
  if (!config) {
    console.warn('[ExamGenerator] canGenerateExam: No config found');
    return {
      canGenerate: false,
      totalAvailable: 0,
      totalRequired: 0,
      shortfall: 0,
      reason: 'No exam configuration. Please sync first.',
    };
  }

  const totalAvailable = await getTotalQuestionCount();
  const totalRequired = EXAM_CONFIG.QUESTIONS_PER_EXAM;
  const canGenerate = totalAvailable >= totalRequired;

  console.warn(
    `[ExamGenerator] canGenerateExam: available=${totalAvailable}, required=${totalRequired}, canGenerate=${canGenerate}`,
  );

  return {
    canGenerate,
    totalAvailable,
    totalRequired,
    shortfall: Math.max(0, totalRequired - totalAvailable),
    reason: canGenerate
      ? undefined
      : `Need ${totalRequired} questions but only have ${totalAvailable}`,
  };
};

/**
 * Get current question distribution for display
 */
export const getQuestionDistribution = async (): Promise<{
  total: number;
  byDomain: Record<DomainId, number>;
  domains: ExamDomain[];
}> => {
  const config = await getCachedExamTypeConfig();
  const byDomain = await getQuestionCountByDomain();
  const total = await getTotalQuestionCount();

  return {
    total,
    byDomain,
    domains: config?.domains ?? [],
  };
};
