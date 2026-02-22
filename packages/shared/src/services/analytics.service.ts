// T067: AnalyticsService - Aggregates analytics data for the dashboard
import { getUserStats } from '../storage/repositories/user-stats.repository';
import { getRecentExamAttempts } from '../storage/repositories/exam-attempt.repository';
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
 * Get score history from completed exam attempts for chart
 */
export const getScoreHistory = async (limit: number = 10): Promise<ScoreHistoryEntry[]> => {
  const attempts = await getRecentExamAttempts(limit);

  return attempts
    .filter((a) => a.score !== null)
    .map((attempt) => ({
      date: attempt.completedAt ?? attempt.startedAt,
      score: attempt.score ?? 0,
      passed: attempt.passed === true,
    }))
    .reverse(); // Chronological order (oldest first) for chart
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
