// T059: ReviewService - Fetch exam attempt with answers, filter logic
import {
  getExamAttemptById,
  getCompletedExamAttempts,
} from '../storage/repositories/exam-attempt.repository';
import { getAnswersByExamAttemptId } from '../storage/repositories/exam-answer.repository';
import { getQuestionsByIds } from '../storage/repositories/question.repository';
import { getAllExamSubmissions } from '../storage/repositories/exam-submission.repository';
import { ExamAttempt, ExamAnswer, Question, DomainScore } from '../storage/schema';
import { getCachedExamTypeConfig } from './sync.service';
import { calculateDomainBreakdown, formatTimeSpent } from './scoring.service';
import { EXAM_CONFIG } from '../config';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ReviewFilterType = 'all' | 'incorrect' | 'correct';

/**
 * A single review item: question + user's answer + result
 */
export interface ReviewItem {
  question: Question;
  answer: ExamAnswer;
  isCorrect: boolean;
  index: number; // 0-based position in exam
}

/**
 * Exam history entry for the list screen
 */
export interface ExamHistoryEntry {
  attempt: ExamAttempt;
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  timeSpent: string;
  /** true when local ExamAnswer rows exist (full per-question review available) */
  canReview: boolean;
  /** domain breakdown from ExamSubmission — available for server-synced entries */
  domainScores?: Array<{ domainId: string; correct: number; total: number }>;
}

/**
 * Full review data for an exam attempt
 */
export interface ReviewData {
  attempt: ExamAttempt;
  items: ReviewItem[];
  domainBreakdown: DomainScore[];
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
}

// ─── Service Functions ───────────────────────────────────────────────────────

/**
 * Get list of completed exams for history screen.
 * Merges local ExamAttempt rows with server-pulled ExamSubmission rows so
 * history is visible even on a fresh install after a cloud pull.
 */
export const getExamHistory = async (): Promise<ExamHistoryEntry[]> => {
  const attempts = await getCompletedExamAttempts();

  // Track which attempt ids are already covered by local ExamAttempt rows
  const localIds = new Set(attempts.map((a) => a.id));

  const localEntries: ExamHistoryEntry[] = attempts.map((attempt) => {
    const score = attempt.score ?? 0;
    const passed = attempt.passed ?? false;
    const totalQuestions = attempt.totalQuestions;
    const startedAt = new Date(attempt.startedAt).getTime();
    const completedAt = attempt.completedAt ? new Date(attempt.completedAt).getTime() : startedAt;
    return {
      attempt,
      score,
      passed,
      correctCount: Math.round((score / 100) * totalQuestions),
      totalQuestions,
      timeSpent: formatTimeSpent(completedAt - startedAt),
      canReview: true,
    };
  });

  // Add server-pulled submissions that have no corresponding local attempt
  const submissions = await getAllExamSubmissions();
  const defaultQuestions = EXAM_CONFIG.QUESTIONS_PER_EXAM;

  const submissionEntries: ExamHistoryEntry[] = submissions
    .filter((s) => {
      const key = s.localId ?? s.id;
      return !localIds.has(key);
    })
    .map((s) => {
      const score = s.score;
      const passed = s.passed;
      const totalQuestions = defaultQuestions;
      const durationMs = s.duration * 1000;
      // Build a synthetic ExamAttempt so the history list can render uniformly
      const syntheticAttempt: ExamAttempt = {
        id: s.localId ?? s.id,
        startedAt: s.submittedAt.toISOString(),
        completedAt: s.submittedAt.toISOString(),
        status: 'completed',
        score,
        passed,
        totalQuestions,
        remainingTimeMs: null,
        expiresAt: null,
      };
      return {
        attempt: syntheticAttempt,
        score,
        passed,
        correctCount: Math.round((score / 100) * totalQuestions),
        totalQuestions,
        timeSpent: formatTimeSpent(durationMs),
        canReview: false,
        domainScores: s.domainScores,
      };
    });

  // Merge and sort by date descending (most recent first)
  return [...localEntries, ...submissionEntries].sort(
    (a, b) =>
      new Date(b.attempt.completedAt ?? b.attempt.startedAt).getTime() -
      new Date(a.attempt.completedAt ?? a.attempt.startedAt).getTime(),
  );
};

/**
 * Load full review data for an exam attempt
 */
export const getReviewData = async (attemptId: string): Promise<ReviewData> => {
  const attempt = await getExamAttemptById(attemptId);
  if (!attempt) {
    throw new Error(`Exam attempt not found: ${attemptId}`);
  }

  // Fetch answers sorted by order
  const answers = await getAnswersByExamAttemptId(attemptId);
  const questionIds = answers.map((a) => a.questionId);
  const questions = await getQuestionsByIds(questionIds);
  const questionsById = new Map(questions.map((q) => [q.id, q]));

  // Build review items
  const items: ReviewItem[] = answers
    .map((answer, index) => {
      const question = questionsById.get(answer.questionId);
      if (!question) return null;
      return {
        question,
        answer,
        isCorrect: answer.isCorrect === true,
        index,
      };
    })
    .filter((item): item is ReviewItem => item !== null);

  // Domain breakdown
  const config = await getCachedExamTypeConfig();
  const domainBreakdown = config
    ? calculateDomainBreakdown(answers, questionsById, config)
    : calculateSimpleDomainBreakdown(items);

  const correctCount = items.filter((i) => i.isCorrect).length;
  const totalQuestions = items.length;
  const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passed = score >= (config?.passingScore ?? 70);

  return {
    attempt,
    items,
    domainBreakdown,
    score,
    passed,
    correctCount,
    totalQuestions,
  };
};

/**
 * Filter review items by type
 */
export const filterReviewItems = (items: ReviewItem[], filter: ReviewFilterType): ReviewItem[] => {
  switch (filter) {
    case 'incorrect':
      return items.filter((i) => !i.isCorrect);
    case 'correct':
      return items.filter((i) => i.isCorrect);
    case 'all':
    default:
      return items;
  }
};

/**
 * Fallback domain breakdown when no exam config is available
 */
const calculateSimpleDomainBreakdown = (items: ReviewItem[]): DomainScore[] => {
  const domainStats: Record<string, { correct: number; total: number; name: string }> = {};

  for (const item of items) {
    const domain = item.question.domain;
    if (!domainStats[domain]) {
      domainStats[domain] = { correct: 0, total: 0, name: formatDomainName(domain) };
    }
    domainStats[domain].total++;
    if (item.isCorrect) domainStats[domain].correct++;
  }

  return Object.entries(domainStats)
    .filter(([, stats]) => stats.total > 0)
    .map(([domainId, stats]) => ({
      domainId,
      domainName: stats.name,
      correct: stats.correct,
      total: stats.total,
      percentage: Math.round((stats.correct / stats.total) * 100),
    }));
};

/**
 * Format domain ID to display name
 */
const formatDomainName = (id: string): string => {
  return id
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};
