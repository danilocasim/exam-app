// T053: PracticeSetupScreen - Domain, difficulty, and set selection for practice mode
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
import { ArrowLeft, Play, BookOpen, Lock, Crown, CheckSquare } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { usePracticeStore } from '../stores/practice.store';
import { DomainSelector, DomainOption } from '../components/DomainSelector';
import { DifficultySelector } from '../components/DifficultySelector';
import {
  getQuestionCountByDomain,
  getQuestionCountByDomainAndSets,
  getQuestionCountBySet,
} from '../storage/repositories/question.repository';
import { getCachedExamTypeConfig, getCachedQuestionSets } from '../services';
import { useIsPremium } from '../stores/purchase.store';

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
  const isPremium = useIsPremium();
  const {
    selectedDomain,
    selectedDifficulty,
    selectedSets,
    availableQuestionCount,
    isLoading,
    error,
    setDomain,
    setDifficulty,
    setSets,
    refreshAvailableCount,
    startSession,
    resetPracticeState,
    setError,
  } = usePracticeStore();

  const [domains, setDomains] = useState<DomainOption[]>([]);
  const [availableBySet, setAvailableBySet] = useState<Record<string, number>>({});
  const [setNames, setSetNames] = useState<Record<string, string>>({});
  const [loadingDomains, setLoadingDomains] = useState(true);

  // Reset practice state on focus
  useFocusEffect(
    useCallback(() => {
      resetPracticeState();
      // Free users are locked to the diagnostic set
      if (!isPremium) {
        setSets(['diagnostic']);
      }
      loadDomains();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isPremium]),
  );

  // Refresh count when filters change
  useEffect(() => {
    refreshAvailableCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDomain, selectedDifficulty, selectedSets]);

  // Reload domain counts when selected sets change
  useEffect(() => {
    loadDomains();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSets]);

  const loadDomains = async () => {
    setLoadingDomains(true);
    try {
      // Use set-filtered domain counts when sets are selected
      const currentSets = usePracticeStore.getState().selectedSets;
      const [countByDomain, bySet, cachedSetNames] = await Promise.all([
        currentSets.length > 0
          ? getQuestionCountByDomainAndSets(currentSets)
          : getQuestionCountByDomain(),
        getQuestionCountBySet(),
        getCachedQuestionSets(),
      ]);

      setAvailableBySet(bySet);
      setSetNames(cachedSetNames);

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

  const toggleSet = (setName: string) => {
    // Free users cannot uncheck the diagnostic set
    if (!isPremium && setName === 'diagnostic') return;

    const current = selectedSets;
    if (current.includes(setName)) {
      setSets(current.filter((s) => s !== setName));
    } else {
      setSets([...current, setName]);
    }
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

          {/* Question Sets (optional filter) */}
          {Object.keys(availableBySet).length > 0 && (
            <View style={styles.setSection}>
              <View style={styles.setSectionHeader}>
                <View>
                  <Text style={styles.setSectionTitle}>Question Sets</Text>
                  <Text style={styles.setSectionHint}>
                    {!isPremium
                      ? 'Diagnostic set only (free tier)'
                      : selectedSets.length === 0
                        ? 'All sets (no filter)'
                        : `${selectedSets.length} set${selectedSets.length > 1 ? 's' : ''} selected`}
                  </Text>
                </View>
                {isPremium && selectedSets.length > 0 && (
                  <TouchableOpacity onPress={() => setSets([])} activeOpacity={0.7}>
                    <Text style={styles.clearFilterText}>Clear Filter</Text>
                  </TouchableOpacity>
                )}
              </View>

              {Object.entries(availableBySet)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([setSlug, count]) => {
                  const isSelected = selectedSets.includes(setSlug);
                  const isLocked = !isPremium && setSlug !== 'diagnostic';
                  return (
                    <TouchableOpacity
                      key={setSlug}
                      onPress={() => {
                        if (isLocked) {
                          navigation.navigate('Upgrade');
                          return;
                        }
                        toggleSet(setSlug);
                      }}
                      activeOpacity={0.7}
                      style={[
                        styles.setRow,
                        isSelected && styles.setRowSelected,
                        isLocked && styles.setRowLocked,
                      ]}
                    >
                      <View
                        style={[
                          styles.setCheckbox,
                          isSelected && styles.setCheckboxSelected,
                          isLocked && styles.setCheckboxLocked,
                        ]}
                      >
                        {isLocked ? (
                          <Lock size={14} color={colors.textMuted} strokeWidth={2} />
                        ) : (
                          isSelected && <CheckSquare size={16} color="#fff" strokeWidth={2.5} />
                        )}
                      </View>
                      <View style={styles.setInfo}>
                        <Text
                          style={[
                            styles.setName,
                            isSelected && styles.setNameSelected,
                            isLocked && styles.setNameLocked,
                          ]}
                          numberOfLines={1}
                        >
                          {setNames[setSlug] ?? setSlug}
                        </Text>
                        <Text style={styles.setCount}>
                          {isLocked ? 'Premium' : `${count} questions`}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}

              {!isPremium && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('Upgrade')}
                  activeOpacity={0.7}
                  style={styles.upgradeHint}
                >
                  <Crown size={14} color={colors.primaryOrange} strokeWidth={2} />
                  <Text style={styles.upgradeHintText}>Upgrade to unlock all sets</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

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

  // ── Question Sets selector ──
  setSection: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    marginBottom: 16,
  },
  setSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  setSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textHeading,
  },
  setSectionHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  clearFilterText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryOrange,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  setRowSelected: {
    backgroundColor: 'rgba(255, 153, 0, 0.06)',
  },
  setRowLocked: {
    opacity: 0.55,
  },
  setCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setCheckboxSelected: {
    backgroundColor: colors.primaryOrange,
    borderColor: colors.primaryOrange,
  },
  setCheckboxLocked: {
    borderColor: colors.surfaceHover,
    backgroundColor: 'transparent',
  },
  setInfo: {
    flex: 1,
  },
  setName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textBody,
  },
  setNameSelected: {
    color: colors.textHeading,
    fontWeight: '600',
  },
  setNameLocked: {
    color: colors.textMuted,
  },
  setCount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  upgradeHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 8,
  },
  upgradeHintText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryOrange,
  },
});

export default PracticeSetupScreen;
