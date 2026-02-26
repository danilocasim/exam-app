/**
 * Stats Sync Service
 *
 * Handles bidirectional sync of UserStats and StudyStreak between
 * the local SQLite database and the production backend.
 *
 * Merge strategy:
 *  - UserStats: MAX-merge — each cumulative counter takes the higher value,
 *    so offline work from either device is never lost.
 *  - StudyStreak: the device with the more recent lastCompletionDate wins
 *    for currentStreak; longestStreak always takes MAX.
 *
 * This service is offline-safe — all failures are logged but non-fatal.
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const getAxios = () => require('axios').default ?? require('axios');

import {
  getUserStats,
  resetUserStats,
} from '../storage/repositories/user-stats.repository';
import {
  getStudyStreak,
  updateStreakOnCompletion,
} from '../storage/repositories/streak.repository';
import { getDatabase } from '../storage/database';
import { getAPIURL } from '../config';

// ─── Types matching backend responses ───────────────────────────────────────

interface RemoteUserStats {
  totalExams: number;
  totalPractice: number;
  totalQuestions: number;
  totalTimeSpentMs: number;
  lastActivityAt: string | null;
}

interface RemoteStreak {
  currentStreak: number;
  longestStreak: number;
  lastCompletionDate: string | null;
  examDate: string | null;
}

// ─── UserStats sync ──────────────────────────────────────────────────────────

/**
 * Push local UserStats to the server.
 * The server applies MAX-merge so no data is overwritten blindly.
 *
 * @param accessToken  JWT access token for the authenticated user
 * @returns The merged stats as returned by the server, or null on failure
 */
export const pushUserStats = async (
  accessToken: string,
): Promise<RemoteUserStats | null> => {
  try {
    const local = await getUserStats();
    const response = await getAxios().put(
      `${getAPIURL()}/user-stats/me`,
      {
        totalExams: local.totalExams,
        totalPractice: local.totalPractice,
        totalQuestions: local.totalQuestions,
        totalTimeSpentMs: local.totalTimeSpentMs,
        lastActivityAt: local.lastActivityAt,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return response.data as RemoteUserStats;
  } catch (err) {
    console.warn('[StatsSync] Failed to push user stats:', err);
    return null;
  }
};

/**
 * Pull UserStats from the server and merge into local SQLite.
 *
 * Merge rule: for each counter take MAX(local, remote) so that
 * whichever device has more data wins.
 *
 * @param accessToken  JWT access token
 */
export const pullAndMergeUserStats = async (accessToken: string): Promise<void> => {
  try {
    const response = await getAxios().get(`${getAPIURL()}/user-stats/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const remote: RemoteUserStats = response.data;

    const local = await getUserStats();

    const mergedExams = Math.max(local.totalExams, remote.totalExams);
    const mergedPractice = Math.max(local.totalPractice, remote.totalPractice);
    const mergedQuestions = Math.max(local.totalQuestions, remote.totalQuestions);
    const mergedTimeMs = Math.max(local.totalTimeSpentMs, remote.totalTimeSpentMs);

    // Pick the most recent lastActivityAt
    let mergedActivity: string | null = local.lastActivityAt;
    if (remote.lastActivityAt) {
      if (!mergedActivity || remote.lastActivityAt > mergedActivity) {
        mergedActivity = remote.lastActivityAt;
      }
    }

    const db = await getDatabase();
    await db.runAsync(
      `UPDATE UserStats
       SET totalExams = ?,
           totalPractice = ?,
           totalQuestions = ?,
           totalTimeSpentMs = ?,
           lastActivityAt = ?
       WHERE id = 1`,
      [mergedExams, mergedPractice, mergedQuestions, mergedTimeMs, mergedActivity],
    );

    console.log('[StatsSync] UserStats merged from server', {
      totalExams: mergedExams,
      totalPractice: mergedPractice,
    });
  } catch (err) {
    console.warn('[StatsSync] Failed to pull user stats:', err);
  }
};

// ─── StudyStreak sync ────────────────────────────────────────────────────────

/**
 * Push local StudyStreak to the server.
 * The server applies a date-aware merge so the more recent completion wins.
 *
 * @param accessToken  JWT access token
 * @returns The merged streak as returned by the server, or null on failure
 */
export const pushStreak = async (accessToken: string): Promise<RemoteStreak | null> => {
  try {
    const local = await getStudyStreak();
    const response = await getAxios().put(
      `${getAPIURL()}/user-streak/me`,
      {
        currentStreak: local.currentStreak,
        longestStreak: local.longestStreak,
        lastCompletionDate: local.lastCompletionDate,
        examDate: local.examDate,
      },
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return response.data as RemoteStreak;
  } catch (err) {
    console.warn('[StatsSync] Failed to push streak:', err);
    return null;
  }
};

/**
 * Pull StudyStreak from the server and merge into local SQLite.
 *
 * Merge rules:
 * - Take the entry with the more recent lastCompletionDate as the source for
 *   currentStreak (client wins if equal, since it may have unseen today data).
 * - longestStreak always takes MAX — never lose an all-time best.
 * - examDate: keep local if set, otherwise take server value.
 *
 * @param accessToken  JWT access token
 */
export const pullAndMergeStreak = async (accessToken: string): Promise<void> => {
  try {
    const response = await getAxios().get(`${getAPIURL()}/user-streak/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const remote: RemoteStreak = response.data;
    const local = await getStudyStreak();

    const localDate = local.lastCompletionDate;
    const remoteDate = remote.lastCompletionDate;

    let mergedCurrent: number;
    let mergedLastDate: string | null;

    if (!remoteDate && !localDate) {
      mergedCurrent = Math.max(local.currentStreak, remote.currentStreak);
      mergedLastDate = null;
    } else if (!remoteDate || (localDate && localDate >= remoteDate)) {
      // Local is more recent or equal — trust local currentStreak
      mergedCurrent = local.currentStreak;
      mergedLastDate = localDate;
    } else {
      // Server is more recent
      mergedCurrent = remote.currentStreak;
      mergedLastDate = remoteDate;
    }

    const mergedLongest = Math.max(local.longestStreak, remote.longestStreak);
    const mergedExamDate = local.examDate ?? remote.examDate;

    const db = await getDatabase();
    await db.runAsync(
      `UPDATE StudyStreak
       SET currentStreak = ?,
           longestStreak = ?,
           lastCompletionDate = ?,
           examDate = ?
       WHERE id = 1`,
      [mergedCurrent, mergedLongest, mergedLastDate, mergedExamDate],
    );

    console.log('[StatsSync] Streak merged from server', {
      currentStreak: mergedCurrent,
      longestStreak: mergedLongest,
      lastCompletionDate: mergedLastDate,
    });
  } catch (err) {
    console.warn('[StatsSync] Failed to pull streak:', err);
  }
};

// ─── Convenience: full sync ──────────────────────────────────────────────────

/**
 * Push both UserStats and Streak to the server in one call.
 * Use this after an exam/practice session completes to keep the server current.
 */
export const pushAllStats = async (accessToken: string): Promise<void> => {
  await Promise.all([pushUserStats(accessToken), pushStreak(accessToken)]);
};

/**
 * Pull both UserStats and Streak from the server and merge locally.
 * Call this on login / app resume to reconcile cross-device data.
 */
export const pullAndMergeAllStats = async (accessToken: string): Promise<void> => {
  await Promise.all([pullAndMergeUserStats(accessToken), pullAndMergeStreak(accessToken)]);
};
