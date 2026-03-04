// T061: ExamHistoryScreen - list of completed exams with scores and dates
import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, SectionList, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, Clock, BarChart2 } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { getExamHistory, ExamHistoryEntry } from '../services/review.service';
import { useExamStore } from '../stores';
import { abandonCurrentExam } from '../services';
import { getInProgressExamAttempt } from '../storage/repositories/exam-attempt.repository';
import { ScoreBadge } from '../components/ScoreBadge';
import { HistoryScreenSkeleton } from '../components/Shimmer';
import { colors, spacing, radii } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ExamHistory'>;

/**
 * ExamHistoryScreen - displays list of completed exams grouped by date
 */
export const ExamHistoryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { startExam } = useExamStore();

  const [entries, setEntries] = useState<ExamHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // Refetch exam history from DB every time the user accesses the screen (status, date, score).
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

  const handleReviewExam = (item: ExamHistoryEntry) => {
    if (item.canReview) {
      navigation.navigate('ReviewScreen', { attemptId: item.attempt.id });
    } else {
      // Server-synced exam: show domain summary without per-question data
      navigation.navigate('ExamSummary', { submissionId: item.attempt.id });
    }
  };

  // ── Date helpers ──
  const formatDateKey = (dateStr: string): string => {
    const date = new Date(dateStr);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  };

  const formatDateLabel = (dateStr: string): string => {
    const date = new Date(dateStr);
    const now = new Date();
    const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(nowDay);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateDay.getTime() === nowDay.getTime()) return 'Today';
    if (dateDay.getTime() === yesterday.getTime()) return 'Yesterday';
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  // ── Group entries by date ──
  const sections = useMemo(() => {
    const groups: { [key: string]: { label: string; data: ExamHistoryEntry[] } } = {};
    for (const entry of entries) {
      const key = formatDateKey(entry.submittedAt);
      if (!groups[key]) {
        groups[key] = { label: formatDateLabel(entry.submittedAt), data: [] };
      }
      groups[key].data.push(entry);
    }
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a)) // newest first
      .map(([, group]) => ({ title: group.label, data: group.data }));
  }, [entries]);

  const renderExamEntry = ({ item }: { item: ExamHistoryEntry }) => (
    <TouchableOpacity
      onPress={() => handleReviewExam(item)}
      activeOpacity={0.7}
      style={styles.entryRow}
    >
      {/* Main info */}
      <View style={styles.entryInfo}>
        <View style={styles.entryTopRow}>
          <ScoreBadge score={item.score} passed={item.passed} />
          <Text style={styles.entryDetailText}>
            {item.correctCount}/{item.totalQuestions}
          </Text>
          <View style={styles.entryDetailRow}>
            <Clock size={11} color={colors.textMuted} strokeWidth={2} />
            <Text style={styles.entryDetailMuted}>{item.timeSpent}</Text>
          </View>
        </View>
      </View>

      <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: { title: string } }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <HistoryScreenSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (navigation as any).navigate('HomeTab')}
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
            onPress={handleStartExam}
            activeOpacity={0.7}
            style={styles.emptyButton}
          >
            <Text style={styles.emptyButtonText}>Start an Exam</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.attempt.id}
          renderItem={renderExamEntry}
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: Math.max(32, insets.bottom) },
          ]}
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
          SectionSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
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
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },
  // ── Section headers (date grouping) ──
  sectionHeader: {
    backgroundColor: colors.background,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  // ── Entry row ──
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    gap: spacing.md,
  },
  entryInfo: {
    flex: 1,
    gap: 2,
  },
  entryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  entryDetailText: {
    fontSize: 13,
    color: colors.textBody,
    fontWeight: '500',
  },
  entryDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  entryDetailMuted: {
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
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textHeading,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    backgroundColor: colors.primaryOrange,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 4,
    borderRadius: radii.md,
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
    marginBottom: spacing.md,
  },
  retryButton: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md - 4,
    borderRadius: radii.md,
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
