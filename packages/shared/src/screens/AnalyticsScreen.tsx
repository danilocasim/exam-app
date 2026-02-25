// T069 + T073: AnalyticsScreen - Performance dashboard (inspiration-aligned layout)
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  RefreshControl,
  Dimensions,
} from 'react-native';
import Svg, {
  Path,
  Circle as SvgCircle,
  Line as SvgLine,
  Defs,
  LinearGradient as SvgGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  BarChart2,
  Trophy,
  Target,
  AlertTriangle,
  BookOpen,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAnalyticsStore, selectHasData } from '../stores/analytics.store';
import { useStreakStore } from '../stores/streak.store';
import { useExamStore } from '../stores';
import { abandonCurrentExam } from '../services';
import { getInProgressExamAttempt } from '../storage/repositories/exam-attempt.repository';
import { ScoreHistoryEntry, StudyStats, WeakDomain } from '../services/analytics.service';
import { DomainScore } from '../storage/schema';

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
  warning: '#F59E0B',
  warningDark: 'rgba(245, 158, 11, 0.15)',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Analytics'>;

type TimeRange = 'week' | 'month' | 'quarter';

/* ────────────────────────────────────────────────────────────
 * Main Screen
 * ──────────────────────────────────────────────────────────── */

export const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { startExam } = useExamStore();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const { streak, completedToday, loadStreak } = useStreakStore();

  const handleStartExam = async () => {
    try {
      await startExam();
      navigation.navigate('ExamScreen', {});
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('already in progress')) {
        try {
          const inProgress = await getInProgressExamAttempt();
          if (inProgress) await abandonCurrentExam(inProgress.id);
          await startExam();
          navigation.navigate('ExamScreen', {});
          return;
        } catch {
          // fall through
        }
      }
      Alert.alert('Error', message || 'Failed to start exam');
    }
  };

  const { analyticsData, isLoading, error } = useAnalyticsStore(
    useShallow((state) => ({
      analyticsData: state.analyticsData,
      isLoading: state.isLoading,
      error: state.error,
    })),
  );
  const { loadAnalytics, refresh } = useAnalyticsStore(
    useShallow((state) => ({
      loadAnalytics: state.loadAnalytics,
      refresh: state.refresh,
    })),
  );
  const hasData = useAnalyticsStore(selectHasData);

  // Load analytics on focus
  useFocusEffect(
    useCallback(() => {
      loadAnalytics();
      loadStreak();
    }, [loadAnalytics, loadStreak]),
  );

  /* ── Loading ── */
  if (isLoading && !analyticsData) {
    return (
      <SafeAreaView style={st.safeArea} edges={['top']}>
        <Header onBack={() => navigation.goBack()} />
        <View style={st.centeredContainer}>
          <ActivityIndicator size="large" color={colors.primaryOrange} />
          <Text style={st.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Error ── */
  if (error && !analyticsData) {
    return (
      <SafeAreaView style={st.safeArea} edges={['top']}>
        <Header onBack={() => (navigation as any).navigate('HomeTab')} />
        <View style={st.centeredContainer}>
          <AlertTriangle size={48} color={colors.error} strokeWidth={1.5} />
          <Text style={st.errorText}>{error}</Text>
          <TouchableOpacity style={st.retryButton} onPress={loadAnalytics}>
            <Text style={st.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={st.safeArea} edges={['top']}>
      <Header onBack={() => (navigation as any).navigate('HomeTab')} />

      <ScrollView
        style={st.scrollView}
        contentContainerStyle={[st.scrollContent, { paddingBottom: Math.max(32, insets.bottom) }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refresh}
            tintColor={colors.primaryOrange}
          />
        }
      >
        {/* Empty state */}
        {!hasData && (
          <View style={st.emptyCard}>
            <BarChart2 size={48} color={colors.trackGray} strokeWidth={1.5} />
            <Text style={st.emptyTitle}>No Data Yet</Text>
            <Text style={st.emptySubtext}>
              Complete exams and practice sessions to see your performance analytics.
            </Text>
            <TouchableOpacity style={st.startButton} onPress={handleStartExam}>
              <Text style={st.startButtonText}>Start Studying</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Dashboard ── */}
        {hasData && analyticsData && (
          <>
            {/* 1 ── Top Summary Cards (side by side) */}
            <SummaryCards
              passRate={analyticsData.overallStats.passRate}
              averageScore={analyticsData.overallStats.averageScore}
              currentStreak={streak?.currentStreak ?? 0}
              longestStreak={streak?.longestStreak ?? 0}
              completedToday={completedToday}
            />

            {/* 2 ── Time Range Selector */}
            <TimeRangeSelector value={timeRange} onChange={setTimeRange} />

            {/* 3 ── Statistics Overview Row */}
            <StatsOverviewRow studyStats={analyticsData.studyStats} />

            {/* 4 ── Score Trend Chart */}
            <ScoreChart scoreHistory={analyticsData.scoreHistory} />

            {/* 5 ── Domain / Subject Analysis */}
            <SectionTitle label="Subject Analysis" />
            <DomainCards domains={analyticsData.domainPerformance} />

            {/* 6 ── Weak Domains */}
            {analyticsData.weakDomains.length > 0 &&
              analyticsData.domainPerformance.some((d) => d.percentage >= 70) && (
                <WeakDomainsSection
                  weakDomains={analyticsData.weakDomains}
                  onPractice={() => navigation.navigate('PracticeSetup')}
                />
              )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/* ────────────────────────────────────────────────────────────
 * 1 ─ Header
 * ──────────────────────────────────────────────────────────── */

const Header: React.FC<{ onBack: () => void }> = ({ onBack }) => (
  <View style={st.header}>
    <TouchableOpacity onPress={onBack} style={st.backButton}>
      <ArrowLeft size={20} color={colors.textHeading} strokeWidth={2} />
    </TouchableOpacity>
    <Text style={st.headerTitle}>Stats</Text>
    <View style={st.headerSpacer} />
    {/* Decorative accent shape */}
    <View style={st.headerAccent} />
  </View>
);

/* ────────────────────────────────────────────────────────────
 * 2 ─ Summary Cards (two side-by-side)
 * ──────────────────────────────────────────────────────────── */

interface SummaryCardsProps {
  passRate: number;
  averageScore: number | null;
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
}

// Day-of-week labels starting from Monday
const ALL_DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DOT_SIZE = 18;

/** Build the 7-day label array ending on the current weekday */
function getWeekDayLabels(): string[] {
  // JS getDay(): 0=Sun,1=Mon,...,6=Sat → convert to Mon-based: 0=Mon,...,6=Sun
  const jsDay = new Date().getDay();
  const monBased = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon,...,6=Sun
  // We want 7 labels ending with today
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const idx = (monBased - i + 7) % 7;
    labels.push(ALL_DAY_LABELS[idx]);
  }
  return labels;
}

const SummaryCards: React.FC<SummaryCardsProps> = ({
  passRate,
  averageScore,
  currentStreak,
  longestStreak,
  completedToday,
}) => {
  const dayLabels = getWeekDayLabels();
  const activeDays = Math.min(currentStreak, 7);
  const streakColor =
    currentStreak >= 7 ? '#EF4444' : currentStreak >= 3 ? colors.primaryOrange : colors.textMuted;

  return (
    <View style={st.summaryRow}>
      {/* Left – Streak */}
      <View style={st.summaryCard}>
        <View style={st.summaryCardHeader}>
          <View style={[st.summaryIconWrap, { backgroundColor: colors.orangeDark }]}>
            <Flame
              size={16}
              color={streakColor}
              strokeWidth={2}
              fill={currentStreak >= 3 ? streakColor : 'none'}
            />
          </View>
          <Text style={st.summaryCardLabel}>Streak</Text>
          {longestStreak > 0 && (
            <View style={st.streakBest}>
              <Trophy size={9} color={colors.primaryOrange} strokeWidth={2} />
              <Text style={st.streakBestText}>{longestStreak}</Text>
            </View>
          )}
        </View>
        <View style={st.streakValueRow}>
          <Text style={st.summaryCardValue}>{currentStreak}</Text>
          <View style={st.streakLabelCol}>
            <Text style={st.streakSubLabel}>day{currentStreak !== 1 ? 's' : ''}</Text>
            {completedToday && <Text style={st.streakDoneLabel}>Done ✓</Text>}
          </View>
        </View>
        {/* 7-day dots */}
        <View
          style={st.streakDotsRow}
          accessibilityLabel={`Current streak: ${currentStreak} days`}
          accessibilityRole="text"
        >
          {dayLabels.map((label, i) => {
            const isActive = i >= 7 - activeDays;
            const isToday = i === 6;
            return (
              <View key={i} style={st.streakDayCol}>
                <View
                  style={[
                    st.streakDot,
                    isActive && st.streakDotActive,
                    isToday && completedToday && st.streakDotToday,
                  ]}
                >
                  {isActive && <View style={st.streakDotInner} />}
                </View>
                <Text style={[st.streakDayLabel, isToday && st.streakDayLabelToday]}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Right – Accuracy */}
      <View style={st.summaryCard}>
        <View style={st.summaryCardHeader}>
          <View style={[st.summaryIconWrap, { backgroundColor: colors.successDark }]}>
            <Target size={16} color={colors.success} strokeWidth={2} />
          </View>
          <Text style={st.summaryCardLabel}>Accuracy</Text>
        </View>
        <Text style={st.summaryCardValue}>{averageScore !== null ? `${averageScore}%` : '--'}</Text>
        <Text style={st.summaryCardSub}>Pass Rate: {passRate}%</Text>
        <View style={st.summaryProgressTrack}>
          <View
            style={[
              st.summaryProgressFill,
              {
                width: `${averageScore !== null ? Math.min(averageScore, 100) : 0}%`,
                backgroundColor: colors.success,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

/* ────────────────────────────────────────────────────────────
 * 3 ─ Time Range Selector (pill tabs)
 * ──────────────────────────────────────────────────────────── */

const TIME_RANGES: { key: TimeRange; label: string }[] = [
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'quarter', label: 'Quarter' },
];

const TimeRangeSelector: React.FC<{ value: TimeRange; onChange: (v: TimeRange) => void }> = ({
  value,
  onChange,
}) => (
  <View style={st.timeRangeContainer}>
    {TIME_RANGES.map((range) => {
      const active = value === range.key;
      return (
        <TouchableOpacity
          key={range.key}
          style={[st.timeRangePill, active && st.timeRangePillActive]}
          onPress={() => onChange(range.key)}
          activeOpacity={0.7}
        >
          <Text style={[st.timeRangeText, active && st.timeRangeTextActive]}>{range.label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

/* ────────────────────────────────────────────────────────────
 * 4 ─ Stats Overview Row (3 metrics horizontal)
 * ──────────────────────────────────────────────────────────── */

const StatsOverviewRow: React.FC<{ studyStats: StudyStats }> = ({ studyStats }) => (
  <View style={st.overviewRow}>
    <View style={st.overviewItem}>
      <Text style={st.overviewValue}>{studyStats.totalExams + studyStats.totalPractice}</Text>
      <Text style={st.overviewLabel}>In Total</Text>
    </View>
    <View style={st.overviewDivider} />
    <View style={st.overviewItem}>
      <Text style={st.overviewValue}>{studyStats.totalQuestions}</Text>
      <Text style={st.overviewLabel}>Questions</Text>
    </View>
    <View style={st.overviewDivider} />
    <View style={st.overviewItem}>
      <Text style={st.overviewValue}>
        {studyStats.totalTimeSpentMs > 0 ? studyStats.totalTimeSpent : '0s'}
      </Text>
      <Text style={st.overviewLabel}>Time Spent</Text>
    </View>
  </View>
);

/* ────────────────────────────────────────────────────────────
 * 5 ─ Score Chart (smooth line chart with SVG)
 * ──────────────────────────────────────────────────────────── */

const CHART_HEIGHT = 150;
const Y_AXIS_W = 28;
const DOT_R = 4.5;
const GRID_STEPS = [0, 25, 50, 75, 100];

function buildSmoothPath(pts: { x: number; y: number }[]): string {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(i + 2, pts.length - 1)];
    const t = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;
    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

const ScoreChart: React.FC<{ scoreHistory: ScoreHistoryEntry[]; passingScore?: number }> = ({
  scoreHistory,
  passingScore = 72,
}) => {
  if (scoreHistory.length === 0) {
    return (
      <View style={st.chartCard}>
        <Text style={st.sectionLabel}>Score Trend</Text>
        <View style={st.chartEmpty}>
          <TrendingUp size={28} color={colors.trackGray} strokeWidth={1.5} />
          <Text style={st.chartEmptyText}>Complete exams to see your score trend</Text>
        </View>
      </View>
    );
  }

  if (scoreHistory.length <= 2) {
    const latestScore = scoreHistory[scoreHistory.length - 1]?.score ?? 0;
    return (
      <View style={st.chartCard}>
        <Text style={st.sectionLabel}>Score Trend</Text>
        <View style={st.chartEarly}>
          <Text style={st.chartEarlyScore}>{latestScore}%</Text>
          <Text style={st.chartEarlyLabel}>
            {scoreHistory.length === 1 ? 'First exam' : '2 exams completed'}
          </Text>
          <Text style={st.chartEarlyHint}>
            Complete {scoreHistory.length === 1 ? '2 more exams' : '1 more exam'} to see your trend
          </Text>
        </View>
      </View>
    );
  }

  const trend = calculateTrend(scoreHistory);
  const latestScore = scoreHistory[scoreHistory.length - 1]?.score ?? 0;

  const screenWidth = Dimensions.get('window').width;
  const padRight = 8;
  const chartWidth = screenWidth - GAP * 2 - CARD_PAD * 2 - Y_AXIS_W - padRight;
  const padTop = 8;
  const padBot = 22;
  const svgW = chartWidth + Y_AXIS_W + padRight;
  const svgH = CHART_HEIGHT + padTop + padBot;

  const points = scoreHistory.map((entry, i) => ({
    x: Y_AXIS_W + (i / (scoreHistory.length - 1)) * chartWidth,
    y: padTop + CHART_HEIGHT - (entry.score / 100) * CHART_HEIGHT,
    score: entry.score,
    passed: entry.passed,
    date: entry.date,
  }));

  const linePath = buildSmoothPath(points);
  const areaBottom = padTop + CHART_HEIGHT;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${areaBottom} L ${points[0].x} ${areaBottom} Z`;
  const passY = padTop + CHART_HEIGHT - (passingScore / 100) * CHART_HEIGHT;

  return (
    <View style={st.chartCard}>
      <View style={st.chartHeader}>
        <Text style={st.sectionLabel}>Score Trend</Text>
        <View style={st.trendBadge}>
          {trend === 'improving' && (
            <>
              <TrendingUp size={13} color={colors.success} strokeWidth={2} />
              <Text style={[st.trendText, { color: colors.success }]}>Improving</Text>
            </>
          )}
          {trend === 'declining' && (
            <>
              <TrendingDown size={13} color={colors.primaryOrange} strokeWidth={2} />
              <Text style={[st.trendText, { color: colors.primaryOrange }]}>Needs Work</Text>
            </>
          )}
          {trend === 'stable' && (
            <>
              <Minus size={13} color={colors.primaryOrange} strokeWidth={2} />
              <Text style={[st.trendText, { color: colors.primaryOrange }]}>Stable</Text>
            </>
          )}
        </View>
      </View>

      <Svg width={svgW} height={svgH}>
        <Defs>
          <SvgGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.primaryOrange} stopOpacity="0.25" />
            <Stop offset="1" stopColor={colors.primaryOrange} stopOpacity="0" />
          </SvgGradient>
        </Defs>

        {/* Grid lines + Y labels */}
        {GRID_STEPS.map((val) => {
          const gy = padTop + CHART_HEIGHT - (val / 100) * CHART_HEIGHT;
          return (
            <React.Fragment key={val}>
              <SvgLine
                x1={Y_AXIS_W}
                y1={gy}
                x2={svgW}
                y2={gy}
                stroke={colors.borderDefault}
                strokeWidth={1}
                strokeOpacity={0.5}
              />
              <SvgText
                x={Y_AXIS_W - 4}
                y={gy + 3.5}
                fill={colors.textMuted}
                fontSize={9}
                fontWeight="500"
                textAnchor="end"
              >
                {val}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Passing score dashed line */}
        <SvgLine
          x1={Y_AXIS_W}
          y1={passY}
          x2={svgW}
          y2={passY}
          stroke={colors.primaryOrange}
          strokeWidth={1}
          strokeDasharray="4,4"
          strokeOpacity={0.5}
        />
        <SvgText
          x={svgW}
          y={passY - 4}
          fill={colors.primaryOrange}
          fontSize={8}
          fontWeight="600"
          textAnchor="end"
        >
          Pass {passingScore}%
        </SvgText>

        {/* Gradient area */}
        <Path d={areaPath} fill="url(#areaFill)" />

        {/* Smooth line */}
        <Path
          d={linePath}
          stroke={colors.primaryOrange}
          strokeWidth={2.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data dots */}
        {points.map((pt, i) => (
          <SvgCircle
            key={i}
            cx={pt.x}
            cy={pt.y}
            r={DOT_R}
            fill={pt.passed ? colors.success : colors.error}
            stroke={colors.surface}
            strokeWidth={2}
          />
        ))}

        {/* X-axis labels */}
        {points.map((pt, i) => {
          if (points.length > 5 && i > 0 && i < points.length - 1 && i % 2 !== 0) return null;
          const d = new Date(pt.date);
          const label = `${d.getMonth() + 1}/${d.getDate()}`;
          return (
            <SvgText
              key={`lbl-${i}`}
              x={pt.x}
              y={svgH - 3}
              fill={colors.textMuted}
              fontSize={8}
              fontWeight="500"
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>

      <View style={st.latestRow}>
        <Text style={st.latestLabel}>Latest Score</Text>
        <Text
          style={[
            st.latestValue,
            { color: latestScore >= passingScore ? colors.success : colors.error },
          ]}
        >
          {latestScore}%
        </Text>
      </View>
    </View>
  );
};

const calculateTrend = (history: ScoreHistoryEntry[]): 'improving' | 'declining' | 'stable' => {
  if (history.length < 2) return 'stable';
  const half = Math.floor(history.length / 2);
  const olderAvg = history.slice(0, half).reduce((sum, e) => sum + e.score, 0) / half;
  const recentAvg =
    history.slice(half).reduce((sum, e) => sum + e.score, 0) / (history.length - half);
  const diff = recentAvg - olderAvg;
  if (diff >= 5) return 'improving';
  if (diff <= -5) return 'declining';
  return 'stable';
};

/* ────────────────────────────────────────────────────────────
 * 6 ─ Section Title
 * ──────────────────────────────────────────────────────────── */

const SectionTitle: React.FC<{ label: string }> = ({ label }) => (
  <Text style={st.sectionTitleStandalone}>{label}</Text>
);

/* ────────────────────────────────────────────────────────────
 * 7 ─ Domain Cards (stacked, with 2×2 metrics grid)
 * ──────────────────────────────────────────────────────────── */

const STRONG_THRESHOLD = 80;
const MODERATE_THRESHOLD = 70;

const getStrength = (pct: number) => {
  if (pct >= STRONG_THRESHOLD) return { color: colors.success, bg: colors.successDark };
  if (pct >= MODERATE_THRESHOLD) return { color: colors.warning, bg: colors.warningDark };
  return { color: colors.error, bg: colors.errorDark };
};

const getStrengthIcon = (pct: number) => {
  if (pct >= STRONG_THRESHOLD)
    return <CheckCircle2 size={10} color={colors.success} strokeWidth={2.5} />;
  if (pct >= MODERATE_THRESHOLD)
    return <AlertCircle size={10} color={colors.warning} strokeWidth={2.5} />;
  return <XCircle size={10} color={colors.error} strokeWidth={2.5} />;
};

const DomainCards: React.FC<{ domains: DomainScore[] }> = ({ domains }) => {
  if (domains.length === 0) {
    return (
      <View style={st.domainEmptyCard}>
        <Text style={st.domainEmptyText}>Complete exams to see domain performance</Text>
      </View>
    );
  }

  const sorted = [...domains].sort((a, b) => a.percentage - b.percentage);

  return (
    <>
      {sorted.map((domain) => {
        const strength = getStrength(domain.percentage);
        return (
          <View key={domain.domainId} style={st.domainCard}>
            {/* Header row: icon · title · percentage · status dot */}
            <View style={st.domainHeaderRow}>
              <View style={st.domainIconWrap}>
                <BookOpen size={14} color={colors.primaryOrange} strokeWidth={2} />
              </View>
              <Text style={st.domainTitle} numberOfLines={2}>
                {domain.domainName}
              </Text>
              <Text style={[st.domainPct, { color: strength.color }]}>{domain.percentage}%</Text>
              <View style={st.domainStatusDot}>{getStrengthIcon(domain.percentage)}</View>
            </View>

            {/* Progress bar */}
            <View style={st.domainProgressTrack}>
              <View
                style={[
                  st.domainProgressFill,
                  {
                    width: `${Math.min(domain.percentage, 100)}%`,
                    backgroundColor: strength.color,
                  },
                ]}
              />
            </View>

            {/* 2×2 metrics grid */}
            <View style={st.domainMetricsGrid}>
              <View style={st.domainMetric}>
                <Target size={12} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={st.domainMetricValue}>{domain.total}</Text>
                <Text style={st.domainMetricLabel}>Questions</Text>
              </View>
              <View style={st.domainMetric}>
                <Clock size={12} color={colors.textMuted} strokeWidth={1.5} />
                <Text style={st.domainMetricValue}>{domain.correct}</Text>
                <Text style={st.domainMetricLabel}>Correct</Text>
              </View>
              <View style={st.domainMetric}>
                <CheckCircle2 size={12} color={colors.success} strokeWidth={1.5} />
                <Text style={[st.domainMetricValue, { color: colors.success }]}>
                  {domain.percentage}%
                </Text>
                <Text style={st.domainMetricLabel}>Score</Text>
              </View>
              <View style={st.domainMetric}>
                <XCircle size={12} color={colors.error} strokeWidth={1.5} />
                <Text style={[st.domainMetricValue, { color: colors.error }]}>
                  {domain.total - domain.correct}
                </Text>
                <Text style={st.domainMetricLabel}>Missed</Text>
              </View>
            </View>
          </View>
        );
      })}
    </>
  );
};

/* ────────────────────────────────────────────────────────────
 * 8 ─ Weak Domains Section
 * ──────────────────────────────────────────────────────────── */

interface WeakDomainsSectionProps {
  weakDomains: WeakDomain[];
  onPractice: (domainId: string) => void;
}

const WeakDomainsSection: React.FC<WeakDomainsSectionProps> = ({ weakDomains, onPractice }) => (
  <View style={st.weakCard}>
    <View style={st.weakAccent} />
    <View style={st.weakContent}>
      <View style={st.weakHeader}>
        <AlertTriangle size={14} color={colors.primaryOrange} strokeWidth={2} />
        <Text style={st.weakTitle}>Areas to Improve</Text>
      </View>
      <Text style={st.weakSubtext}>
        These domains are below 70%. Focus your practice sessions here.
      </Text>

      {weakDomains.map((domain) => (
        <View key={domain.domainId} style={st.weakDomainRow}>
          <View style={st.weakDomainInfo}>
            <Text style={st.weakDomainName}>{domain.domainName}</Text>
            <View style={st.weakProgressRow}>
              <View style={st.weakProgressBar}>
                <View
                  style={[st.weakProgressFill, { width: `${Math.min(domain.percentage, 100)}%` }]}
                />
              </View>
              <Text style={st.weakPercentage}>{domain.percentage}%</Text>
            </View>
            <Text style={st.weakGapText}>
              {domain.gap} pts below passing • {domain.correct}/{domain.total} correct
            </Text>
          </View>
          <TouchableOpacity
            style={st.practiceButton}
            onPress={() => onPractice(domain.domainId)}
            activeOpacity={0.7}
          >
            <Text style={st.practiceButtonText}>Practice</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  </View>
);

/* ────────────────────────────────────────────────────────────
 * Styles
 * ──────────────────────────────────────────────────────────── */

const CARD_RADIUS = 14;
const CARD_PAD = 14;
const GAP = 12;

const st = StyleSheet.create({
  /* ── Layout ── */
  safeArea: { flex: 1, backgroundColor: colors.background },
  scrollView: { flex: 1, backgroundColor: colors.background },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },
  centeredContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    paddingHorizontal: 40,
  },
  loadingText: { color: colors.textMuted, fontSize: 15 },
  errorText: { color: colors.errorLight, fontSize: 14, textAlign: 'center' },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.primaryOrange,
    borderRadius: 10,
    marginTop: 4,
  },
  retryText: { color: colors.textHeading, fontWeight: 'bold', fontSize: 14 },

  /* ── Header ── */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    position: 'relative',
    overflow: 'hidden',
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textHeading,
  },
  headerSpacer: { width: 34 },
  headerAccent: {
    position: 'absolute',
    top: -30,
    right: -20,
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.orangeDark,
    opacity: 0.35,
  },

  /* ── Empty State ── */
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    marginTop: 32,
    gap: 10,
  },
  emptyTitle: { fontSize: 17, fontWeight: 'bold', color: colors.textHeading },
  emptySubtext: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 19 },
  startButton: {
    paddingHorizontal: 22,
    paddingVertical: 10,
    backgroundColor: colors.primaryOrange,
    borderRadius: 10,
    marginTop: 6,
  },
  startButtonText: { color: colors.textHeading, fontWeight: 'bold', fontSize: 14 },

  /* ── Summary Cards ── */
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: GAP },
  summaryCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: 10,
    paddingVertical: CARD_PAD,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  summaryCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  summaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCardLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  summaryCardValue: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.textHeading,
    marginBottom: 2,
  },
  summaryCardSub: { fontSize: 11, color: colors.textMuted, marginBottom: 8 },
  summaryProgressTrack: {
    height: 4,
    backgroundColor: colors.trackGray,
    borderRadius: 2,
    overflow: 'hidden',
  },
  summaryProgressFill: { height: '100%', borderRadius: 2 },

  /* ── Time Range Selector ── */
  timeRangeContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: 3,
    marginBottom: GAP,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  timeRangePill: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  timeRangePillActive: { backgroundColor: colors.primaryOrange },
  timeRangeText: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  timeRangeTextActive: { color: colors.textHeading },

  /* ── Stats Overview Row ── */
  overviewRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    padding: CARD_PAD,
    marginBottom: GAP,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  overviewItem: { flex: 1, alignItems: 'center' },
  overviewValue: { fontSize: 18, fontWeight: 'bold', color: colors.textHeading, marginBottom: 2 },
  overviewLabel: { fontSize: 11, color: colors.textMuted },
  overviewDivider: { width: 1, height: 32, backgroundColor: colors.borderDefault },

  /* ── Chart ── */
  chartCard: {
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    paddingHorizontal: CARD_PAD,
    paddingTop: CARD_PAD,
    paddingBottom: 10,
    marginBottom: GAP,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  trendText: { fontSize: 11, fontWeight: '600' },
  latestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  latestLabel: { fontSize: 12, color: colors.textBody },
  latestValue: { fontSize: 17, fontWeight: 'bold' },
  chartEmpty: { alignItems: 'center', paddingVertical: 28, gap: 10 },
  chartEmptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
  chartEarly: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  chartEarlyScore: { fontSize: 36, fontWeight: 'bold', color: colors.textHeading },
  chartEarlyLabel: { fontSize: 13, color: colors.textBody },
  chartEarlyHint: { fontSize: 12, color: colors.textMuted, marginTop: 4 },

  /* ── Section Title (standalone) ── */
  sectionTitleStandalone: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 4,
  },

  /* ── Domain Cards ── */
  domainCard: {
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    padding: CARD_PAD,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  domainHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  domainIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: colors.orangeDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  domainTitle: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textHeading,
    marginRight: 6,
  },
  domainPct: { fontSize: 15, fontWeight: 'bold', marginRight: 6 },
  domainStatusDot: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  domainProgressTrack: {
    height: 6,
    backgroundColor: colors.trackGray,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  domainProgressFill: { height: '100%', borderRadius: 3 },
  domainMetricsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  domainMetric: {
    width: '50%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 5,
  },
  domainMetricValue: { fontSize: 13, fontWeight: '700', color: colors.textHeading },
  domainMetricLabel: { fontSize: 11, color: colors.textMuted },
  domainEmptyCard: {
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    marginBottom: GAP,
  },
  domainEmptyText: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },

  /* ── Weak Domains ── */
  weakCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    marginBottom: GAP,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    overflow: 'hidden',
    marginTop: 4,
  },
  weakAccent: { width: 4, backgroundColor: colors.primaryOrange },
  weakContent: { flex: 1, padding: CARD_PAD },
  weakHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  weakTitle: { fontSize: 14, fontWeight: '600', color: colors.textHeading },
  weakSubtext: { fontSize: 12, color: colors.textMuted, marginBottom: 12 },
  weakDomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  weakDomainInfo: { flex: 1, marginRight: 10 },
  weakDomainName: { fontSize: 13, fontWeight: '600', color: colors.textHeading, marginBottom: 5 },
  weakProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 },
  weakProgressBar: {
    flex: 1,
    height: 5,
    backgroundColor: colors.trackGray,
    borderRadius: 3,
    overflow: 'hidden',
  },
  weakProgressFill: { height: '100%', backgroundColor: colors.primaryOrange, borderRadius: 3 },
  weakPercentage: {
    fontSize: 12,
    fontWeight: 'bold',
    color: colors.primaryOrange,
    width: 34,
    textAlign: 'right',
  },
  weakGapText: { fontSize: 10, color: colors.textMuted },
  practiceButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.primaryOrange,
    borderRadius: 8,
  },
  practiceButtonText: { color: colors.textHeading, fontWeight: '600', fontSize: 12 },

  /* ── Streak (inside left summary card) ── */
  streakBest: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(255,153,0,0.12)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 8,
    marginLeft: 'auto' as const,
  },
  streakBestText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primaryOrange,
  },
  streakValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 0,
    marginBottom: 4,
  },
  streakLabelCol: {
    justifyContent: 'center',
  },
  streakSubLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  streakDoneLabel: {
    fontSize: 9,
    color: colors.success,
    fontWeight: '600',
  },
  streakDotsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    marginTop: 2,
  },
  streakDayCol: {
    alignItems: 'center',
    gap: 3,
  },
  streakDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  streakDotActive: {
    borderColor: colors.primaryOrange,
    backgroundColor: 'rgba(255,153,0,0.15)',
  },
  streakDotToday: {
    borderColor: colors.success,
    backgroundColor: 'rgba(16,185,129,0.15)',
  },
  streakDotInner: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.primaryOrange,
  },
  streakDayLabel: {
    fontSize: 8,
    fontWeight: '500',
    color: colors.textMuted,
  },
  streakDayLabelToday: {
    color: colors.primaryOrange,
    fontWeight: '700',
  },
});

export default AnalyticsScreen;
