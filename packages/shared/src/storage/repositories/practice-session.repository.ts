// T049: PracticeSessionRepository for SQLite CRUD operations
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';
import { PracticeSession, PracticeSessionRow, Difficulty, DomainId } from '../schema';

/**
 * Convert a SQLite row to a PracticeSession entity
 */
const rowToPracticeSession = (row: PracticeSessionRow): PracticeSession => ({
  id: row.id,
  startedAt: row.startedAt,
  completedAt: row.completedAt,
  domain: row.domain,
  difficulty: row.difficulty,
  questionsCount: row.questionsCount,
  correctCount: row.correctCount,
});

/**
 * Get all practice sessions ordered by most recent first
 */
export const getAllPracticeSessions = async (): Promise<PracticeSession[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PracticeSessionRow>(
    'SELECT * FROM PracticeSession ORDER BY startedAt DESC',
  );
  return rows.map(rowToPracticeSession);
};

/**
 * Get a practice session by ID
 */
export const getPracticeSessionById = async (id: string): Promise<PracticeSession | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PracticeSessionRow>(
    'SELECT * FROM PracticeSession WHERE id = ?',
    [id],
  );
  return row ? rowToPracticeSession(row) : null;
};

/**
 * Get completed practice sessions
 */
export const getCompletedPracticeSessions = async (): Promise<PracticeSession[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PracticeSessionRow>(
    'SELECT * FROM PracticeSession WHERE completedAt IS NOT NULL ORDER BY startedAt DESC',
  );
  return rows.map(rowToPracticeSession);
};

/**
 * Get practice sessions count
 */
export const getPracticeSessionCount = async (): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM PracticeSession',
  );
  return row?.count ?? 0;
};

/**
 * Get completed practice sessions count
 */
export const getCompletedPracticeSessionCount = async (): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM PracticeSession WHERE completedAt IS NOT NULL',
  );
  return row?.count ?? 0;
};

/**
 * Create a new practice session
 */
export const createPracticeSession = async (
  domain: DomainId | null,
  difficulty: Difficulty | null,
): Promise<PracticeSession> => {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const startedAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO PracticeSession (id, startedAt, completedAt, domain, difficulty, questionsCount, correctCount)
     VALUES (?, ?, NULL, ?, ?, 0, 0)`,
    [id, startedAt, domain, difficulty],
  );

  return {
    id,
    startedAt,
    completedAt: null,
    domain,
    difficulty,
    questionsCount: 0,
    correctCount: 0,
  };
};

/**
 * Complete a practice session
 */
export const completePracticeSession = async (id: string): Promise<void> => {
  const db = await getDatabase();
  const completedAt = new Date().toISOString();
  await db.runAsync('UPDATE PracticeSession SET completedAt = ? WHERE id = ?', [completedAt, id]);
};

/**
 * Increment session counters after answering a question
 */
export const incrementSessionCounters = async (id: string, isCorrect: boolean): Promise<void> => {
  const db = await getDatabase();
  if (isCorrect) {
    await db.runAsync(
      'UPDATE PracticeSession SET questionsCount = questionsCount + 1, correctCount = correctCount + 1 WHERE id = ?',
      [id],
    );
  } else {
    await db.runAsync(
      'UPDATE PracticeSession SET questionsCount = questionsCount + 1 WHERE id = ?',
      [id],
    );
  }
};

/**
 * Delete a practice session by ID (cascades to answers)
 */
export const deletePracticeSession = async (id: string): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM PracticeSession WHERE id = ?', [id]);
};

/**
 * Delete all practice sessions
 */
export const deleteAllPracticeSessions = async (): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM PracticeSession');
};

/**
 * Get practice sessions by domain
 */
export const getPracticeSessionsByDomain = async (domain: DomainId): Promise<PracticeSession[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PracticeSessionRow>(
    'SELECT * FROM PracticeSession WHERE domain = ? ORDER BY startedAt DESC',
    [domain],
  );
  return rows.map(rowToPracticeSession);
};
