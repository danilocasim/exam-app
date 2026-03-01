// T130: ExamSubmissionRepository for SQLite CRUD operations
// Stores historical exam submissions with cloud sync tracking
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';

export interface DomainScore {
  domainId: string;
  correct: number;
  total: number;
}

export interface ExamSubmission {
  id: string;
  userId?: string;
  examTypeId: string;
  score: number;
  passed: boolean;
  duration: number; // Seconds
  submittedAt: Date;
  createdAt: Date;
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
  syncRetries: number;
  syncedAt?: Date;
  /** Client-generated UUID sent to the server for idempotent re-submission */
  localId?: string;
  /** Per-domain breakdown — populated at sync time and cached here */
  domainScores?: DomainScore[];
}

interface ExamSubmissionRow {
  id: string;
  userId: string | null;
  examTypeId: string;
  score: number;
  passed: number; // SQLite stores booleans as 0/1
  duration: number;
  submittedAt: string;
  createdAt: string;
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED';
  syncRetries: number;
  syncedAt: string | null;
  localId: string | null;
  domainScores: string | null; // JSON-serialised DomainScore[]
}

/**
 * Convert a SQLite row to an ExamSubmission entity
 */
const rowToExamSubmission = (row: ExamSubmissionRow): ExamSubmission => ({
  id: row.id,
  userId: row.userId || undefined,
  examTypeId: row.examTypeId,
  score: row.score,
  passed: row.passed === 1,
  duration: row.duration,
  submittedAt: new Date(row.submittedAt),
  createdAt: new Date(row.createdAt),
  syncStatus: row.syncStatus,
  syncRetries: row.syncRetries,
  syncedAt: row.syncedAt ? new Date(row.syncedAt) : undefined,
  localId: row.localId || undefined,
  domainScores: row.domainScores ? (JSON.parse(row.domainScores) as DomainScore[]) : undefined,
});

/**
 * Convert an ExamSubmission entity to SQLite row values
 */
const examsSubmissionToRow = (submission: ExamSubmission): ExamSubmissionRow => ({
  id: submission.id,
  userId: submission.userId || null,
  examTypeId: submission.examTypeId,
  score: submission.score,
  passed: submission.passed ? 1 : 0,
  duration: submission.duration,
  submittedAt: submission.submittedAt.toISOString(),
  createdAt: submission.createdAt.toISOString(),
  syncStatus: submission.syncStatus,
  syncRetries: submission.syncRetries,
  syncedAt: submission.syncedAt?.toISOString() || null,
  localId: submission.localId || null,
  domainScores: submission.domainScores ? JSON.stringify(submission.domainScores) : null,
});

/**
 * Get all exam submissions
 */
export const getAllExamSubmissions = async (): Promise<ExamSubmission[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExamSubmissionRow>(
    'SELECT * FROM ExamSubmission ORDER BY submittedAt DESC',
  );
  return rows.map(rowToExamSubmission);
};

/**
 * Get an exam submission by ID
 */
export const getExamSubmissionById = async (id: string): Promise<ExamSubmission | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ExamSubmissionRow>(
    'SELECT * FROM ExamSubmission WHERE id = ?',
    [id],
  );
  return row ? rowToExamSubmission(row) : null;
};

/**
 * Get exam submissions by exam type
 */
export const getExamSubmissionsByType = async (examTypeId: string): Promise<ExamSubmission[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExamSubmissionRow>(
    'SELECT * FROM ExamSubmission WHERE examTypeId = ? ORDER BY submittedAt DESC',
    [examTypeId],
  );
  return rows.map(rowToExamSubmission);
};

/**
 * Get exam submissions by sync status
 */
export const getExamSubmissionsByStatus = async (
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED',
): Promise<ExamSubmission[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExamSubmissionRow>(
    'SELECT * FROM ExamSubmission WHERE syncStatus = ? ORDER BY createdAt ASC',
    [syncStatus],
  );
  return rows.map(rowToExamSubmission);
};

/**
 * Get pending exam submissions (need cloud sync)
 */
export const getPendingExamSubmissions = async (): Promise<ExamSubmission[]> => {
  return getExamSubmissionsByStatus('PENDING');
};

/**
 * Get failed exam submissions (sync errors, retry needed)
 */
export const getFailedExamSubmissions = async (): Promise<ExamSubmission[]> => {
  return getExamSubmissionsByStatus('FAILED');
};

/**
 * Save a new exam submission
 */
export const saveExamSubmission = async (submission: ExamSubmission): Promise<ExamSubmission> => {
  const db = await getDatabase();
  const row = examsSubmissionToRow(submission);

  await db.runAsync(
    `INSERT OR IGNORE INTO ExamSubmission (
      id, userId, examTypeId, score, passed, duration,
      submittedAt, createdAt, syncStatus, syncRetries, syncedAt, localId, domainScores
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      row.localId,
      row.domainScores,
    ],
  );

  return submission;
};

/**
 * Update an exam submission
 */
export const updateExamSubmission = async (submission: ExamSubmission): Promise<ExamSubmission> => {
  const db = await getDatabase();
  const row = examsSubmissionToRow(submission);

  await db.runAsync(
    `UPDATE ExamSubmission SET
      userId = ?, examTypeId = ?, score = ?, passed = ?,
      duration = ?, submittedAt = ?, createdAt = ?,
      syncStatus = ?, syncRetries = ?, syncedAt = ?, localId = ?, domainScores = ?
    WHERE id = ?`,
    [
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
      row.localId,
      row.domainScores,
      row.id,
    ],
  );

  return submission;
};

/**
 * Mark exam submission as synced
 */
export const markExamSubmissionSynced = async (id: string): Promise<ExamSubmission | null> => {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE ExamSubmission SET
      syncStatus = 'SYNCED', syncedAt = ?, syncRetries = 0
    WHERE id = ?`,
    [new Date().toISOString(), id],
  );

  return getExamSubmissionById(id);
};

/**
 * Mark exam submission as failed sync
 */
export const markExamSubmissionFailed = async (id: string): Promise<ExamSubmission | null> => {
  const db = await getDatabase();
  const submission = await getExamSubmissionById(id);

  if (!submission) {
    return null;
  }

  await db.runAsync(
    `UPDATE ExamSubmission SET
      syncStatus = 'FAILED', syncRetries = syncRetries + 1
    WHERE id = ?`,
    [id],
  );

  return getExamSubmissionById(id);
};

/**
 * Delete an exam submission
 */
export const deleteExamSubmission = async (id: string): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM ExamSubmission WHERE id = ?', [id]);
};

/**
 * Get exam submissions count
 */
export const getExamSubmissionCount = async (): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ExamSubmission',
  );
  return row?.count || 0;
};

/**
 * Get exam submissions count by sync status
 */
export const getExamSubmissionCountByStatus = async (
  syncStatus: 'PENDING' | 'SYNCED' | 'FAILED',
): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ExamSubmission WHERE syncStatus = ?',
    [syncStatus],
  );
  return row?.count || 0;
};

/**
 * Delete all exam submissions (e.g., on logout)
 */
export const deleteAllExamSubmissions = async (): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM ExamSubmission');
};
