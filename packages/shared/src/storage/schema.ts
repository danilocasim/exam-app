// SQLite Schema Types
// TypeScript interfaces matching the SQLite table structures

// =============================================================================
// ENUMS
// =============================================================================

/**
 * Question type enum (matches backend QuestionType)
 */
export type QuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';

/**
 * Difficulty level enum (matches backend Difficulty)
 */
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';

/**
 * Exam attempt status
 */
export type ExamStatus = 'in-progress' | 'completed' | 'abandoned';

/**
 * Domain ID - string identifier for exam domains
 * Common AWS CCP domains: 'cloud-concepts', 'security', 'technology', 'billing'
 */
export type DomainId = string;

// =============================================================================
// QUESTION (T022)
// =============================================================================

/**
 * Question option structure (stored as JSON in SQLite)
 */
export interface QuestionOption {
  id: string;
  text: string;
}

/**
 * Question entity - synced from cloud API
 */
export interface Question {
  /** UUID from server */
  id: string;
  /** Question text (min 20 chars) */
  text: string;
  /** Question type */
  type: QuestionType;
  /** Domain ID matching ExamType.domains */
  domain: DomainId;
  /** Difficulty level */
  difficulty: Difficulty;
  /** Array of options (stored as JSON string in SQLite) */
  options: QuestionOption[];
  /** Array of correct option IDs (stored as JSON string in SQLite) */
  correctAnswers: string[];
  /** Explanation of correct answer (min 50 chars) */
  explanation: string;
  /** Sync version number */
  version: number;
  /** ISO timestamp when created */
  createdAt: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

/**
 * Question row as stored in SQLite (options/correctAnswers are JSON strings)
 */
export interface QuestionRow {
  id: string;
  text: string;
  type: QuestionType;
  domain: string;
  difficulty: Difficulty;
  options: string; // JSON string
  correctAnswers: string; // JSON string
  explanation: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// =============================================================================
// EXAM ATTEMPT & ANSWER (T023)
// =============================================================================

/**
 * Exam attempt - represents a complete timed exam session
 */
export interface ExamAttempt {
  /** UUID generated locally */
  id: string;
  /** ISO timestamp when exam started */
  startedAt: string;
  /** ISO timestamp when exam ended (null if in-progress) */
  completedAt: string | null;
  /** Exam status */
  status: ExamStatus;
  /** Percentage score (0-100), null if not completed */
  score: number | null;
  /** Pass/fail result (1=passed, 0=failed, null if not completed) */
  passed: boolean | null;
  /** Number of questions in exam */
  totalQuestions: number;
  /** Remaining time in milliseconds */
  remainingTimeMs: number;
  /** ISO timestamp (startedAt + 24 hours) - exam invalidation time */
  expiresAt: string;
}

/**
 * Exam attempt row as stored in SQLite
 */
export interface ExamAttemptRow {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: ExamStatus;
  score: number | null;
  passed: number | null; // SQLite uses INTEGER for boolean (0/1)
  totalQuestions: number;
  remainingTimeMs: number;
  expiresAt: string;
}

/**
 * Exam answer - user's answer to a question within an exam
 */
export interface ExamAnswer {
  /** UUID generated locally */
  id: string;
  /** FK to ExamAttempt.id */
  examAttemptId: string;
  /** FK to Question.id */
  questionId: string;
  /** Array of selected option IDs (empty if unanswered) */
  selectedAnswers: string[];
  /** Correct/incorrect result (null if unanswered) */
  isCorrect: boolean | null;
  /** Flagged for review */
  isFlagged: boolean;
  /** Position in exam (0-64) */
  orderIndex: number;
  /** ISO timestamp when answered (null if unanswered) */
  answeredAt: string | null;
}

/**
 * Exam answer row as stored in SQLite
 */
export interface ExamAnswerRow {
  id: string;
  examAttemptId: string;
  questionId: string;
  selectedAnswers: string; // JSON string
  isCorrect: number | null; // SQLite uses INTEGER for boolean
  isFlagged: number; // SQLite uses INTEGER for boolean
  orderIndex: number;
  answeredAt: string | null;
}

// =============================================================================
// PRACTICE SESSION & ANSWER (T024)
// =============================================================================

/**
 * Practice session - untimed study session
 */
export interface PracticeSession {
  /** UUID generated locally */
  id: string;
  /** ISO timestamp when session started */
  startedAt: string;
  /** ISO timestamp when session ended (null if abandoned) */
  completedAt: string | null;
  /** Filter: domain (null = all domains) */
  domain: DomainId | null;
  /** Filter: difficulty (null = all difficulties) */
  difficulty: Difficulty | null;
  /** Total questions answered */
  questionsCount: number;
  /** Correct answers count */
  correctCount: number;
}

/**
 * Practice session row as stored in SQLite
 */
export interface PracticeSessionRow {
  id: string;
  startedAt: string;
  completedAt: string | null;
  domain: string | null;
  difficulty: Difficulty | null;
  questionsCount: number;
  correctCount: number;
}

/**
 * Practice answer - user's answer within a practice session
 */
export interface PracticeAnswer {
  /** UUID generated locally */
  id: string;
  /** FK to PracticeSession.id */
  sessionId: string;
  /** FK to Question.id */
  questionId: string;
  /** Array of selected option IDs */
  selectedAnswers: string[];
  /** Correct/incorrect result */
  isCorrect: boolean;
  /** ISO timestamp when answered */
  answeredAt: string;
}

/**
 * Practice answer row as stored in SQLite
 */
export interface PracticeAnswerRow {
  id: string;
  sessionId: string;
  questionId: string;
  selectedAnswers: string; // JSON string
  isCorrect: number; // SQLite uses INTEGER for boolean
  answeredAt: string;
}

// =============================================================================
// SYNC META & USER STATS (T025)
// =============================================================================

/**
 * Sync metadata - key-value store for sync state
 */
export interface SyncMeta {
  /** Metadata key */
  key: string;
  /** Metadata value */
  value: string;
  /** ISO timestamp when last updated */
  updatedAt: string;
}

/**
 * Reserved keys for SyncMeta table
 */
export const SYNC_META_KEYS = {
  /** Last synced question bank version */
  LAST_SYNC_VERSION: 'lastSyncVersion',
  /** ISO timestamp of last successful sync */
  LAST_SYNC_AT: 'lastSyncAt',
  /** Version of bundled question bank */
  BUNDLED_VERSION: 'bundledVersion',
  /** Exam type configuration JSON */
  EXAM_TYPE_CONFIG: 'examTypeConfig',
} as const;

export type SyncMetaKey = (typeof SYNC_META_KEYS)[keyof typeof SYNC_META_KEYS];

/**
 * User statistics - aggregated stats (single row)
 */
export interface UserStats {
  /** Always 1 (single row) */
  id: 1;
  /** Completed exams count */
  totalExams: number;
  /** Practice sessions count */
  totalPractice: number;
  /** Total questions answered (across all modes) */
  totalQuestions: number;
  /** Total time spent in milliseconds */
  totalTimeSpentMs: number;
  /** ISO timestamp of last activity */
  lastActivityAt: string | null;
}

/**
 * User stats row as stored in SQLite
 */
export interface UserStatsRow {
  id: number;
  totalExams: number;
  totalPractice: number;
  totalQuestions: number;
  totalTimeSpentMs: number;
  lastActivityAt: string | null;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Exam type domain configuration (from API)
 */
export interface ExamDomain {
  id: string;
  name: string;
  weight: number;
  questionCount: number;
}

/**
 * Exam type configuration (cached in SyncMeta)
 */
export interface ExamTypeConfig {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  domains: ExamDomain[];
  passingScore: number;
  timeLimit: number;
  questionCount: number;
}

/**
 * Domain breakdown for scoring
 */
export interface DomainScore {
  domainId: string;
  domainName: string;
  correct: number;
  total: number;
  percentage: number;
}

/**
 * Exam result summary
 */
export interface ExamResult {
  examAttemptId: string;
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctAnswers: number;
  domainBreakdown: DomainScore[];
  completedAt: string;
  timeSpentMs: number;
}

// =============================================================================
// STUDY STREAK
// =============================================================================

/**
 * Study streak tracking (singleton row, like UserStats)
 */
export interface StudyStreak {
  /** Always 1 (singleton) */
  id: 1;
  /** Current consecutive-day streak */
  currentStreak: number;
  /** All-time longest streak */
  longestStreak: number;
  /** ISO date (YYYY-MM-DD) of last exam completion that counted toward streak */
  lastCompletionDate: string | null;
  /** ISO date (YYYY-MM-DD) of target exam date (set in Settings) */
  examDate: string | null;
}

/**
 * Study streak row as stored in SQLite
 */
export interface StudyStreakRow {
  id: number;
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string | null;
  examDate: string | null;
}
