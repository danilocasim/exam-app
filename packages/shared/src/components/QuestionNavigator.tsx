// T045: QuestionNavigator component (flag, jump to question)
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  Pressable,
  StyleSheet,
} from 'react-native';
import { ChevronLeft, ChevronRight, Flag, Grid3x3, X, Check, Send } from 'lucide-react-native';
import { ExamAnswer } from '../storage/schema';

// AWS Modern Color Palette
const colors = {
  // Backgrounds
  background: '#232F3E', // AWS Deep Navy
  surface: '#1F2937', // Slate for cards
  surfaceHover: '#374151',
  // Borders
  borderDefault: '#374151', // Gray border
  borderSubtle: '#4B5563',
  // Text
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  textDisabled: '#6B7280',
  // Accents
  primaryOrange: '#FF9900', // AWS Orange
  secondaryOrange: '#EC7211',
  primaryOrangeDark: 'rgba(255, 153, 0, 0.2)',
  // Status
  success: '#10B981',
  successDark: 'rgba(16, 185, 129, 0.15)',
  transparent: 'transparent',
};

export interface QuestionNavigatorProps {
  answers: ExamAnswer[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  onFlag: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  isSubmitting?: boolean;
}

/**
 * QuestionNavigator - bottom navigation bar for exam
 * Shows prev/next buttons, flag button, and question grid
 */
export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  answers,
  currentIndex,
  onNavigate,
  onFlag,
  onPrevious,
  onNext,
  onSubmit,
  hasPrevious,
  hasNext,
  isSubmitting = false,
}) => {
  const [showGrid, setShowGrid] = useState(false);

  const currentAnswer = answers[currentIndex];
  const isFlagged = currentAnswer?.isFlagged ?? false;
  const answeredCount = answers.filter((a) => a.answeredAt !== null).length;
  const flaggedCount = answers.filter((a) => a.isFlagged).length;

  const getQuestionStyle = (answer: ExamAnswer, index: number) => {
    const isCurrentQuestion = index === currentIndex;
    const isAnswered = answer.answeredAt !== null;
    const isQuestionFlagged = answer.isFlagged;

    let bgColor = colors.surfaceHover;
    let borderColor = colors.borderSubtle;

    if (isAnswered && !isQuestionFlagged) {
      bgColor = colors.successDark;
      borderColor = colors.success;
    }
    if (isQuestionFlagged) {
      bgColor = colors.primaryOrangeDark;
      borderColor = colors.primaryOrange;
    }
    if (isCurrentQuestion) {
      borderColor = colors.textHeading;
    }

    return { backgroundColor: bgColor, borderColor };
  };

  const getQuestionTextColor = (answer: ExamAnswer) => {
    return answer.answeredAt !== null || answer.isFlagged ? colors.textHeading : colors.textMuted;
  };

  return (
    <>
      {/* Main navigation bar */}
      <View style={styles.container}>
        {/* Progress info */}
        <View style={styles.progressInfo}>
          <Text style={styles.progressText}>
            Question <Text style={styles.progressCurrent}>{currentIndex + 1}</Text>
            <Text style={styles.progressTotal}> / {answers.length}</Text>
          </Text>
          <View style={styles.badges}>
            <View style={styles.answeredBadge}>
              <Check size={12} color={colors.success} strokeWidth={3} />
              <Text style={styles.answeredBadgeText}> {answeredCount}</Text>
            </View>
            {flaggedCount > 0 && (
              <View style={styles.flaggedBadge}>
                <Flag
                  size={11}
                  color={colors.primaryOrange}
                  strokeWidth={2}
                  fill={colors.primaryOrange}
                />
                <Text style={styles.flaggedBadgeText}> {flaggedCount}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${(answeredCount / answers.length) * 100}%` },
            ]}
          />
        </View>

        {/* Navigation buttons */}
        <View style={styles.navButtons}>
          {/* Previous */}
          <TouchableOpacity
            onPress={onPrevious}
            disabled={!hasPrevious}
            activeOpacity={0.7}
            style={[
              styles.navButton,
              hasPrevious ? styles.navButtonActive : styles.navButtonInactive,
            ]}
          >
            <ChevronLeft
              size={18}
              color={hasPrevious ? colors.textBody : colors.textDisabled}
              strokeWidth={2}
            />
            <Text
              style={[
                styles.navButtonText,
                { color: hasPrevious ? colors.textBody : colors.textDisabled },
              ]}
            >
              Prev
            </Text>
          </TouchableOpacity>

          {/* Center controls */}
          <View style={styles.centerControls}>
            <TouchableOpacity
              onPress={onFlag}
              activeOpacity={0.7}
              style={[
                styles.iconButton,
                isFlagged ? styles.iconButtonFlagged : styles.iconButtonDefault,
              ]}
            >
              <Flag
                size={16}
                color={isFlagged ? colors.primaryOrange : colors.textMuted}
                strokeWidth={2}
                fill={isFlagged ? colors.primaryOrange : 'transparent'}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowGrid(true)}
              activeOpacity={0.7}
              style={[styles.iconButton, styles.iconButtonDefault]}
            >
              <Grid3x3 size={16} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Next / Submit */}
          {hasNext ? (
            <TouchableOpacity
              onPress={onNext}
              activeOpacity={0.8}
              style={[styles.navButton, styles.nextButtonActive]}
            >
              <Text style={[styles.navButtonText, { color: colors.textHeading }]}>Next</Text>
              <ChevronRight size={18} color={colors.textHeading} strokeWidth={2} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={onSubmit}
              disabled={isSubmitting}
              activeOpacity={0.8}
              style={[styles.navButton, styles.submitButtonActive]}
            >
              <Text style={[styles.navButtonText, { color: colors.textHeading }]}>Submit</Text>
              <Send size={14} color={colors.textHeading} strokeWidth={2} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Question grid modal */}
      <Modal
        visible={showGrid}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGrid(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowGrid(false)}>
          <View style={styles.modalDimmer} />
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalContent}>
              {/* Header */}
              <View style={styles.modalHeader}>
                <View>
                  <Text style={styles.modalTitle}>Jump to Question</Text>
                  <Text style={styles.modalSubtitle}>
                    {answeredCount} of {answers.length} answered
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setShowGrid(false)}
                  style={styles.modalCloseButton}
                >
                  <X size={18} color={colors.textBody} strokeWidth={2} />
                </TouchableOpacity>
              </View>

              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.surfaceHover }]} />
                  <Text style={styles.legendText}>Unanswered</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
                  <Text style={styles.legendText}>Answered</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primaryOrange }]} />
                  <Text style={styles.legendText}>Flagged</Text>
                </View>
              </View>

              {/* Question grid */}
              <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
                <View style={styles.questionGrid}>
                  {answers.map((answer, index) => (
                    <TouchableOpacity
                      key={answer.id}
                      onPress={() => {
                        onNavigate(index);
                        setShowGrid(false);
                      }}
                      style={[styles.gridButton, getQuestionStyle(answer, index)]}
                    >
                      <Text
                        style={[styles.gridButtonText, { color: getQuestionTextColor(answer) }]}
                      >
                        {index + 1}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  progressCurrent: {
    color: colors.textHeading,
    fontWeight: '600',
  },
  progressTotal: {
    color: colors.textMuted,
  },
  badges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  answeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  answeredBadgeText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  flaggedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryOrangeDark,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  flaggedBadgeText: {
    color: colors.primaryOrange,
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 4,
    backgroundColor: colors.surfaceHover,
    borderRadius: 2,
    marginBottom: 16,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 2,
  },
  navButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 4,
  },
  navButtonActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  navButtonInactive: {
    backgroundColor: 'transparent',
  },
  nextButtonActive: {
    backgroundColor: colors.primaryOrange,
  },
  submitButtonActive: {
    backgroundColor: colors.success,
  },
  navButtonText: {
    fontWeight: '600',
    fontSize: 14,
  },
  centerControls: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  iconButtonDefault: {
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  iconButtonFlagged: {
    backgroundColor: colors.primaryOrangeDark,
    borderWidth: 1,
    borderColor: colors.primaryOrange,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  modalDimmer: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textHeading,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 4,
  },
  modalCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.surfaceHover,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 20,
    backgroundColor: colors.background,
    padding: 12,
    borderRadius: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 4,
    marginRight: 8,
  },
  legendText: {
    fontSize: 12,
    color: colors.textBody,
  },
  questionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  gridButton: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    minHeight: 50,
  },
  gridButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default QuestionNavigator;
