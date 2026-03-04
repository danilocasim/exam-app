// T043: QuestionCard component with option selection
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Lightbulb, CheckCircle2, XCircle, Maximize2, Lock, Crown } from 'lucide-react-native';
import { Question, QuestionOption, QuestionType } from '../storage/schema';
import { RichExplanation, ExplanationBlock } from './RichExplanation';
import { ExplanationModal } from './ExplanationModal';
import { ImageViewer } from './ImageViewer';
import { colors, spacing, radii } from '../theme';

export interface QuestionCardProps {
  question: Question;
  selectedAnswers: string[];
  onSelectAnswer: (optionId: string) => void;
  showResult?: boolean;
  isCorrect?: boolean | null;
  disabled?: boolean;
  /** Hide the Correct/Incorrect banner at the bottom (default: true) */
  showResultBanner?: boolean;
  /** Hide the explanation section at the bottom (default: true) */
  showExplanation?: boolean;
  /** Font scale multiplier (default: 1.0). Use getFontScale() from FontSizeControl. */
  fontScale?: number;
  /** When true, renders a premium lock overlay over the card */
  isLocked?: boolean;
  /** Called when the user taps the lock overlay (navigate to UpgradeScreen) */
  onLockedPress?: () => void;
}

// Status colors used only in this component
const statusColors = {
  surfaceSelected: '#4A3A1A', // Amber-gold tint for selected state
  successBg: 'rgba(16, 185, 129, 0.15)',
  successText: '#6EE7B7',
  errorBg: 'rgba(239, 68, 68, 0.15)',
  errorText: '#FCA5A5',
};

/**
 * QuestionCard - displays a question with selectable options
 */
