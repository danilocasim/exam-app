// T053: PracticeSetupScreen - Domain and difficulty selection for practice mode
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, Play, BookOpen } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { usePracticeStore } from '../stores/practice.store';
import { DomainSelector, DomainOption } from '../components/DomainSelector';
import { DifficultySelector } from '../components/DifficultySelector';
import { getQuestionCountByDomain } from '../storage/repositories/question.repository';
import { getCachedExamTypeConfig } from '../services';

// AWS Modern Color Palette
const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  surfaceHover: '#374151',
  borderDefault: '#374151',
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  secondaryOrange: '#EC7211',
  orangeDark: 'rgba(255, 153, 0, 0.2)',
  orangeLight: '#FFB84D',
  success: '#10B981',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'PracticeSetup'>;

/**
 * PracticeSetupScreen - configure practice session filters
 */
export const PracticeSetupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const {
    selectedDomain,
    selectedDifficulty,
    availableQuestionCount,
    isLoading,
    error,
    setDomain,
    setDifficulty,
    refreshAvailableCount,
    startSession,
    resetPracticeState,
    setError,
  } = usePracticeStore();

  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [loadingDomains, setLoadingDomains] = useState(true);

  // Reset practice state on focus
  useFocusEffect(
    useCallback(() => {
      resetPracticeState();
      loadDomains();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  // Refresh count when filters change
  useEffect(() => {
    refreshAvailableCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDomain, selectedDifficulty]);

  const loadDomains = async () => {
    setLoadingDomains(true);
    try {
      const countByDomain = await getQuestionCountByDomain();

      // Try to get domain names from cached exam type config
      const domainNames: Record<string, string> = {};
      try {
        const config = await getCachedExamTypeConfig();
        if (config?.domains) {
          for (const d of config.domains) {
            domainNames[d.id] = d.name;
          }
        }
      } catch {
        // Ignore - will use domain ID as name
      }

      const domainOptions: DomainOption[] = Object.entries(countByDomain).map(([id, count]) => ({
        id,
        name: domainNames[id] || formatDomainName(id),
        questionCount: count,
      }));

      // Sort by question count descending
      domainOptions.sort((a, b) => b.questionCount - a.questionCount);

      setDomains(domainOptions);
    } catch (err) {
      console.error('Failed to load domains:', err);
    } finally {
      setLoadingDomains(false);
    }
  };

  const formatDomainName = (id: string): string => {
    // Convert 'cloud-concepts' to 'Cloud Concepts'
    return id
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleStartPractice = async () => {
    try {
      setError(null);
      await startSession();
      const session = usePracticeStore.getState().session;
      if (session) {
        navigation.navigate('PracticeScreen', { sessionId: session.id });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start practice';
      Alert.alert('Error', message);
    }
  };

  const handleGoBack = () => {
    (navigation as any).navigate('HomeTab');
  };

  const canStart = availableQuestionCount > 0 && !isLoading;

  if (loadingDomains) {
    return (
      <SafeAreaView style={styles.loadingContainer} edges={['top']}>
        <View style={styles.loadingIcon}>
          <BookOpen size={32} color={colors.textHeading} strokeWidth={2} />
        </View>
        <ActivityIndicator size="large" color={colors.primaryOrange} />
        <Text style={styles.loadingText}>Loading domains...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleGoBack} activeOpacity={0.7} style={styles.backButton}>
            <ArrowLeft size={20} color={colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Practice Mode</Text>
            <Text style={styles.headerSubtitle}>Study at your own pace</Text>
          </View>
          <View style={styles.backButton} />
        </View>

        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Domain selector */}
          <View style={styles.section}>
            <DomainSelector
              domains={domains}
              selectedDomain={selectedDomain}
              onSelect={setDomain}
            />
          </View>

          {/* Difficulty selector */}
          <View style={styles.section}>
            <DifficultySelector selectedDifficulty={selectedDifficulty} onSelect={setDifficulty} />
          </View>

          {/* Question count info */}
          <View style={styles.countCard}>
            <Text style={styles.countLabel}>Available Questions</Text>
            <Text
              style={[
                styles.countValue,
                { color: canStart ? colors.primaryOrange : colors.textMuted },
              ]}
            >
              {availableQuestionCount}
            </Text>
          </View>

          {/* Error */}
          {error && (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Start button */}
        <View style={styles.bottomContainer}>
          <TouchableOpacity
            onPress={handleStartPractice}
            disabled={!canStart}
            activeOpacity={0.8}
            style={[styles.startButton, !canStart && styles.startButtonDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.startButtonContent}>
                <Play
                  size={20}
                  color={colors.textHeading}
                  strokeWidth={2}
                  fill={colors.textHeading}
                />
                <Text style={styles.startButtonText}>Start Practice</Text>
              </View>
            )}
          </TouchableOpacity>
          {!canStart && !isLoading && (
            <Text style={styles.noQuestionsText}>No questions available for selected filters</Text>
          )}
        </View>
      </View>
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
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 16,
    marginTop: 12,
  },
  header: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textHeading,
  },
  headerSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  section: {
    marginBottom: 16,
  },
  countCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    marginBottom: 20,
  },
  countLabel: {
    fontSize: 14,
    color: colors.textBody,
    fontWeight: '500',
  },
  countValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EF4444',
    marginBottom: 20,
  },
  errorText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
  bottomContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    backgroundColor: colors.surface,
  },
  startButton: {
    backgroundColor: colors.primaryOrange,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  startButtonDisabled: {
    backgroundColor: colors.surfaceHover,
  },
  startButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  startButtonText: {
    color: colors.textHeading,
    fontWeight: 'bold',
    fontSize: 17,
  },
  noQuestionsText: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default PracticeSetupScreen;
