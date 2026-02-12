// Mobile app configuration
// This file contains build-time configuration for the mobile app

/**
 * Exam Type ID - identifies which certification exam this app supports
 * This is set at build time and determines which questions are synced from the API
 * Must match an ExamType.id in the backend database
 */
export const EXAM_TYPE_ID = 'CLF-C02';

/**
 * API Configuration
 */
export const API_CONFIG = {
  /** Base URL for the backend API */
  BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://192.168.31.250:3000',

  /** Request timeout in milliseconds */
  TIMEOUT_MS: 30000,

  /** Number of retry attempts for failed requests */
  RETRY_ATTEMPTS: 3,
} as const;

/**
 * Sync Configuration
 */
export const SYNC_CONFIG = {
  /** Interval between automatic sync attempts (24 hours) */
  AUTO_SYNC_INTERVAL_MS: 24 * 60 * 60 * 1000,

  /** Minimum interval between manual sync attempts (5 minutes) */
  MIN_SYNC_INTERVAL_MS: 5 * 60 * 1000,
} as const;

/**
 * Exam Configuration
 * These values are defaults; actual values come from ExamType API response
 */
export const EXAM_CONFIG = {
  /** Default number of questions per exam */
  QUESTIONS_PER_EXAM: 65,

  /** Default time limit in minutes */
  TIME_LIMIT_MINUTES: 90,

  /** Passing score percentage (0-100) */
  PASSING_SCORE: 72,

  /** Score considered proficient */
  PROFICIENT_SCORE: 80,

  /** Maximum time an in-progress exam can remain resumable (24 hours) */
  EXAM_EXPIRY_MS: 24 * 60 * 60 * 1000,
} as const;

/**
 * Practice Configuration
 */
export const PRACTICE_CONFIG = {
  /** Default number of questions in a practice session */
  DEFAULT_QUESTION_COUNT: 10,

  /** Maximum questions per practice session */
  MAX_QUESTION_COUNT: 50,
} as const;

/**
 * Storage Configuration
 */
export const STORAGE_CONFIG = {
  /** SQLite database name */
  DATABASE_NAME: 'cloudprep.db',

  /** Maximum question bank size in MB */
  MAX_QUESTION_BANK_MB: 50,
} as const;

export type ApiConfig = typeof API_CONFIG;
export type SyncConfig = typeof SYNC_CONFIG;
export type ExamConfig = typeof EXAM_CONFIG;
export type PracticeConfig = typeof PRACTICE_CONFIG;
export type StorageConfig = typeof STORAGE_CONFIG;
