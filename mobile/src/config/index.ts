// App configuration
export const APP_CONFIG = {
  // Exam type ID - identifies which certification exam this app supports
  // This is set at build time and determines which questions are synced
  EXAM_TYPE_ID: 'aws-cloud-practitioner',

  // API endpoint
  API_BASE_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000',

  // Sync settings
  SYNC_INTERVAL_MS: 24 * 60 * 60 * 1000, // 24 hours

  // Practice exam settings
  QUESTIONS_PER_PRACTICE: 65,
  PRACTICE_TIME_LIMIT_MINUTES: 90,

  // Score thresholds
  PASSING_SCORE: 70,
  PROFICIENT_SCORE: 80,
} as const;

export type AppConfig = typeof APP_CONFIG;
