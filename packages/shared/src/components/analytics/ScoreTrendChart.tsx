// T070: ScoreTrendChart — smooth line chart with SVG
import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, {
  Path,
  Circle,
  Line,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
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

const CHART_HEIGHT = 160;
const Y_AXIS_WIDTH = 32;
const DOT_RADIUS = 5;
const GRID_STEPS = [0, 25, 50, 75, 100];

// ── Smooth cubic bezier path builder ──
function buildSmoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

/**
 * ScoreTrendChart — Smooth line chart with gradient fill
 */
export const ScoreTrendChart: React.FC<ScoreTrendChartProps> = ({
  scoreHistory,
  passingScore = 72,
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

  if (scoreHistory.length <= 2) {
    const latestScore = scoreHistory[scoreHistory.length - 1]?.score ?? 0;
    return (
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Score Trend</Text>
        <View style={styles.earlyContainer}>
          <Text style={styles.earlyScore}>{latestScore}%</Text>
          <Text style={styles.earlyLabel}>
            {scoreHistory.length === 1 ? 'First exam' : '2 exams completed'}
          </Text>
          <Text style={styles.earlyHint}>
            Complete {scoreHistory.length === 1 ? '2 more exams' : '1 more exam'} to see your trend
            chart
          </Text>
        </View>
      </View>
    );
  }

  const trend = calculateTrend(scoreHistory);
  const latestScore = scoreHistory[scoreHistory.length - 1]?.score ?? 0;

  // Chart dimensions
  const screenWidth = Dimensions.get('window').width;
  const chartWidth = screenWidth - 32 - 32 - Y_AXIS_WIDTH; // card margin + card padding + Y axis
  const chartPadTop = 8;
  const chartPadBottom = 24; // room for date labels
  const svgWidth = chartWidth + Y_AXIS_WIDTH;
  const svgHeight = CHART_HEIGHT + chartPadTop + chartPadBottom;

  // Map scores to pixel coords
  const points = scoreHistory.map((entry, i) => {
    const x = Y_AXIS_WIDTH + (i / (scoreHistory.length - 1)) * chartWidth;
    const y = chartPadTop + CHART_HEIGHT - (entry.score / 100) * CHART_HEIGHT;
    return { x, y, score: entry.score, passed: entry.passed, date: entry.date };
  });

  const linePath = buildSmoothPath(points);

  // Area path (close to bottom)
  const areaBottom = chartPadTop + CHART_HEIGHT;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${areaBottom} L ${points[0].x} ${areaBottom} Z`;

  // Passing score Y position
  const passY = chartPadTop + CHART_HEIGHT - (passingScore / 100) * CHART_HEIGHT;

  return (
    <View style={styles.card}>
      {/* Header */}
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
              <TrendingDown size={14} color={colors.primaryOrange} strokeWidth={2} />
              <Text style={[styles.trendText, { color: colors.primaryOrange }]}>Needs Work</Text>
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

      {/* Line Chart */}
      <Svg width={svgWidth} height={svgHeight}>
        <Defs>
          <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primaryOrange} stopOpacity="0.25" />
            <Stop offset="1" stopColor={colors.primaryOrange} stopOpacity="0" />
          </SvgGradient>
        </Defs>

        {/* Horizontal grid lines + Y-axis labels */}
        {GRID_STEPS.map((val) => {
          const gy = chartPadTop + CHART_HEIGHT - (val / 100) * CHART_HEIGHT;
          return (
            <React.Fragment key={val}>
              <Line
                x1={Y_AXIS_WIDTH}
                y1={gy}
                x2={svgWidth}
                y2={gy}
                stroke={colors.borderDefault}
                strokeWidth={1}
                strokeOpacity={0.5}
              />
              <SvgText
                x={Y_AXIS_WIDTH - 6}
                y={gy + 4}
                fill={colors.textMuted}
                fontSize={10}
                fontWeight="500"
                textAnchor="end"
              >
                {val}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Passing score dashed line */}
        <Line
          x1={Y_AXIS_WIDTH}
          y1={passY}
          x2={svgWidth}
          y2={passY}
          stroke={colors.primaryOrange}
          strokeWidth={1}
          strokeDasharray="4,4"
          strokeOpacity={0.5}
        />
        <SvgText
          x={svgWidth}
          y={passY - 5}
          fill={colors.primaryOrange}
          fontSize={9}
          fontWeight="600"
          textAnchor="end"
        >
          Pass {passingScore}%
        </SvgText>

        {/* Gradient fill under curve */}
        <Path d={areaPath} fill="url(#areaGrad)" />

        {/* Smooth line */}
        <Path
          d={linePath}
          stroke={colors.primaryOrange}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {points.map((pt, i) => (
          <React.Fragment key={i}>
            <Circle
              cx={pt.x}
              cy={pt.y}
              r={DOT_RADIUS}
              fill={pt.passed ? colors.success : colors.error}
              stroke={colors.surface}
              strokeWidth={2}
            />
          </React.Fragment>
        ))}

        {/* X-axis date labels */}
        {points.map((pt, i) => {
          // Show first, last, and every ~2nd label to avoid overlap
          if (points.length > 5 && i > 0 && i < points.length - 1 && i % 2 !== 0) return null;
          const d = new Date(pt.date);
          const label = `${d.getMonth() + 1}/${d.getDate()}`;
          return (
            <SvgText
              key={`label-${i}`}
              x={pt.x}
              y={svgHeight - 4}
              fill={colors.textMuted}
              fontSize={9}
              fontWeight="500"
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>

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
    marginBottom: 12,
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
  earlyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 4,
  },
  earlyScore: {
    fontSize: 36,
    fontWeight: '700',
    color: colors.textHeading,
  },
  earlyLabel: {
    fontSize: 14,
    color: colors.textBody,
    fontWeight: '500',
  },
  earlyHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 8,
  },
});

export default ScoreTrendChart;
