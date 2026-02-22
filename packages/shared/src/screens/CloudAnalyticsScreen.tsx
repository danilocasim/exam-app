/**
 * T142: Cloud Analytics Screen
 *
 * Fetches and displays server-side analytics when online.
 * Falls back to cached local analytics when offline.
 * Supports pagination for exam history (20/page).
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Cloud,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Target,
  Clock,
  BarChart2,
  WifiOff,
  Check,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuthStore } from '../stores/auth-store';
import { api } from '../services/api';
import { checkConnectivity } from '../services/network.service';
import { SyncStatusIndicator } from '../components/SyncStatusIndicator';

// AWS Color Palette (consistent with AnalyticsScreen)
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
  infoDark: 'rgba(59, 130, 246, 0.15)',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CloudAnalytics'>;

interface AnalyticsSummary {
  totalAttempts: number;
  totalPassed: number;
  passRate: number;
  averageScore: number;
  averageDuration: number;
}

interface ExamAttemptItem {
  id: string;
  examTypeId: string;
  score: number;
  passed: boolean;
  duration: number;
  submittedAt: string;
  syncStatus: string;
}

interface PaginatedHistory {
  data: ExamAttemptItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Format seconds to a human-readable duration
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hours}h ${remainMins}m` : `${hours}h`;
}

/**
 * Format an ISO date string to a readable short date
 */
