// T043: QuestionCard component with option selection
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Lightbulb, CheckCircle2, XCircle } from 'lucide-react-native';
import { Question, QuestionOption, QuestionType } from '../storage/schema';

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
}

// AWS Modern Color Palette
const colors = {
  // Backgrounds
  background: '#232F3E', // AWS Deep Navy
  surface: '#1F2937', // Slate for cards
  surfaceHover: '#374151',
  surfaceSelected: '#4A3A1A', // Amber-gold tint for selected state
  // Borders
  borderDefault: '#374151', // Gray border
  borderSubtle: '#4B5563',
  borderAccent: '#FF9900', // AWS Orange
  // Text
  textHeading: '#F9FAFB', // Pure white for headings
  textBody: '#D1D5DB', // Light Gray for body
  textMuted: '#9CA3AF',
  textDisabled: '#6B7280',
  // Accents
  primaryOrange: '#FF9900', // AWS Orange
  secondaryOrange: '#EC7211', // Darker Orange
  // Status
  success: '#10B981', // Modern Emerald
  successBg: 'rgba(16, 185, 129, 0.15)',
  successText: '#6EE7B7',
  error: '#EF4444', // Modern Red
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
        return { backgroundColor: colors.successBg, borderColor: colors.success };
      }
      if (isSelected && !isCorrectOption) {
        return { backgroundColor: colors.errorBg, borderColor: colors.error };
      }
      return { backgroundColor: 'transparent', borderColor: colors.borderDefault };
    }

    if (isSelected) {
      return {
        backgroundColor: colors.surfaceSelected,
        borderColor: colors.borderAccent,
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
      if (isCorrectOption) return colors.successText;
      if (isSelected && !isCorrectOption) return colors.errorText;
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
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
    >
      <View style={styles.content}>
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
                { color: isCorrect ? colors.successText : colors.errorText },
              ]}
            >
              {isCorrect ? 'Correct!' : 'Incorrect'}
            </Text>
          </View>
        )}

        {/* Explanation */}
        {showResult && showExplanation && question.explanation && (
          <View style={styles.explanationBox}>
            <View style={styles.explanationHeader}>
              <View style={styles.explanationIcon}>
                <Lightbulb size={16} color={colors.primaryOrange} strokeWidth={2} />
              </View>
              <Text style={styles.explanationLabel}>Explanation</Text>
            </View>
            <Text style={styles.explanationText}>{question.explanation}</Text>
          </View>
        )}
      </View>
    </ScrollView>
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
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  badge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  questionBox: {
    marginBottom: 32,
    paddingBottom: 28,
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
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16, // Increased touch target
    paddingHorizontal: 16,
    borderRadius: 12,
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
    marginTop: 28,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
  },
  resultCorrect: {
    backgroundColor: colors.successBg,
    borderColor: colors.success,
  },
  resultIncorrect: {
    backgroundColor: colors.errorBg,
    borderColor: colors.error,
  },
  resultIcon: {
    marginRight: 12,
  },
  resultText: {
    fontSize: 15,
    fontWeight: '600',
  },
  explanationBox: {
    marginTop: 24,
    backgroundColor: colors.surface,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  explanationIcon: {
    marginRight: 10,
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
});

export default QuestionCard;
