export const FREE_QUESTION_LIMIT = 15;
export const DAILY_QUESTION_LIMIT = 15;

export type TierLevel = 'FREE' | 'PREMIUM';

export interface TierConfig {
  level: TierLevel;
  questionLimit: number | null; // null = unlimited
  canTakeFullExams: boolean;
  canViewAnalytics: boolean;
}

export const TIER_CONFIGS: Record<TierLevel, TierConfig> = {
  FREE: {
    level: 'FREE',
    questionLimit: FREE_QUESTION_LIMIT,
    canTakeFullExams: false,
    canViewAnalytics: false,
  },
  PREMIUM: {
    level: 'PREMIUM',
    questionLimit: null,
    canTakeFullExams: true,
    canViewAnalytics: true,
  },
};