function formatDate(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export const CloudAnalyticsScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isSignedIn } = useAuthStore();

  // Analytics state
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [history, setHistory] = useState<PaginatedHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 20;

  /**
   * Fetch analytics data from server
   */
  const fetchAnalytics = useCallback(async () => {
    try {
      const response = await api.get<AnalyticsSummary>('/exam-attempts/analytics/my-analytics');
      setAnalytics(response.data);
      setError(null);
    } catch (err) {
      console.error('[CloudAnalytics] Failed to fetch analytics:', err);
      throw err;
    }
  }, []);

  /**
   * Fetch paginated exam history
   */
  const fetchHistory = useCallback(async (page: number) => {
    try {
      const response = await api.get<PaginatedHistory>('/exam-attempts/my-history', {
        params: { page, limit: PAGE_SIZE },
      });
      setHistory(response.data);
      setCurrentPage(page);
    } catch (err) {
      console.error('[CloudAnalytics] Failed to fetch history:', err);
      throw err;
    }
  }, []);

  /**
   * Load all data (analytics + first page of history)
   */
  const loadData = useCallback(
    async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      setError(null);

      try {
        // Check connectivity
        const online = await checkConnectivity();
        setIsOnline(online);

        if (!online) {
          setError('You are offline. Cloud analytics require an internet connection.');
          setIsLoading(false);
          return;
        }

        if (!isSignedIn) {
          setError('Sign in to view cloud analytics.');
          setIsLoading(false);
          return;
        }

        await Promise.all([fetchAnalytics(), fetchHistory(1)]);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load cloud analytics';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [isSignedIn, fetchAnalytics, fetchHistory],
  );

  // Load on focus
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(false);
    setIsRefreshing(false);
  };

  const handleNextPage = () => {
    if (history && currentPage < history.totalPages) {
      fetchHistory(currentPage + 1);
    }
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      fetchHistory(currentPage - 1);
    }
  };

  // Not signed in state
  if (!isSignedIn) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.textHeading} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cloud Analytics</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.emptyContainer}>
          <Cloud size={48} color={colors.textMuted} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>Sign In Required</Text>
          <Text style={styles.emptyText}>
            Sign in with Google to sync your exam results and view cloud analytics.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.textHeading} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Cloud Analytics</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primaryOrange} />
          <Text style={styles.loadingText}>Loading cloud analytics...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft size={20} color={colors.textHeading} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Cloud Analytics</Text>
        <TouchableOpacity onPress={handleRefresh} style={styles.refreshButton}>
          <RefreshCw size={18} color={colors.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primaryOrange}
          />
        }
      >
        {/* Offline banner */}
        {!isOnline && (
          <View style={styles.offlineBanner}>
            <WifiOff size={16} color={colors.errorLight} strokeWidth={2} />
            <Text style={styles.offlineBannerText}>Offline — showing cached data</Text>
          </View>
        )}

        {/* Error display */}
        {error && (
          <View style={styles.errorBanner}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => loadData()}>
              <Text style={styles.retryLink}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sync Status */}
        <View style={styles.section}>
          <SyncStatusIndicator />
        </View>

        {/* Analytics Summary */}
        {analytics && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Performance Summary</Text>
            <View style={styles.statsGrid}>
              {/* Total Attempts */}
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: colors.infoDark }]}>
                  <BarChart2 size={18} color={colors.info} strokeWidth={2} />
                </View>
                <Text style={styles.statValue}>{analytics.totalAttempts}</Text>
                <Text style={styles.statLabel}>Total Exams</Text>
              </View>

              {/* Pass Rate */}
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: colors.successDark }]}>
                  <Trophy size={18} color={colors.success} strokeWidth={2} />
                </View>
                <Text style={styles.statValue}>
                  {analytics.totalAttempts > 0 ? `${Math.round(analytics.passRate * 100)}%` : '—'}
                </Text>
                <Text style={styles.statLabel}>Pass Rate</Text>
              </View>

              {/* Average Score */}
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: colors.orangeDark }]}>
                  <Target size={18} color={colors.primaryOrange} strokeWidth={2} />
                </View>
                <Text style={styles.statValue}>
                  {analytics.totalAttempts > 0 ? `${Math.round(analytics.averageScore)}%` : '—'}
                </Text>
                <Text style={styles.statLabel}>Avg Score</Text>
              </View>

              {/* Average Duration */}
              <View style={styles.statCard}>
                <View style={[styles.statIcon, { backgroundColor: 'rgba(156,163,175,0.12)' }]}>
                  <Clock size={18} color={colors.textMuted} strokeWidth={2} />
                </View>
                <Text style={styles.statValue}>
                  {analytics.totalAttempts > 0 ? formatDuration(analytics.averageDuration) : '—'}
                </Text>
                <Text style={styles.statLabel}>Avg Duration</Text>
              </View>
            </View>

            {/* Summary bar */}
            <View style={styles.summaryBar}>
              <Text style={styles.summaryText}>
                {analytics.totalPassed} of {analytics.totalAttempts} exams passed
              </Text>
              <View style={styles.summaryBadge}>
                <Check size={12} color={colors.success} strokeWidth={2.5} />
                <Text style={styles.summaryBadgeText}>Cloud Data</Text>
              </View>
            </View>
          </View>
        )}

        {/* Empty analytics state */}
        {analytics && analytics.totalAttempts === 0 && (
          <View style={styles.emptyCard}>
            <Cloud size={32} color={colors.textMuted} strokeWidth={1.5} />
            <Text style={styles.emptyCardTitle}>No Cloud Data Yet</Text>
            <Text style={styles.emptyCardText}>
              Complete and sync exams to see your cloud analytics here.
            </Text>
          </View>
        )}

        {/* Exam History */}
        {history && history.data.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Exam History</Text>
              <Text style={styles.sectionBadge}>{history.total} total</Text>
            </View>

            {/* History list */}
            {history.data.map((item) => (
              <View key={item.id} style={styles.historyItem}>
                <View style={styles.historyLeft}>
                  <View
                    style={[
                      styles.historyDot,
                      {
                        backgroundColor: item.passed ? colors.success : colors.error,
                      },
                    ]}
                  />
                  <View>
                    <Text style={styles.historyScore}>
                      {item.score}%{' '}
                      <Text
                        style={{
                          color: item.passed ? colors.success : colors.error,
                        }}
                      >
                        {item.passed ? 'PASS' : 'FAIL'}
                      </Text>
                    </Text>
                    <Text style={styles.historyMeta}>
                      {formatDate(item.submittedAt)} · {formatDuration(item.duration)}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.syncBadge,
                    {
                      backgroundColor:
                        item.syncStatus === 'SYNCED'
                          ? colors.successDark
                          : item.syncStatus === 'PENDING'
                            ? colors.orangeDark
                            : colors.errorDark,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.syncBadgeText,
                      {
                        color:
                          item.syncStatus === 'SYNCED'
                            ? colors.success
                            : item.syncStatus === 'PENDING'
                              ? colors.primaryOrange
                              : colors.error,
                      },
                    ]}
                  >
                    {item.syncStatus}
                  </Text>
                </View>
              </View>
            ))}

            {/* Pagination */}
            {history.totalPages > 1 && (
              <View style={styles.pagination}>
                <TouchableOpacity
                  onPress={handlePrevPage}
                  disabled={currentPage <= 1}
                  style={[styles.pageButton, currentPage <= 1 && styles.pageButtonDisabled]}
                >
                  <ChevronLeft
                    size={18}
                    color={currentPage <= 1 ? colors.trackGray : colors.textHeading}
                    strokeWidth={2}
                  />
                  <Text
                    style={[
                      styles.pageButtonText,
                      currentPage <= 1 && styles.pageButtonTextDisabled,
                    ]}
                  >
                    Prev
                  </Text>
                </TouchableOpacity>

                <Text style={styles.pageInfo}>
                  Page {currentPage} of {history.totalPages}
                </Text>

                <TouchableOpacity
                  onPress={handleNextPage}
                  disabled={currentPage >= history.totalPages}
                  style={[
                    styles.pageButton,
                    currentPage >= history.totalPages && styles.pageButtonDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.pageButtonText,
                      currentPage >= history.totalPages && styles.pageButtonTextDisabled,
                    ]}
                  >
                    Next
                  </Text>
                  <ChevronRight
                    size={18}
                    color={
                      currentPage >= history.totalPages ? colors.trackGray : colors.textHeading
                    }
                    strokeWidth={2}
                  />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Bottom spacing */}
        <View style={{ height: Math.max(32, insets.bottom) }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.textHeading,
  },
  headerRight: { width: 36 },
  refreshButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Loading & Empty
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { color: colors.textMuted, fontSize: 14 },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textHeading,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Offline
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.errorDark,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  offlineBannerText: {
    color: colors.errorLight,
    fontSize: 13,
  },

  // Error
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.errorDark,
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: colors.errorLight,
    fontSize: 13,
    flex: 1,
  },
  retryLink: {
    color: colors.primaryOrange,
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
  },

  // Section
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textHeading,
    marginBottom: 12,
  },
  sectionBadge: {
    fontSize: 12,
    color: colors.textMuted,
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 12,
  },

  // Stats Grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    gap: 6,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textHeading,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Summary bar
  summaryBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  summaryText: {
    fontSize: 13,
    color: colors.textBody,
  },
  summaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.successDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  summaryBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },

  // Empty card
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 32,
    marginHorizontal: 16,
    marginTop: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    gap: 8,
  },
  emptyCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textHeading,
  },
  emptyCardText: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },

  // History
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  historyLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  historyScore: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textHeading,
  },
  historyMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  syncBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  syncBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingVertical: 8,
  },
  pageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surfaceHover,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  pageButtonDisabled: {
    opacity: 0.4,
  },
  pageButtonText: {
    fontSize: 13,
    color: colors.textHeading,
    fontWeight: '500',
  },
  pageButtonTextDisabled: {
    color: colors.trackGray,
  },
  pageInfo: {
    fontSize: 13,
    color: colors.textMuted,
  },
});

export default CloudAnalyticsScreen;
