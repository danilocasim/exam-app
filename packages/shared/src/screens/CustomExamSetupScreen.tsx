// CustomExamSetupScreen — configure and start a custom exam
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ChevronLeft, Minus, Plus, Clock, CheckSquare, Play } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useExamStore } from '../stores';
import { getCachedExamTypeConfig } from '../services/sync.service';
import { getQuestionCountByDomain } from '../storage/repositories/question.repository';
import { useIsPremium } from '../stores/purchase.store';
import { FREE_QUESTION_LIMIT } from '../config/tiers';
import { ExamDomain } from '../storage/schema';

// AWS Modern Color Palette
const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  surfaceHover: '#374151',
  borderDefault: '#374151',
  trackGray: '#4B5563',
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  orangeLight: '#FFB84D',
  success: '#10B981',
  successLight: '#6EE7B7',
  error: '#EF4444',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'CustomExamSetup'>;

const MIN_QUESTIONS = 10;

export const CustomExamSetupScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const { startCustomExam, isLoading } = useExamStore();
  const isPremium = useIsPremium();

  const [domains, setDomains] = useState<ExamDomain[]>([]);
  const [availableByDomain, setAvailableByDomain] = useState<Record<string, number>>({});
  const [selectedDomains, setSelectedDomains] = useState<string[]>([]);
  const [questionCount, setQuestionCount] = useState(MIN_QUESTIONS);
  const [isTimed, setIsTimed] = useState(true);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadConfig();
    }, []),
  );

  const loadConfig = async () => {
    try {
      setLoading(true);
      const [config, byDomain] = await Promise.all([
        getCachedExamTypeConfig(),
        getQuestionCountByDomain(),
      ]);
      if (config) {
        setDomains(config.domains);
        setAvailableByDomain(byDomain);
        // Default: all domains selected
        const allIds = config.domains.map((d) => d.id);
        setSelectedDomains(allIds);
      }
    } catch {
      Alert.alert('Error', 'Failed to load exam configuration.');
    } finally {
      setLoading(false);
    }
  };

  // Compute max questions based on tier and selected domains
  const maxQuestions = (() => {
    if (selectedDomains.length === 0) return 0;
    const totalAvailable = selectedDomains.reduce(
      (sum, id) => sum + (availableByDomain[id] ?? 0),
      0,
    );
    if (isPremium) return totalAvailable;
    return Math.min(FREE_QUESTION_LIMIT, totalAvailable);
  })();

  // Clamp question count when max changes
  useEffect(() => {
    if (questionCount > maxQuestions && maxQuestions > 0) {
      setQuestionCount(Math.max(MIN_QUESTIONS, maxQuestions));
    }
  }, [maxQuestions, questionCount]);

  const toggleDomain = (domainId: string) => {
    setSelectedDomains((prev) =>
      prev.includes(domainId) ? prev.filter((id) => id !== domainId) : [...prev, domainId],
    );
  };

  const selectAllDomains = () => {
    setSelectedDomains(domains.map((d) => d.id));
  };

  const canStart =
    selectedDomains.length > 0 && questionCount >= MIN_QUESTIONS && maxQuestions >= MIN_QUESTIONS;

  const handleStart = async () => {
    if (!canStart) return;
    try {
      await startCustomExam({
        questionCount: Math.min(questionCount, maxQuestions),
        selectedDomains,
        isTimed,
      });
      navigation.navigate('ExamScreen', {});
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start custom exam';
      Alert.alert('Error', message);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primaryOrange} />
        <Text style={styles.loadingText}>Loading configuration...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
          style={styles.backButton}
        >
          <ChevronLeft size={24} color={colors.textHeading} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Custom Exam</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Question Count ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Number of Questions</Text>
          <Text style={styles.sectionHint}>
            {isPremium ? 'Select any amount' : `Free tier: max ${FREE_QUESTION_LIMIT} questions`}
          </Text>
          <View style={styles.counterRow}>
            <TouchableOpacity
              onPress={() => setQuestionCount((c) => Math.max(MIN_QUESTIONS, c - 5))}
              disabled={questionCount <= MIN_QUESTIONS}
              activeOpacity={0.7}
              style={[
                styles.counterBtn,
                questionCount <= MIN_QUESTIONS && styles.counterBtnDisabled,
              ]}
            >
              <Minus
                size={18}
                color={questionCount <= MIN_QUESTIONS ? colors.trackGray : colors.textHeading}
                strokeWidth={2.5}
              />
            </TouchableOpacity>

            <View style={styles.counterValueWrap}>
              <Text style={styles.counterValue}>{Math.min(questionCount, maxQuestions)}</Text>
              <Text style={styles.counterLabel}>questions</Text>
            </View>

            <TouchableOpacity
              onPress={() => setQuestionCount((c) => Math.min(maxQuestions, c + 5))}
              disabled={questionCount >= maxQuestions}
              activeOpacity={0.7}
              style={[
                styles.counterBtn,
                questionCount >= maxQuestions && styles.counterBtnDisabled,
              ]}
            >
              <Plus
                size={18}
                color={questionCount >= maxQuestions ? colors.trackGray : colors.textHeading}
                strokeWidth={2.5}
              />
            </TouchableOpacity>
          </View>

          {/* Quick select chips */}
          <View style={styles.chipRow}>
            {[10, 15, 20, 30, 50].map((n) => {
              if (n > maxQuestions && maxQuestions > 0) return null;
              const isActive = questionCount === n;
              return (
                <TouchableOpacity
                  key={n}
                  onPress={() => setQuestionCount(n)}
                  activeOpacity={0.7}
                  style={[styles.chip, isActive && styles.chipActive]}
                >
                  <Text style={[styles.chipText, isActive && styles.chipTextActive]}>{n}</Text>
                </TouchableOpacity>
              );
            })}
            {maxQuestions > 0 && (
              <TouchableOpacity
                onPress={() => setQuestionCount(maxQuestions)}
                activeOpacity={0.7}
                style={[styles.chip, questionCount === maxQuestions && styles.chipActive]}
              >
                <Text
                  style={[styles.chipText, questionCount === maxQuestions && styles.chipTextActive]}
                >
                  All
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Domains ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Domains</Text>
              <Text style={styles.sectionHint}>
                {selectedDomains.length}/{domains.length} selected
              </Text>
            </View>
            <TouchableOpacity onPress={selectAllDomains} activeOpacity={0.7}>
              <Text style={styles.selectAllText}>Select All</Text>
            </TouchableOpacity>
          </View>

          {domains.map((domain) => {
            const isSelected = selectedDomains.includes(domain.id);
            const available = availableByDomain[domain.id] ?? 0;
            return (
              <TouchableOpacity
                key={domain.id}
                onPress={() => toggleDomain(domain.id)}
                activeOpacity={0.7}
                style={[styles.domainRow, isSelected && styles.domainRowSelected]}
              >
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                  {isSelected && <CheckSquare size={16} color="#fff" strokeWidth={2.5} />}
                </View>
                <View style={styles.domainInfo}>
                  <Text
                    style={[styles.domainName, isSelected && styles.domainNameSelected]}
                    numberOfLines={1}
                  >
                    {domain.name}
                  </Text>
                  <Text style={styles.domainCount}>{available} questions</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* ── Timed / Untimed ── */}
        <View style={styles.section}>
          <View style={styles.timedRow}>
            <View style={styles.timedLeft}>
              <Clock size={18} color={colors.textMuted} strokeWidth={1.8} />
              <View>
                <Text style={styles.sectionTitle}>Timed Exam</Text>
                <Text style={styles.sectionHint}>
                  {isTimed ? 'Countdown timer enabled' : 'No time limit'}
                </Text>
              </View>
            </View>
            <Switch
              value={isTimed}
              onValueChange={setIsTimed}
              trackColor={{ false: colors.trackGray, true: colors.primaryOrange }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Spacer */}
        <View style={{ height: 24 }} />
      </ScrollView>

      {/* ── Start Button ── */}
      <View style={styles.footer}>
        <TouchableOpacity
          onPress={handleStart}
          disabled={!canStart || isLoading}
          activeOpacity={0.8}
          style={[styles.startBtn, (!canStart || isLoading) && styles.startBtnDisabled]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Play size={18} color="#fff" strokeWidth={2.5} fill="#fff" />
              <Text style={styles.startBtnText}>
                Start Exam ({Math.min(questionCount, maxQuestions)} Questions)
              </Text>
            </>
          )}
        </TouchableOpacity>
        {selectedDomains.length === 0 && (
          <Text style={styles.footerHint}>Select at least one domain to start</Text>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: colors.textHeading,
    textAlign: 'center',
    marginRight: 40,
  },
  headerSpacer: { width: 40 },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 20,
    paddingHorizontal: 20,
  },

  // Section
  section: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textHeading,
  },
  sectionHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryOrange,
  },

  // Counter
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
    marginBottom: 16,
  },
  counterBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterBtnDisabled: {
    opacity: 0.35,
  },
  counterValueWrap: {
    alignItems: 'center',
    minWidth: 60,
  },
  counterValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textHeading,
    lineHeight: 38,
  },
  counterLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },

  // Chips
  chipRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surfaceHover,
  },
  chipActive: {
    backgroundColor: colors.primaryOrange,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: '#fff',
  },

  // Domain list
  domainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 6,
    backgroundColor: 'transparent',
  },
  domainRowSelected: {
    backgroundColor: 'rgba(255, 153, 0, 0.06)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.trackGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primaryOrange,
    borderColor: colors.primaryOrange,
  },
  domainInfo: {
    flex: 1,
  },
  domainName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textBody,
  },
  domainNameSelected: {
    color: colors.textHeading,
    fontWeight: '600',
  },
  domainCount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },

  // Timed toggle
  timedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timedLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
    backgroundColor: colors.background,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.primaryOrange,
    paddingVertical: 15,
    borderRadius: 12,
  },
  startBtnDisabled: {
    opacity: 0.45,
  },
  startBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  footerHint: {
    fontSize: 12,
    color: colors.error,
    textAlign: 'center',
    marginTop: 8,
  },
});

export default CustomExamSetupScreen;
