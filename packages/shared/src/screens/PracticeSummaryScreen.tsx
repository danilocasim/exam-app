// T058: PracticeSummaryScreen - Practice session results
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
import { BookOpen, Home, AlertCircle, RotateCcw } from 'lucide-react-native';
import { CircularProgress } from '../components/CircularProgress';
import { RootStackParamList } from '../navigation/RootNavigator';
import { getPracticeSummary, PracticeSummary } from '../services/practice.service';
import { usePracticeStore } from '../stores/practice.store';
// Schema types used by PracticeSummary

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
  orangeDark: 'rgba(255, 153, 0, 0.2)',
  orangeLight: '#FFB84D',
  success: '#10B981',
  successLight: '#6EE7B7',
  successDark: 'rgba(16, 185, 129, 0.15)',
  error: '#EF4444',
  errorLight: '#FCA5A5',
  errorDark: 'rgba(239, 68, 68, 0.15)',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PracticeSummary'>;
type SummaryRouteProp = RouteProp<RootStackParamList, 'PracticeSummary'>;

/**
 * Domain performance breakdown for summary
 */
interface DomainBreakdown {
  domainId: string;
  domainName: string;
  correct: number;
  total: number;
  percentage: number;
}

/**
 * PracticeSummaryScreen - displays practice session results
 */
