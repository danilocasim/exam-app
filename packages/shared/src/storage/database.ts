// SQLite database initialization
// Supports per-user, per-exam-type database files for data isolation
import * as SQLite from 'expo-sqlite';
import { EXAM_TYPE_ID } from '../config';

// Database instance (singleton per active session)
let db: SQLite.SQLiteDatabase | null = null;

// Default anonymous database name (includes exam type for multi-app isolation)
const ANONYMOUS_DB = `dojoexam_${EXAM_TYPE_ID.toLowerCase().replace(/[^a-z0-9]/g, '_')}.db`;

// Current active database name
let currentDbName = ANONYMOUS_DB;

/**
 * Sanitize an email address for use as a database filename.
 * e.g. "user@gmail.com" → "user_gmail_com"
 */
const sanitizeEmail = (email: string): string => email.toLowerCase().replace(/[^a-z0-9]/g, '_');

/**
 * Get the database filename for a given user email.
 * Returns the anonymous DB name if email is null.
 */
const examTypeSlug = EXAM_TYPE_ID.toLowerCase().replace(/[^a-z0-9]/g, '_');

const getDbNameForUser = (email: string | null): string =>
  email ? `dojoexam_${examTypeSlug}_${sanitizeEmail(email)}.db` : ANONYMOUS_DB;

/**
 * Get the current active database name (for debugging).
 */
export const getCurrentDbName = (): string => currentDbName;

/**
 * Get or create the SQLite database instance
 */
export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (db) {
    return db;
  }

  db = await SQLite.openDatabaseAsync(currentDbName);
  return db;
};

/**
 * Initialize the database schema
 * Creates all tables if they don't exist
 */
