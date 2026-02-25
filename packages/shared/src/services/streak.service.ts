// Streak service — business logic for daily study streaks
import {
  getStudyStreak,
  updateStreakOnCompletion,
  validateStreak,
  setExamDate as setExamDateRepo,
} from '../storage/repositories/streak.repository';
import type { StudyStreak } from '../storage/schema';

export type { StudyStreak };

/**
 * Get today's date as YYYY-MM-DD in the device's local timezone.
 */
export const getLocalToday = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Record an exam completion for streak tracking.
 * Safe to call multiple times per day — only the first call increments.
 */
export const recordExamCompletion = async (): Promise<StudyStreak> => {
  const today = getLocalToday();
  return updateStreakOnCompletion(today);
};

/**
 * Validate and return the current streak, resetting if a day was missed.
 * Call on app launch / screen focus.
 */
export const getCurrentStreak = async (): Promise<StudyStreak> => {
  const today = getLocalToday();
  return validateStreak(today);
};

/**
 * Get the raw streak data without validation (for quick reads).
 */
export const getStreakData = async (): Promise<StudyStreak> => {
  return getStudyStreak();
};

/**
 * Save the target exam date.
 * @param date ISO date string (YYYY-MM-DD) or null to clear.
 */
export const setExamDate = async (date: string | null): Promise<void> => {
  return setExamDateRepo(date);
};

/**
 * Calculate days until the target exam date.
 * Returns null if no exam date is set, or negative if the date has passed.
 */
export const getDaysUntilExam = (examDate: string | null): number | null => {
  if (!examDate) return null;
  const today = new Date(getLocalToday() + 'T00:00:00');
  const target = new Date(examDate + 'T00:00:00');
  const diffMs = target.getTime() - today.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Get motivational text based on streak state.
 */
export const getStreakMotivation = (streak: StudyStreak): string => {
  const { currentStreak, longestStreak, lastCompletionDate } = streak;
  const today = getLocalToday();

  if (currentStreak === 0) {
    return 'Complete an exam to start your streak!';
  }

  const completedToday = lastCompletionDate === today;

  if (completedToday) {
    if (currentStreak >= longestStreak && currentStreak > 1) {
      return "New personal best! You're on fire 🔥";
    }
    if (currentStreak >= 7) {
      return 'Incredible consistency! Keep it up!';
    }
    return 'Great job today! Keep it going!';
  }

  // Haven't completed today yet
  const gap = longestStreak - currentStreak;
  if (gap > 0 && gap <= 3) {
    return `${gap} day${gap > 1 ? 's' : ''} until your best streak!`;
  }

  return '1 exam today to continue your streak';
};

/**
 * Check if the user has already completed an exam today.
 */
export const hasCompletedToday = (streak: StudyStreak): boolean => {
  return streak.lastCompletionDate === getLocalToday();
};