export const PracticeSummaryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<SummaryRouteProp>();
  const insets = useSafeAreaInsets();
  const { sessionId } = route.params;

  const [summary, setSummary] = useState<PracticeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [domainBreakdown, setDomainBreakdown] = useState<DomainBreakdown[]>([]);

  // Get summary from store if available
  const storedSummary = usePracticeStore((state) => state.summary);
  const resetPracticeState = usePracticeStore((state) => state.resetPracticeState);

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const loadSummary = async () => {
    // Use stored summary if it matches
    if (storedSummary && storedSummary.sessionId === sessionId) {
      setSummary(storedSummary);
      calculateDomainBreakdown(storedSummary);
      setLoading(false);
      return;
    }

    // Otherwise fetch from database
    try {
      setLoading(true);
      const result = await getPracticeSummary(sessionId);
      setSummary(result);
      calculateDomainBreakdown(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load session summary';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDomainBreakdown = (data: PracticeSummary) => {
    // Group by domain
    const domainMap = new Map<string, { correct: number; total: number }>();

    data.answers.forEach((answer, index) => {
      const question = data.questions[index];
      if (!question) return;

      const domain = question.domain;
      const existing = domainMap.get(domain) || { correct: 0, total: 0 };
      existing.total += 1;
      if (answer.isCorrect) existing.correct += 1;
      domainMap.set(domain, existing);
    });

    const breakdown: DomainBreakdown[] = Array.from(domainMap.entries()).map(
      ([domainId, stats]) => ({
        domainId,
        domainName: formatDomainName(domainId),
        correct: stats.correct,
        total: stats.total,
        percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
      }),
    );

    // Sort by performance ascending (worst first)
    breakdown.sort((a, b) => a.percentage - b.percentage);
    setDomainBreakdown(breakdown);
  };

  const formatDomainName = (id: string): string => {
    return id
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return colors.success;
    if (score >= 50) return colors.primaryOrange;
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

  const handleGoHome = () => {
    resetPracticeState();
    navigation.navigate('MainTabs');
  };

  const handlePracticeAgain = () => {
    resetPracticeState();
    navigation.navigate('PracticeSetup');
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

  if (error || !summary) {
    return (
      <SafeAreaView style={styles.errorScreenContainer}>
        <View style={styles.errorIconContainer}>
          <AlertCircle size={32} color={colors.error} strokeWidth={2} />
        </View>
        <Text style={styles.errorScreenText}>{error ?? 'Failed to load summary'}</Text>
        <TouchableOpacity onPress={handleGoHome} activeOpacity={0.8} style={styles.errorButton}>
          <Text style={styles.errorButtonText}>Go Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const isGoodScore = summary.score >= 70;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom }}
      >
        {/* Header */}
        <View
          style={[styles.header, isGoodScore ? styles.headerSuccess : styles.headerImprovement]}
        >
          {/* Status */}
          <View style={styles.statusContainer}>
            <View
              style={[
                styles.statusIcon,
                { backgroundColor: isGoodScore ? colors.success : colors.primaryOrange },
              ]}
            >
              <BookOpen size={28} color={colors.textHeading} strokeWidth={2} />
            </View>
            <Text style={styles.statusLabel}>Practice Complete</Text>
          </View>

          {/* Score - Circular Progress */}
          <View style={styles.scoreContainer}>
            <CircularProgress
              percentage={summary.score}
              size={140}
              strokeWidth={10}
              color={getScoreColor(summary.score)}
              trackColor={colors.trackGray}
            >
              <Text style={styles.scoreValue}>{summary.score}</Text>
              <Text style={styles.scorePercent}>%</Text>
            </CircularProgress>
          </View>

          {/* Filter info */}
          {(summary.domain || summary.difficulty) && (
            <View style={styles.filterInfo}>
              {summary.domain && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterText}>{formatDomainName(summary.domain)}</Text>
                </View>
              )}
              {summary.difficulty && (
                <View style={styles.filterBadge}>
                  <Text style={styles.filterText}>{summary.difficulty}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.successLight }]}>
              {summary.correctCount}
            </Text>
            <Text style={styles.statLabel}>Correct</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.errorLight }]}>
              {summary.incorrectCount}
            </Text>
            <Text style={styles.statLabel}>Incorrect</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.orangeLight }]}>
              {summary.totalQuestions}
            </Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
        </View>

        {/* Domain Performance */}
        {domainBreakdown.length > 0 && (
          <View style={styles.domainCard}>
            <Text style={styles.sectionLabel}>Domain Performance</Text>

            {domainBreakdown.map((domain, index) => (
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
                <Text style={styles.domainSubtext}>
                  {domain.correct}/{domain.total} correct
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Areas to improve */}
        {domainBreakdown.some((d) => d.percentage < 70) && (
          <View style={styles.weakAreasCard}>
            <View style={styles.weakAreasHeader}>
              <AlertCircle
                size={18}
                color={colors.orangeLight}
                strokeWidth={2}
                style={{ marginRight: 8 }}
              />
              <Text style={styles.weakAreasTitle}>Focus Areas</Text>
            </View>
            {domainBreakdown
              .filter((d) => d.percentage < 70)
              .map((domain) => (
                <View key={domain.domainId} style={styles.weakAreaItem}>
                  <View style={styles.weakAreaDot} />
                  <Text style={styles.weakAreaName}>{domain.domainName}</Text>
                  <Text style={styles.weakAreaPercent}>{domain.percentage}%</Text>
                </View>
              ))}
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            onPress={handlePracticeAgain}
            activeOpacity={0.8}
            style={styles.practiceAgainButton}
          >
            <RotateCcw size={18} color={colors.textHeading} strokeWidth={2} />
            <Text style={styles.practiceAgainText}>Practice Again</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleGoHome} activeOpacity={0.8} style={styles.homeButton}>
            <Home size={18} color={colors.textBody} strokeWidth={2} />
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
  errorScreenText: {
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
  headerSuccess: {
    backgroundColor: colors.successDark,
  },
  headerImprovement: {
    backgroundColor: colors.orangeDark,
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
  statusLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textHeading,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  scoreContainer: {
    alignItems: 'center',
    paddingTop: 8,
  },
  scoreValue: {
    fontSize: 44,
    fontWeight: '700',
    color: colors.textHeading,
  },
  scorePercent: {
    color: colors.textMuted,
    fontSize: 18,
  },
  filterInfo: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 12,
  },
  filterBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  filterText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
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
  domainSubtext: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  weakAreasCard: {
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.orangeDark,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primaryOrange,
  },
  weakAreasHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  weakAreasTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.orangeLight,
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
    color: colors.orangeLight,
    flex: 1,
    fontSize: 14,
  },
  weakAreaPercent: {
    color: colors.primaryOrange,
    fontSize: 14,
    fontWeight: '600',
  },
  actions: {
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 32,
  },
  practiceAgainButton: {
    backgroundColor: colors.primaryOrange,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  practiceAgainText: {
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
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  homeButtonText: {
    color: colors.textBody,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default PracticeSummaryScreen;
