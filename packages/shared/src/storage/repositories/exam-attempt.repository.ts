// T035: ExamAttemptRepository for SQLite CRUD operations
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';
import { ExamAttempt, ExamAttemptRow, ExamStatus } from '../schema';

/**
 * Convert a SQLite row to an ExamAttempt entity
 */
const rowToExamAttempt = (row: ExamAttemptRow): ExamAttempt => ({
  id: row.id,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
  status: row.status,
  score: row.score,
  passed: row.passed === 1,
  totalQuestions: row.totalQuestions,
  remainingTimeMs: row.remainingTimeMs,
  expiresAt: row.expiresAt,
});

/**
 * Convert an ExamAttempt entity to SQLite row values
 */
const examAttemptToRow = (attempt: ExamAttempt): ExamAttemptRow => ({
  id: attempt.id,
  startedAt: attempt.startedAt,
  completedAt: attempt.completedAt,
  status: attempt.status,
  score: attempt.score,
  passed: attempt.passed ? 1 : 0,
  totalQuestions: attempt.totalQuestions,
  remainingTimeMs: attempt.remainingTimeMs,
  expiresAt: attempt.expiresAt,
});

/**
 * Get all exam attempts
 */
export const getAllExamAttempts = async (): Promise<ExamAttempt[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExamAttemptRow>(
    'SELECT * FROM ExamAttempt ORDER BY startedAt DESC',
  );
  return rows.map(rowToExamAttempt);
};

/**
 * Get an exam attempt by ID
 */
export const getExamAttemptById = async (id: string): Promise<ExamAttempt | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ExamAttemptRow>('SELECT * FROM ExamAttempt WHERE id = ?', [
    id,
  ]);
  return row ? rowToExamAttempt(row) : null;
};

/**
 * Get exam attempts by status
 */
export const getExamAttemptsByStatus = async (status: ExamStatus): Promise<ExamAttempt[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExamAttemptRow>(
    'SELECT * FROM ExamAttempt WHERE status = ? ORDER BY startedAt DESC',
    [status],
  );
  return rows.map(rowToExamAttempt);
};

/**
 * Get the in-progress exam attempt (if any)
 * There should only be one at a time
 */
export const getInProgressExamAttempt = async (): Promise<ExamAttempt | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ExamAttemptRow>(
    "SELECT * FROM ExamAttempt WHERE status = 'in-progress' ORDER BY startedAt DESC LIMIT 1",
  );
  return row ? rowToExamAttempt(row) : null;
};

/**
 * Get completed exam attempts
 */
export const getCompletedExamAttempts = async (): Promise<ExamAttempt[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExamAttemptRow>(
    "SELECT * FROM ExamAttempt WHERE status = 'completed' ORDER BY completedAt DESC",
  );
  return rows.map(rowToExamAttempt);
};

/**
 * Get exam attempts count
 */
export const getExamAttemptCount = async (): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ExamAttempt',
  );
  return row?.count ?? 0;
};

/**
 * Get completed exam attempts count
 */
export const getCompletedExamAttemptCount = async (): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM ExamAttempt WHERE status = 'completed'",
  );
  return row?.count ?? 0;
};

/**
 * Get passed exam attempts count
 */
export const getPassedExamAttemptCount = async (): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ExamAttempt WHERE passed = 1',
  );
  return row?.count ?? 0;
};

/**
 * Create a new exam attempt
 */
export const createExamAttempt = async (
  totalQuestions: number,
  durationMs: number,
): Promise<ExamAttempt> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + durationMs).toISOString();

  const attempt: ExamAttempt = {
    id: Crypto.randomUUID(),
    startedAt: now,
    completedAt: null,
    status: 'in-progress',
    score: null,
    passed: false,
    totalQuestions,
    remainingTimeMs: durationMs,
    expiresAt,
  };

  const row = examAttemptToRow(attempt);
  await db.runAsync(
    `INSERT INTO ExamAttempt 
      (id, startedAt, completedAt, status, score, passed, totalQuestions, remainingTimeMs, expiresAt)
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

  return attempt;
};

/**
 * Update an exam attempt
 */
export const updateExamAttempt = async (attempt: ExamAttempt): Promise<void> => {
  const db = await getDatabase();
  const row = examAttemptToRow(attempt);
  await db.runAsync(
    `UPDATE ExamAttempt SET 
      startedAt = ?, completedAt = ?, status = ?, score = ?,
      passed = ?, totalQuestions = ?, remainingTimeMs = ?, expiresAt = ?
    WHERE id = ?`,
    [
      row.startedAt,
      row.completedAt,
      row.status,
      row.score,
      row.passed,
      row.totalQuestions,
      row.remainingTimeMs,
      row.expiresAt,
      row.id,
    ],
  );
};

/**
 * Complete an exam attempt with final score
 */
export const completeExamAttempt = async (
  id: string,
  score: number,
  passed: boolean,
): Promise<void> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE ExamAttempt SET 
      completedAt = ?, status = 'completed', score = ?, passed = ?, remainingTimeMs = 0
    WHERE id = ?`,
    [now, score, passed ? 1 : 0, id],
  );
};

/**
 * Abandon an exam attempt
 */
export const abandonExamAttempt = async (id: string): Promise<void> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    `UPDATE ExamAttempt SET 
      completedAt = ?, status = 'abandoned', remainingTimeMs = 0
    WHERE id = ?`,
    [now, id],
  );
};

/**
 * Update remaining time for an exam attempt
 */
export const updateRemainingTime = async (id: string, remainingTimeMs: number): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('UPDATE ExamAttempt SET remainingTimeMs = ? WHERE id = ?', [
    remainingTimeMs,
    id,
  ]);
};

/**
 * Delete an exam attempt by ID
 */
export const deleteExamAttempt = async (id: string): Promise<void> => {
  const db = await getDatabase();
  // Delete related answers first
  await db.runAsync('DELETE FROM ExamAnswer WHERE examAttemptId = ?', [id]);
  await db.runAsync('DELETE FROM ExamAttempt WHERE id = ?', [id]);
};

/**
 * Delete all exam attempts (for reset)
 */
export const deleteAllExamAttempts = async (): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM ExamAnswer');
  await db.runAsync('DELETE FROM ExamAttempt');
};

/**
 * Get average score from completed exams
 */
export const getAverageScore = async (): Promise<number | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ avgScore: number | null }>(
    "SELECT AVG(score) as avgScore FROM ExamAttempt WHERE status = 'completed' AND score IS NOT NULL",
  );
  return row?.avgScore ?? null;
};

/**
 * Get best score from completed exams
 */
export const getBestScore = async (): Promise<number | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ maxScore: number | null }>(
    "SELECT MAX(score) as maxScore FROM ExamAttempt WHERE status = 'completed' AND score IS NOT NULL",
  );
  return row?.maxScore ?? null;
};

/**
 * Get recent exam attempts (limit)
 */
export const getRecentExamAttempts = async (limit: number): Promise<ExamAttempt[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExamAttemptRow>(
    'SELECT * FROM ExamAttempt ORDER BY startedAt DESC LIMIT ?',
    [limit],
  );
  return rows.map(rowToExamAttempt);
};
