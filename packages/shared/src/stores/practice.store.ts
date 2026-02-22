// T052: Practice Store - Zustand state management for practice mode
import { create } from 'zustand';
import { Question, PracticeAnswer, PracticeSession, Difficulty, DomainId } from '../storage/schema';
import {
  startPracticeSession,
  submitPracticeAnswer,
  endPracticeSession,
  getPracticeSummary,
  getAvailableQuestionCount,
  PracticeSessionState,
  PracticeAnswerResult,
  PracticeSummary,
} from '../services/practice.service';

/**
 * Practice store state
 */
export interface PracticeState {
  // Session data
  session: PracticeSession | null;
  questions: Question[];
  answers: PracticeAnswer[];
  currentIndex: number;

  // Filters
  selectedDomain: DomainId | null;
  selectedDifficulty: Difficulty | null;
  availableQuestionCount: number;

  // Current answer feedback
  lastResult: PracticeAnswerResult | null;
  showFeedback: boolean;

  // Status flags
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;

  // Summary (after end session)
  summary: PracticeSummary | null;
}

/**
 * Practice store actions
 */
export interface PracticeActions {
  // Setup
  setDomain: (domain: DomainId | null) => void;
  setDifficulty: (difficulty: Difficulty | null) => void;
  refreshAvailableCount: () => Promise<void>;

  // Session lifecycle
  startSession: () => Promise<void>;
  endSession: () => Promise<void>;
  resetPracticeState: () => void;

  // Answering
  submitAnswer: (selectedAnswers: string[]) => Promise<PracticeAnswerResult>;
  dismissFeedback: () => void;

  // Navigation
  goToNextQuestion: () => void;
  goToPreviousQuestion: () => void;
  goToQuestion: (index: number) => void;

  // State updates
  setError: (error: string | null) => void;
}

export type PracticeStore = PracticeState & PracticeActions;

/**
 * Initial state
 */
const initialState: PracticeState = {
  session: null,
  questions: [],
  answers: [],
  currentIndex: 0,
  selectedDomain: null,
  selectedDifficulty: null,
  availableQuestionCount: 0,
  lastResult: null,
  showFeedback: false,
  isLoading: false,
  isSubmitting: false,
  error: null,
  summary: null,
};

/**
 * Create practice store with Zustand
 */
export const usePracticeStore = create<PracticeStore>((set, get) => ({
  ...initialState,

  /**
   * Set domain filter
   */
  setDomain: (domain: DomainId | null) => {
    set({ selectedDomain: domain });
  },

  /**
   * Set difficulty filter
   */
  setDifficulty: (difficulty: Difficulty | null) => {
    set({ selectedDifficulty: difficulty });
  },

  /**
   * Refresh available question count for current filters
   */
  refreshAvailableCount: async () => {
    const { selectedDomain, selectedDifficulty } = get();
    try {
      const count = await getAvailableQuestionCount(selectedDomain, selectedDifficulty);
      set({ availableQuestionCount: count });
    } catch (err) {
      console.warn('Failed to refresh question count:', err);
    }
  },

  /**
   * Start a new practice session
   */
  startSession: async () => {
    const { selectedDomain, selectedDifficulty } = get();
    set({ isLoading: true, error: null, summary: null });
    try {
      const sessionState: PracticeSessionState = await startPracticeSession(
        selectedDomain,
        selectedDifficulty,
      );
      set({
        session: sessionState.session,
        questions: sessionState.questions,
        answers: [],
        currentIndex: 0,
        lastResult: null,
        showFeedback: false,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start practice session';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  /**
   * Submit answer for the current question
   */
  submitAnswer: async (selectedAnswers: string[]) => {
    const { session, questions, currentIndex, answers } = get();
    if (!session) throw new Error('No practice session in progress');

    const currentQuestion = questions[currentIndex];
    if (!currentQuestion) throw new Error('No current question');

    set({ isSubmitting: true, error: null });
    try {
      const result = await submitPracticeAnswer(session.id, currentQuestion.id, selectedAnswers);
      set({
        lastResult: result,
        showFeedback: true,
        answers: [...answers, result.answer],
        isSubmitting: false,
      });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit answer';
      set({ error: message, isSubmitting: false });
      throw err;
    }
  },

  /**
   * Dismiss feedback and move to next question
   */
  dismissFeedback: () => {
    set({ showFeedback: false, lastResult: null });
  },

  /**
   * Go to next question
   */
  goToNextQuestion: () => {
    const { currentIndex, questions, showFeedback } = get();
    // Don't navigate while feedback is showing
    if (showFeedback) return;

    if (currentIndex < questions.length - 1) {
      set({ currentIndex: currentIndex + 1 });
    }
  },

  /**
   * Go to previous question (only answered questions)
   */
  goToPreviousQuestion: () => {
    const { currentIndex, showFeedback } = get();
    if (showFeedback) return;

    if (currentIndex > 0) {
      set({ currentIndex: currentIndex - 1 });
    }
  },

  /**
   * Navigate to specific question index
   */
  goToQuestion: (index: number) => {
    const { questions, showFeedback } = get();
    if (showFeedback) return;

    const maxIndex = questions.length - 1;
    const safeIndex = Math.max(0, Math.min(index, maxIndex));
    set({ currentIndex: safeIndex });
  },

  /**
   * End the practice session
   */
  endSession: async () => {
    const { session } = get();
    if (!session) return;

    set({ isLoading: true, error: null });
    try {
      await endPracticeSession(session.id);
      const summary = await getPracticeSummary(session.id);
      set({
        summary,
        session: null,
        questions: [],
        currentIndex: 0,
        lastResult: null,
        showFeedback: false,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end session';
      set({ error: message, isLoading: false });
      throw err;
    }
  },

  /**
   * Reset practice state (go back to setup)
   */
  resetPracticeState: () => {
    set({ ...initialState });
  },

  /**
   * Set error message
   */
  setError: (error: string | null) => {
    set({ error });
  },
}));

/**
 * Selectors for common derived state
 */
export const selectCurrentPracticeQuestion = (state: PracticeStore): Question | null => {
  return state.questions[state.currentIndex] ?? null;
};

export const selectPracticeProgress = (state: PracticeStore) => ({
  answered: state.answers.length,
  total: state.questions.length,
  correct: state.answers.filter((a) => a.isCorrect).length,
  percentage:
    state.answers.length > 0
      ? Math.round((state.answers.filter((a) => a.isCorrect).length / state.answers.length) * 100)
      : 0,
});

export const selectIsCurrentQuestionAnswered = (state: PracticeStore): boolean => {
  const currentQuestion = state.questions[state.currentIndex];
  if (!currentQuestion) return false;
  return state.answers.some((a) => a.questionId === currentQuestion.id);
};

export const selectHasNextPracticeQuestion = (state: PracticeStore): boolean => {
  return state.currentIndex < state.questions.length - 1;
};

export const selectHasPreviousPracticeQuestion = (state: PracticeStore): boolean => {
  return state.currentIndex > 0;
};
