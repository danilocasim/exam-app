// T067: AnalyticsService - Aggregates analytics data for the dashboard
import { getUserStats } from '../storage/repositories/user-stats.repository';
import { getRecentExamAttempts } from '../storage/repositories/exam-attempt.repository';
import { getDatabase } from '../storage/database';
import {
  getOverallStats,
  calculateAggregatedDomainPerformance,
  formatTimeSpent,
  OverallStats,
} from './scoring.service';
import { DomainScore, UserStats } from '../storage/schema';

/**
 * Score history entry for chart display
 */
export interface ScoreHistoryEntry {
  date: string;
  score: number;
  passed: boolean;
}

/**
 * Study statistics from UserStats table
 */
export interface StudyStats {
  totalExams: number;
  totalPractice: number;
  totalQuestions: number;
  totalTimeSpent: string;
  totalTimeSpentMs: number;
  lastActivityAt: string | null;
}

/**
 * Weak domain with recommendation
 */
export interface WeakDomain {
  domainId: string;
  domainName: string;
  percentage: number;
  correct: number;
  total: number;
  gap: number; // How many percentage points below threshold
}

/**
 * Full analytics dashboard data
 */
export interface AnalyticsData {
  overallStats: OverallStats;
  studyStats: StudyStats;
  scoreHistory: ScoreHistoryEntry[];
  domainPerformance: DomainScore[];
  weakDomains: WeakDomain[];
}

const WEAK_DOMAIN_THRESHOLD = 70;

/**
 * Get complete analytics data for the dashboard
 */
export const getAnalyticsData = async (): Promise<AnalyticsData> => {
  const [overallStats, studyStats, scoreHistory, domainPerformance] = await Promise.all([
    getOverallStats(),
    getStudyStats(),
    getScoreHistory(10),
    calculateAggregatedDomainPerformance(),
  ]);

  const weakDomains = getWeakDomains(domainPerformance);

  return {
    overallStats,
    studyStats,
    scoreHistory,
    domainPerformance,
    weakDomains,
  };
};

/**
 * Get formatted study stats from the UserStats table
 */
export const getStudyStats = async (): Promise<StudyStats> => {
  const stats: UserStats = await getUserStats();

  return {
    totalExams: stats.totalExams,
    totalPractice: stats.totalPractice,
    totalQuestions: stats.totalQuestions,
    totalTimeSpent: formatTimeSpent(stats.totalTimeSpentMs),
    totalTimeSpentMs: stats.totalTimeSpentMs,
    lastActivityAt: stats.lastActivityAt,
  };
};

/**
 * Get score history from completed exam attempts for chart.
 * Merges local ExamAttempt rows with server-pulled ExamSubmission rows,
 * deduplicating by localId so the same exam doesn't appear twice.
 */
export const getScoreHistory = async (limit: number = 10): Promise<ScoreHistoryEntry[]> => {
  // Local attempts (taken on this device)
  const attempts = await getRecentExamAttempts(limit);
  const localEntries = attempts
    .filter((a) => a.score !== null)
    .map((a) => ({
      date: a.completedAt ?? a.startedAt,
      score: a.score ?? 0,
      passed: a.passed === true,
      key: a.id, // ExamAttempt.id === ExamSubmission.localId for locally-created submissions
    }));

  // Server-pulled submissions (ExamSubmission table)
  const db = await getDatabase();
  const submissionRows = await db.getAllAsync<{
    id: string;
    localId: string | null;
    score: number;
    passed: number;
    submittedAt: string;
  }>('SELECT id, localId, score, passed, submittedAt FROM ExamSubmission ORDER BY submittedAt DESC LIMIT ?', [limit]);

  // Dedup: skip submissions whose localId already appears in local attempts
  const seenKeys = new Set(localEntries.map((e) => e.key));
  const submissionEntries = submissionRows
    .filter((row) => {
      const key = row.localId ?? row.id;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    })
    .map((row) => ({
      date: row.submittedAt,
      score: row.score,
      passed: row.passed === 1,
    }));

  // Merge, sort chronologically (oldest first), take most recent `limit`
  return [...localEntries, ...submissionEntries]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-limit)
    .map(({ date, score, passed }) => ({ date, score, passed }));
};

/**
 * Get weak domains below the threshold with practice recommendations
 */
export const getWeakDomains = (domainPerformance: DomainScore[]): WeakDomain[] => {
  return domainPerformance
    .filter((d) => d.percentage < WEAK_DOMAIN_THRESHOLD)
    .map((d) => ({
      domainId: d.domainId,
      domainName: d.domainName,
      percentage: d.percentage,
      correct: d.correct,
      total: d.total,
      gap: WEAK_DOMAIN_THRESHOLD - d.percentage,
    }))
    .sort((a, b) => a.percentage - b.percentage); // Weakest first
};
