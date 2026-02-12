// T041: HomeScreen with "Start Exam" button
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Cloud, Play, AlertTriangle, ClipboardList, BarChart2 } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useExamStore } from '../stores';
import { hasInProgressExam, abandonCurrentExam } from '../services';
import { getInProgressExamAttempt } from '../storage/repositories/exam-attempt.repository';
import { getTotalQuestionCount } from '../storage/repositories/question.repository';
import { canGenerateExam } from '../services/exam-generator.service';
import { EXAM_CONFIG } from '../config';

// AWS Modern Color Palette
const colors = {
  // Backgrounds
  background: '#232F3E', // AWS Deep Navy
  surface: '#1F2937', // Slate for cards
  surfaceHover: '#374151',
  // Borders
  borderDefault: '#374151', // Gray border
  // Text
  textHeading: '#F9FAFB', // Pure white for headings
  textBody: '#D1D5DB', // Light Gray for body
  textMuted: '#9CA3AF',
  // Accents
  primaryOrange: '#FF9900', // AWS Orange
  secondaryOrange: '#EC7211',
  orangeDark: 'rgba(255, 153, 0, 0.2)', // Subtle orange tint
  orangeLight: '#FFB84D',
  // Status
  success: '#10B981',
  successLight: '#6EE7B7',
  error: '#EF4444',
  errorLight: '#FCA5A5',
  errorDark: 'rgba(239, 68, 68, 0.15)',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

/**
 * HomeScreen - main landing screen with exam start button
 */
export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { startExam, resumeExam, isLoading, error, setError } = useExamStore();

  const [hasInProgress, setHasInProgress] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [canStart, setCanStart] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Check exam status on focus
  useFocusEffect(
    useCallback(() => {
      checkExamStatus();
    }, []),
  );

  const checkExamStatus = async () => {
    setCheckingStatus(true);
    try {
      console.warn('[HomeScreen] Checking exam status...');
      const inProgress = await hasInProgressExam();
      setHasInProgress(inProgress);
      console.warn(`[HomeScreen] In progress: ${inProgress}`);

      const count = await getTotalQuestionCount();
      setQuestionCount(count);
      console.warn(`[HomeScreen] Question count: ${count}`);

      const canGen = await canGenerateExam();
      setCanStart(canGen.canGenerate);
      console.warn(
        `[HomeScreen] Can start exam: ${canGen.canGenerate}, reason: ${canGen.reason || 'OK'}`,
      );
    } catch (err) {
      console.error('[HomeScreen] Failed to check exam status:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleStartExam = async () => {
    try {
      console.warn('[HomeScreen] Starting exam...');
      setError(null);
      await startExam();
      console.warn('[HomeScreen] Exam started, navigating to ExamScreen');
      navigation.navigate('ExamScreen', {});
    } catch (err) {
      // If blocked by a stale in-progress exam, auto-abandon and retry once
      const message = err instanceof Error ? err.message : '';
      if (message.includes('already in progress')) {
        console.warn('[HomeScreen] Stale exam detected, auto-abandoning...');
        try {
          const inProgress = await getInProgressExamAttempt();
          if (inProgress) {
            await abandonCurrentExam(inProgress.id);
          }
          await startExam();
          navigation.navigate('ExamScreen', {});
          return;
        } catch (retryErr) {
          console.error('[HomeScreen] Retry after abandon failed:', retryErr);
        }
      }
      console.error('[HomeScreen] Failed to start exam:', err);
      Alert.alert('Error', message || 'Failed to start exam');
    }
  };

  const handleResumeExam = async () => {
    try {
      setError(null);
      const resumed = await resumeExam();
      if (resumed) {
        navigation.navigate('ExamScreen', {});
      } else {
        // No exam to resume, refresh status
        await checkExamStatus();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume exam';
      Alert.alert('Error', message);
    }
  };

  const handleStartNewExam = () => {
    Alert.alert(
      'Start New Exam',
      'You have an exam in progress. Do you want to abandon it and start a new one?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Abandon & Start New',
          style: 'destructive',
          onPress: async () => {
            try {
              // Abandon from store if session is loaded
              const { abandonExam } = useExamStore.getState();
              const session = useExamStore.getState().session;
              if (session) {
                await abandonExam();
              } else {
                // Session not in store (app restarted) — abandon directly from DB
                const inProgress = await getInProgressExamAttempt();
                if (inProgress) {
                  await abandonCurrentExam(inProgress.id);
                }
              }
            } catch (err) {
              console.warn('[HomeScreen] Failed to abandon exam:', err);
            }
            await handleStartExam();
          },
        },
      ],
    );
  };

  if (checkingStatus) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Cloud size={40} color={colors.textHeading} strokeWidth={2} />
        </View>
        <ActivityIndicator size="large" color={colors.primaryOrange} />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerRow}>
            <View style={styles.logoIcon}>
              <Cloud size={22} color={colors.textHeading} strokeWidth={2} />
            </View>
            <View>
              <Text style={styles.appTitle}>CloudPrep</Text>
              <Text style={styles.appSubtitle}>AWS Cloud Practitioner</Text>
            </View>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Exam Info Card */}
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Exam Format</Text>
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{questionCount}</Text>
                <Text style={styles.statLabel}>In Bank</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{EXAM_CONFIG.QUESTIONS_PER_EXAM}</Text>
                <Text style={styles.statLabel}>Questions</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{EXAM_CONFIG.TIME_LIMIT_MINUTES}</Text>
                <Text style={styles.statLabel}>Minutes</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.successLight }]}>
                  {EXAM_CONFIG.PASSING_SCORE}%
                </Text>
                <Text style={styles.statLabel}>To Pass</Text>
              </View>
            </View>
          </View>

          {/* Resume Exam Card */}
          {hasInProgress && (
            <View style={styles.resumeCard}>
              <View style={styles.resumeHeader}>
                <View style={styles.resumeIcon}>
                  <Play
                    size={16}
                    color={colors.textHeading}
                    strokeWidth={2}
                    fill={colors.textHeading}
                  />
                </View>
                <View style={styles.resumeTextContainer}>
                  <Text style={styles.resumeTitle}>Exam In Progress</Text>
                  <Text style={styles.resumeSubtitle}>Continue where you left off</Text>
                </View>
              </View>
              <View style={styles.resumeButtons}>
                <TouchableOpacity
                  onPress={handleResumeExam}
                  disabled={isLoading}
                  activeOpacity={0.8}
                  style={styles.resumeButton}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.resumeButtonText}>Resume Exam</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleStartNewExam}
                  disabled={isLoading}
                  activeOpacity={0.8}
                  style={styles.newButton}
                >
                  <Text style={styles.newButtonText}>New</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Start Exam Button */}
          {!hasInProgress && (
            <TouchableOpacity
              onPress={handleStartExam}
              disabled={isLoading || !canStart}
              activeOpacity={0.8}
              style={[styles.startButton, !canStart && styles.startButtonDisabled]}
            >
              <LinearGradient
                colors={
                  canStart
                    ? [colors.primaryOrange, colors.secondaryOrange]
                    : [colors.surfaceHover, colors.surface]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.startButtonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.startButtonContent}>
                    <Text style={styles.startButtonTitle}>Start Exam</Text>
                    <Text style={styles.startButtonSubtitle}>
                      {EXAM_CONFIG.QUESTIONS_PER_EXAM} questions • {EXAM_CONFIG.TIME_LIMIT_MINUTES}{' '}
                      minutes
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {!canStart && !hasInProgress && (
            <View style={styles.warningCard}>
              <View style={styles.warningContent}>
                <AlertTriangle
                  size={16}
                  color={colors.errorLight}
                  strokeWidth={2}
                  style={{ marginRight: 8 }}
                />
                <Text style={styles.warningText}>
                  Need at least {EXAM_CONFIG.QUESTIONS_PER_EXAM} questions to start. Current:{' '}
                  {questionCount}
                </Text>
              </View>
            </View>
          )}

          {/* Error */}
          {error && (
            <View style={styles.warningCard}>
              <Text style={styles.warningText}>{error}</Text>
            </View>
          )}

          {/* Quick Actions */}
          <Text style={styles.sectionLabel}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              onPress={() => navigation.navigate('PracticeSetup')}
              activeOpacity={0.7}
              style={styles.actionCard}
            >
              <View style={styles.actionIconMinimal}>
                <ClipboardList size={22} color={colors.primaryOrange} strokeWidth={1.5} />
              </View>
              <Text style={styles.actionTitle}>Practice</Text>
              <Text style={styles.actionSubtitle}>By domain</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('Analytics')}
              activeOpacity={0.7}
              style={styles.actionCard}
            >
              <View style={styles.actionIconMinimal}>
                <BarChart2 size={22} color={colors.primaryOrange} strokeWidth={1.5} />
              </View>
              <Text style={styles.actionTitle}>Analytics</Text>
              <Text style={styles.actionSubtitle}>Performance</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate('ExamHistory')}
              activeOpacity={0.7}
              style={styles.actionCard}
            >
              <View style={styles.actionIconMinimal}>
                <ClipboardList size={22} color={colors.textMuted} strokeWidth={1.5} />
              </View>
              <Text style={styles.actionTitle}>History</Text>
              <Text style={styles.actionSubtitle}>Past exams</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
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
    width: 80,
    height: 80,
    borderRadius: 16,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingText: {
    marginTop: 16,
    color: colors.textMuted,
    fontSize: 16,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  appTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textHeading,
  },
  appSubtitle: {
    fontSize: 14,
    color: colors.orangeLight,
  },
  content: {
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textHeading,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.borderDefault,
  },
  resumeCard: {
    backgroundColor: colors.orangeDark,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primaryOrange,
  },
  resumeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  resumeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  resumeTextContainer: {
    flex: 1,
  },
  resumeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textHeading,
  },
  resumeSubtitle: {
    fontSize: 13,
    color: colors.orangeLight,
  },
  resumeButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  resumeButton: {
    flex: 1,
    backgroundColor: colors.primaryOrange,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  resumeButtonText: {
    color: colors.textHeading,
    fontWeight: 'bold',
    fontSize: 15,
  },
  newButton: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  newButtonText: {
    color: colors.textBody,
    fontWeight: '500',
  },
  startButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  startButtonDisabled: {
    opacity: 0.5,
  },
  startButtonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  startButtonContent: {
    alignItems: 'center',
  },
  startButtonTitle: {
    color: colors.textHeading,
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 2,
  },
  startButtonSubtitle: {
    color: colors.orangeLight,
    fontSize: 13,
  },
  warningCard: {
    backgroundColor: colors.errorDark,
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.error,
  },
  warningContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  warningText: {
    color: colors.errorLight,
    fontSize: 13,
    flex: 1,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: 'transparent',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  actionIconMinimal: {
    marginBottom: 12,
  },
  actionTitle: {
    color: colors.textHeading,
    fontWeight: '600',
    fontSize: 14,
  },
  actionSubtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
});

export default HomeScreen;
