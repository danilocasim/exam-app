// T054: PracticeScreen - Question display with immediate feedback
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  BackHandler,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { X, CheckSquare } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import {
  usePracticeStore,
  selectCurrentPracticeQuestion,
  selectIsCurrentQuestionAnswered,
} from '../stores/practice.store';
import { useShallow } from 'zustand/react/shallow';
import { QuestionCard } from '../components/QuestionCard';
import { FeedbackCard } from '../components/FeedbackCard';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PracticeScreen'>;

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
  error: '#EF4444',
};

/**
 * PracticeScreen - main practice question screen with immediate feedback
 */
export const PracticeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // Store state
  const session = usePracticeStore((state) => state.session);
  const currentIndex = usePracticeStore((state) => state.currentIndex);
  const isSubmitting = usePracticeStore((state) => state.isSubmitting);
  const error = usePracticeStore((state) => state.error);
  const lastResult = usePracticeStore((state) => state.lastResult);
  const showFeedback = usePracticeStore((state) => state.showFeedback);
  const questions = usePracticeStore((state) => state.questions);

  // Derived state
  const currentQuestion = usePracticeStore(selectCurrentPracticeQuestion);
  const progress = usePracticeStore(
    useShallow((state) => ({
      answered: state.answers.length,
      correct: state.answers.filter((a) => a.isCorrect).length,
    })),
  );
  const isAnswered = usePracticeStore(selectIsCurrentQuestionAnswered);

  // Actions
  const { submitAnswer, dismissFeedback, goToNextQuestion, endSession, setError } =
    usePracticeStore();

  // Local state for selected answers (before submitting)
  const [pendingAnswers, setPendingAnswers] = useState<string[]>([]);

  // Reset pending when question changes
  React.useEffect(() => {
    setPendingAnswers([]);
  }, [currentIndex]);

  // Handle back button
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        handleExitPress();
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Handle answer selection (before submit)
  const handleSelectAnswer = (optionId: string) => {
    if (isAnswered || showFeedback || isSubmitting) return;
    if (!currentQuestion) return;

    let newAnswers: string[];
    if (currentQuestion.type === 'MULTIPLE_CHOICE') {
      if (pendingAnswers.includes(optionId)) {
        newAnswers = pendingAnswers.filter((id) => id !== optionId);
      } else {
        newAnswers = [...pendingAnswers, optionId];
      }
    } else {
      newAnswers = [optionId];
    }
    setPendingAnswers(newAnswers);
  };

  // Handle submit answer
  const handleSubmitAnswer = async () => {
    if (pendingAnswers.length === 0) {
      Alert.alert('Select an Answer', 'Please select at least one answer before submitting.');
      return;
    }

    try {
      setError(null);
      await submitAnswer(pendingAnswers);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit answer';
      Alert.alert('Error', message);
    }
  };

  // Handle continue after feedback
  const handleContinue = () => {
    const isLast = currentIndex >= questions.length - 1;
    dismissFeedback();

    if (isLast) {
      // End session and go to summary
      handleEndSession();
    } else {
      goToNextQuestion();
    }
  };

  // Handle end session
  const handleEndSession = async () => {
    try {
      const sessionId = session?.id;
      await endSession();
      if (sessionId) {
        navigation.replace('PracticeSummary', { sessionId });
      } else {
        navigation.navigate('Home');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to end session';
      Alert.alert('Error', message);
    }
  };

  // Handle exit press
  const handleExitPress = () => {
    Alert.alert(
      'End Practice',
      `You've answered ${progress.answered} questions. End this session?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Session',
          style: 'destructive',
          onPress: handleEndSession,
        },
      ],
    );
  };

  // Show loading if no session
  if (!session || !currentQuestion) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
        <Text style={styles.loadingText}>Loading practice...</Text>
      </SafeAreaView>
    );
  }

  const isLastQuestion = currentIndex >= questions.length - 1;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {/* Exit button */}
          <TouchableOpacity onPress={handleExitPress} activeOpacity={0.7} style={styles.exitButton}>
            <X size={18} color={colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>

          {/* Progress */}
          <View style={styles.progressContainer}>
            <Text style={styles.progressText}>
              {currentIndex + 1} / {questions.length}
            </Text>
            <View style={styles.progressBar}>
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${questions.length > 0 ? ((currentIndex + 1) / questions.length) * 100 : 0}%`,
                  },
                ]}
              />
            </View>
          </View>

          {/* Score */}
          <View style={styles.scoreContainer}>
            <Text style={styles.scoreText}>
              {progress.correct}/{progress.answered}
            </Text>
          </View>
        </View>

        {/* Question card */}
        <View style={styles.questionContainer}>
          <QuestionCard
            question={currentQuestion}
            selectedAnswers={pendingAnswers}
            onSelectAnswer={handleSelectAnswer}
            showResult={showFeedback}
            isCorrect={lastResult?.isCorrect ?? null}
            disabled={isAnswered || showFeedback || isSubmitting}
            showResultBanner={false}
            showExplanation={false}
          />
        </View>

        {/* Feedback card (after submitting) */}
        {showFeedback && lastResult && (
          <FeedbackCard
            isCorrect={lastResult.isCorrect}
            explanation={lastResult.explanation}
            onContinue={handleContinue}
            isLastQuestion={isLastQuestion}
          />
        )}

        {/* Submit button (before submitting) */}
        {!showFeedback && !isAnswered && (
          <View style={styles.bottomContainer}>
            <TouchableOpacity
              onPress={handleSubmitAnswer}
              disabled={pendingAnswers.length === 0 || isSubmitting}
              activeOpacity={0.8}
              style={[
                styles.submitButton,
                pendingAnswers.length === 0 && styles.submitButtonDisabled,
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.submitContent}>
                  <CheckSquare size={18} color={colors.textHeading} strokeWidth={2} />
                  <Text style={styles.submitText}>Check Answer</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Error display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </View>
      <View style={{ paddingBottom: insets.bottom }} />
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
    color: colors.textBody,
    fontSize: 16,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    gap: 12,
  },
  exitButton: {
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
    flex: 1,
    gap: 4,
  },
  progressText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.borderDefault,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primaryOrange,
    borderRadius: 2,
  },
  scoreContainer: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  scoreText: {
    color: colors.successLight,
    fontWeight: '600',
    fontSize: 14,
  },
  questionContainer: {
    flex: 1,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  submitButton: {
    backgroundColor: colors.primaryOrange,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: colors.borderDefault,
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitText: {
    color: colors.textHeading,
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.error,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
});

export default PracticeScreen;
