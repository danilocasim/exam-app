// T055: FeedbackCard - Immediate answer feedback with correct/incorrect and explanation
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { CheckCircle2, XCircle, Lightbulb, ChevronRight, Trophy } from 'lucide-react-native';

// AWS Modern Color Palette
const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  borderDefault: '#374151',
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  success: '#10B981',
  successLight: '#6EE7B7',
  successDark: 'rgba(16, 185, 129, 0.15)',
  error: '#EF4444',
  errorLight: '#FCA5A5',
  errorDark: 'rgba(239, 68, 68, 0.15)',
};

export interface FeedbackCardProps {
  isCorrect: boolean;
  explanation: string;
  onContinue: () => void;
  isLastQuestion?: boolean;
}

/**
 * FeedbackCard - shows answer result with explanation and continue button
 */
export const FeedbackCard: React.FC<FeedbackCardProps> = ({
  isCorrect,
  explanation,
  onContinue,
  isLastQuestion = false,
}) => {
  return (
    <View style={styles.container}>
      {/* Combined result + explanation card */}
      <View
        style={[styles.feedbackCard, isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect]}
      >
        {/* Accent strip */}
        <View
          style={[
            styles.accentStrip,
            { backgroundColor: isCorrect ? colors.success : colors.error },
          ]}
        />

        {/* Result header */}
        <View style={styles.resultRow}>
          {isCorrect ? (
            <View style={styles.iconWrap}>
              <CheckCircle2 size={22} color={colors.success} strokeWidth={2.5} />
            </View>
          ) : (
            <View style={styles.iconWrap}>
              <XCircle size={22} color={colors.error} strokeWidth={2.5} />
            </View>
          )}
          <Text
            style={[
              styles.resultText,
              { color: isCorrect ? colors.successLight : colors.errorLight },
            ]}
          >
            {isCorrect ? 'Correct!' : 'Incorrect'}
          </Text>
        </View>

        {/* Explanation - scrollable if long */}
        {explanation ? (
          <View style={styles.explanationSection}>
            <View style={styles.explanationHeader}>
              <Lightbulb size={14} color={colors.primaryOrange} strokeWidth={2} />
              <Text style={styles.explanationLabel}>Explanation</Text>
            </View>
            <ScrollView
              style={styles.explanationScroll}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.explanationText}>{explanation}</Text>
            </ScrollView>
          </View>
        ) : null}
      </View>

      {/* Continue button */}
      <TouchableOpacity onPress={onContinue} activeOpacity={0.8} style={styles.continueButton}>
        {isLastQuestion ? (
          <>
            <Trophy size={18} color={colors.textHeading} strokeWidth={2} />
            <Text style={styles.continueText}>View Summary</Text>
          </>
        ) : (
          <>
            <Text style={styles.continueText}>Next Question</Text>
            <ChevronRight size={18} color={colors.textHeading} strokeWidth={2} />
          </>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingBottom: 8,
    gap: 10,
  },
  feedbackCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  feedbackCorrect: {
    backgroundColor: colors.successDark,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  feedbackIncorrect: {
    backgroundColor: colors.errorDark,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  accentStrip: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 0,
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultText: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  explanationSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  explanationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  explanationLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primaryOrange,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  explanationScroll: {
    maxHeight: 120,
  },
  explanationText: {
    fontSize: 14,
    color: colors.textBody,
    lineHeight: 21,
  },
  continueButton: {
    backgroundColor: colors.primaryOrange,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  continueText: {
    color: colors.textHeading,
    fontWeight: '700',
    fontSize: 16,
  },
});

export default FeedbackCard;
