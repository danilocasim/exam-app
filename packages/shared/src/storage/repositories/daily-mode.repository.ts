/**
 * Daily Mode Repository
 *
 * Tracks last-attempt timestamps for Daily Mode (timed) and Daily Practice
 * (untimed) using the existing SyncMeta key-value table.
 *
 * Keys are cached locally in SyncMeta and synced to the backend via
 * UserStats.dailyQuizLastCompletedAt / missedQuizLastCompletedAt fields
 * so that cooldowns persist at account level even if app data is cleared.
 */
import { getDatabase } from '../database';

// ─── Keys ────────────────────────────────────────────────────────────────────

const DAILY_EXAM_KEY = 'daily_exam_last_attempt';
const DAILY_PRACTICE_KEY = 'daily_practice_last_attempt';
const MISSED_EXAM_KEY = 'missed_exam_last_attempt';

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readSyncMeta(key: string): Promise<string | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM SyncMeta WHERE key = ? LIMIT 1',
    [key],
  );
  return row?.value ?? null;
}

async function writeSyncMeta(key: string, value: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(`INSERT OR REPLACE INTO SyncMeta (key, value, updatedAt) VALUES (?, ?, ?)`, [
    key,
    value,
    new Date().toISOString(),
  ]);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** ISO timestamp of the last Daily Mode (timed) attempt, or null if never attempted. */
export const getDailyExamLastAttempt = (): Promise<string | null> => readSyncMeta(DAILY_EXAM_KEY);

/** Record that a Daily Mode (timed) attempt was started right now. */
export const setDailyExamLastAttempt = (): Promise<void> =>
  writeSyncMeta(DAILY_EXAM_KEY, new Date().toISOString());

/** ISO timestamp of the last Daily Practice (untimed) attempt, or null if never attempted. */
export const getDailyPracticeLastAttempt = (): Promise<string | null> =>
  readSyncMeta(DAILY_PRACTICE_KEY);

/** Record that a Daily Practice (untimed) attempt was started right now. */
export const setDailyPracticeLastAttempt = (): Promise<void> =>
  writeSyncMeta(DAILY_PRACTICE_KEY, new Date().toISOString());

/** ISO timestamp of the last Missed Questions Quiz attempt, or null if never attempted. */
export const getMissedExamLastAttempt = (): Promise<string | null> => readSyncMeta(MISSED_EXAM_KEY);

/** Record that a Missed Questions Quiz attempt was completed right now. */
export const setMissedExamLastAttempt = (): Promise<void> =>
  writeSyncMeta(MISSED_EXAM_KEY, new Date().toISOString());

// ─── Backend-restore helpers ──────────────────────────────────────────────────

/** Restore the Daily Mode last-attempt timestamp from a backend value. */
export const restoreDailyExamLastAttempt = (iso: string): Promise<void> =>
  writeSyncMeta(DAILY_EXAM_KEY, iso);

/** Restore the Missed Quiz last-attempt timestamp from a backend value. */
export const restoreMissedExamLastAttempt = (iso: string): Promise<void> =>
  writeSyncMeta(MISSED_EXAM_KEY, iso);
