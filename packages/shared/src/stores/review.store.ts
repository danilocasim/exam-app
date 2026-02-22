// T060: Review Store - Zustand state management for exam review
import { create } from 'zustand';
import { Question } from '../storage/schema';
import {
  getReviewData,
  filterReviewItems,
  ReviewItem,
  ReviewData,
  ReviewFilterType,
} from '../services/review.service';

/**
 * Review store state
 */
export interface ReviewState {
  // Data
  reviewData: ReviewData | null;
  filteredItems: ReviewItem[];
  currentIndex: number;

  // Filter
  filter: ReviewFilterType;

  // Status
  isLoading: boolean;
  error: string | null;
}

/**
 * Review store actions
 */
export interface ReviewActions {
  // Load review data
  loadReview: (attemptId: string) => Promise<void>;

  // Navigation
  goToQuestion: (index: number) => void;
  goToNextQuestion: () => void;
  goToPreviousQuestion: () => void;

  // Filter
  setFilter: (filter: ReviewFilterType) => void;

  // Reset
  resetReviewState: () => void;
}

export type ReviewStore = ReviewState & ReviewActions;

/**
 * Initial state
 */
const initialState: ReviewState = {
  reviewData: null,
  filteredItems: [],
  currentIndex: 0,
  filter: 'all',
  isLoading: false,
  error: null,
};

/**
 * Create review store with Zustand
 */
export const useReviewStore = create<ReviewStore>((set, get) => ({
  ...initialState,

  /**
   * Load review data for an exam attempt
   */
  loadReview: async (attemptId: string) => {
    set({ isLoading: true, error: null });
    try {
      const data = await getReviewData(attemptId);
      const filteredItems = filterReviewItems(data.items, get().filter);
      set({
        reviewData: data,
        filteredItems,
        currentIndex: 0,
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load review';
      set({ error: message, isLoading: false });
    }
  },

  /**
   * Navigate to specific question index
   */
  goToQuestion: (index: number) => {
    const { filteredItems } = get();
    const maxIndex = filteredItems.length - 1;
    const safeIndex = Math.max(0, Math.min(index, maxIndex));
    set({ currentIndex: safeIndex });
  },

  /**
   * Go to next question
   */
  goToNextQuestion: () => {
    const { currentIndex, filteredItems } = get();
    if (currentIndex < filteredItems.length - 1) {
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
   * Set filter and re-filter items
   */
  setFilter: (filter: ReviewFilterType) => {
    const { reviewData } = get();
    if (!reviewData) {
      set({ filter });
      return;
    }
    const filteredItems = filterReviewItems(reviewData.items, filter);
    set({ filter, filteredItems, currentIndex: 0 });
  },

  /**
   * Reset review state
   */
  resetReviewState: () => {
    set({ ...initialState });
  },
}));

/**
 * Selectors for common derived state
 */
export const selectCurrentReviewItem = (state: ReviewStore): ReviewItem | null => {
  return state.filteredItems[state.currentIndex] ?? null;
};

export const selectCurrentReviewQuestion = (state: ReviewStore): Question | null => {
  const item = state.filteredItems[state.currentIndex];
  return item?.question ?? null;
};

export const selectHasNextReviewQuestion = (state: ReviewStore): boolean => {
  return state.currentIndex < state.filteredItems.length - 1;
};

export const selectHasPreviousReviewQuestion = (state: ReviewStore): boolean => {
  return state.currentIndex > 0;
};

export const selectReviewProgress = (state: ReviewStore): string => {
  const total = state.filteredItems.length;
  if (total === 0) return '0 / 0';
  return `${state.currentIndex + 1} / ${total}`;
};

export const selectReviewStats = (
  state: ReviewStore,
): { correct: number; incorrect: number; total: number } => {
  if (!state.reviewData) return { correct: 0, incorrect: 0, total: 0 };
  return {
    correct: state.reviewData.correctCount,
    incorrect: state.reviewData.totalQuestions - state.reviewData.correctCount,
    total: state.reviewData.totalQuestions,
  };
};
