// T068: Analytics Store - Zustand state management for performance tracking
import { create } from 'zustand';
import {
  getAnalyticsData,
  AnalyticsData,
  ScoreHistoryEntry,
  StudyStats,
  WeakDomain,
} from '../services/analytics.service';
import { DomainScore } from '../storage/schema';
import { OverallStats } from '../services/scoring.service';

/**
 * Analytics store state
 */
export interface AnalyticsState {
  // Data
  analyticsData: AnalyticsData | null;

  // Status
  isLoading: boolean;
  error: string | null;
}

/**
 * Analytics store actions
 */
export interface AnalyticsActions {
  // Load analytics
  loadAnalytics: () => Promise<void>;

  // Refresh
  refresh: () => Promise<void>;

  // Reset
  resetAnalyticsState: () => void;
}

export type AnalyticsStore = AnalyticsState & AnalyticsActions;

/**
 * Initial state
 */
const initialState: AnalyticsState = {
  analyticsData: null,
  isLoading: false,
  error: null,
};

/**
 * Create analytics store with Zustand
 */
export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  ...initialState,

  /**
   * Load full analytics data
   */
  loadAnalytics: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getAnalyticsData();
      set({ analyticsData: data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load analytics';
      set({ error: message, isLoading: false });
    }
  },

  /**
   * Refresh analytics data (same as load but preserves existing data during load)
   */
  refresh: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await getAnalyticsData();
      set({ analyticsData: data, isLoading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh analytics';
      set({ error: message, isLoading: false });
    }
  },

  /**
   * Reset analytics state
   */
  resetAnalyticsState: () => {
    set({ ...initialState });
  },
}));

/**
 * Selectors for derived state
 */
export const selectOverallStats = (state: AnalyticsStore): OverallStats | null => {
  return state.analyticsData?.overallStats ?? null;
};

export const selectStudyStats = (state: AnalyticsStore): StudyStats | null => {
  return state.analyticsData?.studyStats ?? null;
};

export const selectScoreHistory = (state: AnalyticsStore): ScoreHistoryEntry[] => {
  return state.analyticsData?.scoreHistory ?? [];
};

export const selectDomainPerformance = (state: AnalyticsStore): DomainScore[] => {
  return state.analyticsData?.domainPerformance ?? [];
};

export const selectWeakDomains = (state: AnalyticsStore): WeakDomain[] => {
  return state.analyticsData?.weakDomains ?? [];
};

export const selectHasData = (state: AnalyticsStore): boolean => {
  return state.analyticsData !== null && state.analyticsData.overallStats.totalExams > 0;
};
