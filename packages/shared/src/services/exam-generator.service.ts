// T037: ExamGeneratorService - Weighted random selection by domain
import {
  getRandomQuestionsByDomain,
  getQuestionCountByDomain,
  getTotalQuestionCount,
} from '../storage/repositories';
import { Question, ExamTypeConfig, ExamDomain, DomainId } from '../storage/schema';
import { getCachedExamTypeConfig } from './sync.service';

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
export const generateExam = async (): Promise<GeneratedExam> => {
  console.warn('[ExamGenerator] generateExam called');

  // Get exam configuration
  const config = await getCachedExamTypeConfig();
  if (!config) {
    console.error('[ExamGenerator] No exam configuration found');
    throw new Error('Exam configuration not found. Please sync before starting an exam.');
  }
  console.warn(
    `[ExamGenerator] Config loaded: ${config.questionCount} questions, ${config.domains.length} domains`,
  );

  // Get available question counts per domain
  const availableByDomain = await getQuestionCountByDomain();
  const totalAvailable = await getTotalQuestionCount();
  console.warn(`[ExamGenerator] Available questions: ${totalAvailable}`);
  console.warn('[ExamGenerator] By domain:', JSON.stringify(availableByDomain));

  if (totalAvailable === 0) {
    throw new Error('No questions available. Please sync or load bundled questions.');
  }

  // Calculate quotas
  const targetTotal = config.questionCount;
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
      const questions = await getRandomQuestionsByDomain(quota.domain.id, quota.targetCount);
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

  // Shuffle the combined question set
  const shuffledQuestions = shuffleArray(allQuestions);
  console.warn(`[ExamGenerator] Generated exam with ${shuffledQuestions.length} questions`);

  return {
    questions: shuffledQuestions,
    totalQuestions: shuffledQuestions.length,
    config,
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
  const totalRequired = config.questionCount;
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
