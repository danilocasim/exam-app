/**
 * T154: IntegrityStatusRepository for SQLite CRUD operations
 * Manages cached Play Integrity verification status with 30-day TTL
 */
import { getDatabase } from '../database';
import { IntegrityStatusRecord } from '../../services/play-integrity.service';

// Cache TTL in seconds (30 days)
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 2592000 seconds

/**
 * SQLite row structure for IntegrityStatus table
 */
interface IntegrityStatusRow {
  id: string; // 'singleton'
  integrity_verified: number; // SQLite boolean (0/1)
  verified_at: string; // ISO 8601 timestamp
  created_at: string;
  updated_at: string;
}

/**
 * Convert a SQLite row to an IntegrityStatusRecord entity
 */
const rowToIntegrityStatus = (row: IntegrityStatusRow): IntegrityStatusRecord => ({
  id: row.id,
  integrity_verified: row.integrity_verified === 1,
  verified_at: row.verified_at,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

/**
 * Convert an IntegrityStatusRecord entity to SQLite row values
 */
const integrityStatusToRow = (status: IntegrityStatusRecord): IntegrityStatusRow => ({
  id: status.id,
  integrity_verified: status.integrity_verified ? 1 : 0,
  verified_at: status.verified_at,
  created_at: status.created_at,
  updated_at: status.updated_at,
});

/**
 * Get the current integrity status (singleton pattern)
 * Returns null if no verification has been performed yet
 */
export const getStatus = async (): Promise<IntegrityStatusRecord | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<IntegrityStatusRow>(
    "SELECT * FROM IntegrityStatus WHERE id = 'singleton' LIMIT 1",
  );
  return row ? rowToIntegrityStatus(row) : null;
};

/**
 * Save or update the integrity status
 * Uses INSERT OR REPLACE to handle both create and update
 *
 * @param verified - Whether the integrity check passed
 * @param verifiedAt - ISO 8601 timestamp of verification (defaults to now)
 */
export const saveStatus = async (
  verified: boolean,
  verifiedAt?: string,
): Promise<IntegrityStatusRecord> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const timestamp = verifiedAt || now;

  await db.runAsync(
    `INSERT OR REPLACE INTO IntegrityStatus (id, integrity_verified, verified_at, created_at, updated_at)
     VALUES ('singleton', ?, ?, COALESCE((SELECT created_at FROM IntegrityStatus WHERE id = 'singleton'), ?), ?)`,
    [verified ? 1 : 0, timestamp, now, now],
  );

  // Return the saved record
  const status = await getStatus();
  if (!status) {
    throw new Error('Failed to save integrity status');
  }
  return status;
};

/**
 * Clear the integrity status (reset verification)
 * Used on app reinstall or manual reset.
 * Android automatically clears SQLite data on uninstall/reinstall.
 * This function is also used for manual cache clearing (e.g., version mismatch).
 */
export const clearStatus = async (): Promise<void> => {
  const db = await getDatabase();
  await db.runAsync("DELETE FROM IntegrityStatus WHERE id = 'singleton'");
};

/**
 * Check if the cached verification is still valid (< 30 days old)
 *
 * @param verifiedAt - ISO 8601 timestamp of last verification
 * @returns true if cache is valid (< 30 days old)
 */
export const checkCacheTTL = (verifiedAt: string): boolean => {
  try {
    const verifiedDate = new Date(verifiedAt);
    const now = new Date();
    const ageInSeconds = (now.getTime() - verifiedDate.getTime()) / 1000;

    return ageInSeconds < CACHE_TTL_SECONDS;
  } catch (error) {
    console.error('[IntegrityRepository] Invalid verifiedAt timestamp:', verifiedAt, error);
    return false;
  }
};

/**
 * Get the number of seconds remaining until cache expires
 * Returns 0 if cache is already expired
 *
 * @param verifiedAt - ISO 8601 timestamp of last verification
 * @returns Seconds until expiry (0 if expired)
 */
export const getCacheTTLRemaining = (verifiedAt: string): number => {
  try {
    const verifiedDate = new Date(verifiedAt);
    const now = new Date();
    const ageInSeconds = (now.getTime() - verifiedDate.getTime()) / 1000;
    const remaining = CACHE_TTL_SECONDS - ageInSeconds;

    return Math.max(0, Math.floor(remaining));
  } catch (error) {
    console.error('[IntegrityRepository] Invalid verifiedAt timestamp:', verifiedAt, error);
    return 0;
  }
};

/**
 * Get cache TTL in a human-readable format
 *
 * @param verifiedAt - ISO 8601 timestamp of last verification
 * @returns Human-readable string like "29 days" or "12 hours"
 */
export const getCacheTTLFormatted = (verifiedAt: string): string => {
  const remainingSeconds = getCacheTTLRemaining(verifiedAt);

  if (remainingSeconds === 0) {
    return 'Expired';
  }

  const days = Math.floor(remainingSeconds / (24 * 60 * 60));
  const hours = Math.floor((remainingSeconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((remainingSeconds % (60 * 60)) / 60);

  if (days > 0) {
    return `${days} day${days !== 1 ? 's' : ''}`;
  }
  if (hours > 0) {
    return `${hours} hour${hours !== 1 ? 's' : ''}`;
  }
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
};
