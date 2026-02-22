// T040: Exam Store - Zustand state management for exam mode
// T140: Extended with sync state for cloud persistence
import { create } from 'zustand';
import { ExamAnswer, Question, ExamResult } from '../storage/schema';
import {
  startExam as startExamService,
  resumeExam as resumeExamService,
  hasInProgressExam,
  saveAnswer as saveAnswerService,
  toggleQuestionFlag as toggleFlagService,
  submitExam as submitExamService,
  abandonCurrentExam as abandonExamService,
  saveRemainingTime,
  getExamProgress,
  ExamSession,
} from '../services';
import { getAnswersByExamAttemptId } from '../storage/repositories/exam-answer.repository';
import { useExamAttemptStore } from './exam-attempt.store';
import { useAuthStore } from './auth-store';
import { EXAM_TYPE_ID } from '../config';

/**
 * Exam store state
 */
export interface ExamState {
  // Session data
  session: ExamSession | null;
  currentIndex: number;
  remainingTimeMs: number;

  // Status flags
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Progress
  answeredCount: number;
  flaggedCount: number;

  // Result (after submission)
  result: ExamResult | null;

  // T140: Sync state for cloud persistence
  syncState: {
    pendingCount: number;
    isSyncing: boolean;
    lastSyncedAt: Date | null;
    lastSyncError: string | null;
  };
}

/**
 * Exam store actions
 */
export interface ExamActions {
  // Session lifecycle
  startExam: () => Promise<void>;
  resumeExam: () => Promise<boolean>;
  abandonExam: () => Promise<void>;
  submitExam: () => Promise<ExamResult>;
  resetExamState: () => void;

  // Navigation
  goToQuestion: (index: number) => void;
  goToNextQuestion: () => void;
  goToPreviousQuestion: () => void;

  // Answering
  selectAnswer: (questionId: string, selectedAnswers: string[]) => Promise<void>;
  toggleFlag: (questionId: string) => Promise<void>;

  // Timer
  setRemainingTime: (timeMs: number) => void;
  persistRemainingTime: () => Promise<void>;

  // State updates
  refreshProgress: () => Promise<void>;
  setError: (error: string | null) => void;

  // T140: Sync actions
  syncToCloud: () => Promise<void>;
  refreshSyncState: () => void;
}

export type ExamStore = ExamState & ExamActions;

/**
 * Initial state
 */
const initialState: ExamState = {
  session: null,
  currentIndex: 0,
  remainingTimeMs: 0,
  isLoading: false,
  isSubmitting: false,
  error: null,
  answeredCount: 0,
  flaggedCount: 0,
  result: null,
  syncState: {
    pendingCount: 0,
    isSyncing: false,
    lastSyncedAt: null,
    lastSyncError: null,
  },
};

/**
 * Create exam store with Zustand
 */
