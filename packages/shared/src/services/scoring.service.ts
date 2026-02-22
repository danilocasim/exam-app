// T039: ScoringService - Calculate score, pass/fail, domain breakdown
import {
  getExamAttemptById,
  getCompletedExamAttempts,
  getAverageScore,
  getBestScore,
  getPassedExamAttemptCount,
  getCompletedExamAttemptCount,
} from '../storage/repositories/exam-attempt.repository';
import { getAnswersByExamAttemptId } from '../storage/repositories/exam-answer.repository';
import { getQuestionsByIds } from '../storage/repositories/question.repository';
import { ExamAnswer, Question, ExamResult, DomainScore, ExamTypeConfig } from '../storage/schema';
import { getCachedExamTypeConfig } from './sync.service';

/**
 * Score summary for display
 */
export interface ScoreSummary {
  score: number;
  passed: boolean;
  passingScore: number;
  correctAnswers: number;
  totalQuestions: number;
  timeSpentMs: number;
  domainBreakdown: DomainScore[];
}

/**
 * Overall stats across all exams
 */
export interface OverallStats {
  totalExams: number;
  passedExams: number;
  passRate: number;
  averageScore: number | null;
  bestScore: number | null;
  weakDomains: DomainScore[];
  strongDomains: DomainScore[];
}

/**
 * Calculate score for a completed exam attempt
 */
export const calculateScore = async (examAttemptId: string): Promise<ScoreSummary> => {
  const attempt = await getExamAttemptById(examAttemptId);
  if (!attempt) {
    throw new Error('Exam attempt not found');
  }

  const config = await getCachedExamTypeConfig();
  if (!config) {
    throw new Error('Exam configuration not found');
  }

  // Get answers and questions
  const answers = await getAnswersByExamAttemptId(examAttemptId);
  const questionIds = answers.map((a) => a.questionId);
  const questions = await getQuestionsByIds(questionIds);
  const questionsById = new Map(questions.map((q) => [q.id, q]));

  // Calculate totals
  const totalQuestions = answers.length;
  const correctAnswers = answers.filter((a) => a.isCorrect === true).length;
  const score = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
  const passed = score >= config.passingScore;

  // Calculate domain breakdown
  const domainBreakdown = calculateDomainBreakdown(answers, questionsById, config);

  // Calculate time spent
  const startedAt = new Date(attempt.startedAt).getTime();
  const completedAt = attempt.completedAt ? new Date(attempt.completedAt).getTime() : Date.now();
  const timeSpentMs = completedAt - startedAt;

  return {
    score,
    passed,
    passingScore: config.passingScore,
    correctAnswers,
    totalQuestions,
    timeSpentMs,
    domainBreakdown,
  };
};

/**
 * Calculate domain-level breakdown from answers
 */
export const calculateDomainBreakdown = (
  answers: ExamAnswer[],
  questionsById: Map<string, Question>,
  config: ExamTypeConfig,
): DomainScore[] => {
  const domainStats: Record<string, { correct: number; total: number; name: string }> = {};

  // Initialize all domains from config
  for (const domain of config.domains) {
    domainStats[domain.id] = {
      correct: 0,
      total: 0,
      name: domain.name,
    };
  }

  // Aggregate answers by domain
  for (const answer of answers) {
    const question = questionsById.get(answer.questionId);
    if (!question) continue;

    const domain = question.domain;
    if (!domainStats[domain]) {
      // Handle questions from unknown domains
      domainStats[domain] = {
        correct: 0,
        total: 0,
        name: domain,
      };
    }

    domainStats[domain].total++;
    if (answer.isCorrect === true) {
      domainStats[domain].correct++;
    }
  }

  // Convert to array with percentages
  return Object.entries(domainStats)
    .filter(([, stats]) => stats.total > 0) // Only include domains with questions
    .map(([domainId, stats]) => ({
      domainId,
      domainName: stats.name,
      correct: stats.correct,
      total: stats.total,
      percentage: Math.round((stats.correct / stats.total) * 100),
    }));
};

/**
 * Get result for a completed exam
 */
export const getExamResult = async (examAttemptId: string): Promise<ExamResult> => {
  const summary = await calculateScore(examAttemptId);
  const attempt = await getExamAttemptById(examAttemptId);

  if (!attempt) {
    throw new Error('Exam attempt not found');
  }

  return {
    examAttemptId,
    score: summary.score,
    passed: summary.passed,
    totalQuestions: summary.totalQuestions,
    correctAnswers: summary.correctAnswers,
    domainBreakdown: summary.domainBreakdown,
    completedAt: attempt.completedAt ?? new Date().toISOString(),
    timeSpentMs: summary.timeSpentMs,
  };
};

/**
 * Get overall statistics across all completed exams
 */
