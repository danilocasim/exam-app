import { clearStatus } from '../storage/repositories/integrity.repository';
import { version as appVersion } from '../../package.json';

let lastAppVersion: string | null = null;

/**
 * Check for app version mismatch and clear integrity cache if major version changes
 * Used to simulate reinstall/reset for integrity cache
 */
export const checkVersionAndClearIntegrityCache = async (): Promise<void> => {
  // Only clear if major version changes
  const major = (v: string) => v.split('.')[0];
  if (!lastAppVersion) {
    lastAppVersion = appVersion;
    return;
  }
  if (major(appVersion) !== major(lastAppVersion)) {
    await clearStatus();
    console.log('[PersistenceService] App major version changed, integrity cache cleared');
    lastAppVersion = appVersion;
  }
};
import NetInfo from '@react-native-community/netinfo';
import { useExamAttemptStore } from '../stores';
import { pushAllStats } from './stats-sync.service';

export interface PersistenceConfig {
  autoSyncEnabled: boolean;
  autoSyncInterval: number; // ms
  maxRetries: number;
  retryDelay: number; // ms
}

const DEFAULT_CONFIG: PersistenceConfig = {
  autoSyncEnabled: true,
  autoSyncInterval: 300000, // 5 minutes
  maxRetries: 12,
  retryDelay: 5000, // 5 seconds
};

let syncIntervalId: NodeJS.Timeout | null = null;
let isOnline = true;
let isSyncing = false;

/** Accessor for the current JWT access token — injected at init time */
let getAccessToken: (() => string | null) | null = null;

/**
 * Initialize persistence service
 * Sets up network monitoring and automatic sync
 * @param config - Persistence configuration
 * @param userId - Current user ID (for authenticated exam-attempt sync)
 * @param tokenGetter - Callback that returns the current JWT access token
 */
export const initPersistence = async (
  config: Partial<PersistenceConfig> = {},
  userId?: string,
  tokenGetter?: () => string | null,
): Promise<void> => {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (tokenGetter) {
    getAccessToken = tokenGetter;
  }

  console.log('[PersistenceService] Initializing with config:', finalConfig);

  // Monitor network connectivity
  setupNetworkMonitoring(finalConfig, userId);

  // Start automatic sync if enabled
  if (finalConfig.autoSyncEnabled) {
    startAutoSync(finalConfig, userId);
  }
};

/**
 * Setup network connectivity monitoring
 */
const setupNetworkMonitoring = (config: PersistenceConfig, userId?: string): void => {
  NetInfo.addEventListener((state) => {
    const wasOnline = isOnline;
    isOnline = state.isConnected ?? false;

    if (!wasOnline && isOnline) {
      // Network came back online
      console.log('[PersistenceService] Network came back online');
      syncNow(config, userId);
    } else if (wasOnline && !isOnline) {
      // Network went offline
      console.log('[PersistenceService] Network went offline');
    }
  });
};

/**
 * Start automatic sync on interval
 */
const startAutoSync = (config: PersistenceConfig, userId?: string): void => {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
  }

  syncIntervalId = setInterval(() => {
    if (isOnline && !isSyncing) {
      syncNow(config, userId);
    }
  }, config.autoSyncInterval);

  console.log(`[PersistenceService] Auto-sync started (interval: ${config.autoSyncInterval}ms)`);
};

/**
 * Perform a full sync cycle:
 *  1. Sync pending exam attempts to the server
 *  2. Retry any previously failed attempts
 *  3. Push UserStats + StudyStreak to the server (fire-and-forget)
 */
const syncNow = async (config: PersistenceConfig, userId?: string): Promise<void> => {
  if (isSyncing || !isOnline) {
    return;
  }

  try {
    isSyncing = true;
    console.log('[PersistenceService] Starting sync...');

    const store = useExamAttemptStore.getState();

    // 1. Sync pending exam attempts
    const syncResult = await store.syncPendingAttempts(userId);
    console.log(
      `[PersistenceService] Sync complete: ${syncResult.synced} synced, ${syncResult.failed} failed`,
    );

    // 2. Retry previously failed attempts
    if (syncResult.failed > 0) {
      console.log('[PersistenceService] Retrying failed attempts...');
      await store.retryFailedAttempts(userId);
    }

    // 3. Push UserStats + Streak (non-blocking, best-effort)
    const token = getAccessToken?.();
    if (token) {
      pushAllStats(token).catch((err) =>
        console.warn('[PersistenceService] Stats push failed:', err),
      );
    }
  } catch (error) {
    console.error('[PersistenceService] Sync failed:', error);
  } finally {
    isSyncing = false;
  }
};

/**
 * Stop persistence service
 */
export const stopPersistence = (): void => {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }
  console.log('[PersistenceService] Stopped');
};

/**
 * Check if device is online
 */
export const isNetworkOnline = (): boolean => {
  return isOnline;
};

/**
 * Check if sync is in progress
 */
export const isSyncInProgress = (): boolean => {
  return isSyncing;
};

/**
 * Manually trigger sync
 */
export const triggerSync = async (userId?: string): Promise<void> => {
  await syncNow(DEFAULT_CONFIG, userId);
};

/**
 * Get sync status
 */
export const getSyncStatus = () => {
  const store = useExamAttemptStore.getState();

  return {
    isOnline,
    isSyncing,
    pendingCount: store.pendingCount,
    failedCount: store.failedCount,
    lastSyncTime: store.lastSyncTime,
  };
};
