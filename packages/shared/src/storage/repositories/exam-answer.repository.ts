// T036: ExamAnswerRepository for SQLite CRUD operations
import * as Crypto from 'expo-crypto';
import { getDatabase } from '../database';
import { ExamAnswer, ExamAnswerRow } from '../schema';

/**
 * Convert a SQLite row to an ExamAnswer entity
 */
const rowToExamAnswer = (row: ExamAnswerRow): ExamAnswer => ({
  id: row.id,
  examAttemptId: row.examAttemptId,
  questionId: row.questionId,
  selectedAnswers: JSON.parse(row.selectedAnswers) as string[],
  isCorrect: row.isCorrect === null ? null : row.isCorrect === 1,
  isFlagged: row.isFlagged === 1,
  orderIndex: row.orderIndex,
  answeredAt: row.answeredAt,
});

/**
 * Convert an ExamAnswer entity to SQLite row values
 */
const examAnswerToRow = (answer: ExamAnswer): ExamAnswerRow => ({
  id: answer.id,
  examAttemptId: answer.examAttemptId,
  questionId: answer.questionId,
  selectedAnswers: JSON.stringify(answer.selectedAnswers),
  isCorrect: answer.isCorrect === null ? null : answer.isCorrect ? 1 : 0,
  isFlagged: answer.isFlagged ? 1 : 0,
  orderIndex: answer.orderIndex,
  answeredAt: answer.answeredAt,
});

/**
 * Get all answers for an exam attempt
 */
export const getAnswersByExamAttemptId = async (examAttemptId: string): Promise<ExamAnswer[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExamAnswerRow>(
    'SELECT * FROM ExamAnswer WHERE examAttemptId = ? ORDER BY orderIndex',
    [examAttemptId],
  );
  return rows.map(rowToExamAnswer);
};

/**
 * Get an answer by ID
 */
export const getExamAnswerById = async (id: string): Promise<ExamAnswer | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ExamAnswerRow>('SELECT * FROM ExamAnswer WHERE id = ?', [id]);
  return row ? rowToExamAnswer(row) : null;
};

/**
 * Get an answer for a specific question in an exam
 */
export const getAnswerByExamAndQuestion = async (
  examAttemptId: string,
  questionId: string,
): Promise<ExamAnswer | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ExamAnswerRow>(
    'SELECT * FROM ExamAnswer WHERE examAttemptId = ? AND questionId = ?',
    [examAttemptId, questionId],
  );
  return row ? rowToExamAnswer(row) : null;
};

/**
 * Get flagged answers for an exam attempt
 */
export const getFlaggedAnswers = async (examAttemptId: string): Promise<ExamAnswer[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExamAnswerRow>(
    'SELECT * FROM ExamAnswer WHERE examAttemptId = ? AND isFlagged = 1 ORDER BY orderIndex',
    [examAttemptId],
  );
  return rows.map(rowToExamAnswer);
};

/**
 * Get unanswered questions for an exam attempt
 */
export const getUnansweredAnswers = async (examAttemptId: string): Promise<ExamAnswer[]> => {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ExamAnswerRow>(
    'SELECT * FROM ExamAnswer WHERE examAttemptId = ? AND answeredAt IS NULL ORDER BY orderIndex',
    [examAttemptId],
  );
  return rows.map(rowToExamAnswer);
};

/**
 * Get answered questions count for an exam attempt
 */
export const getAnsweredCount = async (examAttemptId: string): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ExamAnswer WHERE examAttemptId = ? AND answeredAt IS NOT NULL',
    [examAttemptId],
  );
  return row?.count ?? 0;
};

/**
 * Get flagged answers count for an exam attempt
 */
export const getFlaggedCount = async (examAttemptId: string): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ExamAnswer WHERE examAttemptId = ? AND isFlagged = 1',
    [examAttemptId],
  );
  return row?.count ?? 0;
};

/**
 * Get correct answers count for an exam attempt
 */
export const getCorrectCount = async (examAttemptId: string): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM ExamAnswer WHERE examAttemptId = ? AND isCorrect = 1',
    [examAttemptId],
  );
  return row?.count ?? 0;
};

/**
 * Create an exam answer (placeholder for a question in an exam)
 */
export const createExamAnswer = async (
  examAttemptId: string,
  questionId: string,
  orderIndex: number,
): Promise<ExamAnswer> => {
  const db = await getDatabase();
  const answer: ExamAnswer = {
    id: Crypto.randomUUID(),
    examAttemptId,
    questionId,
    selectedAnswers: [],
    isCorrect: null,
    isFlagged: false,
    orderIndex,
    answeredAt: null,
  };

  const row = examAnswerToRow(answer);
  await db.runAsync(
    `INSERT INTO ExamAnswer 
      (id, examAttemptId, questionId, selectedAnswers, isCorrect, isFlagged, orderIndex, answeredAt)
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

  return answer;
};

/**
 * Create multiple exam answers at once (for exam setup)
 */
export const createExamAnswersBatch = async (
  examAttemptId: string,
  questionIds: string[],
): Promise<ExamAnswer[]> => {
  const db = await getDatabase();
  const answers: ExamAnswer[] = questionIds.map((questionId, index) => ({
    id: Crypto.randomUUID(),
    examAttemptId,
    questionId,
    selectedAnswers: [],
    isCorrect: null,
    isFlagged: false,
    orderIndex: index,
    answeredAt: null,
  }));

  // Insert in a transaction for atomicity
  await db.withTransactionAsync(async () => {
    for (const answer of answers) {
      const row = examAnswerToRow(answer);
      await db.runAsync(
        `INSERT INTO ExamAnswer 
          (id, examAttemptId, questionId, selectedAnswers, isCorrect, isFlagged, orderIndex, answeredAt)
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
  });

  return answers;
};

