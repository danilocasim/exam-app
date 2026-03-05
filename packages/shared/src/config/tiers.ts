export type TierLevel = 'FREE' | 'PREMIUM';

export interface TierConfig {
  level: TierLevel;
  canTakeFullExams: boolean;
  canViewAnalytics: boolean;
}

export const TIER_CONFIGS: Record<TierLevel, TierConfig> = {
  FREE: {
    level: 'FREE',
    canTakeFullExams: false,
    canViewAnalytics: false,
  },
  PREMIUM: {
    level: 'PREMIUM',
    canTakeFullExams: true,
    canViewAnalytics: true,
  },
};
