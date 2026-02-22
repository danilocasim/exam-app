// SyncService - handles syncing exam type config and questions from API
import { EXAM_TYPE_ID, SYNC_CONFIG } from '../config';
import {
  getDatabase,
  ExamTypeConfig,
  ExamDomain,
  Question,
  QuestionRow,
  SYNC_META_KEYS,
} from '../storage';
import { get, isApiError } from './api';

// =============================================================================
// Retry Configuration
// =============================================================================

const RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  MAX_RETRIES: 3,
  /** Base delay in ms (exponential backoff: delay * 2^attempt) */
  BASE_DELAY_MS: 1000,
  /** Maximum delay between retries */
  MAX_DELAY_MS: 30000,
} as const;

// =============================================================================
// API Response Types (from contracts/api.yaml)
// =============================================================================

/**
 * Exam type response from GET /exam-types/{examTypeId}
 */
interface ExamTypeResponse {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  domains: ExamDomain[];
  passingScore: number;
  timeLimit: number;
  questionCount: number;
  isActive: boolean;
}

/**
 * Question from API (mapped to local Question type)
 */
interface ApiQuestion {
  id: string;
  text: string;
  type: 'single-choice' | 'multiple-choice' | 'true-false';
  domain: string;
  difficulty: 'easy' | 'medium' | 'hard';
  options: Array<{ id: string; text: string }>;
  correctAnswers: string[];
  explanation: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Question bank response from GET /exam-types/{examTypeId}/questions
 */
interface QuestionBankResponse {
  questions: ApiQuestion[];
  latestVersion: number;
  hasMore: boolean;
  nextSince?: number;
}

/**
 * Version response from GET /exam-types/{examTypeId}/questions/version
 */
interface VersionResponse {
  latestVersion: number;
  questionCount: number;
  lastUpdatedAt?: string;
}

// =============================================================================
// Sync Service
// =============================================================================

/**
 * Sync result type
 */
export interface SyncResult {
  success: boolean;
  questionsAdded: number;
  questionsUpdated: number;
  latestVersion: number;
  error?: string;
  retriesUsed?: number;
}

/**
 * Wait for a specified duration
 */
const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Execute an async function with exponential backoff retry
 */
const withRetry = async <T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries: number = RETRY_CONFIG.MAX_RETRIES,
): Promise<{ result: T; retriesUsed: number }> => {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();
      return { result, retriesUsed: attempt };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on 4xx client errors (except 408, 429)
      if (isApiError(error)) {
        const status = error.response?.status;
        if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) {
          throw lastError;
        }
      }

      if (attempt < maxRetries) {
        const backoff = Math.min(
          RETRY_CONFIG.BASE_DELAY_MS * Math.pow(2, attempt),
          RETRY_CONFIG.MAX_DELAY_MS,
        );
        console.warn(
          `[SyncService] ${label} attempt ${attempt + 1} failed, retrying in ${backoff}ms...`,
        );
        await delay(backoff);
      }
    }
  }

  throw lastError || new Error(`${label} failed after ${maxRetries} retries`);
};

/**
 * Map API question type to local SQLite enum
 */
const mapQuestionType = (apiType: ApiQuestion['type']): Question['type'] => {
  const typeMap: Record<ApiQuestion['type'], Question['type']> = {
    'single-choice': 'SINGLE_CHOICE',
    'multiple-choice': 'MULTIPLE_CHOICE',
    'true-false': 'TRUE_FALSE',
  };
  return typeMap[apiType];
};

/**
 * Map API difficulty to local SQLite enum
 */
const mapDifficulty = (apiDifficulty: ApiQuestion['difficulty']): Question['difficulty'] => {
  const difficultyMap: Record<ApiQuestion['difficulty'], Question['difficulty']> = {
    easy: 'EASY',
    medium: 'MEDIUM',
    hard: 'HARD',
  };
  return difficultyMap[apiDifficulty];
};

/**
 * Fetch exam type configuration from API
 */
