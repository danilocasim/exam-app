// T042: ExamScreen with question display, options, navigation
import React, { useEffect, useCallback, useState } from 'react';
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
import { X, Send } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import {
  useExamStore,
  selectCurrentQuestion,
  selectCurrentAnswer,
  selectHasNextQuestion,
  selectHasPreviousQuestion,
} from '../stores';
import { QuestionCard } from '../components/QuestionCard';
import { Timer } from '../components/Timer';
import { QuestionNavigator } from '../components/QuestionNavigator';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ExamScreen'>;

/**
 * ExamScreen - main exam taking screen
 */
export const ExamScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

  // Store state
  const session = useExamStore((state) => state.session);
  const currentIndex = useExamStore((state) => state.currentIndex);
  const remainingTimeMs = useExamStore((state) => state.remainingTimeMs);
  const isSubmitting = useExamStore((state) => state.isSubmitting);
  const error = useExamStore((state) => state.error);

  // Derived state
  const currentQuestion = useExamStore(selectCurrentQuestion);
  const currentAnswer = useExamStore(selectCurrentAnswer);
  const hasNext = useExamStore(selectHasNextQuestion);
  const hasPrevious = useExamStore(selectHasPreviousQuestion);

  // Actions
  const {
    selectAnswer,
    toggleFlag,
    goToQuestion,
    goToNextQuestion,
    goToPreviousQuestion,
    setRemainingTime,
    persistRemainingTime,
    submitExam,
  } = useExamStore();

  // Local state for selected answers (before saving)
  const [pendingAnswers, setPendingAnswers] = useState<string[]>([]);

  // Initialize pending answers when question changes
  useEffect(() => {
    if (currentAnswer) {
      setPendingAnswers(currentAnswer.selectedAnswers);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAnswer?.id]);

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

  // Handle answer selection
  const handleSelectAnswer = (optionId: string) => {
    console.warn(`[ExamScreen] handleSelectAnswer: optionId=${optionId}`);
    if (!currentQuestion) {
      console.warn('[ExamScreen] No current question');
      return;
    }

    let newAnswers: string[];

    if (currentQuestion.type === 'MULTIPLE_CHOICE') {
      // Toggle selection for multiple choice
      if (pendingAnswers.includes(optionId)) {
        newAnswers = pendingAnswers.filter((id) => id !== optionId);
      } else {
        newAnswers = [...pendingAnswers, optionId];
      }
    } else {
      // Single selection for single choice / true-false
      newAnswers = [optionId];
    }

    console.warn(`[ExamScreen] New answers: ${newAnswers.join(',')}`);
    setPendingAnswers(newAnswers);

    // Auto-save answer
    if (currentQuestion) {
      selectAnswer(currentQuestion.id, newAnswers).catch((err) => {
        console.error('[ExamScreen] Failed to save answer:', err);
      });
    }
  };

  // Handle flag toggle
  const handleToggleFlag = async () => {
    if (!currentQuestion) return;
    try {
      await toggleFlag(currentQuestion.id);
    } catch (err) {
      console.error('Failed to toggle flag:', err);
    }
  };

  // Handle timer tick
  const handleTimerTick = (newTime: number) => {
    setRemainingTime(newTime);
  };

  // Handle time up
  const handleTimeUp = () => {
    Alert.alert(
      'Time Up!',
      'Your exam time has expired. Your exam will be submitted now.',
      [
        {
          text: 'OK',
          onPress: handleSubmitExam,
        },
      ],
      { cancelable: false },
    );
  };

  // Handle persist timer
  const handlePersistTimer = () => {
    persistRemainingTime();
  };

  // Handle exit press
  const handleExitPress = () => {
    Alert.alert(
      'Exit Exam',
      'Are you sure you want to exit? Your progress will be saved and you can resume later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Save & Exit',
          onPress: () => {
            persistRemainingTime();
            navigation.goBack();
          },
        },
      ],
    );
  };

  // Handle submit exam
  const handleSubmitExam = async () => {
    try {
      const result = await submitExam();
      navigation.replace('ExamResults', { attemptId: result.examAttemptId });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to submit exam';
      Alert.alert('Error', message);
    }
  };

  // Handle submit button press
  const handleSubmitPress = () => {
    const answers = session?.answers ?? [];
    const answeredCount = answers.filter((a) => a.answeredAt !== null).length;
    const totalCount = answers.length;

    if (answeredCount < totalCount) {
      Alert.alert(
        'Submit Exam',
        `You have answered ${answeredCount} of ${totalCount} questions. Submit anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit', style: 'destructive', onPress: handleSubmitExam },
        ],
      );
    } else {
      Alert.alert('Submit Exam', 'Are you sure you want to submit your exam?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: handleSubmitExam },
      ]);
    }
  };

  // Show loading if no session
  if (!session || !currentQuestion || !currentAnswer) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
        <Text style={styles.loadingText}>Loading exam...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {/* Exit button */}
          <TouchableOpacity onPress={handleExitPress} activeOpacity={0.7} style={styles.exitButton}>
            <X size={18} color="#9CA3AF" strokeWidth={2} />
          </TouchableOpacity>

          {/* Timer */}
          <Timer
            remainingTimeMs={remainingTimeMs}
            onTick={handleTimerTick}
            onTimeUp={handleTimeUp}
            onPersist={handlePersistTimer}
            persistInterval={30000}
          />

          {/* Submit button */}
          <TouchableOpacity
            onPress={handleSubmitPress}
            disabled={isSubmitting}
            activeOpacity={0.8}
            style={styles.submitButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.submitContent}>
                <Text style={styles.submitText}>Submit</Text>
                <Send size={14} color="#9CA3AF" strokeWidth={2} />
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Question card */}
        <View style={styles.questionContainer}>
          <QuestionCard
            question={currentQuestion}
            selectedAnswers={pendingAnswers}
            onSelectAnswer={handleSelectAnswer}
            disabled={isSubmitting}
          />
        </View>

        {/* Error display */}
        {error && (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Navigation */}
        <View style={{ paddingBottom: insets.bottom }}>
          <QuestionNavigator
            answers={session.answers}
            currentIndex={currentIndex}
            onNavigate={goToQuestion}
            onFlag={handleToggleFlag}
            onPrevious={goToPreviousQuestion}
            onNext={goToNextQuestion}
            hasPrevious={hasPrevious}
            hasNext={hasNext}
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#232F3E', // AWS Deep Navy
  },
  container: {
    flex: 1,
    backgroundColor: '#232F3E',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#232F3E',
  },
  loadingIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#FF9900',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingText: {
    color: '#D1D5DB',
    fontSize: 16,
  },
  header: {
    backgroundColor: '#1F2937', // Slate
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  exitButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  submitContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitText: {
    color: '#9CA3AF',
    fontWeight: '600',
    fontSize: 14,
  },
  questionContainer: {
    flex: 1,
  },
  errorContainer: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
});

export default ExamScreen;
