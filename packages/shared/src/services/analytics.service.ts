// T067: AnalyticsService - Aggregates analytics data for the dashboard
import { getUserStats } from '../storage/repositories/user-stats.repository';
import {
  getOverallStats,
  calculateAggregatedDomainPerformance,
  formatTimeSpent,
  OverallStats,
} from './scoring.service';
import { getExamHistory } from './review.service';
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
 * Get complete analytics data for the dashboard.
 * All data is read from the local SQLite DB (UserStats, ExamAttempt, ExamSubmission, ExamAnswer).
 * Ensure pullAndMergeAllStats runs on login/app focus so the DB is synced with the server.
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
 * Get score history from completed exams for the trend chart.
 * Uses getExamHistory() as the single source of truth — it already
 * deduplicates ExamAttempt + ExamSubmission rows via SQL + JS-level dedup.
 */
export const getScoreHistory = async (limit: number = 10): Promise<ScoreHistoryEntry[]> => {
  const history = await getExamHistory();

  // Sort chronologically (oldest first), take most recent `limit`
  return history
    .filter((e) => e.score != null)
    .sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    .slice(-limit)
    .map((e) => ({
      date: e.submittedAt,
      score: e.score,
      passed: e.passed,
    }));
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