export const initializeDatabase = async (): Promise<void> => {
  const database = await getDatabase();

  // Enable foreign keys
  await database.execAsync('PRAGMA foreign_keys = ON;');

  // Create Question table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS Question (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE')),
      domain TEXT NOT NULL,
      difficulty TEXT NOT NULL CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
      options TEXT NOT NULL,
      correctAnswers TEXT NOT NULL,
      explanation TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_question_domain ON Question(domain);
    CREATE INDEX IF NOT EXISTS idx_question_difficulty ON Question(difficulty);
    CREATE INDEX IF NOT EXISTS idx_question_version ON Question(version);
  `);

  // Create ExamAttempt table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS ExamAttempt (
      id TEXT PRIMARY KEY,
      startedAt TEXT NOT NULL,
      completedAt TEXT,
      status TEXT NOT NULL CHECK (status IN ('in-progress', 'completed', 'abandoned')) DEFAULT 'in-progress',
      score REAL,
      passed INTEGER,
      totalQuestions INTEGER NOT NULL DEFAULT 65,
      remainingTimeMs INTEGER NOT NULL,
      expiresAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_exam_attempt_status ON ExamAttempt(status);
    CREATE INDEX IF NOT EXISTS idx_exam_attempt_started_at ON ExamAttempt(startedAt);
  `);

  // Create ExamSubmission table (for historical submissions with sync tracking)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS ExamSubmission (
      id TEXT PRIMARY KEY,
      userId TEXT,
      examTypeId TEXT NOT NULL,
      score REAL NOT NULL,
      passed INTEGER NOT NULL,
      duration INTEGER NOT NULL,
      submittedAt TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      syncStatus TEXT NOT NULL CHECK (syncStatus IN ('PENDING', 'SYNCED', 'FAILED')) DEFAULT 'PENDING',
      syncRetries INTEGER NOT NULL DEFAULT 0,
      syncedAt TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_submission_exam_type ON ExamSubmission(examTypeId);
    CREATE INDEX IF NOT EXISTS idx_submission_sync_status ON ExamSubmission(syncStatus);
    CREATE INDEX IF NOT EXISTS idx_submission_submitted_at ON ExamSubmission(submittedAt);
  `);

  // Create ExamAnswer table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS ExamAnswer (
      id TEXT PRIMARY KEY,
      examAttemptId TEXT NOT NULL,
      questionId TEXT NOT NULL,
      selectedAnswers TEXT NOT NULL DEFAULT '[]',
      isCorrect INTEGER,
      isFlagged INTEGER NOT NULL DEFAULT 0,
      orderIndex INTEGER NOT NULL,
      answeredAt TEXT,
      FOREIGN KEY (examAttemptId) REFERENCES ExamAttempt(id) ON DELETE CASCADE,
      FOREIGN KEY (questionId) REFERENCES Question(id),
      UNIQUE (examAttemptId, questionId)
    );
    CREATE INDEX IF NOT EXISTS idx_exam_answer_attempt ON ExamAnswer(examAttemptId);
    CREATE INDEX IF NOT EXISTS idx_exam_answer_question ON ExamAnswer(questionId);
  `);

  // Create PracticeSession table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS PracticeSession (
      id TEXT PRIMARY KEY,
      startedAt TEXT NOT NULL,
      completedAt TEXT,
      domain TEXT,
      difficulty TEXT CHECK (difficulty IS NULL OR difficulty IN ('EASY', 'MEDIUM', 'HARD')),
      questionsCount INTEGER NOT NULL DEFAULT 0,
      correctCount INTEGER NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_practice_session_started_at ON PracticeSession(startedAt);
    CREATE INDEX IF NOT EXISTS idx_practice_session_domain ON PracticeSession(domain);
  `);

  // Create PracticeAnswer table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS PracticeAnswer (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      questionId TEXT NOT NULL,
      selectedAnswers TEXT NOT NULL DEFAULT '[]',
      isCorrect INTEGER NOT NULL,
      answeredAt TEXT NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES PracticeSession(id) ON DELETE CASCADE,
      FOREIGN KEY (questionId) REFERENCES Question(id)
    );
    CREATE INDEX IF NOT EXISTS idx_practice_answer_session ON PracticeAnswer(sessionId);
    CREATE INDEX IF NOT EXISTS idx_practice_answer_question ON PracticeAnswer(questionId);
  `);

  // Create SyncMeta table (key-value store)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS SyncMeta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);

  // Create UserStats table (single row)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS UserStats (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      totalExams INTEGER NOT NULL DEFAULT 0,
      totalPractice INTEGER NOT NULL DEFAULT 0,
      totalQuestions INTEGER NOT NULL DEFAULT 0,
      totalTimeSpentMs INTEGER NOT NULL DEFAULT 0,
      lastActivityAt TEXT
    );
    INSERT OR IGNORE INTO UserStats (id) VALUES (1);
  `);

  // Create IntegrityStatus table (T151: Phase 3 - Play Integrity Guard)
  // Stores cached result of Play Integrity verification with 30-day TTL
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS IntegrityStatus (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      integrity_verified INTEGER NOT NULL DEFAULT 0,
      verified_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Create StudyStreak table (singleton row, tracks daily exam streak)
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS StudyStreak (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      currentStreak INTEGER NOT NULL DEFAULT 0,
      longestStreak INTEGER NOT NULL DEFAULT 0,
      lastCompletionDate TEXT,
      examDate TEXT
    );
    INSERT OR IGNORE INTO StudyStreak (id) VALUES (1);
  `);
};

/**
 * Close the database connection
 */
export const closeDatabase = async (): Promise<void> => {
  if (db) {
    await db.closeAsync();
    db = null;
  }
};

/**
 * Reset the database (drop all tables and reinitialize)
 * WARNING: This deletes all data!
 */
export const resetDatabase = async (): Promise<void> => {
  const database = await getDatabase();

  await database.execAsync(`
    DROP TABLE IF EXISTS PracticeAnswer;
    DROP TABLE IF EXISTS PracticeSession;
    DROP TABLE IF EXISTS ExamAnswer;
    DROP TABLE IF EXISTS ExamSubmission;
    DROP TABLE IF EXISTS ExamAttempt;
    DROP TABLE IF EXISTS Question;
    DROP TABLE IF EXISTS SyncMeta;
    DROP TABLE IF EXISTS UserStats;
    DROP TABLE IF EXISTS StudyStreak;
  `);

  await initializeDatabase();
};

// ─── Per-user database partitioning ─────────────────────────────────────────

/**
 * Exported user data structure for migration between databases.
 * Includes all user-scoped tables; excludes Question and SyncMeta (shared content).
 */
export interface UserDataExport {
  examAttempts: any[];
  examAnswers: any[];
  examSubmissions: any[];
  practiceSessions: any[];
  practiceAnswers: any[];
  userStats: any | null;
  studyStreak: any | null;
}

