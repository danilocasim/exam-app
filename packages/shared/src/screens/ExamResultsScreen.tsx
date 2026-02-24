// T046: ExamResultsScreen with score and domain breakdown
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Trophy, XCircle, BookOpen, Home, AlertCircle, CheckCircle2 } from 'lucide-react-native';
import { CircularProgress } from '../components/CircularProgress';
import { RootStackParamList } from '../navigation/RootNavigator';
import { getExamResult, formatTimeSpent } from '../services';
import { ExamResult, DomainScore } from '../storage/schema';
import { useExamStore, useExamAttemptStore } from '../stores';
import { EXAM_TYPE_ID } from '../config/app.config';

// AWS Modern Color Palette
const colors = {
  // Backgrounds
  background: '#232F3E', // AWS Deep Navy
  surface: '#1F2937', // Slate for cards
  surfaceHover: '#374151',
  // Borders
  borderDefault: '#374151', // Gray border
  trackGray: '#4B5563', // Dark track for progress bars
  // Text
  textHeading: '#F9FAFB', // Pure white for headings
  textBody: '#D1D5DB', // Light Gray for body
  textMuted: '#9CA3AF',
  // Accents
  primaryOrange: '#FF9900', // AWS Orange
  secondaryOrange: '#EC7211',
  orangeDark: 'rgba(255, 153, 0, 0.2)',
  orangeLight: '#FFB84D',
  // Status
  success: '#10B981', // Modern Emerald
  successLight: '#6EE7B7',
  successDark: 'rgba(16, 185, 129, 0.15)',
  error: '#EF4444', // Modern Red
  errorLight: '#FCA5A5',
  errorDark: 'rgba(239, 68, 68, 0.15)',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ExamResults'>;
type ResultsRouteProp = RouteProp<RootStackParamList, 'ExamResults'>;

/**
 * ExamResultsScreen - displays exam score and domain breakdown
 */
export const ExamResultsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ResultsRouteProp>();
  const insets = useSafeAreaInsets();
  const { attemptId } = route.params;

  const [result, setResult] = useState<ExamResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Get result from store if available, otherwise fetch
  const storedResult = useExamStore((state) => state.result);
  const resetExamState = useExamStore((state) => state.resetExamState);
  const submitExam = useExamAttemptStore((state) => state.submitExam);

  useEffect(() => {
    loadResult();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

  const loadResult = async () => {
    // Use stored result if it matches
    if (storedResult && storedResult.examAttemptId === attemptId) {
      setResult(storedResult);
      setLoading(false);
      // Submit exam attempt to store
      submitExamAttempt(storedResult);
      return;
    }

    // Otherwise fetch from database
    try {
      setLoading(true);
      const examResult = await getExamResult(attemptId);
      setResult(examResult);
      // Submit exam attempt to store
      submitExamAttempt(examResult);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load results';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const submitExamAttempt = async (examResult: ExamResult) => {
    try {
      // Use timeSpentMs from the result (already calculated during submission)
      const duration = Math.round(examResult.timeSpentMs / 1000) || 0;

      // Submit to exam attempt store
      await submitExam({
        examTypeId: EXAM_TYPE_ID,
        score: examResult.score,
        passed: examResult.passed,
        duration,
        submittedAt: new Date(examResult.completedAt || new Date()),
      });

      console.log('[ExamResultsScreen] Exam attempt submitted successfully');
    } catch (error) {
      console.error('[ExamResultsScreen] Failed to submit exam attempt:', error);
      // Don't fail the results screen, just log the error
    }
  };

  const handleGoHome = () => {
    resetExamState();
    navigation.navigate('MainTabs');
  };

  const handleReviewExam = () => {
    navigation.navigate('ReviewScreen', { attemptId });
  };

  const getScoreColor = (score: number, passingScore: number = 70) => {
    if (score >= passingScore) return colors.success;
    if (score >= passingScore - 10) return colors.primaryOrange;
    return colors.error;
  };

  const getDomainBarColor = (percentage: number) => {
    if (percentage >= 70) return colors.success;
    if (percentage >= 50) return colors.primaryOrange;
    return colors.error;
  };

  const getDomainTextColor = (percentage: number) => {
    if (percentage >= 70) return colors.successLight;
    if (percentage >= 50) return colors.orangeLight;
    return colors.errorLight;
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
        <Text style={styles.loadingText}>Calculating results...</Text>
      </SafeAreaView>
    );
  }

  if (error || !result) {
    return (
      <SafeAreaView style={styles.errorScreenContainer}>
        <View style={styles.errorIconContainer}>
          <AlertCircle size={32} color={colors.error} strokeWidth={2} />
        </View>
        <Text style={styles.errorText}>{error ?? 'Failed to load results'}</Text>
        <TouchableOpacity onPress={handleGoHome} activeOpacity={0.8} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        {/* Header */}
        <View style={[styles.header, result.passed ? styles.headerPassed : styles.headerFailed]}>
          {/* Status badge */}
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusIcon,
                result.passed ? styles.statusIconPassed : styles.statusIconFailed,
              ]}
            >
              {result.passed ? (
                <Trophy size={28} color={colors.textHeading} strokeWidth={2} />
              ) : (
                <BookOpen size={28} color={colors.textHeading} strokeWidth={2} />
              )}
            </View>
            <View
              style={[
                styles.statusBadge,
                result.passed ? styles.statusBadgePassed : styles.statusBadgeFailed,
              ]}
            >
              <Text style={styles.statusText}>{result.passed ? 'PASSED' : 'NOT PASSED'}</Text>
            </View>
          </View>

          {/* Score - Circular Progress */}
          <View style={styles.scoreContainer}>
            <CircularProgress
              percentage={result.score}
              size={140}
              strokeWidth={10}
              color={getScoreColor(result.score)}
              trackColor={colors.trackGray}
            >
              <Text style={[styles.scoreValue, { color: colors.textHeading }]}>{result.score}</Text>
              <Text style={styles.scorePercent}>%</Text>
            </CircularProgress>
            <Text style={styles.passingNote}>Passing: 70%</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.successLight }]}>
              {result.correctAnswers}
            </Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.errorLight }]}>
              {result.totalQuestions - result.correctAnswers}
            </Text>
            <Text style={styles.statLabel}>Incorrect</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.orangeLight }]}>
              {formatTimeSpent(result.timeSpentMs)}
            </Text>
            <Text style={styles.statLabel}>Time</Text>
          </View>
        </View>

        {/* Domain Performance */}
        <View style={styles.domainCard}>
          <Text style={styles.sectionLabel}>Domain Performance</Text>

          {result.domainBreakdown.map((domain: DomainScore, index: number) => (
            <View key={domain.domainId} style={index > 0 ? styles.domainItemSpaced : undefined}>
              <View style={styles.domainHeader}>
                <Text style={styles.domainName} numberOfLines={1}>
                  {domain.domainName}
                </Text>
                <Text
                  style={[styles.domainPercent, { color: getDomainTextColor(domain.percentage) }]}
                >
                  {domain.percentage}%
                </Text>
              </View>
              <View style={styles.domainBarContainer}>
                <View
                  style={[
                    styles.domainBarFill,
                    {
                      width: `${domain.percentage}%`,
                      backgroundColor: getDomainBarColor(domain.percentage),
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        {/* Weak Areas */}
        {result.domainBreakdown.some((d) => d.percentage < 70) && (
          <View style={styles.weakAreasCard}>
            <View style={styles.weakAreasAccent} />
            <View style={styles.weakAreasContent}>
              <View style={styles.weakAreasHeader}>
                <AlertCircle
                  size={18}
                  color={colors.primaryOrange}
                  strokeWidth={2}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.weakAreasTitle}>Areas to Improve</Text>
              </View>
              {result.domainBreakdown
                .filter((d) => d.percentage < 70)
                .sort((a, b) => a.percentage - b.percentage)
                .map((domain) => (
                  <View key={domain.domainId} style={styles.weakAreaItem}>
                    <View style={styles.weakAreaDot} />
                    <Text style={styles.weakAreaName}>{domain.domainName}</Text>
                    <Text style={styles.weakAreaPercent}>{domain.percentage}%</Text>
                  </View>
                ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handleReviewExam}
            activeOpacity={0.8}
            style={styles.reviewButton}
          >
            <Text style={styles.reviewButtonText}>Review Answers</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleGoHome} activeOpacity={0.8} style={styles.homeButton}>
            <Text style={styles.homeButtonText}>Back to Home</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  errorScreenContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: 24,
  },
  errorIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.errorDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  errorText: {
    color: colors.errorLight,
    fontSize: 18,
    marginBottom: 24,
    textAlign: 'center',
  },
  errorButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  errorButtonText: {
    color: colors.textHeading,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  headerPassed: {
    backgroundColor: colors.successDark,
  },
  headerFailed: {
    backgroundColor: colors.errorDark,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statusIconPassed: {
    backgroundColor: colors.success,
  },
  statusIconFailed: {
    backgroundColor: colors.error,
  },
  statusBadge: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  statusBadgePassed: {
    backgroundColor: colors.success,
  },
  statusBadgeFailed: {
    backgroundColor: colors.error,
  },
  statusText: {
    color: colors.textHeading,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  scoreContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  scoreValue: {
    fontSize: 44,
    fontWeight: '700',
  },
  scorePercent: {
    color: colors.textMuted,
    fontSize: 18,
  },
  passingNote: {
    color: colors.textMuted,
    marginTop: 8,
    fontSize: 13,
  },
  statsCard: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.borderDefault,
  },
  domainCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  domainItemSpaced: {
    marginTop: 12,
  },
  domainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  domainName: {
    fontSize: 14,
    color: colors.textBody,
    flex: 1,
  },
  domainPercent: {
    fontSize: 14,
    fontWeight: '600',
  },
  domainBarContainer: {
    height: 8,
    backgroundColor: colors.trackGray,
    borderRadius: 4,
    overflow: 'hidden',
  },
  domainBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  weakAreasCard: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    overflow: 'hidden',
  },
  weakAreasAccent: {
    width: 4,
    backgroundColor: colors.primaryOrange,
  },
  weakAreasContent: {
    flex: 1,
    padding: 16,
  },
  weakAreasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  weakAreasTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textHeading,
  },
  weakAreaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  weakAreaDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primaryOrange,
    marginRight: 12,
  },
  weakAreaName: {
    color: colors.textBody,
    flex: 1,
    fontSize: 14,
  },
  weakAreaPercent: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 32,
  },
  reviewButton: {
    backgroundColor: colors.primaryOrange,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
  },
  reviewButtonText: {
    color: colors.textHeading,
    fontWeight: 'bold',
    fontSize: 16,
  },
  homeButton: {
    backgroundColor: colors.surface,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  homeButtonText: {
    color: colors.textBody,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default ExamResultsScreen;
