// T066: UserStatsRepository for tracking aggregate user statistics
import { getDatabase } from '../database';
import { UserStats, UserStatsRow } from '../schema';

/**
 * Convert a SQLite row to a UserStats entity
 */
const rowToUserStats = (row: UserStatsRow): UserStats => ({
  id: row.id as 1,
  totalExams: row.totalExams,
  totalPractice: row.totalPractice,
  totalQuestions: row.totalQuestions,
  totalTimeSpentMs: row.totalTimeSpentMs,
  lastActivityAt: row.lastActivityAt,
});

/**
 * Get the singleton user stats row
 */
export const getUserStats = async (): Promise<UserStats> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<UserStatsRow>('SELECT * FROM UserStats WHERE id = 1');

  if (!row) {
    // Should always exist due to INSERT OR IGNORE on init, but handle gracefully
    return {
      id: 1,
      totalExams: 0,
      totalPractice: 0,
      totalQuestions: 0,
      totalTimeSpentMs: 0,
      lastActivityAt: null,
    };
  }

  return rowToUserStats(row);
};

/**
 * Increment exam count and related stats after completing an exam
 */
export const incrementExamCount = async (
  timeSpentMs: number,
  questionsCount: number,
): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE UserStats
     SET totalExams = totalExams + 1,
         totalQuestions = totalQuestions + ?,
         totalTimeSpentMs = totalTimeSpentMs + ?,
         lastActivityAt = ?
     WHERE id = 1`,
    [questionsCount, timeSpentMs, new Date().toISOString()],
  );
};

/**
 * Increment practice count and related stats after completing a practice session
 */
export const incrementPracticeCount = async (
  questionsCount: number,
  timeSpentMs: number,
): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE UserStats
     SET totalPractice = totalPractice + 1,
         totalQuestions = totalQuestions + ?,
         totalTimeSpentMs = totalTimeSpentMs + ?,
         lastActivityAt = ?
     WHERE id = 1`,
    [questionsCount, timeSpentMs, new Date().toISOString()],
  );
};

/**
 * Reset all user stats to defaults
 */
export const resetUserStats = async (): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE UserStats
     SET totalExams = 0,
         totalPractice = 0,
         totalQuestions = 0,
         totalTimeSpentMs = 0,
         lastActivityAt = NULL
     WHERE id = 1`,
  );
};
