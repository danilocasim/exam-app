// StreakCard — motivational streak display for HomeScreen
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Flame, Trophy } from 'lucide-react-native';

// AWS Modern Color Palette
const colors = {
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  orangeLight: '#FFB84D',
  orangeDark: 'rgba(255, 153, 0, 0.2)',
  success: '#10B981',
  surface: '#1F2937',
  borderDefault: '#374151',
};

export interface StreakCardProps {
  currentStreak: number;
  longestStreak: number;
  motivation: string;
  completedToday: boolean;
  daysUntilExam: number | null;
}

/**
 * StreakCard — shows current daily streak with motivational context.
 * Replaces the promo/upgrade banner on the HomeScreen.
 */
export const StreakCard: React.FC<StreakCardProps> = ({
  currentStreak,
  longestStreak,
  motivation,
  completedToday,
  daysUntilExam,
}) => {
  // Fire is lit (colored) only when today's streak goal is accomplished
  const isLit = completedToday;

  // Dynamic glow ring color
  const accentColor = isLit ? colors.primaryOrange : colors.textMuted;

  // Streak dots: show the last 7 days worth
  const dotCount = 7;
  const filledDots = Math.min(currentStreak, dotCount);

  return (
    <View style={st.wrapper}>
      <LinearGradient
        colors={
          isLit
            ? ['rgba(255, 153, 0, 0.12)', 'rgba(31, 41, 55, 0)']
            : ['rgba(255, 153, 0, 0.06)', 'rgba(31, 41, 55, 0)']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={st.card}
      >
        {/* ── Top Row: Streak + Decorative ── */}
        <View style={st.topRow}>
          {/* Left: Streak number */}
          <View style={st.streakSection}>
            <View style={[st.flameCircle, { borderColor: accentColor }]}>
              <Flame
                size={22}
                color={isLit ? colors.primaryOrange : colors.textMuted}
                strokeWidth={2}
                fill={isLit ? 'rgba(255, 153, 0, 0.3)' : 'none'}
              />
            </View>
            <View>
              <Text style={st.streakNumber}>{currentStreak}</Text>
              <Text style={st.streakLabel}>Day Streak</Text>
            </View>
          </View>

          {/* Right: Decorative shape + best badge */}
          <View style={st.rightSection}>
            {longestStreak > 0 && (
              <View style={st.bestBadge}>
                <Trophy size={11} color={colors.orangeLight} strokeWidth={2} />
                <Text style={st.bestText}>Best: {longestStreak}</Text>
              </View>
            )}
            {/* Moon-like decorative circle */}
            <View style={st.decorCircleOuter}>
              <View style={st.decorCircleInner} />
            </View>
          </View>
        </View>

        {/* ── Progress Dots ── */}
        <View style={st.dotsRow}>
          {Array.from({ length: dotCount }).map((_, i) => (
            <View
              key={i}
              style={[
                st.dot,
                i < filledDots
                  ? { backgroundColor: colors.primaryOrange }
                  : { backgroundColor: 'rgba(255, 255, 255, 0.08)' },
              ]}
            />
          ))}
        </View>

        {/* ── Bottom: Motivation text ── */}
        <View style={st.bottomRow}>
          <Text style={st.motivationText}>{motivation}</Text>
          {daysUntilExam !== null && daysUntilExam > 0 && (
            <View style={st.countdownPill}>
              <Text style={st.countdownText}>{daysUntilExam}d to exam</Text>
            </View>
          )}
        </View>
      </LinearGradient>
    </View>
  );
};

const st = StyleSheet.create({
  wrapper: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  card: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 153, 0, 0.15)',
  },

  // Top row
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  streakSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flameCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 153, 0, 0.08)',
  },
  streakNumber: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textHeading,
    lineHeight: 36,
  },
  streakLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: -2,
  },

  // Right decorative
  rightSection: {
    alignItems: 'flex-end',
    gap: 8,
  },
  bestBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.orangeDark,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  bestText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.orangeLight,
  },
  decorCircleOuter: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 153, 0, 0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  decorCircleInner: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 153, 0, 0.15)',
  },

  // Dots
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 12,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },

  // Bottom
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  motivationText: {
    fontSize: 13,
    color: colors.textBody,
    flex: 1,
    marginRight: 8,
  },
  countdownPill: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countdownText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
});

export default StreakCard;