export const fetchExamTypeConfig = async (
  examTypeId: string = EXAM_TYPE_ID,
): Promise<ExamTypeConfig> => {
  try {
    const response = await get<ExamTypeResponse>(`/exam-types/${examTypeId}`);
    return {
      id: response.id,
      name: response.name,
      displayName: response.displayName,
      description: response.description,
      domains: response.domains,
      passingScore: response.passingScore,
      timeLimit: response.timeLimit,
      questionCount: response.questionCount,
    };
  } catch (error) {
    if (isApiError(error) && error.response?.status === 404) {
      throw new Error(`Exam type '${examTypeId}' not found`, { cause: error });
    }
    throw error;
  }
};

/**
 * Fetch latest question bank version from API
 */
export const fetchLatestVersion = async (
  examTypeId: string = EXAM_TYPE_ID,
): Promise<VersionResponse> => {
  return get<VersionResponse>(`/exam-types/${examTypeId}/questions/version`);
};

/**
 * Fetch questions from API (with pagination support)
 */
export const fetchQuestions = async (
  examTypeId: string = EXAM_TYPE_ID,
  sinceVersion?: number,
  limit: number = 100,
): Promise<QuestionBankResponse> => {
  const params: Record<string, string | number> = { limit };
  if (sinceVersion !== undefined) {
    params.since = sinceVersion;
  }
  return get<QuestionBankResponse>(`/exam-types/${examTypeId}/questions`, {
    params,
  });
};

/**
 * Get last sync version from local database
 */
export const getLastSyncVersion = async (): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM SyncMeta WHERE key = ?',
    [SYNC_META_KEYS.LAST_SYNC_VERSION],
  );
  return row ? parseInt(row.value, 10) : 0;
};

/**
 * Save sync metadata to local database
 */
const saveSyncMeta = async (key: string, value: string): Promise<void> => {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(`INSERT OR REPLACE INTO SyncMeta (key, value, updatedAt) VALUES (?, ?, ?)`, [
    key,
    value,
    now,
  ]);
};

/**
 * Save exam type config to local database
 */
export const saveExamTypeConfig = async (config: ExamTypeConfig): Promise<void> => {
  await saveSyncMeta(SYNC_META_KEYS.EXAM_TYPE_CONFIG, JSON.stringify(config));
};

/**
 * Get cached exam type config from local database
 */
export const getCachedExamTypeConfig = async (): Promise<ExamTypeConfig | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM SyncMeta WHERE key = ?',
    [SYNC_META_KEYS.EXAM_TYPE_CONFIG],
  );
  return row ? JSON.parse(row.value) : null;
};

/**
 * Upsert questions into local database
 */
