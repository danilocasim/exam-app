// T062 + T065: ReviewScreen - question-by-question review with domain breakdown
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, ChevronRight, X, BarChart2, AlertCircle, Grid3x3 } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import {
  useReviewStore,
  selectCurrentReviewItem,
  selectHasNextReviewQuestion,
  selectHasPreviousReviewQuestion,
  selectReviewProgress,
  selectReviewStats,
} from '../stores/review.store';
import { ReviewQuestionCard } from '../components/ReviewQuestionCard';
import { ReviewFilter } from '../components/ReviewFilter';
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
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ReviewScreen'>;
type ReviewRouteProp = RouteProp<RootStackParamList, 'ReviewScreen'>;

/**
 * ReviewScreen - review answered questions with navigation and domain breakdown
 */
export const ReviewScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<ReviewRouteProp>();
  const { attemptId } = route.params;

  // Store state
  const reviewData = useReviewStore((state) => state.reviewData);
  const filteredItems = useReviewStore((state) => state.filteredItems);
  const currentIndex = useReviewStore((state) => state.currentIndex);
  const filter = useReviewStore((state) => state.filter);
  const isLoading = useReviewStore((state) => state.isLoading);
  const error = useReviewStore((state) => state.error);

  // Selectors
  const currentItem = useReviewStore(selectCurrentReviewItem);
  const hasNext = useReviewStore(selectHasNextReviewQuestion);
  const hasPrevious = useReviewStore(selectHasPreviousReviewQuestion);
  const progress = useReviewStore(selectReviewProgress);
  const stats = useReviewStore(selectReviewStats);

  // Actions
  const {
    loadReview,
    setFilter,
    goToQuestion,
    goToNextQuestion,
    goToPreviousQuestion,
    resetReviewState,
  } = useReviewStore();

  // Local state
  const [showDomains, setShowDomains] = useState(false);
  const [showGrid, setShowGrid] = useState(false);

  useEffect(() => {
    loadReview(attemptId);
    return () => {
      resetReviewState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptId]);

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

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
        <Text style={styles.loadingText}>Loading review...</Text>
      </SafeAreaView>
    );
  }

  if (error || !reviewData) {
    return (
      <SafeAreaView style={styles.errorScreenContainer}>
        <View style={styles.errorIconContainer}>
          <AlertCircle size={32} color={colors.error} strokeWidth={2} />
        </View>
        <Text style={styles.errorText}>{error ?? 'Failed to load review'}</Text>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
          style={styles.errorButton}
        >
          <Text style={styles.errorButtonText}>Go Back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const filterCounts = {
    all: reviewData.items.length,
    incorrect: reviewData.items.filter((i) => !i.isCorrect).length,
    correct: reviewData.items.filter((i) => i.isCorrect).length,
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {/* Back button */}
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={styles.headerButton}
          >
            <ChevronLeft size={18} color={colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>{progress}</Text>
            <Text style={styles.progressLabel}>
              {stats.correct}/{stats.total} correct
            </Text>
          </View>

          {/* Domain breakdown button */}
          <TouchableOpacity
            onPress={() => setShowDomains(true)}
            activeOpacity={0.7}
            style={styles.headerButton}
          >
            <BarChart2 size={18} color={colors.primaryOrange} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Filter */}
        <ReviewFilter selectedFilter={filter} onSelect={setFilter} counts={filterCounts} />

        {/* Question content */}
        {filteredItems.length === 0 ? (
          <View style={styles.noResultsContainer}>
            <Text style={styles.noResultsText}>
              No {filter === 'incorrect' ? 'incorrect' : filter === 'correct' ? 'correct' : ''}{' '}
              questions
            </Text>
          </View>
        ) : currentItem ? (
          <View style={styles.questionContainer}>
            <ReviewQuestionCard item={currentItem} />
          </View>
        ) : null}

        {/* Bottom Navigation */}
        {filteredItems.length > 0 && (
          <View style={styles.navigator}>
            {/* Previous */}
            <TouchableOpacity
              onPress={goToPreviousQuestion}
              disabled={!hasPrevious}
              activeOpacity={0.7}
              style={[styles.navButton, !hasPrevious && styles.navButtonDisabled]}
            >
              <ChevronLeft
                size={20}
                color={hasPrevious ? colors.textHeading : colors.trackGray}
                strokeWidth={2}
              />
            </TouchableOpacity>

            {/* Grid button */}
            <TouchableOpacity
              onPress={() => setShowGrid(true)}
              activeOpacity={0.7}
              style={styles.gridButton}
            >
              <Grid3x3 size={18} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>

            {/* Next */}
            <TouchableOpacity
              onPress={goToNextQuestion}
              disabled={!hasNext}
              activeOpacity={0.7}
              style={[styles.navButton, !hasNext && styles.navButtonDisabled]}
            >
              <ChevronRight
                size={20}
                color={hasNext ? colors.textHeading : colors.trackGray}
                strokeWidth={2}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Domain Breakdown Modal (T065) */}
      <Modal
        visible={showDomains}
        animationType="slide"
        transparent
        onRequestClose={() => setShowDomains(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowDomains(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Domain Performance</Text>
              <TouchableOpacity
                onPress={() => setShowDomains(false)}
                activeOpacity={0.7}
                style={styles.modalCloseButton}
              >
                <X size={18} color={colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Score summary */}
            <View style={styles.scoreSummary}>
              <View style={styles.scoreSummaryItem}>
                <Text style={[styles.scoreSummaryValue, { color: colors.successLight }]}>
                  {reviewData.correctCount}
                </Text>
                <Text style={styles.scoreSummaryLabel}>Correct</Text>
              </View>
              <View style={styles.scoreSummaryDivider} />
              <View style={styles.scoreSummaryItem}>
                <Text style={[styles.scoreSummaryValue, { color: colors.errorLight }]}>
                  {reviewData.totalQuestions - reviewData.correctCount}
                </Text>
                <Text style={styles.scoreSummaryLabel}>Incorrect</Text>
              </View>
              <View style={styles.scoreSummaryDivider} />
              <View style={styles.scoreSummaryItem}>
                <Text style={[styles.scoreSummaryValue, { color: colors.orangeLight }]}>
                  {reviewData.score}%
                </Text>
                <Text style={styles.scoreSummaryLabel}>Score</Text>
              </View>
            </View>

            {/* Domain bars */}
            <ScrollView style={styles.domainList} showsVerticalScrollIndicator={false}>
              {reviewData.domainBreakdown.map((domain: DomainScore, index: number) => (
                <View key={domain.domainId} style={index > 0 ? styles.domainItemSpaced : undefined}>
                  <View style={styles.domainHeader}>
                    <Text style={styles.domainName} numberOfLines={1}>
                      {domain.domainName}
                    </Text>
                    <Text
                      style={[
                        styles.domainPercent,
                        { color: getDomainTextColor(domain.percentage) },
                      ]}
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
                  <Text style={styles.domainCount}>
                    {domain.correct}/{domain.total} correct
                  </Text>
                </View>
              ))}

              {/* Weak areas */}
              {reviewData.domainBreakdown.some((d) => d.percentage < 70) && (
                <View style={styles.weakAreasCard}>
                  <View style={styles.weakAreasHeader}>
                    <AlertCircle
                      size={16}
                      color={colors.orangeLight}
                      strokeWidth={2}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.weakAreasTitle}>Areas to Improve</Text>
                  </View>
                  {reviewData.domainBreakdown
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
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Question Grid Modal */}
      <Modal
        visible={showGrid}
        animationType="slide"
        transparent
        onRequestClose={() => setShowGrid(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowGrid(false)}>
          <Pressable style={styles.gridModalContent} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Questions</Text>
              <TouchableOpacity
                onPress={() => setShowGrid(false)}
                activeOpacity={0.7}
                style={styles.modalCloseButton}
              >
                <X size={18} color={colors.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Legend */}
            <View style={styles.gridLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                <Text style={styles.legendText}>Correct</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.error }]} />
                <Text style={styles.legendText}>Incorrect</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: colors.primaryOrange }]} />
                <Text style={styles.legendText}>Current</Text>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.gridContainer}>
                {filteredItems.map((item, index) => {
                  const isCurrent = index === currentIndex;
                  return (
                    <TouchableOpacity
                      key={item.answer.id}
                      onPress={() => {
                        goToQuestion(index);
                        setShowGrid(false);
                      }}
                      activeOpacity={0.7}
                      style={[
                        styles.gridItem,
                        item.isCorrect ? styles.gridItemCorrect : styles.gridItemIncorrect,
                        isCurrent && styles.gridItemCurrent,
                      ]}
                    >
                      <Text
                        style={[styles.gridItemText, isCurrent && { color: colors.textHeading }]}
                      >
                        {item.index + 1}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
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
    width: 56,
    height: 56,
    borderRadius: 12,
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

  // Header
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressContainer: {
    alignItems: 'center',
  },
  progressText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textHeading,
  },
  progressLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Question
  questionContainer: {
    flex: 1,
  },

  // No results
  noResultsContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResultsText: {
    fontSize: 16,
    color: colors.textMuted,
  },

  // Bottom navigation
  navigator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    gap: 16,
  },
  navButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  gridButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Modal shared
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%',
    paddingBottom: 32,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textHeading,
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Score summary
  scoreSummary: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  scoreSummaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  scoreSummaryValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  scoreSummaryLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },
  scoreSummaryDivider: {
    width: 1,
    backgroundColor: colors.borderDefault,
  },

  // Domain breakdown
  domainList: {
    paddingHorizontal: 20,
    marginTop: 16,
  },
  domainItemSpaced: {
    marginTop: 16,
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
  domainCount: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 4,
  },

  // Weak areas
  weakAreasCard: {
    marginTop: 20,
    backgroundColor: colors.orangeDark,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.primaryOrange,
    marginBottom: 16,
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

  // Grid modal
  gridModalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '65%',
    paddingBottom: 32,
  },
  gridLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    gap: 8,
  },
  gridItem: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  gridItemCorrect: {
    backgroundColor: colors.successDark,
    borderColor: colors.success,
  },
  gridItemIncorrect: {
    backgroundColor: colors.errorDark,
    borderColor: colors.error,
  },
  gridItemCurrent: {
    borderColor: colors.primaryOrange,
    borderWidth: 2,
    shadowColor: colors.primaryOrange,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  gridItemText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textBody,
  },
});

export default ReviewScreen;