export const getOverallStats = async (): Promise<OverallStats> => {
  const config = await getCachedExamTypeConfig();
  const passingThreshold = config?.passingScore ?? 70;

  const totalExams = await getCompletedExamAttemptCount();
  const passedExams = await getPassedExamAttemptCount();
  const averageScore = await getAverageScore();
  const bestScore = await getBestScore();

  const passRate = totalExams > 0 ? Math.round((passedExams / totalExams) * 100) : 0;

  // Calculate domain performance across all exams
  const domainPerformance = await calculateAggregatedDomainPerformance();

  // Identify weak and strong domains (below/above passing threshold)
  const weakDomains = domainPerformance.filter((d) => d.percentage < passingThreshold);
  const strongDomains = domainPerformance.filter((d) => d.percentage >= passingThreshold);

  // Sort weak domains by percentage (lowest first)
  weakDomains.sort((a, b) => a.percentage - b.percentage);
  // Sort strong domains by percentage (highest first)
  strongDomains.sort((a, b) => b.percentage - a.percentage);

  return {
    totalExams,
    passedExams,
    passRate,
    averageScore: averageScore !== null ? Math.round(averageScore) : null,
    bestScore: bestScore !== null ? Math.round(bestScore) : null,
    weakDomains,
    strongDomains,
  };
};

/**
 * Calculate aggregated domain performance across all completed exams
 */
export const calculateAggregatedDomainPerformance = async (): Promise<DomainScore[]> => {
  const config = await getCachedExamTypeConfig();
  if (!config) {
    return [];
  }

  const completedExams = await getCompletedExamAttempts();
  if (completedExams.length === 0) {
    return [];
  }

  // Aggregate stats across all exams
  const domainTotals: Record<string, { correct: number; total: number; name: string }> = {};

  // Initialize domains from config
  for (const domain of config.domains) {
    domainTotals[domain.id] = {
      correct: 0,
      total: 0,
      name: domain.name,
    };
  }

  // Process each exam
  for (const exam of completedExams) {
    const answers = await getAnswersByExamAttemptId(exam.id);
    const questionIds = answers.map((a) => a.questionId);
    const questions = await getQuestionsByIds(questionIds);
    const questionsById = new Map(questions.map((q) => [q.id, q]));

    for (const answer of answers) {
      const question = questionsById.get(answer.questionId);
      if (!question) continue;

      const domain = question.domain;
      if (domainTotals[domain]) {
        domainTotals[domain].total++;
        if (answer.isCorrect === true) {
          domainTotals[domain].correct++;
        }
      }
    }
  }

  // Convert to array
  return Object.entries(domainTotals)
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
 * Get detailed breakdown for a specific domain across all exams
 */
export const getDomainPerformanceHistory = async (
  domainId: string,
  limit: number = 10,
): Promise<{
  domainId: string;
  domainName: string;
  examResults: Array<{
    examAttemptId: string;
    date: string;
    correct: number;
    total: number;
    percentage: number;
  }>;
  trend: 'improving' | 'declining' | 'stable';
}> => {
  const config = await getCachedExamTypeConfig();
  const domain = config?.domains.find((d) => d.id === domainId);
  const domainName = domain?.name ?? domainId;

  const completedExams = await getCompletedExamAttempts();
  const recentExams = completedExams.slice(0, limit);

  const examResults: Array<{
    examAttemptId: string;
    date: string;
    correct: number;
    total: number;
    percentage: number;
  }> = [];

  for (const exam of recentExams) {
    const answers = await getAnswersByExamAttemptId(exam.id);
    const questionIds = answers.map((a) => a.questionId);
    const questions = await getQuestionsByIds(questionIds);
    const questionsById = new Map(questions.map((q) => [q.id, q]));

    let correct = 0;
    let total = 0;

    for (const answer of answers) {
      const question = questionsById.get(answer.questionId);
      if (question?.domain === domainId) {
        total++;
        if (answer.isCorrect === true) {
          correct++;
        }
      }
    }

    if (total > 0) {
      examResults.push({
        examAttemptId: exam.id,
        date: exam.completedAt ?? exam.startedAt,
        correct,
        total,
        percentage: Math.round((correct / total) * 100),
      });
    }
  }

  // Determine trend (compare first half to second half)
  let trend: 'improving' | 'declining' | 'stable' = 'stable';
  if (examResults.length >= 4) {
    const half = Math.floor(examResults.length / 2);
    const recentHalf = examResults.slice(0, half);
    const olderHalf = examResults.slice(half);

    const recentAvg = recentHalf.reduce((sum, r) => sum + r.percentage, 0) / recentHalf.length;
    const olderAvg = olderHalf.reduce((sum, r) => sum + r.percentage, 0) / olderHalf.length;

    const difference = recentAvg - olderAvg;
    if (difference >= 5) {
      trend = 'improving';
    } else if (difference <= -5) {
      trend = 'declining';
    }
  }

  return {
    domainId,
    domainName,
    examResults,
    trend,
  };
};

/**
 * Format time spent as human-readable string
 */
export const formatTimeSpent = (timeSpentMs: number): string => {
  const totalSeconds = Math.floor(timeSpentMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  } else {
    return `${seconds}s`;
  }
};

/**
 * Format remaining time as countdown string (MM:SS)
 */
export const formatRemainingTime = (remainingMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Get pass/fail status text
 */
export const getPassFailText = (passed: boolean): string => {
  return passed ? 'PASSED' : 'FAILED';
};

/**
 * Get score color based on value (for UI)
 */
export const getScoreColor = (
  score: number,
  passingScore: number = 70,
): 'success' | 'warning' | 'error' => {
  if (score >= passingScore) return 'success';
  if (score >= passingScore - 10) return 'warning';
  return 'error';
};
