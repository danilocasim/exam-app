// Streak repository — CRUD for StudyStreak singleton table
import { getDatabase } from '../database';
import { StudyStreak, StudyStreakRow } from '../schema';

/**
 * Convert a SQLite row to a StudyStreak entity
 */
const rowToStreak = (row: StudyStreakRow): StudyStreak => ({
  id: row.id as 1,
  currentStreak: row.currentStreak,
  longestStreak: row.longestStreak,
  lastCompletionDate: row.lastCompletionDate,
  examDate: row.examDate,
});

/**
 * Get the singleton study-streak row
 */
export const getStudyStreak = async (): Promise<StudyStreak> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<StudyStreakRow>('SELECT * FROM StudyStreak WHERE id = 1');

  if (!row) {
    return {
      id: 1,
      currentStreak: 0,
      longestStreak: 0,
      lastCompletionDate: null,
      examDate: null,
    };
  }

  return rowToStreak(row);
};

/**
 * Update the streak after an exam completion.
 * Only increments once per calendar day.
 */
export const updateStreakOnCompletion = async (todayDate: string): Promise<StudyStreak> => {
  const db = await getDatabase();
  const current = await getStudyStreak();

  // Already counted today — no-op
  if (current.lastCompletionDate === todayDate) {
    return current;
  }

  const yesterday = getYesterday(todayDate);

  let newStreak: number;
  if (current.lastCompletionDate === yesterday) {
    // Consecutive day → increment
    newStreak = current.currentStreak + 1;
  } else if (current.currentStreak === 0) {
    // First ever completion
    newStreak = 1;
  } else {
    // Missed at least one day → reset to 1
    newStreak = 1;
  }

  const newLongest = Math.max(current.longestStreak, newStreak);

  await db.runAsync(
    `UPDATE StudyStreak
     SET currentStreak = ?,
         longestStreak = ?,
         lastCompletionDate = ?
     WHERE id = 1`,
    [newStreak, newLongest, todayDate],
  );

  return {
    ...current,
    currentStreak: newStreak,
    longestStreak: newLongest,
    lastCompletionDate: todayDate,
  };
};

/**
 * Re-validate the streak on app load.
 * If lastCompletionDate is not today or yesterday, reset current streak to 0.
 */
export const validateStreak = async (todayDate: string): Promise<StudyStreak> => {
  const current = await getStudyStreak();

  if (!current.lastCompletionDate) return current;

  const yesterday = getYesterday(todayDate);

  if (current.lastCompletionDate !== todayDate && current.lastCompletionDate !== yesterday) {
    // Streak broken — reset
    const db = await getDatabase();
    await db.runAsync('UPDATE StudyStreak SET currentStreak = 0 WHERE id = 1');
    return { ...current, currentStreak: 0 };
  }

  return current;
};

/**
 * Save the target exam date
 */
export const setExamDate = async (examDate: string | null): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync('UPDATE StudyStreak SET examDate = ? WHERE id = 1', [examDate]);
};

/**
 * Reset streak data entirely
 */
export const resetStreak = async (): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE StudyStreak
     SET currentStreak = 0,
         longestStreak = 0,
         lastCompletionDate = NULL
     WHERE id = 1`,
  );
};

// ─── Helpers ────────────────────────────────────────────────

/**
 * Get yesterday's date string (YYYY-MM-DD) relative to a given date string.
 */
const getYesterday = (dateStr: string): string => {
  const d = new Date(dateStr + 'T12:00:00'); // noon to avoid DST edge
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
};
