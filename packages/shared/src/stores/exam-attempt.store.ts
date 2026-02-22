import { create } from 'zustand';
import { ExamAttemptService, ExamAttempt, SyncResult } from '../services/exam-attempt.service';

interface ExamAttemptStoreState {
  // State
  attempts: ExamAttempt[];
  pendingCount: number;
  failedCount: number;
  isLoading: boolean;
  isSyncing: boolean;
  lastSyncTime?: Date;
  analytics?: {
    totalAttempts: number;
    totalPassed: number;
    passRate: number;
    averageScore: number;
    averageDuration: number;
    lastAttemptDate?: Date;
  };

  // Service
  service: ExamAttemptService;

  // Actions
  initialize: () => Promise<void>;
  submitExam: (
    attempt: Omit<ExamAttempt, 'id' | 'createdAt' | 'syncStatus' | 'syncRetries'>,
  ) => Promise<void>;
  loadAttempts: () => Promise<void>;
  syncPendingAttempts: (userId?: string) => Promise<SyncResult>;
  retryFailedAttempts: (userId?: string) => Promise<SyncResult>;
  deleteAttempt: (id: string) => Promise<void>;
  loadAnalytics: (examTypeId?: string) => Promise<void>;
  clearAll: () => Promise<void>;
}

/**
 * Zustand store for exam attempt state management
 * Handles submission history, sync status, and analytics
 */
export const useExamAttemptStore = create<ExamAttemptStoreState>((set, get) => ({
  // Initial state
  attempts: [],
  pendingCount: 0,
  failedCount: 0,
  isLoading: false,
  isSyncing: false,

  // Service instance
  service: new ExamAttemptService(),

  // Initialize store
  initialize: async () => {
    try {
      set({ isLoading: true });
      await get().loadAttempts();
    } catch (error) {
      console.error('[ExamAttemptStore] Failed to initialize:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // Submit a new exam attempt
  submitExam: async (attempt) => {
    const service = get().service;

    try {
      set({ isLoading: true });

      const submitted = await service.submitExam({
        ...attempt,
      });

      // Add to attempts list
      set((state) => ({
        attempts: [submitted, ...state.attempts],
        pendingCount: state.pendingCount + 1,
      }));
    } catch (error) {
      console.error('[ExamAttemptStore] Failed to submit exam:', error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  // Load all attempts from storage
  loadAttempts: async () => {
    const service = get().service;

    try {
      set({ isLoading: true });

      const attempts = await service.getLocalAttempts();
      const pendingCount = attempts.filter((a) => a.syncStatus === 'PENDING').length;
      const failedCount = attempts.filter((a) => a.syncStatus === 'FAILED').length;

      set({
        attempts,
        pendingCount,
        failedCount,
      });
    } catch (error) {
      console.error('[ExamAttemptStore] Failed to load attempts:', error);
    } finally {
      set({ isLoading: false });
    }
  },

  // Sync pending attempts with cloud
  syncPendingAttempts: async (userId?: string) => {
    const service = get().service;

    try {
      set({ isSyncing: true });

      const result = await service.syncPendingAttempts(userId);

      // Reload attempts after sync
      await get().loadAttempts();

      // Update sync time
      set({ lastSyncTime: new Date() });

      return result;
    } catch (error) {
      console.error('[ExamAttemptStore] Failed to sync pending attempts:', error);
      throw error;
    } finally {
      set({ isSyncing: false });
    }
  },

  // Retry failed attempts
  retryFailedAttempts: async (userId?: string) => {
    const service = get().service;

    try {
      set({ isSyncing: true });

      const result = await service.retryFailedAttempts(userId);

      // Reload attempts after retry
      await get().loadAttempts();

      // Update sync time
      set({ lastSyncTime: new Date() });

      return result;
    } catch (error) {
      console.error('[ExamAttemptStore] Failed to retry failed attempts:', error);
      throw error;
    } finally {
      set({ isSyncing: false });
    }
  },

  // Delete an attempt
  deleteAttempt: async (id: string) => {
    const service = get().service;

    try {
      await service.deleteAttempt(id);

      // Remove from attempts list
      set((state) => ({
        attempts: state.attempts.filter((a) => a.id !== id),
      }));

      // Reload analytics
      await get().loadAnalytics();
    } catch (error) {
      console.error('[ExamAttemptStore] Failed to delete attempt:', error);
      throw error;
    }
  },

  // Load analytics data
  loadAnalytics: async (examTypeId?: string) => {
    const service = get().service;

    try {
      const analytics = await service.getAnalytics(examTypeId);
      set({ analytics });
    } catch (error) {
      console.error('[ExamAttemptStore] Failed to load analytics:', error);
    }
  },

  // Clear all data
  clearAll: async () => {
    const service = get().service;

    try {
      await service.clearAll();
      set({
        attempts: [],
        pendingCount: 0,
        failedCount: 0,
        analytics: undefined,
      });
    } catch (error) {
      console.error('[ExamAttemptStore] Failed to clear all:', error);
      throw error;
    }
  },
}));
