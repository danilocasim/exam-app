// T063: ReviewQuestionCard - displays question with user's answer, correct answer, explanation
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';
import { QuestionOption, QuestionType } from '../storage/schema';
import { ReviewItem } from '../services/review.service';

export interface ReviewQuestionCardProps {
  item: ReviewItem;
}

// AWS Modern Color Palette
const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  surfaceHover: '#374151',
  borderDefault: '#374151',
  borderSubtle: '#4B5563',
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.15)',
  successText: '#6EE7B7',
  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.15)',
  errorText: '#FCA5A5',
};

/**
 * ReviewQuestionCard - read-only display of a question with result
 */
export const ReviewQuestionCard: React.FC<ReviewQuestionCardProps> = ({ item }) => {
  const { question, answer, isCorrect } = item;

  const getOptionStyle = (option: QuestionOption) => {
    const isSelected = answer.selectedAnswers.includes(option.id);
    const isCorrectOption = question.correctAnswers.includes(option.id);

    if (isCorrectOption) {
      return { backgroundColor: colors.successBg, borderColor: colors.success };
    }
    if (isSelected && !isCorrectOption) {
      return { backgroundColor: colors.errorBg, borderColor: colors.error };
    }
    return { backgroundColor: 'transparent', borderColor: colors.borderDefault };
  };

  const getOptionTextColor = (option: QuestionOption) => {
    const isSelected = answer.selectedAnswers.includes(option.id);
    const isCorrectOption = question.correctAnswers.includes(option.id);

    if (isCorrectOption) return colors.successText;
    if (isSelected && !isCorrectOption) return colors.errorText;
    return colors.textBody;
  };

  const getOptionIcon = (option: QuestionOption) => {
    const isSelected = answer.selectedAnswers.includes(option.id);
    const isCorrectOption = question.correctAnswers.includes(option.id);

    if (isCorrectOption) {
      return <CheckCircle2 size={18} color={colors.success} strokeWidth={2} />;
    }
    if (isSelected && !isCorrectOption) {
      return <XCircle size={18} color={colors.error} strokeWidth={2} />;
    }
    return null;
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
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.content}>
        {/* Question type badge and domain */}
        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{getQuestionTypeLabel(question.type)}</Text>
          </View>
          <View style={[styles.badge, styles.domainBadge]}>
            <Text style={styles.badgeText}>{question.domain}</Text>
          </View>
        </View>

        {/* Question text */}
        <View style={styles.questionBox}>
          <Text style={styles.questionText}>{question.text}</Text>
        </View>

        {/* Options */}
        <View style={styles.optionsContainer}>
          {question.options.map((option, index) => (
            <View key={option.id} style={[styles.optionButton, getOptionStyle(option)]}>
              <View style={styles.optionTextContainer}>
                <Text style={[styles.optionText, { color: getOptionTextColor(option) }]}>
                  <Text style={[styles.optionLetter, { color: getOptionTextColor(option) }]}>
                    {String.fromCharCode(65 + index)}.{' '}
                  </Text>
                  {option.text}
                </Text>
              </View>
              <View style={styles.optionIconContainer}>{getOptionIcon(option)}</View>
            </View>
          ))}
        </View>

        {/* Explanation - shown directly after options */}
        {question.explanation && (
          <View style={styles.explanationBox}>
            <View style={styles.explanationHeader}>
              <View style={styles.explanationIcon}>
                {isCorrect ? (
                  <CheckCircle2 size={16} color={colors.success} strokeWidth={2} />
                ) : (
                  <XCircle size={16} color={colors.error} strokeWidth={2} />
                )}
              </View>
              <Text
                style={[
                  styles.explanationLabel,
                  { color: isCorrect ? colors.success : colors.error },
                ]}
              >
                {isCorrect ? 'Correct' : 'Incorrect'} — Explanation
              </Text>
            </View>
            <Text style={styles.explanationText}>{question.explanation}</Text>
          </View>
        )}

        {/* Fallback when no explanation: just show result */}
        {!question.explanation && (
          <View
            style={[
              styles.resultContainer,
              isCorrect ? styles.resultCorrect : styles.resultIncorrect,
            ]}
          >
            <View style={styles.resultIcon}>
              {isCorrect ? (
                <CheckCircle2 size={20} color={colors.success} strokeWidth={2} />
              ) : (
                <XCircle size={20} color={colors.error} strokeWidth={2} />
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
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 24,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  badge: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  domainBadge: {
    borderColor: colors.primaryOrange,
    backgroundColor: 'rgba(255, 153, 0, 0.1)',
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
    fontSize: 20,
    color: colors.textHeading,
    lineHeight: 30,
    fontWeight: '500',
    fontFamily: 'System',
  },
  optionsContainer: {
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
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
  },
  optionIconContainer: {
    width: 24,
    marginLeft: 8,
    alignItems: 'center',
  },
  resultContainer: {
    marginTop: 24,
    padding: 14,
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
    padding: 16,
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
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  explanationText: {
    fontSize: 15,
    color: colors.textBody,
    lineHeight: 24,
  },
});

export default ReviewQuestionCard;