const upsertQuestions = async (
  questions: ApiQuestion[],
): Promise<{ added: number; updated: number }> => {
  const db = await getDatabase();
  let added = 0;
  let updated = 0;

  for (const q of questions) {
    const existing = await db.getFirstAsync<QuestionRow>('SELECT id FROM Question WHERE id = ?', [
      q.id,
    ]);

    const row: QuestionRow = {
      id: q.id,
      text: q.text,
      type: mapQuestionType(q.type),
      domain: q.domain,
      difficulty: mapDifficulty(q.difficulty),
      options: JSON.stringify(q.options),
      correctAnswers: JSON.stringify(q.correctAnswers),
      explanation: q.explanation,
      version: q.version,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };

    if (existing) {
      await db.runAsync(
        `UPDATE Question SET 
          text = ?, type = ?, domain = ?, difficulty = ?,
          options = ?, correctAnswers = ?, explanation = ?,
          version = ?, createdAt = ?, updatedAt = ?
        WHERE id = ?`,
        [
          row.text,
          row.type,
          row.domain,
          row.difficulty,
          row.options,
          row.correctAnswers,
          row.explanation,
          row.version,
          row.createdAt,
          row.updatedAt,
          row.id,
        ],
      );
      updated++;
    } else {
      await db.runAsync(
        `INSERT INTO Question 
          (id, text, type, domain, difficulty, options, correctAnswers, explanation, version, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          row.text,
          row.type,
          row.domain,
          row.difficulty,
          row.options,
          row.correctAnswers,
          row.explanation,
          row.version,
          row.createdAt,
          row.updatedAt,
        ],
      );
      added++;
    }
  }

  return { added, updated };
};

/**
 * Sync questions from API to local database
 * Fetches all questions since the last sync version with retry support
 */
export const syncQuestions = async (examTypeId: string = EXAM_TYPE_ID): Promise<SyncResult> => {
  console.warn(`[SyncService] syncQuestions called for examType: ${examTypeId}`);
  try {
    const lastVersion = await getLastSyncVersion();
    console.warn(`[SyncService] Last sync version: ${lastVersion}`);
    let totalAdded = 0;
    let totalUpdated = 0;
    let latestVersion = lastVersion;
    let hasMore = true;
    let sinceVersion: number | undefined = lastVersion > 0 ? lastVersion : undefined;
    let totalRetries = 0;

    // Fetch all pages of questions with retry
    while (hasMore) {
      console.warn(`[SyncService] Fetching questions since version ${sinceVersion}`);
      const currentSince = sinceVersion;
      const { result: response, retriesUsed } = await withRetry(
        () => fetchQuestions(examTypeId, currentSince),
        `fetchQuestions(since=${currentSince})`,
      );
      totalRetries += retriesUsed;
      console.warn(
        `[SyncService] Fetched ${response.questions.length} questions, hasMore=${response.hasMore}`,
      );

      if (response.questions.length > 0) {
        const { added, updated } = await upsertQuestions(response.questions);
        totalAdded += added;
        totalUpdated += updated;
      }

      latestVersion = response.latestVersion;
      hasMore = response.hasMore;
      sinceVersion = response.nextSince;
    }

    // Update sync metadata
    await saveSyncMeta(SYNC_META_KEYS.LAST_SYNC_VERSION, String(latestVersion));
    await saveSyncMeta(SYNC_META_KEYS.LAST_SYNC_AT, new Date().toISOString());

    console.warn(
      `[SyncService] Sync complete: added=${totalAdded}, updated=${totalUpdated}, latestVersion=${latestVersion}, retries=${totalRetries}`,
    );
    return {
      success: true,
      questionsAdded: totalAdded,
      questionsUpdated: totalUpdated,
      latestVersion,
      retriesUsed: totalRetries,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during sync';
    console.error(`[SyncService] Sync failed: ${message}`);
    return {
      success: false,
      questionsAdded: 0,
      questionsUpdated: 0,
      latestVersion: 0,
      error: message,
    };
  }
};

/**
 * Check if sync is needed based on last sync time
 */
export const isSyncNeeded = async (): Promise<boolean> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM SyncMeta WHERE key = ?',
    [SYNC_META_KEYS.LAST_SYNC_AT],
  );

  if (!row) {
    return true; // Never synced
  }

  const lastSyncAt = new Date(row.value).getTime();
  const now = Date.now();
  return now - lastSyncAt > SYNC_CONFIG.AUTO_SYNC_INTERVAL_MS;
};

/**
 * Full sync: fetch exam type config + sync questions (with retry)
 */
export const performFullSync = async (examTypeId: string = EXAM_TYPE_ID): Promise<SyncResult> => {
  console.warn(`[SyncService] performFullSync called for examType: ${examTypeId}`);
  try {
    // Reset sync version to force full re-sync (temporary for dev)
    console.warn('[SyncService] Resetting sync version to 0 for fresh sync...');
    await saveSyncMeta(SYNC_META_KEYS.LAST_SYNC_VERSION, '0');

    // Fetch and save exam type config with retry
    console.warn('[SyncService] Fetching exam type config...');
    const { result: config } = await withRetry(
      () => fetchExamTypeConfig(examTypeId),
      'fetchExamTypeConfig',
    );
    await saveExamTypeConfig(config);
    console.warn(`[SyncService] Config saved: ${config.questionCount} questions required`);

    // Sync questions (already has internal retry)
    return await syncQuestions(examTypeId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error during full sync';
    return {
      success: false,
      questionsAdded: 0,
      questionsUpdated: 0,
      latestVersion: 0,
      error: message,
    };
  }
};
