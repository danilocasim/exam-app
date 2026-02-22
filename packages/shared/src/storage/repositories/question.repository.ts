// T034: QuestionRepository for SQLite CRUD operations
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';
import { Question, QuestionRow, QuestionOption, Difficulty, DomainId } from '../schema';

/**
 * Convert a SQLite row to a Question entity
 */
const rowToQuestion = (row: QuestionRow): Question => ({
  id: row.id,
  text: row.text,
  type: row.type,
  domain: row.domain,
  difficulty: row.difficulty,
  options: JSON.parse(row.options) as QuestionOption[],
  correctAnswers: JSON.parse(row.correctAnswers) as string[],
  explanation: row.explanation,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * Convert a Question entity to SQLite row values
 */
const questionToRow = (question: Question): QuestionRow => ({
  id: question.id,
  text: question.text,
  type: question.type,
  domain: question.domain,
  difficulty: question.difficulty,
  options: JSON.stringify(question.options),
  correctAnswers: JSON.stringify(question.correctAnswers),
  explanation: question.explanation,
  version: question.version,
  createdAt: question.createdAt,
  updatedAt: question.updatedAt,
});

/**
 * Get all questions from the database
 */
export const getAllQuestions = async (): Promise<Question[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<QuestionRow>('SELECT * FROM Question');
  return rows.map(rowToQuestion);
};

/**
 * Get a question by ID
 */
export const getQuestionById = async (id: string): Promise<Question | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<QuestionRow>('SELECT * FROM Question WHERE id = ?', [id]);
  return row ? rowToQuestion(row) : null;
};

/**
 * Get questions by domain
 */
export const getQuestionsByDomain = async (domain: DomainId): Promise<Question[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<QuestionRow>('SELECT * FROM Question WHERE domain = ?', [
    domain,
  ]);
  return rows.map(rowToQuestion);
};

/**
 * Get questions by difficulty
 */
export const getQuestionsByDifficulty = async (difficulty: Difficulty): Promise<Question[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<QuestionRow>('SELECT * FROM Question WHERE difficulty = ?', [
    difficulty,
  ]);
  return rows.map(rowToQuestion);
};

/**
 * Get questions by domain and difficulty
 */
export const getQuestionsByDomainAndDifficulty = async (
  domain: DomainId,
  difficulty: Difficulty,
): Promise<Question[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<QuestionRow>(
    'SELECT * FROM Question WHERE domain = ? AND difficulty = ?',
    [domain, difficulty],
  );
  return rows.map(rowToQuestion);
};

/**
 * Get a random sample of questions (for exam generation)
 * Uses SQLite's random() function for efficient random selection
 */
export const getRandomQuestions = async (limit: number): Promise<Question[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<QuestionRow>(
    'SELECT * FROM Question ORDER BY RANDOM() LIMIT ?',
    [limit],
  );
  return rows.map(rowToQuestion);
};

/**
 * Get a random sample of questions from a specific domain
 */
export const getRandomQuestionsByDomain = async (
  domain: DomainId,
  limit: number,
): Promise<Question[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<QuestionRow>(
    'SELECT * FROM Question WHERE domain = ? ORDER BY RANDOM() LIMIT ?',
    [domain, limit],
  );
  return rows.map(rowToQuestion);
};

/**
 * Get question count by domain
 */
export const getQuestionCountByDomain = async (): Promise<Record<string, number>> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ domain: string; count: number }>(
    'SELECT domain, COUNT(*) as count FROM Question GROUP BY domain',
  );
  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.domain] = row.count;
  }
  return result;
};

/**
 * Get total question count
 */
export const getTotalQuestionCount = async (): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM Question');
  return row?.count ?? 0;
};

/**
 * Insert a new question (usually from sync)
 */
export const insertQuestion = async (question: Question): Promise<void> => {
  const db = await getDatabase();
  const row = questionToRow(question);
  await db.runAsync(
    `INSERT INTO Question 
      (id, text, type, domain, difficulty, options, correctAnswers, explanation, version, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.text,
      row.type,
      row.domain,
      row.difficulty,
      row.options,
      row.correctAnswers,
      row.explanation,
      row.version,
      row.createdAt,
      row.updatedAt,
    ],
  );
};

/**
 * Update an existing question (usually from sync)
 */
export const updateQuestion = async (question: Question): Promise<void> => {
  const db = await getDatabase();
  const row = questionToRow(question);
  await db.runAsync(
    `UPDATE Question SET 
      text = ?, type = ?, domain = ?, difficulty = ?,
      options = ?, correctAnswers = ?, explanation = ?,
      version = ?, createdAt = ?, updatedAt = ?
    WHERE id = ?`,
    [
      row.text,
      row.type,
      row.domain,
      row.difficulty,
      row.options,
      row.correctAnswers,
      row.explanation,
      row.version,
      row.createdAt,
      row.updatedAt,
      row.id,
    ],
  );
};

/**
 * Upsert a question (insert or update)
 */
export const upsertQuestion = async (question: Question): Promise<void> => {
  const db = await getDatabase();
  const row = questionToRow(question);
  await db.runAsync(
    `INSERT OR REPLACE INTO Question 
      (id, text, type, domain, difficulty, options, correctAnswers, explanation, version, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.text,
      row.type,
      row.domain,
      row.difficulty,
      row.options,
      row.correctAnswers,
      row.explanation,
      row.version,
      row.createdAt,
      row.updatedAt,
    ],
  );
};

/**
 * Delete a question by ID
 */
export const deleteQuestion = async (id: string): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM Question WHERE id = ?', [id]);
};

/**
 * Delete all questions (for reset)
 */
export const deleteAllQuestions = async (): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM Question');
};

/**
 * Get questions by multiple IDs
 */
export const getQuestionsByIds = async (ids: string[]): Promise<Question[]> => {
  if (ids.length === 0) return [];
  const db = await getDatabase();
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.getAllAsync<QuestionRow>(
    `SELECT * FROM Question WHERE id IN (${placeholders})`,
    ids,
  );
  return rows.map(rowToQuestion);
};

/**
 * Generate a new UUID for local entities
 */
export const generateUUID = (): string => {
  return Crypto.randomUUID();
};
