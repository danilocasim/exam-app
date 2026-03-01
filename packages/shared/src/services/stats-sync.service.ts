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

import { getUserStats, resetUserStats } from '../storage/repositories/user-stats.repository';
import {
  getStudyStreak,
  updateStreakOnCompletion,
} from '../storage/repositories/streak.repository';
import { getAllExamSubmissions } from '../storage/repositories/exam-submission.repository';
import {
  getAnswersByExamAttemptId,
  insertRestoredAnswersBatch,
} from '../storage/repositories/exam-answer.repository';
import { getQuestionsByIds } from '../storage/repositories/question.repository';
import { calculateDomainBreakdown } from './scoring.service';
import { getCachedExamTypeConfig } from './sync.service';
import { getDatabase } from '../storage/database';
import { getAPIURL, EXAM_TYPE_ID } from '../config';

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
export const pushUserStats = async (accessToken: string): Promise<RemoteUserStats | null> => {
  try {
    const local = await getUserStats();
    const axios = getAxios();
    const response = await axios.put(
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
    const axios = getAxios();
    if (axios.isAxiosError(err)) {
      console.warn('[StatsSync] Failed to push user stats', {
        url: err.config?.url,
        status: err.response?.status,
        data: err.response?.data,
      });
    } else {
      console.warn('[StatsSync] Failed to push user stats:', err);
    }
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
    const axios = getAxios();
    const response = await axios.get(`${getAPIURL()}/user-stats/me`, {
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
    const axios = getAxios();
    if (axios.isAxiosError(err)) {
      console.warn('[StatsSync] Failed to pull user stats', {
        url: err.config?.url,
        status: err.response?.status,
        data: err.response?.data,
      });
    } else {
      console.warn('[StatsSync] Failed to pull user stats:', err);
    }
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
    const axios = getAxios();
    const response = await axios.put(
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
    const axios = getAxios();
    if (axios.isAxiosError(err)) {
      console.warn('[StatsSync] Failed to push streak', {
        url: err.config?.url,
        status: err.response?.status,
        data: err.response?.data,
      });
    } else {
      console.warn('[StatsSync] Failed to push streak:', err);
    }
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
    const axios = getAxios();
    const response = await axios.get(`${getAPIURL()}/user-streak/me`, {
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
    const axios = getAxios();
    if (axios.isAxiosError(err)) {
      console.warn('[StatsSync] Failed to pull streak', {
        url: err.config?.url,
        status: err.response?.status,
        data: err.response?.data,
      });
    } else {
      console.warn('[StatsSync] Failed to pull streak:', err);
    }
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

// ─── ExamSubmission history sync ─────────────────────────────────────────────

interface RemoteExamAttempt {
  id: string;
  examTypeId: string;
  score: number;
  passed: boolean;
  duration: number;
  submittedAt: string;
  createdAt: string;
  localId?: string;
  domainScores?: Array<{ domainId: string; correct: number; total: number }>;
  answers?: Array<{
    questionId: string;
    selectedAnswers: string[];
    isCorrect: boolean;
    orderIndex: number;
  }>;
}

/**
 * Pull exam history from the server and insert any missing records into local SQLite.
 *
 * Merge rule: server records are inserted only when no local record already exists
 * with a matching localId (or id if localId is absent). Existing local records are
 * never overwritten, preserving any offline-only data.
 *
 * @param accessToken  JWT access token
 */
export const pullAndMergeExamHistory = async (accessToken: string): Promise<void> => {
  try {
    const axios = getAxios();
    const db = await getDatabase();
    const limit = 50;
    let page = 1;
    let totalPages = 1;
    let inserted = 0;

    do {
      const response = await axios.get(`${getAPIURL()}/exam-attempts/my-history`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { page, limit, examTypeId: EXAM_TYPE_ID },
      });

      const result = response.data as {
        data: RemoteExamAttempt[];
        totalPages: number;
      };

      totalPages = result.totalPages ?? 1;

      for (const remote of result.data) {
        // Dedup: check by localId first, then by server id
        const matchKey = remote.localId ?? remote.id;
        let existing = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM ExamSubmission WHERE id = ? OR localId = ?',
          [matchKey, matchKey],
        );

        // Fallback: composite match when server doesn't return localId.
        // This prevents orphan creation for old server records that lack localId.
        if (!existing && !remote.localId) {
          existing = await db.getFirstAsync<{ id: string }>(
            `SELECT id FROM ExamSubmission
             WHERE examTypeId = ? AND score = ? AND passed = ?
               AND ABS(julianday(submittedAt) - julianday(?)) < 0.001`,
            [remote.examTypeId, remote.score, remote.passed ? 1 : 0, remote.submittedAt],
          );
        }

        if (!existing) {
          await db.runAsync(
            `INSERT OR IGNORE INTO ExamSubmission
              (id, examTypeId, score, passed, duration, submittedAt, createdAt,
               syncStatus, syncRetries, syncedAt, localId, domainScores)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'SYNCED', 0, ?, ?, ?)`,
            [
              matchKey,
              remote.examTypeId,
              remote.score,
              remote.passed ? 1 : 0,
              remote.duration,
              remote.submittedAt,
              remote.createdAt,
              new Date().toISOString(),
              remote.localId ?? null,
              remote.domainScores ? JSON.stringify(remote.domainScores) : null,
            ],
          );
          inserted++;
        } else {
          // We matched an existing record by localId (matchKey = remote.localId).
          // Delete any stale orphan that was previously inserted using the server's
          // UUID as its id (created before the server returned localId in responses).
          if (remote.localId && remote.id !== matchKey) {
            await db.runAsync('DELETE FROM ExamSubmission WHERE id = ? AND localId IS NULL', [
              remote.id,
            ]);
          }
          if (remote.domainScores) {
            // Backfill domainScores into an existing local record that lacks them
            await db.runAsync(
              `UPDATE ExamSubmission SET domainScores = ? WHERE (id = ? OR localId = ?) AND domainScores IS NULL`,
              [JSON.stringify(remote.domainScores), matchKey, matchKey],
            );
          }
        }

        // If the server provided per-question answers, restore ExamAttempt + ExamAnswer rows
        // so this exam appears as fully reviewable (canReview: true) in history.
        if (remote.answers && remote.answers.length > 0) {
          let existingAttempt = await db.getFirstAsync<{ id: string }>(
            'SELECT id FROM ExamAttempt WHERE id = ?',
            [matchKey],
          );

          // Fallback: composite match to avoid creating orphan ExamAttempts
          // when the matchKey is a server UUID that doesn't match any local attempt.
          if (!existingAttempt) {
            existingAttempt = await db.getFirstAsync<{ id: string }>(
              `SELECT id FROM ExamAttempt
               WHERE status = 'completed' AND score = ? AND passed = ?
                 AND ABS(julianday(completedAt) - julianday(?)) < 0.001`,
              [remote.score, remote.passed ? 1 : 0, remote.submittedAt],
            );
          }

          if (!existingAttempt) {
            // Synthesise startedAt from submittedAt minus duration
            const submittedMs = new Date(remote.submittedAt).getTime();
            const startedAt = new Date(submittedMs - remote.duration * 1000).toISOString();
            // remainingTimeMs and expiresAt are NOT NULL; use 0 and completed time for restored attempts
            const completedAt = remote.submittedAt;

            await db.runAsync(
              `INSERT OR IGNORE INTO ExamAttempt
                (id, startedAt, completedAt, status, score, passed, totalQuestions, remainingTimeMs, expiresAt)
               VALUES (?, ?, ?, 'completed', ?, ?, ?, 0, ?)`,
              [
                matchKey,
                startedAt,
                completedAt,
                remote.score,
                remote.passed ? 1 : 0,
                remote.answers.length,
                completedAt,
              ],
            );
          }

          // Insert answer rows only if none exist yet
          const existingAnswers = await db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) as count FROM ExamAnswer WHERE examAttemptId = ?',
            [matchKey],
          );
          if (!existingAnswers || existingAnswers.count === 0) {
            await insertRestoredAnswersBatch(matchKey, remote.answers);
          }
        }
      }

      page++;
    } while (page <= totalPages);

    console.log(`[StatsSync] Exam history synced from server — ${inserted} new records inserted`);
  } catch (err) {
    const axios = getAxios();
    if (axios.isAxiosError(err)) {
      console.warn('[StatsSync] Failed to pull exam history', {
        url: err.config?.url,
        status: err.response?.status,
        data: err.response?.data,
      });
    } else {
      console.warn('[StatsSync] Failed to pull exam history:', err);
    }
  }
};

// ─── Domain score backfill ────────────────────────────────────────────────────

/**
 * For ExamSubmission rows that are already SYNCED but have no domainScores yet,
 * compute them from local ExamAnswer data and push to the server.
 *
 * The server upsert will fill in the missing field without creating a duplicate
 * because the same localId is used. Scores are then stored locally too.
 *
 * @param accessToken  JWT access token
 */
export const backfillDomainScores = async (accessToken: string): Promise<void> => {
  try {
    const config = await getCachedExamTypeConfig();
    if (!config) return;

    const submissions = await getAllExamSubmissions();
    const toBackfill = submissions.filter((s) => s.syncStatus === 'SYNCED' && !s.domainScores);
    if (toBackfill.length === 0) return;

    const axios = getAxios();
    const db = await getDatabase();

    for (const sub of toBackfill) {
      // ExamAttempt.id === ExamSubmission.localId — ExamAnswer rows are keyed by that id
      const attemptId = sub.localId ?? sub.id;
      try {
        const answers = await getAnswersByExamAttemptId(attemptId);
        if (answers.length === 0) continue; // No local answers — can't backfill

        const questionIds = answers.map((a) => a.questionId);
        const questions = await getQuestionsByIds(questionIds);
        const questionsById = new Map(questions.map((q) => [q.id, q]));
        const domainScores = calculateDomainBreakdown(answers, questionsById, config).map(
          ({ domainId, correct, total }) => ({ domainId, correct, total }),
        );
        if (domainScores.length === 0) continue;

        // Re-POST to server — idempotent thanks to localId; server updates domainScores
        await axios.post(
          `${getAPIURL()}/exam-attempts/submit-authenticated`,
          {
            examTypeId: sub.examTypeId,
            score: sub.score,
            passed: sub.passed,
            duration: sub.duration,
            submittedAt: sub.submittedAt,
            localId: sub.localId,
            domainScores,
          },
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );

        // Persist locally so we don't re-attempt on the next sync
        await db.runAsync(`UPDATE ExamSubmission SET domainScores = ? WHERE id = ?`, [
          JSON.stringify(domainScores),
          sub.id,
        ]);
      } catch {
        // Non-fatal — will retry on next sync
      }
    }

    console.log(
      `[StatsSync] Domain score backfill complete (${toBackfill.length} candidates checked)`,
    );
  } catch (err) {
    console.warn('[StatsSync] Domain score backfill failed:', err);
  }
};

/**
 * Pull both UserStats and Streak from the server and merge locally.
 * Call this on login / app resume to reconcile cross-device data.
 */
export const pullAndMergeAllStats = async (accessToken: string): Promise<void> => {
  await Promise.all([
    pullAndMergeUserStats(accessToken),
    pullAndMergeStreak(accessToken),
    pullAndMergeExamHistory(accessToken),
  ]);
  // Backfill runs after history pull so newly inserted records are also candidates
  await backfillDomainScores(accessToken);
};