/**
 * Export all user-scoped data from the current database.
 * Used to migrate anonymous data to a user-specific database on first login.
 */
export const exportUserData = async (): Promise<UserDataExport> => {
  const database = await getDatabase();

  const examAttempts = await database.getAllAsync('SELECT * FROM ExamAttempt');
  const examAnswers = await database.getAllAsync('SELECT * FROM ExamAnswer');
  const examSubmissions = await database.getAllAsync('SELECT * FROM ExamSubmission');
  const practiceSessions = await database.getAllAsync('SELECT * FROM PracticeSession');
  const practiceAnswers = await database.getAllAsync('SELECT * FROM PracticeAnswer');
  const userStats = await database.getFirstAsync('SELECT * FROM UserStats WHERE id = 1');

  const studyStreak = await database.getFirstAsync('SELECT * FROM StudyStreak WHERE id = 1');

  return {
    examAttempts,
    examAnswers,
    examSubmissions,
    practiceSessions,
    practiceAnswers,
    userStats,
    studyStreak,
  };
};

/**
 * Import user-scoped data into the current database.
 * Uses INSERT OR IGNORE to avoid duplicating records that already exist.
 */
export const importUserData = async (data: UserDataExport): Promise<void> => {
  const database = await getDatabase();

  // Import ExamAttempts
  for (const row of data.examAttempts) {
    await database.runAsync(
      `INSERT OR IGNORE INTO ExamAttempt (id, startedAt, completedAt, status, score, passed, totalQuestions, remainingTimeMs, expiresAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.startedAt,
        row.completedAt,
        row.status,
        row.score,
        row.passed,
        row.totalQuestions,
        row.remainingTimeMs,
        row.expiresAt,
      ],
    );
  }

  // Import ExamAnswers
  for (const row of data.examAnswers) {
    await database.runAsync(
      `INSERT OR IGNORE INTO ExamAnswer (id, examAttemptId, questionId, selectedAnswers, isCorrect, isFlagged, orderIndex, answeredAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.examAttemptId,
        row.questionId,
        row.selectedAnswers,
        row.isCorrect,
        row.isFlagged,
        row.orderIndex,
        row.answeredAt,
      ],
    );
  }

  // Import ExamSubmissions
  for (const row of data.examSubmissions) {
    await database.runAsync(
      `INSERT OR IGNORE INTO ExamSubmission (id, userId, examTypeId, score, passed, duration, submittedAt, createdAt, syncStatus, syncRetries, syncedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.userId,
        row.examTypeId,
        row.score,
        row.passed,
        row.duration,
        row.submittedAt,
        row.createdAt,
        row.syncStatus,
        row.syncRetries,
        row.syncedAt,
      ],
    );
  }

  // Import PracticeSessions
  for (const row of data.practiceSessions) {
    await database.runAsync(
      `INSERT OR IGNORE INTO PracticeSession (id, startedAt, completedAt, domain, difficulty, questionsCount, correctCount)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.startedAt,
        row.completedAt,
        row.domain,
        row.difficulty,
        row.questionsCount,
        row.correctCount,
      ],
    );
  }

  // Import PracticeAnswers
  for (const row of data.practiceAnswers) {
    await database.runAsync(
      `INSERT OR IGNORE INTO PracticeAnswer (id, sessionId, questionId, selectedAnswers, isCorrect, answeredAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [row.id, row.sessionId, row.questionId, row.selectedAnswers, row.isCorrect, row.answeredAt],
    );
  }

  // Merge UserStats (add to existing rather than overwrite)
  if (data.userStats) {
    await database.runAsync(
      `UPDATE UserStats SET
        totalExams = totalExams + ?,
        totalPractice = totalPractice + ?,
        totalQuestions = totalQuestions + ?,
        totalTimeSpentMs = totalTimeSpentMs + ?,
        lastActivityAt = COALESCE(?, lastActivityAt)
      WHERE id = 1`,
      [
        data.userStats.totalExams || 0,
        data.userStats.totalPractice || 0,
        data.userStats.totalQuestions || 0,
        data.userStats.totalTimeSpentMs || 0,
        data.userStats.lastActivityAt,
      ],
    );
  }

  // Merge StudyStreak (keep the higher streak values)
  if (data.studyStreak) {
    await database.runAsync(
      `UPDATE StudyStreak SET
        currentStreak = MAX(currentStreak, ?),
        longestStreak = MAX(longestStreak, ?),
        lastCompletionDate = COALESCE(?, lastCompletionDate),
        examDate = COALESCE(?, examDate)
      WHERE id = 1`,
      [
        data.studyStreak.currentStreak || 0,
        data.studyStreak.longestStreak || 0,
        data.studyStreak.lastCompletionDate,
        data.studyStreak.examDate,
      ],
    );
  }
};

/**
 * Clear all user-scoped data from the current database.
 * Keeps Question table and SyncMeta (shared content) intact.
 */
export const clearUserData = async (): Promise<void> => {
  const database = await getDatabase();
  await database.execAsync(`
    DELETE FROM PracticeAnswer;
    DELETE FROM PracticeSession;
    DELETE FROM ExamAnswer;
    DELETE FROM ExamSubmission;
    DELETE FROM ExamAttempt;
    UPDATE UserStats SET totalExams = 0, totalPractice = 0, totalQuestions = 0, totalTimeSpentMs = 0, lastActivityAt = NULL WHERE id = 1;
    UPDATE StudyStreak SET currentStreak = 0, longestStreak = 0, lastCompletionDate = NULL WHERE id = 1;
  `);
};

/**
 * Check if the current database has any user-scoped data.
 */
export const hasUserData = async (): Promise<boolean> => {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ total: number }>(`
    SELECT (
      (SELECT COUNT(*) FROM ExamAttempt) +
      (SELECT COUNT(*) FROM ExamSubmission) +
      (SELECT COUNT(*) FROM PracticeSession)
    ) AS total
  `);
  return (row?.total ?? 0) > 0;
};

/**
 * Switch to a user-specific database (or back to anonymous).
 *
 * This is the core of per-user data isolation:
 * - Each email gets its own SQLite file (e.g. dojoexam_user_gmail_com.db)
 * - Questions and SyncMeta are copied from the source DB on first switch
 * - Schema is auto-initialized on the target DB
 *
 * @param email - User email to switch to, or null for anonymous
 */
export const switchUserDatabase = async (email: string | null): Promise<void> => {
  const targetDbName = getDbNameForUser(email);

  // Already on the correct database
  if (targetDbName === currentDbName && db) {
    console.log(`[Database] Already on database: ${currentDbName}`);
    return;
  }

  console.log(`[Database] Switching database: ${currentDbName} → ${targetDbName}`);

  // Capture questions and sync metadata from the current DB before closing
  let questionsToCopy: any[] = [];
  let syncMetaToCopy: any[] = [];
  if (db) {
    try {
      questionsToCopy = await db.getAllAsync('SELECT * FROM Question');
      syncMetaToCopy = await db.getAllAsync('SELECT * FROM SyncMeta');
    } catch {
      // Source DB might not have tables yet
    }
  }

  // Close current database
  await closeDatabase();

  // Switch to target
  currentDbName = targetDbName;

  // Initialize schema on the new database
  await initializeDatabase();

  // Copy questions if the new database is empty
  const database = await getDatabase();
  const questionCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM Question',
  );

  if ((!questionCount || questionCount.count === 0) && questionsToCopy.length > 0) {
    console.log(`[Database] Copying ${questionsToCopy.length} questions to ${targetDbName}`);
    for (const q of questionsToCopy) {
      await database.runAsync(
        `INSERT OR IGNORE INTO Question (id, text, type, domain, difficulty, options, correctAnswers, explanation, version, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          q.id,
          q.text,
          q.type,
          q.domain,
          q.difficulty,
          q.options,
          q.correctAnswers,
          q.explanation,
          q.version,
          q.createdAt,
          q.updatedAt,
        ],
      );
    }
  }

  // Copy SyncMeta if the new database is empty (so question sync knows its version)
  const syncMetaCount = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM SyncMeta',
  );
  if ((!syncMetaCount || syncMetaCount.count === 0) && syncMetaToCopy.length > 0) {
    console.log(`[Database] Copying SyncMeta to ${targetDbName}`);
    for (const row of syncMetaToCopy) {
      await database.runAsync(
        'INSERT OR IGNORE INTO SyncMeta (key, value, updatedAt) VALUES (?, ?, ?)',
        [row.key, row.value, row.updatedAt],
      );
    }
  }

  console.log(`[Database] Switched to database: ${targetDbName}`);
};