export const useExamStore = create<ExamStore>((set, get) => ({
  ...initialState,

  /**
   * Start a new exam
   */
  startExam: async () => {
    console.warn('[ExamStore] startExam called');
    set({ isLoading: true, error: null, result: null });
    try {
      const session = await startExamService();
      console.warn(`[ExamStore] Exam started with ${session.questions.length} questions`);
      set({
        session,
        currentIndex: 0,
        remainingTimeMs: session.attempt.remainingTimeMs,
        answeredCount: 0,
        flaggedCount: 0,
        isLoading: false,
      });
    } catch (err) {
      console.error('[ExamStore] startExam failed:', err);
      const message = err instanceof Error ? err.message : 'Failed to start exam';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  /**
   * Resume an existing in-progress exam
   * Returns true if exam was resumed, false if no exam to resume
   */
  resumeExam: async () => {
    set({ isLoading: true, error: null });
    try {
      const session = await resumeExamService();
      if (!session) {
        set({ isLoading: false });
        return false;
      }

      // Calculate answered and flagged counts
      const answeredCount = session.answers.filter((a) => a.answeredAt !== null).length;
      const flaggedCount = session.answers.filter((a) => a.isFlagged).length;

      set({
        session,
        currentIndex: session.currentIndex,
        remainingTimeMs: session.attempt.remainingTimeMs,
        answeredCount,
        flaggedCount,
        isLoading: false,
      });
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume exam';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  /**
   * Abandon the current exam
   */
  abandonExam: async () => {
    const { session } = get();
    if (!session) return;

    set({ isLoading: true, error: null });
    try {
      await abandonExamService(session.attempt.id);
      set({ ...initialState });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to abandon exam';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  /**
   * Submit exam for scoring
   * T140: Also queues result for cloud sync if user is signed in
   */
  submitExam: async () => {
    const { session } = get();
    if (!session) {
      throw new Error('No exam in progress');
    }

    set({ isSubmitting: true, error: null });
    try {
      const result = await submitExamService(session.attempt.id);

      // T140: Queue for cloud sync via exam-attempt store
      try {
        const authState = useAuthStore.getState();
        await useExamAttemptStore.getState().submitExam({
          examTypeId: EXAM_TYPE_ID,
          score: result.score,
          passed: result.passed,
          duration: Math.round(result.timeSpentMs / 1000),
          userId: authState.isSignedIn ? authState.user?.id : undefined,
        });
        // Refresh sync state
        const attemptStore = useExamAttemptStore.getState();
        set({
          syncState: {
            pendingCount: attemptStore.pendingCount,
            isSyncing: attemptStore.isSyncing,
            lastSyncedAt: attemptStore.lastSyncTime ?? null,
            lastSyncError: null,
          },
        });
      } catch (syncErr) {
        console.warn('[ExamStore] Failed to queue for cloud sync:', syncErr);
        // Non-blocking: exam submission still succeeds locally
      }

      set({
        result,
        isSubmitting: false,
        session: null,
        remainingTimeMs: 0,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit exam';
      set({ error: message, isSubmitting: false });
      throw err;
    }
  },

  /**
   * Reset exam state (after viewing results, etc.)
   */
  resetExamState: () => {
    set({ ...initialState });
  },

  /**
   * Navigate to specific question index
   */
  goToQuestion: (index: number) => {
    const { session } = get();
    if (!session) return;

    const maxIndex = session.questions.length - 1;
    const safeIndex = Math.max(0, Math.min(index, maxIndex));
    set({ currentIndex: safeIndex });
  },

  /**
   * Go to next question
   */
  goToNextQuestion: () => {
    const { currentIndex, session } = get();
    if (!session) return;

    if (currentIndex < session.questions.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  /**
   * Go to previous question
   */
  goToPreviousQuestion: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  /**
   * Select/submit an answer for current question
   */
  selectAnswer: async (questionId: string, selectedAnswers: string[]) => {
    const { session } = get();
    if (!session) {
      throw new Error('No exam in progress');
    }

    console.warn(
      `[ExamStore] selectAnswer: questionId=${questionId}, answers=${selectedAnswers.join(',')}`,
    );
    try {
      await saveAnswerService(session.attempt.id, questionId, selectedAnswers);
      console.warn('[ExamStore] Answer saved successfully');

      // Refresh answers from database to get updated state
      const updatedAnswers = await getAnswersByExamAttemptId(session.attempt.id);
      const answeredCount = updatedAnswers.filter((a) => a.answeredAt !== null).length;

      set({
        session: {
          ...session,
          answers: updatedAnswers,
        },
        answeredCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save answer';
      set({ error: message });
      throw err;
    }
  },

  /**
   * Toggle flag on a question
   */
  toggleFlag: async (questionId: string) => {
    const { session } = get();
    if (!session) {
      throw new Error('No exam in progress');
    }

    try {
      await toggleFlagService(session.attempt.id, questionId);

      // Refresh answers to get updated flag state
      const updatedAnswers = await getAnswersByExamAttemptId(session.attempt.id);
      const flaggedCount = updatedAnswers.filter((a) => a.isFlagged).length;

      set({
        session: {
          ...session,
          answers: updatedAnswers,
        },
        flaggedCount,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to toggle flag';
      set({ error: message });
      throw err;
    }
  },

  /**
   * Update remaining time in memory (called frequently by timer)
   */
  setRemainingTime: (timeMs: number) => {
    set({ remainingTimeMs: Math.max(0, timeMs) });
  },

  /**
   * Persist remaining time to database (called less frequently)
   */
  persistRemainingTime: async () => {
    const { session, remainingTimeMs } = get();
    if (!session) return;

    try {
      await saveRemainingTime(session.attempt.id, remainingTimeMs);
    } catch (err) {
      // Silent fail - timer persistence is best-effort
      console.warn('Failed to persist remaining time:', err);
    }
  },

  /**
   * Refresh progress counts from database
   */
  refreshProgress: async () => {
    const { session } = get();
    if (!session) return;

    try {
      const progress = await getExamProgress(session.attempt.id);
      set({
        answeredCount: progress.answered,
        flaggedCount: progress.flagged,
      });
    } catch (err) {
      console.warn('Failed to refresh progress:', err);
    }
  },

  /**
   * Set error message
   */
  setError: (error: string | null) => {
    set({ error });
  },

  /**
   * T140: Trigger cloud sync for pending exam submissions
   */
  syncToCloud: async () => {
    const authState = useAuthStore.getState();
    if (!authState.isSignedIn) return;

    try {
      set((state) => ({
        syncState: { ...state.syncState, isSyncing: true, lastSyncError: null },
      }));

      const userId = authState.user?.id;
      const result = await useExamAttemptStore.getState().syncPendingAttempts(userId);
      const attemptStore = useExamAttemptStore.getState();

      set({
        syncState: {
          pendingCount: attemptStore.pendingCount,
          isSyncing: false,
          lastSyncedAt: result.synced > 0 ? new Date() : get().syncState.lastSyncedAt,
          lastSyncError: result.failed > 0 ? `${result.failed} submission(s) failed to sync` : null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      set((state) => ({
        syncState: { ...state.syncState, isSyncing: false, lastSyncError: message },
      }));
    }
  },

  /**
   * T140: Refresh sync state from exam-attempt store
   */
  refreshSyncState: () => {
    const attemptStore = useExamAttemptStore.getState();
    set({
      syncState: {
        pendingCount: attemptStore.pendingCount,
        isSyncing: attemptStore.isSyncing,
        lastSyncedAt: attemptStore.lastSyncTime ?? null,
        lastSyncError: null,
      },
    });
  },
}));

/**
 * Selectors for common derived state
 */
export const selectCurrentQuestion = (state: ExamStore): Question | null => {
  if (!state.session) return null;
  return state.session.questions[state.currentIndex] ?? null;
};

export const selectCurrentAnswer = (state: ExamStore): ExamAnswer | null => {
  if (!state.session) return null;
  return state.session.answers[state.currentIndex] ?? null;
};

export const selectHasNextQuestion = (state: ExamStore): boolean => {
  if (!state.session) return false;
  return state.currentIndex < state.session.questions.length - 1;
};

export const selectHasPreviousQuestion = (state: ExamStore): boolean => {
  return state.currentIndex > 0;
};

export const selectIsExamInProgress = (state: ExamStore): boolean => {
  return state.session !== null && !state.result;
};

export const selectTotalQuestions = (state: ExamStore): number => {
  return state.session?.questions.length ?? 0;
};

export const selectProgressPercent = (state: ExamStore): number => {
  if (!state.session) return 0;
  const total = state.session.questions.length;
  return total > 0 ? Math.round((state.answeredCount / total) * 100) : 0;
};

/**
 * Hook to check if there's an in-progress exam
 */
export const useHasInProgressExam = async (): Promise<boolean> => {
  return hasInProgressExam();
};
