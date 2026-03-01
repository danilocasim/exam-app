// T059: ReviewService - Fetch exam attempt with answers, filter logic
import { getExamAttemptById } from '../storage/repositories/exam-attempt.repository';
import { getAnswersByExamAttemptId } from '../storage/repositories/exam-answer.repository';
import { getQuestionsByIds } from '../storage/repositories/question.repository';
import { ExamAttempt, ExamAnswer, Question, DomainScore } from '../storage/schema';
import { getCachedExamTypeConfig } from './sync.service';
import { calculateDomainBreakdown, formatTimeSpent } from './scoring.service';
import { EXAM_CONFIG } from '../config';
import { getDatabase } from '../storage/database';

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
  /** ISO timestamp from ExamSubmission.submittedAt — canonical date to display */
  submittedAt: string;
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

interface HistoryRow {
  submissionId: string | null;
  score: number;
  passed: number; // SQLite 0/1
  duration: number;
  submittedAt: string;
  syncStatus: string;
  localId: string | null;
  domainScores: string | null;
  attemptId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  totalQuestions: number | null;
  canReview: number; // SQLite 0/1
}

/**
 * Get list of completed exams for history screen.
 *
 * Uses a single SQL query:
 *  1. ExamSubmission (canonical) LEFT JOIN ExamAttempt — determines canReview.
 *     Orphan SYNCED rows with no localId that mirror a local attempt are excluded.
 *  2. UNION ALL: ExamAttempts that have no ExamSubmission yet (sync not yet run).
 *
 * Sorted by submittedAt DESC. Call on every screen focus for fresh data.
 */
