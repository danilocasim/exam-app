// T041: HomeScreen — redesigned with clear visual hierarchy
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, { Circle } from 'react-native-svg';
import {
  Cloud,
  Play,
  AlertTriangle,
  ClipboardList,
  BarChart2,
  BookOpen,
  Zap,
  ChevronRight,
  Target,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useExamStore } from '../stores';
import { hasInProgressExam, abandonCurrentExam } from '../services';
import { getInProgressExamAttempt } from '../storage/repositories/exam-attempt.repository';
import { getTotalQuestionCount } from '../storage/repositories/question.repository';
import { canGenerateExam } from '../services/exam-generator.service';
import { getUserStats } from '../storage/repositories/user-stats.repository';
import { getOverallStats, calculateAggregatedDomainPerformance } from '../services/scoring.service';
import { EXAM_CONFIG } from '../config';

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
  info: '#3B82F6',
};

const SCREEN_WIDTH = Dimensions.get('window').width;

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// ── Progress Ring ──
interface ProgressRingProps {
  progress: number; // 0-1
  size: number;
  strokeWidth: number;
  color: string;
  trackColor: string;
}

const ProgressRing: React.FC<ProgressRingProps> = ({
  progress,
  size,
  strokeWidth,
  color,
  trackColor,
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(progress, 1));

  return (
    <Svg width={size} height={size}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={trackColor}
        strokeWidth={strokeWidth}
        fill="transparent"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={color}
        strokeWidth={strokeWidth}
        fill="transparent"
        strokeDasharray={`${circumference}`}
        strokeDashoffset={strokeDashoffset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
};

// ── HomeScreen ──
export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { startExam, resumeExam, isLoading, error, setError } = useExamStore();

  const [hasInProgress, setHasInProgress] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [canStart, setCanStart] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Supplementary data for progress ring + insights
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [passRate, setPassRate] = useState(0);
  const [totalExams, setTotalExams] = useState(0);
  const [weakDomainName, setWeakDomainName] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      checkExamStatus();
    }, []),
  );

  const checkExamStatus = async () => {
    setCheckingStatus(true);
    try {
      const [inProgress, count, canGen] = await Promise.all([
        hasInProgressExam(),
        getTotalQuestionCount(),
        canGenerateExam(),
      ]);
      setHasInProgress(inProgress);
      setQuestionCount(count);
      setCanStart(canGen.canGenerate);

      // Non-critical analytics data
      try {
        const [stats, overall, domainPerf] = await Promise.all([
          getUserStats(),
          getOverallStats(),
          calculateAggregatedDomainPerformance(),
        ]);
        setQuestionsAnswered(stats.totalQuestions);
        setPassRate(overall.passRate);
        setTotalExams(overall.totalExams);

        const weak = domainPerf
          .filter((d) => d.percentage < 70)
          .sort((a, b) => a.percentage - b.percentage);
        setWeakDomainName(weak.length > 0 ? weak[0].domainName : null);
      } catch {
        // CTA still works without analytics
      }
    } catch (err) {
      console.error('[HomeScreen] Failed to check exam status:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // ── Handlers ──
  const handleStartExam = async () => {
    try {
      setError(null);
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

  const handleResumeExam = async () => {
    try {
      setError(null);
      const resumed = await resumeExam();
      if (resumed) {
        navigation.navigate('ExamScreen', {});
      } else {
        await checkExamStatus();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume exam';
      Alert.alert('Error', message);
    }
  };

  const handleStartNewExam = () => {
    Alert.alert(
      'Start New Exam',
      'You have an exam in progress. Do you want to abandon it and start a new one?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Abandon & Start New',
          style: 'destructive',
          onPress: async () => {
            try {
              const { abandonExam } = useExamStore.getState();
              const session = useExamStore.getState().session;
              if (session) {
                await abandonExam();
              } else {
                const ip = await getInProgressExamAttempt();
                if (ip) await abandonCurrentExam(ip.id);
              }
            } catch {
              // continue
            }
            await handleStartExam();
          },
        },
      ],
    );
  };

  // ── Loading splash ──
  if (checkingStatus) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Cloud size={32} color={colors.textHeading} strokeWidth={2} />
        </View>
        <ActivityIndicator size="large" color={colors.primaryOrange} />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  // ── Derived values ──
  const progressRatio = questionCount > 0 ? questionsAnswered / questionCount : 0;

  // ── Quick action definitions ──
  const quickActions = [
    {
      key: 'practice',
      label: 'Practice',
      sub: 'By domain',
      icon: <ClipboardList size={20} color={colors.primaryOrange} strokeWidth={1.5} />,
      gradient: ['rgba(255, 153, 0, 0.12)', 'rgba(236, 114, 17, 0.06)'] as [string, string],
      borderColor: 'rgba(255, 153, 0, 0.25)',
      onPress: () => navigation.navigate('PracticeSetup'),
    },
    {
      key: 'analytics',
      label: 'Analytics',
      sub: 'Performance',
      icon: <BarChart2 size={20} color={colors.info} strokeWidth={1.5} />,
      gradient: ['rgba(59, 130, 246, 0.12)', 'rgba(59, 130, 246, 0.04)'] as [string, string],
      borderColor: 'rgba(59, 130, 246, 0.25)',
      onPress: () => navigation.navigate('Analytics'),
    },
    {
      key: 'history',
      label: 'History',
      sub: 'Past exams',
      icon: <BookOpen size={20} color={colors.success} strokeWidth={1.5} />,
      gradient: ['rgba(16, 185, 129, 0.12)', 'rgba(16, 185, 129, 0.04)'] as [string, string],
      borderColor: 'rgba(16, 185, 129, 0.25)',
      onPress: () => navigation.navigate('ExamHistory'),
    },
    {
      key: 'settings',
      label: 'Settings',
      sub: 'Configure',
      icon: <Target size={20} color={colors.textMuted} strokeWidth={1.5} />,
      gradient: ['rgba(156, 163, 175, 0.10)', 'rgba(156, 163, 175, 0.04)'] as [string, string],
      borderColor: 'rgba(156, 163, 175, 0.20)',
      onPress: () => navigation.navigate('Settings'),
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* ── Compact Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoIcon}>
              <Cloud size={16} color={colors.textHeading} strokeWidth={2.5} />
            </View>
            <Text style={styles.appTitle}>CloudPrep</Text>
          </View>
          <Text style={styles.headerBadge}>CLF-C02</Text>
        </View>

        {/* ── Inline Stats Strip ── */}
        <View style={styles.statsStrip}>
          <View style={styles.stripItem}>
            <Text style={styles.stripValue}>{questionCount}</Text>
            <Text style={styles.stripLabel}>In Bank</Text>
          </View>
          <View style={styles.stripDot} />
          <View style={styles.stripItem}>
            <Text style={styles.stripValue}>{EXAM_CONFIG.QUESTIONS_PER_EXAM}</Text>
            <Text style={styles.stripLabel}>Per Exam</Text>
          </View>
          <View style={styles.stripDot} />
          <View style={styles.stripItem}>
            <Text style={styles.stripValue}>{EXAM_CONFIG.TIME_LIMIT_MINUTES}m</Text>
            <Text style={styles.stripLabel}>Time</Text>
          </View>
          <View style={styles.stripDot} />
          <View style={styles.stripItem}>
            <Text style={[styles.stripValue, { color: colors.successLight }]}>
              {EXAM_CONFIG.PASSING_SCORE}%
            </Text>
            <Text style={styles.stripLabel}>Pass</Text>
          </View>
        </View>

        <View style={styles.content}>
          {/* ── Primary CTA ── */}
          {hasInProgress ? (
            <View style={styles.ctaSection}>
              <TouchableOpacity
                onPress={handleResumeExam}
                disabled={isLoading}
                activeOpacity={0.85}
                style={styles.ctaWrapper}
              >
                <LinearGradient
                  colors={[colors.primaryOrange, colors.secondaryOrange]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.ctaContent}>
                      <View style={styles.ctaLeft}>
                        <View style={styles.ctaIconCircle}>
                          <Play
                            size={18}
                            color={colors.textHeading}
                            strokeWidth={2.5}
                            fill={colors.textHeading}
                          />
                        </View>
                        <View>
                          <Text style={styles.ctaTitle}>Resume Exam</Text>
                          <Text style={styles.ctaSub}>Continue where you left off</Text>
                        </View>
                      </View>
                      <ChevronRight size={20} color={colors.textHeading} strokeWidth={2} />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleStartNewExam}
                disabled={isLoading}
                activeOpacity={0.7}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionText}>or start a new exam</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={handleStartExam}
              disabled={isLoading || !canStart}
              activeOpacity={0.85}
              style={[styles.ctaWrapper, !canStart && styles.ctaDisabled]}
            >
              <LinearGradient
                colors={
                  canStart
                    ? [colors.primaryOrange, colors.secondaryOrange]
                    : [colors.surfaceHover, colors.surface]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.ctaContent}>
                    <View style={styles.ctaLeft}>
                      <View
                        style={[
                          styles.ctaIconCircle,
                          !canStart && { backgroundColor: colors.trackGray },
                        ]}
                      >
                        <Zap size={18} color={colors.textHeading} strokeWidth={2.5} />
                      </View>
                      <View>
                        <Text style={styles.ctaTitle}>Start Exam</Text>
                        <Text style={styles.ctaSub}>
                          {EXAM_CONFIG.QUESTIONS_PER_EXAM} questions ·{' '}
                          {EXAM_CONFIG.TIME_LIMIT_MINUTES} min
                        </Text>
                      </View>
                    </View>
                    <ChevronRight
                      size={20}
                      color={canStart ? colors.textHeading : colors.textMuted}
                      strokeWidth={2}
                    />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Warning */}
          {!canStart && !hasInProgress && (
            <View style={styles.warningRow}>
              <AlertTriangle size={14} color={colors.errorLight} strokeWidth={2} />
              <Text style={styles.warningText}>
                Need {EXAM_CONFIG.QUESTIONS_PER_EXAM}+ questions to start ({questionCount} loaded)
              </Text>
            </View>
          )}
          {error && (
            <View style={styles.warningRow}>
              <AlertTriangle size={14} color={colors.errorLight} strokeWidth={2} />
              <Text style={styles.warningText}>{error}</Text>
            </View>
          )}

          {/* ── Progress & Insights ── */}
          <View style={styles.insightCard}>
            <View style={styles.insightLeft}>
              <View style={styles.ringContainer}>
                <ProgressRing
                  progress={progressRatio}
                  size={72}
                  strokeWidth={6}
                  color={colors.primaryOrange}
                  trackColor={colors.surfaceHover}
                />
                <View style={styles.ringLabel}>
                  <Text style={styles.ringValue}>
                    {questionsAnswered > 999
                      ? `${(questionsAnswered / 1000).toFixed(1)}k`
                      : questionsAnswered}
                  </Text>
                  <Text style={styles.ringCaption}>done</Text>
                </View>
              </View>
            </View>

            <View style={styles.insightRight}>
              <Text style={styles.insightTitle}>
                {questionsAnswered === 0
                  ? 'Ready to begin?'
                  : `${questionsAnswered} of ${questionCount} answered`}
              </Text>
              <View style={styles.insightMetrics}>
                {totalExams > 0 && (
                  <View style={styles.metricChip}>
                    <Text style={styles.metricValue}>{passRate}%</Text>
                    <Text style={styles.metricLabel}>pass rate</Text>
                  </View>
                )}
                {totalExams > 0 && (
                  <View style={styles.metricChip}>
                    <Text style={styles.metricValue}>{totalExams}</Text>
                    <Text style={styles.metricLabel}>{totalExams === 1 ? 'exam' : 'exams'}</Text>
                  </View>
                )}
                {totalExams === 0 && (
                  <Text style={styles.insightHint}>Take your first exam to track progress</Text>
                )}
              </View>
            </View>
          </View>

          {/* ── Weak Domain Nudge ── */}
          {weakDomainName && (
            <TouchableOpacity
              onPress={() => navigation.navigate('PracticeSetup')}
              activeOpacity={0.7}
              style={styles.nudge}
            >
              <View style={styles.nudgeLeft}>
                <View style={styles.nudgeIcon}>
                  <AlertTriangle size={14} color={colors.error} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.nudgeTitle} numberOfLines={1}>
                    Weak area: {weakDomainName}
                  </Text>
                  <Text style={styles.nudgeSub}>Tap to practice this domain</Text>
                </View>
              </View>
              <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          )}

          {/* ── Quick Actions ── */}
          <Text style={styles.sectionLabel}>Quick Actions</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.actionsRow}
        >
          {quickActions.map((action) => (
            <TouchableOpacity
              key={action.key}
              onPress={action.onPress}
              activeOpacity={0.75}
              style={styles.actionCard}
            >
              <LinearGradient
                colors={action.gradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.actionGradient, { borderColor: action.borderColor }]}
              >
                <View style={styles.actionIconWrap}>{action.icon}</View>
                <Text style={styles.actionTitle}>{action.label}</Text>
                <Text style={styles.actionSub}>{action.sub}</Text>
              </LinearGradient>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

// ── Styles ──
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20 },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingText: { marginTop: 12, color: colors.textMuted, fontSize: 15 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textHeading },
  headerBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.orangeLight,
    backgroundColor: colors.orangeDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },

  // Stats Strip
  statsStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  stripItem: { alignItems: 'center', paddingHorizontal: 12 },
  stripValue: { fontSize: 16, fontWeight: '700', color: colors.textHeading },
  stripLabel: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  stripDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: colors.trackGray,
  },

  // Primary CTA
  ctaSection: { marginBottom: 12 },
  ctaWrapper: { borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  ctaDisabled: { opacity: 0.5 },
  ctaGradient: { paddingVertical: 18, paddingHorizontal: 20 },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ctaIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: { fontSize: 17, fontWeight: 'bold', color: colors.textHeading },
  ctaSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  secondaryAction: { alignItems: 'center', paddingVertical: 8 },
  secondaryActionText: { fontSize: 13, color: colors.textMuted },

  // Warning
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.errorDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  warningText: { color: colors.errorLight, fontSize: 13, flex: 1 },

  // Progress Insight Card
  insightCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  insightLeft: { marginRight: 16 },
  ringContainer: { position: 'relative', width: 72, height: 72 },
  ringLabel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: { fontSize: 16, fontWeight: 'bold', color: colors.textHeading },
  ringCaption: { fontSize: 9, color: colors.textMuted, marginTop: -1 },
  insightRight: { flex: 1 },
  insightTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textHeading,
    marginBottom: 6,
  },
  insightMetrics: { flexDirection: 'row', gap: 10 },
  metricChip: {
    backgroundColor: colors.surfaceHover,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignItems: 'center',
  },
  metricValue: { fontSize: 15, fontWeight: 'bold', color: colors.orangeLight },
  metricLabel: { fontSize: 10, color: colors.textMuted, marginTop: 1 },
  insightHint: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },

  // Weak Domain Nudge
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.errorDark,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  nudgeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  nudgeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudgeTitle: { fontSize: 13, fontWeight: '600', color: colors.textHeading },
  nudgeSub: { fontSize: 11, color: colors.textMuted, marginTop: 1 },

  // Section Label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 4,
  },

  // Quick Actions (Horizontal Scroll)
  actionsRow: { paddingLeft: 20, paddingRight: 10, gap: 10 },
  actionCard: { width: (SCREEN_WIDTH - 60) / 3.2, flexShrink: 0 },
  actionGradient: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  actionIconWrap: { marginBottom: 10 },
  actionTitle: { fontSize: 13, fontWeight: '600', color: colors.textHeading },
  actionSub: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
});

export default HomeScreen;
