// T061: ExamHistoryScreen - list of completed exams with scores and dates
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Trophy, XCircle, ChevronLeft, ChevronRight, Clock, BarChart2 } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { getExamHistory, ExamHistoryEntry } from '../services/review.service';

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

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ExamHistory'>;

/**
 * ExamHistoryScreen - displays list of completed exams
 */
export const ExamHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();

  const [entries, setEntries] = useState<ExamHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, []),
  );

  const loadHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getExamHistory();
      setEntries(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load history';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewExam = (attemptId: string) => {
    navigation.navigate('ReviewScreen', { attemptId });
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return colors.success;
    if (score >= 60) return colors.primaryOrange;
    return colors.error;
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 70) return colors.successDark;
    if (score >= 60) return colors.orangeDark;
    return colors.errorDark;
  };

  const renderExamEntry = ({ item }: { item: ExamHistoryEntry }) => (
    <TouchableOpacity
      onPress={() => handleReviewExam(item.attempt.id)}
      activeOpacity={0.7}
      style={styles.entryCard}
    >
      <View style={styles.entryHeader}>
        {/* Pass/Fail badge */}
        <View
          style={[
            styles.statusBadge,
            item.passed ? styles.statusBadgePassed : styles.statusBadgeFailed,
          ]}
        >
          {item.passed ? (
            <Trophy size={14} color={colors.textHeading} strokeWidth={2} />
          ) : (
            <XCircle size={14} color={colors.textHeading} strokeWidth={2} />
          )}
          <Text style={styles.statusBadgeText}>{item.passed ? 'PASSED' : 'FAILED'}</Text>
        </View>
        <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
      </View>

      <View style={styles.entryBody}>
        {/* Score */}
        <View style={[styles.scoreCircle, { backgroundColor: getScoreBgColor(item.score) }]}>
          <Text style={[styles.scoreText, { color: getScoreColor(item.score) }]}>
            {item.score}%
          </Text>
        </View>

        {/* Details */}
        <View style={styles.entryDetails}>
          <Text style={styles.entryDetailText}>
            {item.correctCount}/{item.totalQuestions} correct
          </Text>
          <View style={styles.entryDetailRow}>
            <Clock size={12} color={colors.textMuted} strokeWidth={2} />
            <Text style={styles.entryDetailMuted}>{item.timeSpent}</Text>
          </View>
        </View>

        {/* Score Bar */}
        <View style={styles.scoreBarContainer}>
          <View
            style={[
              styles.scoreBarFill,
              {
                width: `${item.score}%`,
                backgroundColor: getScoreColor(item.score),
              },
            ]}
          />
        </View>
      </View>

      {/* Date */}
      <View style={styles.entryFooter}>
        <Text style={styles.dateText}>
          {formatDate(item.attempt.completedAt ?? item.attempt.startedAt)}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryOrange} />
        <Text style={styles.loadingText}>Loading history...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={colors.textHeading} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exam History</Text>
        <View style={styles.headerSpacer} />
      </View>

      {error ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={loadHistory} activeOpacity={0.7} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <BarChart2 size={32} color={colors.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>No Exam History</Text>
          <Text style={styles.emptySubtitle}>Complete your first exam to see results here</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.7}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>Start an Exam</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.attempt.id}
          renderItem={renderExamEntry}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 16,
    marginTop: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
    color: colors.textHeading,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  entryCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 6,
  },
  statusBadgePassed: {
    backgroundColor: colors.success,
  },
  statusBadgeFailed: {
    backgroundColor: colors.error,
  },
  statusBadgeText: {
    color: colors.textHeading,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  entryBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  scoreCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 16,
    fontWeight: '700',
  },
  entryDetails: {
    flex: 1,
    gap: 4,
  },
  entryDetailText: {
    fontSize: 15,
    color: colors.textBody,
    fontWeight: '500',
  },
  entryDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  entryDetailMuted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  scoreBarContainer: {
    position: 'absolute',
    bottom: 0,
    left: 68,
    right: 0,
    height: 4,
    backgroundColor: colors.trackGray,
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  entryFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    paddingTop: 8,
  },
  dateText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textHeading,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: colors.primaryOrange,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyButtonText: {
    color: colors.textHeading,
    fontWeight: '600',
    fontSize: 15,
  },
  errorText: {
    color: colors.errorLight,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  retryText: {
    color: colors.textBody,
    fontWeight: '600',
    fontSize: 15,
  },
});

export default ExamHistoryScreen;
