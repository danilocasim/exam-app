// T070: ScoreTrendChart - Visual score trend over time using RN Views
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import { ScoreHistoryEntry } from '../../services/analytics.service';

// AWS Modern Color Palette
const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  surfaceHover: '#374151',
  borderDefault: '#374151',
  trackGray: '#4B5563',
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  secondaryOrange: '#EC7211',
  orangeDark: 'rgba(255, 153, 0, 0.2)',
  orangeLight: '#FFB84D',
  success: '#10B981',
  successLight: '#6EE7B7',
  successDark: 'rgba(16, 185, 129, 0.15)',
  error: '#EF4444',
  errorLight: '#FCA5A5',
  errorDark: 'rgba(239, 68, 68, 0.15)',
};

interface ScoreTrendChartProps {
  scoreHistory: ScoreHistoryEntry[];
  passingScore?: number;
}

const CHART_HEIGHT = 140;
const BAR_GAP = 6;

/**
 * ScoreTrendChart - Bar chart showing exam score trend
 */
export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({
  scoreHistory,
  passingScore = 70,
}) => {
  if (scoreHistory.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Score Trend</Text>
        <View style={styles.emptyContainer}>
          <TrendingUp size={32} color={colors.trackGray} strokeWidth={1.5} />
          <Text style={styles.emptyText}>Complete exams to see your score trend</Text>
        </View>
      </View>
    );
  }

  // Calculate trend direction
  const trend = calculateTrend(scoreHistory);
  const latestScore = scoreHistory[scoreHistory.length - 1]?.score ?? 0;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardLabel}>Score Trend</Text>
        <View style={styles.trendBadge}>
          {trend === 'improving' && (
            <>
              <TrendingUp size={14} color={colors.success} strokeWidth={2} />
              <Text style={[styles.trendText, { color: colors.success }]}>Improving</Text>
            </>
          )}
          {trend === 'declining' && (
            <>
              <TrendingDown size={14} color={colors.error} strokeWidth={2} />
              <Text style={[styles.trendText, { color: colors.error }]}>Declining</Text>
            </>
          )}
          {trend === 'stable' && (
            <>
              <Minus size={14} color={colors.primaryOrange} strokeWidth={2} />
              <Text style={[styles.trendText, { color: colors.primaryOrange }]}>Stable</Text>
            </>
          )}
        </View>
      </View>

      {/* Bar Chart */}
      <View style={styles.chartContainer}>
        {/* Passing score line */}
        <View style={[styles.passLine, { bottom: (passingScore / 100) * CHART_HEIGHT }]}>
          <Text style={styles.passLineLabel}>{passingScore}%</Text>
          <View style={styles.passLineDash} />
        </View>

        {/* Bars */}
        <View style={styles.barsContainer}>
          {scoreHistory.map((entry, index) => {
            const barHeight = (entry.score / 100) * CHART_HEIGHT;
            const barColor = entry.passed ? colors.success : colors.error;
            const date = new Date(entry.date);
            const label = `${date.getMonth() + 1}/${date.getDate()}`;

            return (
              <View key={index} style={styles.barWrapper}>
                <Text style={styles.barValue}>{entry.score}%</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: Math.max(barHeight, 4),
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Latest score highlight */}
      <View style={styles.latestRow}>
        <Text style={styles.latestLabel}>Latest Score</Text>
        <Text
          style={[
            styles.latestValue,
            { color: latestScore >= passingScore ? colors.success : colors.error },
          ]}
        >
          {latestScore}%
        </Text>
      </View>
    </View>
  );
};

/**
 * Calculate score trend from history
 */
const calculateTrend = (history: ScoreHistoryEntry[]): 'improving' | 'declining' | 'stable' => {
  if (history.length < 2) return 'stable';

  const half = Math.floor(history.length / 2);
  const olderHalf = history.slice(0, half);
  const recentHalf = history.slice(half);

  const olderAvg = olderHalf.reduce((sum, e) => sum + e.score, 0) / olderHalf.length;
  const recentAvg = recentHalf.reduce((sum, e) => sum + e.score, 0) / recentHalf.length;

  const diff = recentAvg - olderAvg;
  if (diff >= 5) return 'improving';
  if (diff <= -5) return 'declining';
  return 'stable';
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  chartContainer: {
    height: CHART_HEIGHT + 40,
    position: 'relative',
  },
  passLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 1,
  },
  passLineLabel: {
    fontSize: 10,
    color: colors.primaryOrange,
    fontWeight: '600',
    width: 30,
  },
  passLineDash: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: colors.primaryOrange,
    opacity: 0.4,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: CHART_HEIGHT,
    paddingLeft: 34,
    gap: BAR_GAP,
    marginTop: 10,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    maxWidth: 40,
  },
  barValue: {
    fontSize: 9,
    color: colors.textMuted,
    fontWeight: '600',
    marginBottom: 2,
  },
  barTrack: {
    width: '100%',
    height: CHART_HEIGHT,
    backgroundColor: colors.surfaceHover,
    borderRadius: 4,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  bar: {
    width: '100%',
    borderRadius: 4,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
  },
  latestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  latestLabel: {
    fontSize: 13,
    color: colors.textBody,
  },
  latestValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default ScoreTrendChart;