export const getExamHistory = async (): Promise<ExamHistoryEntry[]> => {
  const db = await getDatabase();
  const defaultQuestions = EXAM_CONFIG.QUESTIONS_PER_EXAM;

  // ── Orphan cleanup ────────────────────────────────────────────────────────
  // Phase 1: Purge orphan ExamSubmissions — rows restored from the server
  // before it returned localId. These have localId=NULL, syncStatus=SYNCED,
  // and a matching local ExamAttempt (by score + passed).
  await db.runAsync(`
    DELETE FROM ExamSubmission
    WHERE localId IS NULL
      AND syncStatus = 'SYNCED'
      AND EXISTS (
        SELECT 1 FROM ExamAttempt ea
        WHERE ea.score  = ExamSubmission.score
          AND ea.passed = ExamSubmission.passed
      )
  `);

  // Phase 2: Purge orphan ExamAttempts — completed attempts that have NO
  // matching ExamSubmission (by id or localId) but DO have a duplicate
  // ExamAttempt (different id, same score+passed) that IS linked to an
  // ExamSubmission. These are restored-from-server duplicates that will
  // otherwise appear in Part 2 of the UNION ALL below.
  // First delete their ExamAnswer rows (FK dependency).
  await db.runAsync(`
    DELETE FROM ExamAnswer WHERE examAttemptId IN (
      SELECT ea.id FROM ExamAttempt ea
      WHERE ea.status = 'completed'
        AND NOT EXISTS (
          SELECT 1 FROM ExamSubmission es
          WHERE es.id = ea.id OR es.localId = ea.id
        )
        AND EXISTS (
          SELECT 1 FROM ExamAttempt ea2
          JOIN ExamSubmission es2 ON es2.id = ea2.id OR es2.localId = ea2.id
          WHERE ea2.id != ea.id
            AND ea2.score = ea.score
            AND ea2.passed = ea.passed
        )
    )
  `);
  await db.runAsync(`
    DELETE FROM ExamAttempt
    WHERE status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM ExamSubmission es
        WHERE es.id = ExamAttempt.id OR es.localId = ExamAttempt.id
      )
      AND EXISTS (
        SELECT 1 FROM ExamAttempt ea2
        JOIN ExamSubmission es2 ON es2.id = ea2.id OR es2.localId = ea2.id
        WHERE ea2.id != ExamAttempt.id
          AND ea2.score = ExamAttempt.score
          AND ea2.passed = ExamAttempt.passed
      )
  `);

  const rows = await db.getAllAsync<HistoryRow>(`
    SELECT
      es.id            AS submissionId,
      es.score         AS score,
      es.passed        AS passed,
      es.duration      AS duration,
      es.submittedAt   AS submittedAt,
      es.syncStatus    AS syncStatus,
      es.localId       AS localId,
      es.domainScores  AS domainScores,
      ea.id            AS attemptId,
      ea.startedAt     AS startedAt,
      ea.completedAt   AS completedAt,
      ea.totalQuestions AS totalQuestions,
      CASE WHEN ea.id IS NOT NULL THEN 1 ELSE 0 END AS canReview
    FROM ExamSubmission es
    LEFT JOIN ExamAttempt ea ON ea.id = es.id OR ea.id = es.localId

    UNION ALL

    SELECT
      NULL             AS submissionId,
      ea.score         AS score,
      ea.passed        AS passed,
      0                AS duration,
      COALESCE(ea.completedAt, ea.startedAt) AS submittedAt,
      'LOCAL'          AS syncStatus,
      NULL             AS localId,
      NULL             AS domainScores,
      ea.id            AS attemptId,
      ea.startedAt     AS startedAt,
      ea.completedAt   AS completedAt,
      ea.totalQuestions AS totalQuestions,
      1                AS canReview
    FROM ExamAttempt ea
    WHERE ea.status = 'completed'
      AND NOT EXISTS (
        SELECT 1 FROM ExamSubmission es2
        WHERE es2.id = ea.id OR es2.localId = ea.id
      )

    ORDER BY submittedAt DESC
  `);

  const entries = rows.map((row) => {
    const score = row.score ?? 0;
    const passed = row.passed === 1;
    const canReview = row.canReview === 1;
    const totalQuestions = row.totalQuestions ?? defaultQuestions;
    const submittedAt = row.submittedAt;

    // Duration: prefer ExamSubmission's stored duration; fall back to attempt timestamps
    const startedAt = row.startedAt ?? submittedAt;
    const completedAt = row.completedAt ?? submittedAt;
    const durationMs =
      row.duration > 0
        ? row.duration * 1000
        : new Date(completedAt).getTime() - new Date(startedAt).getTime();

    const attempt: ExamAttempt = {
      id: row.attemptId ?? row.submissionId ?? '',
      startedAt,
      completedAt,
      status: 'completed',
      score,
      passed,
      totalQuestions,
      remainingTimeMs: 0,
      expiresAt: completedAt,
    };

    return {
      attempt,
      score,
      passed,
      correctCount: Math.round((score / 100) * totalQuestions),
      totalQuestions,
      timeSpent: formatTimeSpent(durationMs),
      submittedAt,
      canReview,
      domainScores: row.domainScores
        ? (JSON.parse(row.domainScores) as Array<{
            domainId: string;
            correct: number;
            total: number;
          }>)
        : undefined,
    };
  });

  // ── Final safety net: JS-level dedup ────────────────────────────────────
  // If orphan records still slip through the SQL cleanup (e.g. race conditions,
  // edge cases), deduplicate entries by score + passed + submittedAt rounded
  // to the nearest minute. Prefer the entry with canReview = true.
  const seen = new Map<string, number>();
  const deduped: ExamHistoryEntry[] = [];
  for (const entry of entries) {
    // Round submittedAt to the minute to handle millisecond discrepancies
    const dateKey = entry.submittedAt
      ? entry.submittedAt.substring(0, 16) // "YYYY-MM-DDTHH:MM"
      : '';
    const key = `${entry.score}|${entry.passed}|${dateKey}`;
    const existingIdx = seen.get(key);
    if (existingIdx !== undefined) {
      // Keep the one with canReview; if both or neither can review, keep first
      if (!deduped[existingIdx].canReview && entry.canReview) {
        deduped[existingIdx] = entry;
      }
      // else skip this duplicate
    } else {
      seen.set(key, deduped.length);
      deduped.push(entry);
    }
  }

  return deduped;
};

/**
 * Load full review data for an exam attempt (questions, correct/incorrect, subject analysis).
 * Reads from local DB (ExamAttempt, ExamAnswer, Question). Refetch on review screen focus for fresh data.
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
