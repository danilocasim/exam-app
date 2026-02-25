// Streak Store — Zustand state management for daily study streaks
import { create } from 'zustand';
import {
  getCurrentStreak,
  recordExamCompletion,
  setExamDate,
  getDaysUntilExam,
  getStreakMotivation,
  hasCompletedToday,
} from '../services/streak.service';
import type { StudyStreak } from '../storage/schema';

// ─── State ──────────────────────────────────────────────────

export interface StreakState {
  streak: StudyStreak | null;
  daysUntilExam: number | null;
  motivation: string;
  completedToday: boolean;
  isLoading: boolean;
}

// ─── Actions ────────────────────────────────────────────────

export interface StreakActions {
  /** Load & validate streak (call on app launch / screen focus) */
  loadStreak: () => Promise<void>;

  /** Record an exam completion (call after submitExam succeeds) */
  onExamCompleted: () => Promise<void>;

  /** Save a target exam date */
  saveExamDate: (date: string | null) => Promise<void>;

  /** Reset store to initial state */
  resetStreakState: () => void;
}

export type StreakStore = StreakState & StreakActions;

// ─── Initial ────────────────────────────────────────────────

const initialState: StreakState = {
  streak: null,
  daysUntilExam: null,
  motivation: '',
  completedToday: false,
  isLoading: false,
};

// ─── Store ──────────────────────────────────────────────────

export const useStreakStore = create<StreakStore>((set) => ({
  ...initialState,

  loadStreak: async () => {
    set({ isLoading: true });
    try {
      const streak = await getCurrentStreak();
      set({
        streak,
        daysUntilExam: getDaysUntilExam(streak.examDate),
        motivation: getStreakMotivation(streak),
        completedToday: hasCompletedToday(streak),
        isLoading: false,
      });
    } catch (err) {
      console.error('[StreakStore] Failed to load streak:', err);
      set({ isLoading: false });
    }
  },

  onExamCompleted: async () => {
    try {
      const streak = await recordExamCompletion();
      set({
        streak,
        daysUntilExam: getDaysUntilExam(streak.examDate),
        motivation: getStreakMotivation(streak),
        completedToday: hasCompletedToday(streak),
      });
    } catch (err) {
      console.error('[StreakStore] Failed to record exam completion:', err);
    }
  },

  saveExamDate: async (date: string | null) => {
    try {
      await setExamDate(date);
      const streak = await getCurrentStreak();
      set({
        streak,
        daysUntilExam: getDaysUntilExam(streak.examDate),
      });
    } catch (err) {
      console.error('[StreakStore] Failed to save exam date:', err);
    }
  },

  resetStreakState: () => set(initialState),
}));

// ─── Selectors ──────────────────────────────────────────────

export const selectCurrentStreak = (state: StreakStore) => state.streak?.currentStreak ?? 0;
export const selectLongestStreak = (state: StreakStore) => state.streak?.longestStreak ?? 0;
export const selectExamDate = (state: StreakStore) => state.streak?.examDate ?? null;
