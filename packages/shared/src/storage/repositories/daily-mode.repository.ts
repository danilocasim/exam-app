/**
 * Cooldown Mode Repository
 *
 * Tracks last-attempt timestamps for Missed Questions Quiz
 * using the existing SyncMeta key-value table.
 *
 * Keys are cached locally in SyncMeta and synced to the backend via
 * UserStats.missedQuizLastCompletedAt fields so that cooldowns persist
 * at account level even if app data is cleared.
 */
import { getDatabase } from '../database';

// ─── Keys ────────────────────────────────────────────────────────────────────

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

/** ISO timestamp of the last Missed Questions Quiz attempt, or null if never attempted. */
export const getMissedExamLastAttempt = (): Promise<string | null> => readSyncMeta(MISSED_EXAM_KEY);

/** Record that a Missed Questions Quiz attempt was completed right now. */
export const setMissedExamLastAttempt = (): Promise<void> =>
  writeSyncMeta(MISSED_EXAM_KEY, new Date().toISOString());

// ─── Backend-restore helpers ──────────────────────────────────────────────────

/** Restore the Missed Quiz last-attempt timestamp from a backend value. */
export const restoreMissedExamLastAttempt = (iso: string): Promise<void> =>
  writeSyncMeta(MISSED_EXAM_KEY, iso);