/**
 * Update an exam answer
 */
export const updateExamAnswer = async (answer: ExamAnswer): Promise<void> => {
  const db = await getDatabase();
  const row = examAnswerToRow(answer);
  await db.runAsync(
    `UPDATE ExamAnswer SET 
      selectedAnswers = ?, isCorrect = ?, isFlagged = ?, orderIndex = ?, answeredAt = ?
    WHERE id = ?`,
    [row.selectedAnswers, row.isCorrect, row.isFlagged, row.orderIndex, row.answeredAt, row.id],
  );
};

/**
 * Submit an answer for a question
 */
export const submitAnswer = async (
  id: string,
  selectedAnswers: string[],
  isCorrect: boolean,
): Promise<void> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE ExamAnswer SET selectedAnswers = ?, isCorrect = ?, answeredAt = ? WHERE id = ?',
    [JSON.stringify(selectedAnswers), isCorrect ? 1 : 0, now, id],
  );
};

/**
 * Toggle flag status for an answer
 */
export const toggleFlag = async (id: string): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE ExamAnswer SET isFlagged = CASE WHEN isFlagged = 1 THEN 0 ELSE 1 END WHERE id = ?',
    [id],
  );
};

/**
 * Set flag status for an answer
 */
export const setFlag = async (id: string, isFlagged: boolean): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('UPDATE ExamAnswer SET isFlagged = ? WHERE id = ?', [isFlagged ? 1 : 0, id]);
};

/**
 * Delete an exam answer by ID
 */
export const deleteExamAnswer = async (id: string): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM ExamAnswer WHERE id = ?', [id]);
};

/**
 * Delete all answers for an exam attempt
 */
export const deleteAnswersByExamAttemptId = async (examAttemptId: string): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM ExamAnswer WHERE examAttemptId = ?', [examAttemptId]);
};

/**
 * Insert a batch of already-answered rows restored from the server.
 * Only inserts answers whose questionId exists in Question (FK constraint).
 * Skips answers for questions not yet in the local bank (e.g. before question sync).
 */
export const insertRestoredAnswersBatch = async (
  examAttemptId: string,
  answers: Array<{
    questionId: string;
    selectedAnswers: string[];
    isCorrect: boolean;
    orderIndex: number;
  }>,
): Promise<void> => {
  if (answers.length === 0) return;
  const db = await getDatabase();

  const questionIds = [...new Set(answers.map((a) => a.questionId))];
  const placeholders = questionIds.map(() => '?').join(',');
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM Question WHERE id IN (${placeholders})`,
    questionIds,
  );
  const existingIds = new Set(rows.map((r) => r.id));
  const toInsert = answers.filter((a) => existingIds.has(a.questionId));
  if (toInsert.length === 0) return;

  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    for (const a of toInsert) {
      await db.runAsync(
        `INSERT OR IGNORE INTO ExamAnswer
          (id, examAttemptId, questionId, selectedAnswers, isCorrect, isFlagged, orderIndex, answeredAt)
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          Crypto.randomUUID(),
          examAttemptId,
          a.questionId,
          JSON.stringify(a.selectedAnswers),
          a.isCorrect ? 1 : 0,
          a.orderIndex,
          now,
        ],
      );
    }
  });
};

/**
 * Get answer by order index for an exam attempt
 */
export const getAnswerByOrderIndex = async (
  examAttemptId: string,
  orderIndex: number,
): Promise<ExamAnswer | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ExamAnswerRow>(
    'SELECT * FROM ExamAnswer WHERE examAttemptId = ? AND orderIndex = ?',
    [examAttemptId, orderIndex],
  );
  return row ? rowToExamAnswer(row) : null;
};

/**
 * Get next unanswered or flagged question's answer
 */
export const getNextUnansweredOrFlagged = async (
  examAttemptId: string,
  currentOrderIndex: number,
): Promise<ExamAnswer | null> => {
  const db = await getDatabase();
  // Find next unanswered or flagged after current position
  const row = await db.getFirstAsync<ExamAnswerRow>(
    `SELECT * FROM ExamAnswer 
    WHERE examAttemptId = ? AND orderIndex > ? AND (answeredAt IS NULL OR isFlagged = 1)
    ORDER BY orderIndex LIMIT 1`,
    [examAttemptId, currentOrderIndex],
  );

  if (row) return rowToExamAnswer(row);

  // Wrap around to beginning if not found
  const wrapRow = await db.getFirstAsync<ExamAnswerRow>(
    `SELECT * FROM ExamAnswer 
    WHERE examAttemptId = ? AND orderIndex <= ? AND (answeredAt IS NULL OR isFlagged = 1)
    ORDER BY orderIndex LIMIT 1`,
    [examAttemptId, currentOrderIndex],
  );

  return wrapRow ? rowToExamAnswer(wrapRow) : null;
};
