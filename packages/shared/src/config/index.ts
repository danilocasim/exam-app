// App configuration - re-export from app.config.ts
export {
  EXAM_TYPE_ID,
  API_CONFIG,
  SYNC_CONFIG,
  EXAM_CONFIG,
  PRACTICE_CONFIG,
  STORAGE_CONFIG,
} from './app.config';

export type {
  ApiConfig,
  SyncConfig,
  ExamConfig,
  PracticeConfig,
  StorageConfig,
} from './app.config';

/**
 * Get the API base URL from configuration
 */
export function getAPIURL(): string {
  return process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
}
