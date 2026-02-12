// API service exports
export { apiClient, get, post, put, del, isApiError } from './api';
export type { ApiError } from './api';

// Sync service exports
export {
  fetchExamTypeConfig,
  fetchLatestVersion,
  fetchQuestions,
  getLastSyncVersion,
  saveExamTypeConfig,
  getCachedExamTypeConfig,
  syncQuestions,
  isSyncNeeded,
  performFullSync,
} from './sync.service';
export type { SyncResult } from './sync.service';

// Bundle service exports
export {
  isBundleLoaded,
  getBundledVersion,
  loadBundledQuestions,
  getQuestionCount,
} from './bundle.service';

// Exam generator service exports (T037)
export { generateExam, canGenerateExam, getQuestionDistribution } from './exam-generator.service';
export type { GeneratedExam } from './exam-generator.service';

// Exam session service exports (T038)
export {
  startExam,
  resumeExam,
  hasInProgressExam,
  getRemainingTime,
  saveRemainingTime,
  saveAnswer,
  toggleQuestionFlag,
  setQuestionFlag,
  navigateToQuestion,
  getNavigationInfo,
  goToNextUnansweredOrFlagged,
  submitExam,
  abandonCurrentExam,
  handleExpiredExams,
  deleteExam,
  getExamProgress,
} from './exam-session.service';
export type { ExamSession, NavigationResult } from './exam-session.service';

// Scoring service exports (T039)
export {
  calculateScore,
  calculateDomainBreakdown,
  getExamResult,
  getOverallStats,
  calculateAggregatedDomainPerformance,
  getDomainPerformanceHistory,
  formatTimeSpent,
  formatRemainingTime,
  getPassFailText,
  getScoreColor,
} from './scoring.service';
export type { ScoreSummary, OverallStats } from './scoring.service';

// Practice service exports (T051)
export {
  startPracticeSession,
  submitPracticeAnswer,
  endPracticeSession,
  getPracticeSummary,
  getAvailableQuestionCount,
  deletePracticeSessionWithAnswers,
} from './practice.service';
export type {
  PracticeSessionState,
  PracticeAnswerResult,
  PracticeSummary,
} from './practice.service';

// Review service exports (T059)
export { getExamHistory, getReviewData, filterReviewItems } from './review.service';
export type { ReviewFilterType, ReviewItem, ExamHistoryEntry, ReviewData } from './review.service';