export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  selectedAnswers,
  onSelectAnswer,
  showResult = false,
  isCorrect = null,
  disabled = false,
  showResultBanner = true,
  showExplanation = true,
  fontScale = 1,
  isLocked = false,
  onLockedPress,
}) => {
  const isMultipleChoice = question.type === 'MULTIPLE_CHOICE';

  const handleOptionPress = (optionId: string) => {
    console.warn(`[QuestionCard] Option pressed: ${optionId}, disabled: ${disabled}`);
    if (disabled) return;
    onSelectAnswer(optionId);
  };

  const getOptionStyle = (option: QuestionOption) => {
    const isSelected = selectedAnswers.includes(option.id);
    const isCorrectOption = question.correctAnswers.includes(option.id);

    if (showResult) {
      if (isCorrectOption) {
        return { backgroundColor: statusColors.successBg, borderColor: colors.success };
      }
      if (isSelected && !isCorrectOption) {
        return { backgroundColor: statusColors.errorBg, borderColor: colors.error };
      }
      return { backgroundColor: 'transparent', borderColor: colors.borderDefault };
    }

    if (isSelected) {
      return {
        backgroundColor: statusColors.surfaceSelected,
        borderColor: colors.primaryOrange,
        borderWidth: 2, // Thicker border for selected
        // Strong orange glow effect
        shadowColor: colors.primaryOrange,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 6,
      };
    }

    // Default state: transparent with subtle border
    return { backgroundColor: 'transparent', borderColor: colors.borderDefault };
  };

  const getOptionTextColor = (option: QuestionOption) => {
    const isSelected = selectedAnswers.includes(option.id);
    const isCorrectOption = question.correctAnswers.includes(option.id);

    if (showResult) {
      if (isCorrectOption) return statusColors.successText;
      if (isSelected && !isCorrectOption) return statusColors.errorText;
    }
    // Selected text is AWS Orange for full orange appearance
    if (isSelected) return '#FF9900'; // AWS Orange text
    return colors.textBody;
  };

  const getQuestionTypeLabel = (type: QuestionType): string => {
    switch (type) {
      case 'SINGLE_CHOICE':
        return 'Select one answer';
      case 'MULTIPLE_CHOICE':
        return 'Select all that apply';
      case 'TRUE_FALSE':
        return 'True or False';
      default:
        return '';
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, isLocked && styles.lockedContainer]}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEnabled={!isLocked}
      >
        <View style={[styles.content, isLocked && { opacity: 0.35 }]}>
          {/* Question type badge */}
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getQuestionTypeLabel(question.type)}</Text>
            </View>
          </View>

          {/* Question text */}
          <View style={styles.questionBox}>
            <Text
              style={[
                styles.questionText,
                {
                  fontSize: Math.round(20 * fontScale),
                  lineHeight: Math.round(30 * fontScale),
                },
              ]}
            >
              {question.text}
            </Text>
          </View>

          {/* Options */}
          <View style={styles.optionsContainer}>
            {question.options.map((option, index) => (
              <TouchableOpacity
                key={option.id}
                onPress={() => handleOptionPress(option.id)}
                disabled={disabled}
                activeOpacity={disabled ? 1 : 0.7}
                style={[styles.optionButton, getOptionStyle(option)]}
              >
                {/* Option text */}
                <View style={styles.optionTextContainer}>
                  <Text
                    style={[
                      styles.optionText,
                      {
                        color: getOptionTextColor(option),
                        fontWeight: selectedAnswers.includes(option.id) ? '600' : '400',
                        fontSize: Math.round(16 * fontScale),
                        lineHeight: Math.round(24 * fontScale),
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.optionLetter,
                        {
                          color: selectedAnswers.includes(option.id)
                            ? colors.primaryOrange
                            : colors.textMuted,
                        },
                      ]}
                    >
                      {String.fromCharCode(65 + index)}.{' '}
                    </Text>
                    {option.text}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          {/* Result indicator */}
          {showResult && showResultBanner && isCorrect !== null && (
            <View
              style={[
                styles.resultContainer,
                isCorrect ? styles.resultCorrect : styles.resultIncorrect,
              ]}
            >
              <View style={styles.resultIcon}>
                {isCorrect ? (
                  <CheckCircle2 size={24} color={colors.success} strokeWidth={2} />
                ) : (
                  <XCircle size={24} color={colors.error} strokeWidth={2} />
                )}
              </View>
              <Text
                style={[
                  styles.resultText,
                  { color: isCorrect ? statusColors.successText : statusColors.errorText },
                ]}
              >
                {isCorrect ? 'Correct!' : 'Incorrect'}
              </Text>
            </View>
          )}

          {/* Explanation */}
          {showResult && showExplanation && question.explanation && (
            <ExplanationSection
              explanation={question.explanation}
              explanationBlocks={(question as any).explanationBlocks}
            />
          )}
        </View>
      </ScrollView>

      {/* Lock overlay — rendered over the dimmed card when isLocked=true */}
      {isLocked && (
        <TouchableOpacity
          style={[StyleSheet.absoluteFillObject, styles.lockOverlay]}
          onPress={onLockedPress}
          activeOpacity={0.9}
          accessibilityRole="button"
          accessibilityLabel="Premium question — tap to upgrade"
        >
          <View style={styles.lockContent}>
            <View style={styles.lockIconCircle}>
              <Lock size={28} color="#F59E0B" strokeWidth={2} />
            </View>
            <Text style={styles.lockTitle}>Premium Question</Text>
            <Text style={styles.lockSubtitle}>Upgrade to access this question</Text>
            <View style={styles.lockCta}>
              <Crown size={13} color="#000" strokeWidth={2} />
              <Text style={styles.lockCtaText}>Unlock All Questions</Text>
            </View>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

/**
 * ExplanationSection — explanation with rich text + full-screen expand
 */
const ExplanationSection: React.FC<{
  explanation: string;
  explanationBlocks?: ExplanationBlock[] | null;
}> = ({ explanation, explanationBlocks }) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [imageViewer, setImageViewer] = useState<{
    visible: boolean;
    uri: string;
    alt?: string;
  }>({ visible: false, uri: '' });

  const handleOpenModal = useCallback(() => setModalVisible(true), []);
  const handleCloseModal = useCallback(() => setModalVisible(false), []);
  const handleImagePress = useCallback((uri: string, alt?: string) => {
    setImageViewer({ visible: true, uri, alt });
  }, []);
  const handleImageViewerClose = useCallback(() => {
    setImageViewer({ visible: false, uri: '' });
  }, []);

  return (
    <>
      <View style={styles.explanationBox}>
        <View style={styles.explanationHeader}>
          <View style={styles.explanationHeaderLeft}>
            <View style={styles.explanationIcon}>
              <Lightbulb size={16} color={colors.primaryOrange} strokeWidth={2} />
            </View>
            <Text style={styles.explanationLabel}>Explanation</Text>
          </View>
          <TouchableOpacity
            onPress={handleOpenModal}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="View explanation full screen"
          >
            <Maximize2 size={16} color={colors.primaryOrange} strokeWidth={2} />
          </TouchableOpacity>
        </View>
        <RichExplanation
          explanation={explanation}
          explanationBlocks={explanationBlocks}
          textStyle={styles.explanationText}
          onImagePress={handleImagePress}
        />
      </View>

      <ExplanationModal
        visible={modalVisible}
        explanation={explanation}
        explanationBlocks={explanationBlocks}
        onClose={handleCloseModal}
      />

      <ImageViewer
        visible={imageViewer.visible}
        uri={imageViewer.uri}
        alt={imageViewer.alt}
        onClose={handleImageViewerClose}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg - 4,
    paddingBottom: spacing.lg,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  badge: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  badgeText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.3,
  },
  questionBox: {
    marginBottom: spacing.xl,
    paddingBottom: spacing.lg + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  questionText: {
    fontSize: 20, // 1.25x larger than option text
    color: colors.textHeading,
    lineHeight: 30, // 1.5 line-height
    fontWeight: '500',
    fontFamily: 'System',
  },
  optionsContainer: {
    gap: spacing.md - 4,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  optionTextContainer: {
    flex: 1,
  },
  optionText: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '400',
  },
  optionLetter: {
    fontWeight: '700',
    color: colors.textMuted,
  },
  resultContainer: {
    marginTop: spacing.lg + 4,
    padding: spacing.md,
    borderRadius: radii.md,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  resultCorrect: {
    backgroundColor: statusColors.successBg,
    borderColor: colors.success,
  },
  resultIncorrect: {
    backgroundColor: statusColors.errorBg,
    borderColor: colors.error,
  },
  resultIcon: {
    marginRight: spacing.md - 4,
  },
  resultText: {
    fontSize: 15,
    fontWeight: '600',
  },
  explanationBox: {
    marginTop: spacing.lg,
    backgroundColor: colors.surface,
    padding: spacing.lg - 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md - 4,
  },
  explanationHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  explanationIcon: {
    marginRight: spacing.sm + 2,
  },
  explanationLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primaryOrange,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  explanationText: {
    fontSize: 15,
    color: colors.textBody,
    lineHeight: 24,
  },

  // Lock overlay
  lockedContainer: {
    pointerEvents: 'none',
  },
  lockOverlay: {
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockContent: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockIconCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  lockTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textHeading,
    marginBottom: spacing.xs,
  },
  lockSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.lg - 4,
  },
  lockCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: '#F59E0B',
    paddingHorizontal: spacing.lg - 4,
    paddingVertical: spacing.sm + 2,
    borderRadius: radii.md - 2,
  },
  lockCtaText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000',
  },
});

export default QuestionCard;
