// Zustand store exports

// Exam store (T040)
export {
  useExamStore,
  selectCurrentQuestion,
  selectCurrentAnswer,
  selectHasNextQuestion,
  selectHasPreviousQuestion,
  selectIsExamInProgress,
  selectTotalQuestions,
  selectProgressPercent,
  useHasInProgressExam,
} from './exam.store';
export type { ExamState, ExamActions, ExamStore } from './exam.store';

// Practice store (T052)
export {
  usePracticeStore,
  selectCurrentPracticeQuestion,
  selectPracticeProgress,
  selectIsCurrentQuestionAnswered,
  selectHasNextPracticeQuestion,
  selectHasPreviousPracticeQuestion,
} from './practice.store';
export type { PracticeState, PracticeActions, PracticeStore } from './practice.store';

// Review store (T060)
export {
  useReviewStore,
  selectCurrentReviewItem,
  selectCurrentReviewQuestion,
  selectHasNextReviewQuestion,
  selectHasPreviousReviewQuestion,
  selectReviewProgress,
  selectReviewStats,
} from './review.store';
export type { ReviewState, ReviewActions, ReviewStore } from './review.store';

// Analytics store (T068)
export {
  useAnalyticsStore,
  selectOverallStats,
  selectStudyStats,
  selectScoreHistory,
  selectDomainPerformance,
  selectWeakDomains,
  selectHasData,
} from './analytics.store';
export type { AnalyticsState, AnalyticsActions, AnalyticsStore } from './analytics.store';

// ExamAttempt store (T133)
export { useExamAttemptStore } from './exam-attempt.store';

// Streak store
export {
  useStreakStore,
  selectCurrentStreak,
  selectLongestStreak,
  selectExamDate,
} from './streak.store';
export type { StreakState, StreakActions, StreakStore } from './streak.store';
