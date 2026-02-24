// T069 + T073: AnalyticsScreen - Performance dashboard with WeakDomainsSection
import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, BarChart2, Trophy, Target, AlertTriangle, BookOpen } from 'lucide-react-native';
import { useShallow } from 'zustand/react/shallow';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAnalyticsStore, selectHasData } from '../stores/analytics.store';
import { ScoreTrendChart } from '../components/analytics/ScoreTrendChart';
import { DomainPerformanceCard } from '../components/analytics/DomainPerformanceCard';
import { StudyStatsCard } from '../components/analytics/StudyStatsCard';
import { WeakDomain } from '../services/analytics.service';

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

/**
 * AnalyticsScreen - Performance tracking dashboard
 */
export const AnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

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
    }, [loadAnalytics]),
  );

  // Loading state
  if (isLoading && !analyticsData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={22} color={colors.textHeading} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryOrange} />
          <Text style={styles.loadingText}>Loading analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error && !analyticsData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => (navigation as any).navigate('HomeTab')}
            style={styles.backButton}
          >
            <ArrowLeft size={22} color={colors.textHeading} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Analytics</Text>
          <View style={styles.headerSpacer} />
        </View>
        <View style={styles.errorContainer}>
          <AlertTriangle size={48} color={colors.error} strokeWidth={1.5} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadAnalytics}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('HomeTab')}
          style={styles.backButton}
        >
          <ArrowLeft size={22} color={colors.textHeading} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: Math.max(32, insets.bottom) },
        ]}
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
          <View style={styles.emptyCard}>
            <BarChart2 size={48} color={colors.trackGray} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No Data Yet</Text>
            <Text style={styles.emptySubtext}>
              Complete exams and practice sessions to see your performance analytics.
            </Text>
            <TouchableOpacity
              style={styles.startButton}
              onPress={() => navigation.navigate('MainTabs')}
            >
              <Text style={styles.startButtonText}>Start Studying</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dashboard with data */}
        {hasData && analyticsData && (
          <>
            {/* Overall Stats Summary */}
            <OverallStatsCard
              totalExams={analyticsData.overallStats.totalExams}
              passRate={analyticsData.overallStats.passRate}
              averageScore={analyticsData.overallStats.averageScore}
              bestScore={analyticsData.overallStats.bestScore}
            />

            {/* Score trend chart */}
            <ScoreTrendChart scoreHistory={analyticsData.scoreHistory} />

            {/* Study Stats */}
            <StudyStatsCard studyStats={analyticsData.studyStats} />

            {/* Domain Performance */}
            <DomainPerformanceCard domains={analyticsData.domainPerformance} />

            {/* T073: Weak Domains Section - only show when there's contrast (some strong + some weak) */}
            {analyticsData.weakDomains.length > 0 &&
              analyticsData.domainPerformance.some((d) => d.percentage >= 70) && (
                <WeakDomainsSection
                  weakDomains={analyticsData.weakDomains}
                  onPractice={(domainId: string) => {
                    navigation.navigate('PracticeSetup');
                  }}
                />
              )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * Overall stats summary card at the top
 */
interface OverallStatsCardProps {
  totalExams: number;
  passRate: number;
  averageScore: number | null;
  bestScore: number | null;
}

const OverallStatsCard: React.FC<OverallStatsCardProps> = ({
  totalExams,
  passRate,
  averageScore,
  bestScore,
}) => {
  return (
    <View style={styles.summaryCard}>
      <Text style={styles.cardLabel}>Overall Performance</Text>
      <View style={styles.summaryStatsRow}>
        <View style={styles.summaryStat}>
          <Trophy size={18} color={colors.primaryOrange} strokeWidth={1.5} />
          <Text style={styles.summaryStatValue}>{passRate}%</Text>
          <Text style={styles.summaryStatLabel}>Pass Rate</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <Target size={18} color={colors.success} strokeWidth={1.5} />
          <Text style={styles.summaryStatValue}>
            {averageScore !== null ? `${averageScore}%` : '--'}
          </Text>
          <Text style={styles.summaryStatLabel}>Average</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <BarChart2 size={18} color={colors.orangeLight} strokeWidth={1.5} />
          <Text style={styles.summaryStatValue}>{bestScore !== null ? `${bestScore}%` : '--'}</Text>
          <Text style={styles.summaryStatLabel}>Best</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryStat}>
          <BookOpen size={18} color={colors.textBody} strokeWidth={1.5} />
          <Text style={styles.summaryStatValue}>{totalExams}</Text>
          <Text style={styles.summaryStatLabel}>Exams</Text>
        </View>
      </View>
    </View>
  );
};

/**
 * T073: WeakDomainsSection - Shows weak domains with practice recommendations
 */
interface WeakDomainsSectionProps {
  weakDomains: WeakDomain[];
  onPractice: (domainId: string) => void;
}

const WeakDomainsSection: React.FC<WeakDomainsSectionProps> = ({ weakDomains, onPractice }) => {
  return (
    <View style={styles.weakCard}>
      <View style={styles.weakAccent} />
      <View style={styles.weakContent}>
        <View style={styles.weakHeader}>
          <AlertTriangle size={16} color={colors.primaryOrange} strokeWidth={2} />
          <Text style={styles.weakTitle}>Areas to Improve</Text>
        </View>
        <Text style={styles.weakSubtext}>
          These domains are below 70%. Focus your practice sessions here.
        </Text>

        {weakDomains.map((domain) => (
          <View key={domain.domainId} style={styles.weakDomainRow}>
            <View style={styles.weakDomainInfo}>
              <Text style={styles.weakDomainName}>{domain.domainName}</Text>
              <View style={styles.weakProgressRow}>
                <View style={styles.weakProgressBar}>
                  <View
                    style={[
                      styles.weakProgressFill,
                      { width: `${Math.min(domain.percentage, 100)}%` },
                    ]}
                  />
                </View>
                <Text style={styles.weakPercentage}>{domain.percentage}%</Text>
              </View>
              <Text style={styles.weakGapText}>
                {domain.gap} points below passing • {domain.correct}/{domain.total} correct
              </Text>
            </View>
            <TouchableOpacity
              style={styles.practiceButton}
              onPress={() => onPractice(domain.domainId)}
              activeOpacity={0.7}
            >
              <Text style={styles.practiceButtonText}>Practice</Text>
            </TouchableOpacity>
          </View>
        ))}
      </View>
    </View>
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
  contentContainer: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textHeading,
  },
  headerSpacer: {
    width: 36,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  errorText: {
    color: colors.errorLight,
    fontSize: 15,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: colors.primaryOrange,
    borderRadius: 10,
    marginTop: 8,
  },
  retryText: {
    color: colors.textHeading,
    fontWeight: 'bold',
    fontSize: 15,
  },

  // Empty state
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    marginTop: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textHeading,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  startButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: colors.primaryOrange,
    borderRadius: 10,
    marginTop: 8,
  },
  startButtonText: {
    color: colors.textHeading,
    fontWeight: 'bold',
    fontSize: 15,
  },

  // Overall stats summary
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  summaryStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    gap: 6,
  },
  summaryStatValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textHeading,
  },
  summaryStatLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.borderDefault,
  },

  // Weak domains section (T073) - subtle left accent bar instead of red border
  weakCard: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    overflow: 'hidden',
  },
  weakAccent: {
    width: 4,
    backgroundColor: colors.primaryOrange,
  },
  weakContent: {
    flex: 1,
    padding: 16,
  },
  weakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  weakTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textHeading,
  },
  weakSubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 16,
  },
  weakDomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  weakDomainInfo: {
    flex: 1,
    marginRight: 12,
  },
  weakDomainName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textHeading,
    marginBottom: 6,
  },
  weakProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  weakProgressBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.trackGray,
    borderRadius: 3,
    overflow: 'hidden',
  },
  weakProgressFill: {
    height: '100%',
    backgroundColor: colors.primaryOrange,
    borderRadius: 3,
  },
  weakPercentage: {
    fontSize: 13,
    fontWeight: 'bold',
    color: colors.primaryOrange,
    width: 36,
    textAlign: 'right',
  },
  weakGapText: {
    fontSize: 11,
    color: colors.textMuted,
  },
  practiceButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.primaryOrange,
    borderRadius: 8,
  },
  practiceButtonText: {
    color: colors.textHeading,
    fontWeight: '600',
    fontSize: 13,
  },
});

export default AnalyticsScreen;
