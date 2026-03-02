/**
 * Missed Questions Repository
 *
 * Queries the ExamAnswer table for distinct questions the user has answered
 * incorrectly across all completed exam attempts. Each question ID appears
 * at most once — the most recent incorrect answer determines inclusion.
 *
 * A question is "missed" if the user's LATEST answer to it was incorrect.
 * If they later answered it correctly, it is no longer considered missed.
 */
import { getDatabase } from '../database';
import { Question, QuestionRow } from '../schema';

// Re-use the row→entity converter from question.repository (same shape)
const rowToQuestion = (row: QuestionRow): Question => ({
  id: row.id,
  text: row.text,
  type: row.type,
  domain: row.domain,
  difficulty: row.difficulty,
  options: JSON.parse(row.options),
  correctAnswers: JSON.parse(row.correctAnswers),
  explanation: row.explanation,
  explanationBlocks: row.explanationBlocks ? JSON.parse(row.explanationBlocks) : null,
  version: row.version,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * Get the count of distinct missed question IDs.
 *
 * A question is "missed" when the user's most recent answered attempt for
 * that question was incorrect. If they later got it right, it drops off.
 */
export const getMissedQuestionCount = async (): Promise<number> => {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ count: number }>(`
    SELECT COUNT(*) AS count
    FROM (
      SELECT ea.questionId
      FROM ExamAnswer ea
      INNER JOIN ExamAttempt et ON et.id = ea.examAttemptId
      WHERE et.status = 'completed'
        AND ea.isCorrect IS NOT NULL
        AND ea.answeredAt IS NOT NULL
      GROUP BY ea.questionId
      HAVING MAX(ea.answeredAt) = MAX(CASE WHEN ea.isCorrect = 0 THEN ea.answeredAt END)
    )
  `);

  return row?.count ?? 0;
};

/**
 * Get distinct missed questions (full Question entities), limited to `limit`.
 * Shuffled via ORDER BY RANDOM() for variety across attempts.
 */
export const getMissedQuestions = async (limit: number): Promise<Question[]> => {
  const db = await getDatabase();

  const rows = await db.getAllAsync<QuestionRow>(
    `
    SELECT q.*
    FROM Question q
    INNER JOIN (
      SELECT ea.questionId
      FROM ExamAnswer ea
      INNER JOIN ExamAttempt et ON et.id = ea.examAttemptId
      WHERE et.status = 'completed'
        AND ea.isCorrect IS NOT NULL
        AND ea.answeredAt IS NOT NULL
      GROUP BY ea.questionId
      HAVING MAX(ea.answeredAt) = MAX(CASE WHEN ea.isCorrect = 0 THEN ea.answeredAt END)
    ) missed ON missed.questionId = q.id
    ORDER BY RANDOM()
    LIMIT ?
  `,
    [limit],
  );

  return rows.map(rowToQuestion);
};
