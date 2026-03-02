/**
 * Daily Mode Repository
 *
 * Tracks last-attempt timestamps for Daily Mode (timed) and Daily Practice
 * (untimed) using the existing SyncMeta key-value table.
 *
 * Keys are device-local and not synced to the backend — daily resets are
 * intentionally per-device and do not need cloud coordination.
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
