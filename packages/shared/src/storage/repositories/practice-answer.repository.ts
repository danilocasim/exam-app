// T050: PracticeAnswerRepository for SQLite CRUD operations
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';
import { PracticeAnswer, PracticeAnswerRow } from '../schema';

/**
 * Convert a SQLite row to a PracticeAnswer entity
 */
const rowToPracticeAnswer = (row: PracticeAnswerRow): PracticeAnswer => ({
  id: row.id,
  sessionId: row.sessionId,
  questionId: row.questionId,
  selectedAnswers: JSON.parse(row.selectedAnswers) as string[],
  isCorrect: row.isCorrect === 1,
  answeredAt: row.answeredAt,
});

/**
 * Get all answers for a practice session
 */
export const getPracticeAnswersBySessionId = async (
  sessionId: string,
): Promise<PracticeAnswer[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<PracticeAnswerRow>(
    'SELECT * FROM PracticeAnswer WHERE sessionId = ? ORDER BY answeredAt ASC',
    [sessionId],
  );
  return rows.map(rowToPracticeAnswer);
};

/**
 * Get a practice answer by ID
 */
export const getPracticeAnswerById = async (id: string): Promise<PracticeAnswer | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<PracticeAnswerRow>(
    'SELECT * FROM PracticeAnswer WHERE id = ?',
    [id],
  );
  return row ? rowToPracticeAnswer(row) : null;
};

/**
 * Create a new practice answer
 */
export const createPracticeAnswer = async (
  sessionId: string,
  questionId: string,
  selectedAnswers: string[],
  isCorrect: boolean,
): Promise<PracticeAnswer> => {
  const db = await getDatabase();
  const id = Crypto.randomUUID();
  const answeredAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO PracticeAnswer (id, sessionId, questionId, selectedAnswers, isCorrect, answeredAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, sessionId, questionId, JSON.stringify(selectedAnswers), isCorrect ? 1 : 0, answeredAt],
  );

  return {
    id,
    sessionId,
    questionId,
    selectedAnswers,
    isCorrect,
    answeredAt,
  };
};

/**
 * Get correct answer count for a session
 */
export const getCorrectAnswerCount = async (sessionId: string): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM PracticeAnswer WHERE sessionId = ? AND isCorrect = 1',
    [sessionId],
  );
  return row?.count ?? 0;
};

/**
 * Get total answer count for a session
 */
export const getPracticeAnswerCount = async (sessionId: string): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM PracticeAnswer WHERE sessionId = ?',
    [sessionId],
  );
  return row?.count ?? 0;
};

/**
 * Delete all answers for a session (cascaded by FK, but explicit for safety)
 */
export const deletePracticeAnswersBySessionId = async (sessionId: string): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM PracticeAnswer WHERE sessionId = ?', [sessionId]);
};

/**
 * Delete all practice answers
 */
export const deleteAllPracticeAnswers = async (): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM PracticeAnswer');
};

/**
 * Check if a question has already been answered in a session
 */
export const hasQuestionBeenAnswered = async (
  sessionId: string,
  questionId: string,
): Promise<boolean> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM PracticeAnswer WHERE sessionId = ? AND questionId = ?',
    [sessionId, questionId],
  );
  return (row?.count ?? 0) > 0;
};
