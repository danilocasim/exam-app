// Bundle loader - loads initial question bank from bundled assets
import { getDatabase, QuestionRow, SYNC_META_KEYS } from '../storage';

/**
 * Bundled question structure (matches the JSON format)
 */
interface BundledQuestion {
  id: string;
  text: string;
  type: 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TRUE_FALSE';
  domain: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  options: Array<{ id: string; text: string }>;
  correctAnswers: string[];
  explanation: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Bundled question bank structure
 */
export interface QuestionBundle {
  version: number;
  examTypeId: string;
  generatedAt: string;
  questions: BundledQuestion[];
}

/**
 * Check if bundled questions have been loaded
 */
export const isBundleLoaded = async (): Promise<boolean> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM SyncMeta WHERE key = ?',
    [SYNC_META_KEYS.BUNDLED_VERSION],
  );
  return row !== null;
};

/**
 * Get the bundled version that was loaded
 */
export const getBundledVersion = async (): Promise<number | null> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM SyncMeta WHERE key = ?',
    [SYNC_META_KEYS.BUNDLED_VERSION],
  );
  return row ? parseInt(row.value, 10) : null;
};

/**
 * Load bundled questions into the database
 * This is called on first app launch to provide offline-first functionality
 * Will also reload if the bundle examTypeId has changed (e.g., data migration)
 *
 * @param bundle - The question bundle data (imported by the app, not the shared package)
 */
export const loadBundledQuestions = async (
  bundle: QuestionBundle,
): Promise<{
  loaded: boolean;
  count: number;
}> => {
  const db = await getDatabase();

  // Check if bundle was already loaded with the SAME exam type
  const loadedExamType = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM SyncMeta WHERE key = ?',
    ['bundled_exam_type_id'],
  );

  const needsReload = !loadedExamType || loadedExamType.value !== bundle.examTypeId;

  if (!needsReload && (await isBundleLoaded())) {
    return { loaded: false, count: 0 };
  }

  // Clear old questions if reloading due to exam type change
  if (needsReload) {
    console.warn(`[BundleService] Exam type changed to ${bundle.examTypeId}, clearing old data...`);
    await db.runAsync('DELETE FROM ExamAnswer');
    await db.runAsync('DELETE FROM ExamAttempt');
    await db.runAsync('DELETE FROM Question');
    await db.runAsync('DELETE FROM SyncMeta');
  }

  // Insert each question
  for (const q of bundle.questions) {
    const row: QuestionRow = {
      id: q.id,
      text: q.text,
      type: q.type,
      domain: q.domain,
      difficulty: q.difficulty,
      options: JSON.stringify(q.options),
      correctAnswers: JSON.stringify(q.correctAnswers),
      explanation: q.explanation,
      version: q.version,
      createdAt: q.createdAt,
      updatedAt: q.updatedAt,
    };

    await db.runAsync(
      `INSERT OR IGNORE INTO Question 
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
  }

  // Mark bundle as loaded
  const now = new Date().toISOString();
  await db.runAsync(`INSERT OR REPLACE INTO SyncMeta (key, value, updatedAt) VALUES (?, ?, ?)`, [
    SYNC_META_KEYS.BUNDLED_VERSION,
    String(bundle.version),
    now,
  ]);

  // Store the exam type ID so we can detect changes
  await db.runAsync(`INSERT OR REPLACE INTO SyncMeta (key, value, updatedAt) VALUES (?, ?, ?)`, [
    'bundled_exam_type_id',
    bundle.examTypeId,
    now,
  ]);

  // If no sync has occurred yet, set the last sync version to 1 (version is always 1)
  const lastSyncRow = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM SyncMeta WHERE key = ?',
    [SYNC_META_KEYS.LAST_SYNC_VERSION],
  );

  if (!lastSyncRow) {
    await db.runAsync(`INSERT OR REPLACE INTO SyncMeta (key, value, updatedAt) VALUES (?, ?, ?)`, [
      SYNC_META_KEYS.LAST_SYNC_VERSION,
      '1',
      now,
    ]);
  }

  return { loaded: true, count: bundle.questions.length };
};

/**
 * Get question count in database
 */
export const getQuestionCount = async (): Promise<number> => {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM Question');
  return row?.count ?? 0;
};
