// T041: HomeScreen — redesigned with clear visual hierarchy
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Dimensions,
  Image,
  Modal,
  Pressable,
  Animated,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { WebView } from 'react-native-webview';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Cloud,
  Play,
  AlertTriangle,
  ClipboardList,
  BarChart2,
  BookOpen,
  Zap,
  ChevronRight,
  User,
  GraduationCap,
  FileText,
  Globe,
  ExternalLink,
  X,
  ArrowLeft,
  MessageSquare,
  Target,
  Clock,
  Calendar,
  Flame,
  Crown,
  CheckCircle2,
  Lock,
  Sun,
  Pencil,
  CircleX,
  Activity,
  Minus,
  Plus,
  SlidersHorizontal,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useExamStore } from '../stores';
import { EXAM_TYPE_ID } from '../config';
import { useAuthStore } from '../stores/auth-store';
import { useStreakStore } from '../stores/streak.store';
import { hasInProgressExam, abandonCurrentExam } from '../services';
import { getInProgressExamAttempt } from '../storage/repositories/exam-attempt.repository';
import {
  getTotalQuestionCount,
  getQuestionCountBySet,
} from '../storage/repositories/question.repository';
import { canGenerateExam } from '../services/exam-generator.service';
import { getUserStats } from '../storage/repositories/user-stats.repository';
import { getOverallStats, calculateAggregatedDomainPerformance } from '../services/scoring.service';
import { EXAM_CONFIG, FREE_QUESTION_LIMIT } from '../config';
import { useIsPremium } from '../stores/purchase.store';
import {
  getDailyExamLastAttempt,
  getMissedExamLastAttempt,
} from '../storage/repositories/daily-mode.repository';
import { getMissedQuestionCount } from '../storage/repositories/missed-questions.repository';
import { CalendarStrip } from '../components/CalendarStrip';
import { DatePickerModal } from '../components/DatePickerModal';
import { getCachedQuestionSets } from '../services/sync.service';

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
  secondaryOrange: '#EC7211',
  orangeDark: 'rgba(255, 153, 0, 0.2)',
  orangeLight: '#FFB84D',
  success: '#10B981',
  successLight: '#6EE7B7',
  successDark: 'rgba(16, 185, 129, 0.15)',
  error: '#EF4444',
  errorLight: '#FCA5A5',
  errorDark: 'rgba(239, 68, 68, 0.15)',
  info: '#3B82F6',
};

const SCREEN_WIDTH = Dimensions.get('window').width;

// ── Cooldown helpers (module-level) ──
const remainingMs = (lastAttemptAt: string | null): number => {
  if (!lastAttemptAt) return 0;
  const ms = 24 * 60 * 60 * 1000 - (Date.now() - new Date(lastAttemptAt).getTime());
  return ms > 0 ? ms : 0;
};

const formatCooldown = (lastAttemptAt: string | null): string => {
  const ms = remainingMs(lastAttemptAt);
  if (ms <= 0) return '';
  const totalMinutes = Math.floor(ms / 60_000);
  if (totalMinutes <= 0) return 'Available in <1m';
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `Available in ${m}m`;
  if (m === 0) return `Available in ${h}h`;
  return `Available in ${h}h ${m}m`;
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

// ── Thin progress bar for WebView loading ──
const WebViewProgressBar: React.FC = () => {
  const progress = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    // Animate from 0 → 90% quickly, then slow down (feels like real loading)
    Animated.sequence([
      Animated.timing(progress, {
        toValue: 0.6,
        duration: 800,
        useNativeDriver: false,
      }),
      Animated.timing(progress, {
        toValue: 0.9,
        duration: 4000,
        useNativeDriver: false,
      }),
    ]).start();
  }, [progress]);

  const width = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, screenWidth],
  });

  return (
    <View style={styles.webViewProgressTrack}>
      <Animated.View style={[styles.webViewProgressBar, { width }]} />
    </View>
  );
};

// ── TierCard ──
// Unified card for FREE and PREMIUM states — same structure, animated internals.
// Uses opacity-gated CTA (not conditional) so card height never shifts.
const TierCard: React.FC<{
  isPremium: boolean;
  questionCount: number;
  onUpgrade: () => void;
}> = ({ isPremium, questionCount, onUpgrade }) => {
  const isPremiumRef = useRef(isPremium);

  // Compute initial progress ratio for FREE state
  const freeRatio = questionCount > 0 ? FREE_QUESTION_LIMIT / questionCount : 0;
  const progressAnim = useRef(new Animated.Value(isPremium ? 1 : freeRatio)).current;
  const ctaOpacity = useRef(new Animated.Value(isPremium ? 0 : 1)).current;

  // Sync progress when questionCount loads async (FREE only, instant — not an upgrade)
  useEffect(() => {
    if (!isPremiumRef.current && questionCount > 0) {
      progressAnim.setValue(FREE_QUESTION_LIMIT / questionCount);
    }
  }, [questionCount]);

  // Animate only on the FREE → PREMIUM transition
  useEffect(() => {
    if (isPremium && !isPremiumRef.current) {
      Animated.parallel([
        Animated.timing(progressAnim, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(ctaOpacity, { toValue: 0, duration: 350, useNativeDriver: true }),
      ]).start();
    }
    isPremiumRef.current = isPremium;
  }, [isPremium]);

  const lockedCount = Math.max(0, questionCount - FREE_QUESTION_LIMIT);
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.tierCard}>
      {/* Plan label row */}
      <View style={styles.tierCardHeader}>
        <View style={styles.tierCardLeft}>
          <Crown size={14} color="#F59E0B" strokeWidth={2} />
          <Text style={styles.tierPlanLabel}>{isPremium ? 'Premium Plan' : 'Free Plan'}</Text>
        </View>
        {isPremium && (
          <View style={styles.tierActivePill}>
            <CheckCircle2 size={12} color={colors.success} strokeWidth={2.5} />
            <Text style={styles.tierActivePillText}>All Unlocked</Text>
          </View>
        )}
      </View>

      {/* Count description */}
      <Text style={styles.tierCountText}>
        {isPremium
          ? `All ${questionCount} questions unlocked`
          : `${FREE_QUESTION_LIMIT} of ${questionCount} questions available`}
      </Text>

      {/* Progress bar — always rendered, animates to full on upgrade */}
      <View style={styles.tierProgressTrack}>
        <Animated.View
          style={[
            styles.tierProgressFill,
            isPremium && styles.tierProgressFillSuccess,
            { width: progressWidth },
          ]}
        />
      </View>

      {/* Upgrade CTA — always in layout (prevents height shift), fades on upgrade */}
      <Animated.View style={[styles.tierCtaRow, { opacity: ctaOpacity }]}>
        <TouchableOpacity
          onPress={onUpgrade}
          style={styles.tierUpgradeLink}
          activeOpacity={0.7}
          disabled={isPremium}
        >
          <Text style={styles.tierUpgradeLinkText}>Unlock {lockedCount} more questions</Text>
          <ChevronRight size={13} color={colors.primaryOrange} strokeWidth={2.5} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ── HomeScreen ──
export const HomeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { startExam, resumeExam, isLoading, error, setError } = useExamStore();
  const { isSignedIn, user } = useAuthStore();
  const isPremium = useIsPremium();
  const { streak, motivation, completedToday, daysUntilExam, loadStreak, saveExamDate } =
    useStreakStore();

  const [hasInProgressDaily, setHasInProgressDaily] = useState(false);
  const [hasInProgressMock, setHasInProgressMock] = useState(false);
  const [hasInProgressMissed, setHasInProgressMissed] = useState(false);
  const [hasInProgressCustom, setHasInProgressCustom] = useState(false);
  const [hasInProgressDiagnostic, setHasInProgressDiagnostic] = useState(false);
  const [questionCount, setQuestionCount] = useState(0);
  const [canStart, setCanStart] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);

  // Supplementary data for progress ring + insights
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [passRate, setPassRate] = useState(0);
  const [totalExams, setTotalExams] = useState(0);
  const [weakDomainName, setWeakDomainName] = useState<string | null>(null);
  const [showResources, setShowResources] = useState(false);
  const [webViewUrl, setWebViewUrl] = useState<string | null>(null);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dailyLastAttempt, setDailyLastAttempt] = useState<string | null>(null);
  const [, setTick] = useState(0);

  // Missed Questions Quiz state
  const [missedCount, setMissedCount] = useState(0);
  const [missedLastAttempt, setMissedLastAttempt] = useState<string | null>(null);
  const [showMissedPicker, setShowMissedPicker] = useState(false);
  const [selectedMissedCount, setSelectedMissedCount] = useState(10);

  // Mock Exam set picker state
  const [availableBySet, setAvailableBySet] = useState<Record<string, number>>({});
  const [setNames, setSetNames] = useState<Record<string, string>>({});
  const [showMockSetPicker, setShowMockSetPicker] = useState(false);
  const [selectedMockSets, setSelectedMockSets] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      checkExamStatus();
      loadStreak();
    }, []),
  );

  // Real-time cooldown: tick every 60s to recompute remaining time
  useEffect(() => {
    if (isPremium) return;
    const id = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [isPremium]);

  const checkExamStatus = async () => {
    setCheckingStatus(true);
    try {
      const [
        inProgressDaily,
        inProgressMock,
        inProgressMissed,
        inProgressCustom,
        inProgressDiagnostic,
        count,
        canGen,
        examLast,
        missedLast,
        missedQCount,
        bySet,
        cachedSetNames,
      ] = await Promise.all([
        hasInProgressExam('daily'),
        hasInProgressExam('mock'),
        hasInProgressExam('missed'),
        hasInProgressExam('custom'),
        hasInProgressExam('diagnostic'),
        getTotalQuestionCount(),
        canGenerateExam(),
        getDailyExamLastAttempt(),
        getMissedExamLastAttempt(),
        getMissedQuestionCount(),
        getQuestionCountBySet(),
        getCachedQuestionSets(),
      ]);
      setHasInProgressDaily(inProgressDaily);
      setHasInProgressMock(inProgressMock);
      setHasInProgressMissed(inProgressMissed);
      setHasInProgressCustom(inProgressCustom);
      setHasInProgressDiagnostic(inProgressDiagnostic);
      setQuestionCount(count);
      setCanStart(canGen.canGenerate);
      setDailyLastAttempt(examLast);
      setMissedLastAttempt(missedLast);
      setMissedCount(missedQCount);
      setSelectedMissedCount((prev) => Math.min(prev, missedQCount || 10));
      setAvailableBySet(bySet);
      setSetNames(cachedSetNames);

      // Non-critical analytics data
      try {
        const [stats, overall, domainPerf] = await Promise.all([
          getUserStats(),
          getOverallStats(),
          calculateAggregatedDomainPerformance(),
        ]);
        setQuestionsAnswered(stats.totalQuestions);
        setPassRate(overall.passRate);
        setTotalExams(overall.totalExams);

        const weak = domainPerf
          .filter((d) => d.percentage < 70)
          .sort((a, b) => a.percentage - b.percentage);
        setWeakDomainName(weak.length > 0 ? weak[0].domainName : null);
      } catch {
        // CTA still works without analytics
      }
    } catch (err) {
      console.error('[HomeScreen] Failed to check exam status:', err);
    } finally {
      setCheckingStatus(false);
    }
  };

  // ── Handlers ──
  // mode: 'daily' (always FREE tier, 15 questions) or 'mock' (user's tier)
  const handleStartExam = async (mode: 'daily' | 'mock' = 'mock', sets?: string[]) => {
    try {
      setError(null);
      const tier = mode === 'daily' ? 'FREE' : undefined;
      await startExam(tier, mode, sets && sets.length > 0 ? sets : undefined);
      navigation.navigate('ExamScreen', {});
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('already in progress')) {
        try {
          const inProgress = await getInProgressExamAttempt(mode);
          if (inProgress) await abandonCurrentExam(inProgress.id);
          const tier = mode === 'daily' ? 'FREE' : undefined;
          await startExam(tier, mode, sets && sets.length > 0 ? sets : undefined);
          navigation.navigate('ExamScreen', {});
          return;
        } catch {
          // fall through
        }
      }
      Alert.alert('Error', message || 'Failed to start exam');
    }
  };

  const handleStartDiagnosticExam = async () => {
    try {
      setError(null);
      const { startDiagnosticExam } = useExamStore.getState();
      await startDiagnosticExam();
      navigation.navigate('ExamScreen', {});
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('already in progress')) {
        try {
          const ip = await getInProgressExamAttempt('diagnostic');
          if (ip) await abandonCurrentExam(ip.id);
          const { startDiagnosticExam } = useExamStore.getState();
          await startDiagnosticExam();
          navigation.navigate('ExamScreen', {});
          return;
        } catch {
          // fall through
        }
      }
      Alert.alert('Error', message || 'Failed to start diagnostic test');
    }
  };

  const handleResumeExam = async (
    mode: 'daily' | 'mock' | 'missed' | 'custom' | 'diagnostic' = 'mock',
  ) => {
    try {
      setError(null);
      const resumed = await resumeExam(mode);
      if (resumed) {
        navigation.navigate('ExamScreen', {});
      } else {
        await checkExamStatus();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resume exam';
      Alert.alert('Error', message);
    }
  };

  // Accepts mode for starting a new exam (abandons existing of SAME mode only)
  const handleStartNewExam = (
    mode: 'daily' | 'mock' | 'missed' | 'custom' | 'diagnostic' = 'mock',
  ) => {
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
              const { abandonExam } = useExamStore.getState();
              const session = useExamStore.getState().session;
              if (session && session.attempt.mode === mode) {
                await abandonExam();
              } else {
                const ip = await getInProgressExamAttempt(mode);
                if (ip) await abandonCurrentExam(ip.id);
              }
            } catch {
              // continue
            }
            if (mode === 'missed') {
              await handleStartMissedExam(selectedMissedCount);
            } else if (mode === 'custom') {
              navigation.navigate('CustomExamSetup');
            } else if (mode === 'diagnostic') {
              await handleStartDiagnosticExam();
            } else {
              await handleStartExam(mode);
            }
          },
        },
      ],
    );
  };

  // ── Missed Questions Quiz handlers ──
  const handleStartMissedExam = async (count: number) => {
    try {
      setError(null);
      const { startMissedExam } = useExamStore.getState();
      await startMissedExam(count);
      navigation.navigate('ExamScreen', {});
    } catch (err) {
      const message = err instanceof Error ? err.message : '';
      if (message.includes('already in progress')) {
        try {
          const ip = await getInProgressExamAttempt('missed');
          if (ip) await abandonCurrentExam(ip.id);
          const { startMissedExam } = useExamStore.getState();
          await startMissedExam(count);
          navigation.navigate('ExamScreen', {});
          return;
        } catch {
          // fall through
        }
      }
      Alert.alert('Error', message || 'Failed to start missed questions quiz');
    }
  };

  const handleMissedCardPress = () => {
    if (hasInProgressMissed) {
      handleResumeExam('missed');
    } else {
      // Open picker to choose question count
      setSelectedMissedCount(Math.min(10, missedCount));
      setShowMissedPicker(true);
    }
  };

  const handleCustomCardPress = () => {
    if (hasInProgressCustom) {
      handleResumeExam('custom');
    } else {
      navigation.navigate('CustomExamSetup');
    }
  };

  const handleMockCardPress = () => {
    if (hasInProgressMock) {
      handleResumeExam('mock');
    } else {
      // Open set picker for mock exam
      setSelectedMockSets([]);
      setShowMockSetPicker(true);
    }
  };

  const toggleMockSet = (slug: string) => {
    setSelectedMockSets((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  // ── Loading splash ──
  if (checkingStatus) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <View style={styles.loadingIcon}>
          <Cloud size={32} color={colors.textHeading} strokeWidth={2} />
        </View>
        <ActivityIndicator size="large" color={colors.primaryOrange} />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  // ── Resource definitions ──
  const resources = [
    {
      key: 'courses',
      label: 'Courses & Ebooks',
      sub: 'Study materials',
      icon: <GraduationCap size={20} color="#F59E0B" strokeWidth={1.5} />,
      gradient: ['rgba(245, 158, 11, 0.14)', 'rgba(245, 158, 11, 0.04)'] as [string, string],
      borderColor: 'rgba(245, 158, 11, 0.25)',
      url: 'https://portal.tutorialsdojo.com/shop/',
    },
    {
      key: 'blogs',
      label: 'Blogs',
      sub: 'Latest articles',
      icon: <FileText size={20} color="#8B5CF6" strokeWidth={1.5} />,
      gradient: ['rgba(139, 92, 246, 0.14)', 'rgba(139, 92, 246, 0.04)'] as [string, string],
      borderColor: 'rgba(139, 92, 246, 0.25)',
      url: 'https://tutorialsdojo.com/blog/',
    },
    {
      key: 'cheatsheets',
      label: 'Cheat Sheets',
      sub: 'Quick reference',
      icon: <Globe size={20} color="#06B6D4" strokeWidth={1.5} />,
      gradient: ['rgba(6, 182, 212, 0.14)', 'rgba(6, 182, 212, 0.04)'] as [string, string],
      borderColor: 'rgba(6, 182, 212, 0.25)',
      url: 'https://tutorialsdojo.com/aws-cheat-sheets/',
    },
  ];

  const handleOpenResource = (url: string) => {
    setWebViewLoading(true);
    setWebViewUrl(url);
    setShowResources(false);
  };

  const handleCloseWebView = () => {
    setWebViewUrl(null);
    setWebViewLoading(true);
  };

  // ── Tier-aware mode definitions ──
  // Cards always visible for both tiers — only lock/cooldown state changes.
  // Cooldown (FREE only): computed from SQLite via getDailyExamLastAttempt() / getMissedExamLastAttempt().
  // Cooldown is recorded on exam SUBMISSION in exam.store.ts, not on start.
  const missedCooldownActive = !isPremium && remainingMs(missedLastAttempt) > 0;
  const missedEmpty = missedCount === 0;
  const missedDisabled =
    (missedCooldownActive && !hasInProgressMissed) || (missedEmpty && !hasInProgressMissed);

  const diagnosticCard = {
    key: 'diagnostic',
    label: 'Diagnostic Test',
    sub: hasInProgressDiagnostic ? 'In progress' : 'Assess your readiness',
    icon: <Activity size={22} color={colors.success} strokeWidth={1.8} />,
    iconBg: 'rgba(16, 185, 129, 0.15)',
    locked: false,
    cooldown: false,
    onPress: hasInProgressDiagnostic
      ? () => handleResumeExam('diagnostic')
      : () => handleStartDiagnosticExam(),
  };

  const missedCard = {
    key: 'missed',
    label: 'Missed Question',
    sub: hasInProgressMissed
      ? 'In progress'
      : isPremium
        ? missedEmpty
          ? 'No missed questions yet'
          : missedCooldownActive
            ? formatCooldown(missedLastAttempt)
            : `${missedCount} available`
        : '',
    icon: isPremium ? (
      <CircleX size={22} color={missedDisabled ? colors.textMuted : '#EF4444'} strokeWidth={1.8} />
    ) : (
      <Lock size={22} color={colors.textMuted} strokeWidth={1.8} />
    ),
    iconBg: isPremium
      ? missedDisabled
        ? colors.surfaceHover
        : 'rgba(239, 68, 68, 0.12)'
      : colors.surfaceHover,
    locked: !isPremium,
    cooldown: isPremium && missedDisabled,
    onPress: !isPremium ? () => navigation.navigate('Upgrade') : handleMissedCardPress,
  };

  const customCard = {
    key: 'custom',
    label: 'Custom Exam',
    sub: hasInProgressCustom ? 'In progress' : isPremium ? 'Build your own' : '',
    icon: isPremium ? (
      <SlidersHorizontal size={22} color={colors.info} strokeWidth={1.8} />
    ) : (
      <Lock size={22} color={colors.textMuted} strokeWidth={1.8} />
    ),
    iconBg: isPremium ? 'rgba(59, 130, 246, 0.15)' : colors.surfaceHover,
    locked: !isPremium,
    cooldown: false,
    onPress: !isPremium ? () => navigation.navigate('Upgrade') : handleCustomCardPress,
  };

  const mockCard = {
    key: 'mock',
    label: 'Mock Exam',
    sub: hasInProgressMock
      ? 'In progress'
      : isPremium
        ? `${EXAM_CONFIG.QUESTIONS_PER_EXAM} questions · timed`
        : '',
    icon: isPremium ? (
      <Target size={22} color={colors.primaryOrange} strokeWidth={1.8} />
    ) : (
      <Lock size={22} color={colors.textMuted} strokeWidth={1.8} />
    ),
    iconBg: isPremium ? 'rgba(255, 153, 0, 0.15)' : colors.surfaceHover,
    locked: !isPremium,
    cooldown: false,
    onPress: !isPremium ? () => navigation.navigate('Upgrade') : () => handleMockCardPress(),
  };

  const gridModes = [diagnosticCard, missedCard, mockCard, customCard];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* ── Compact Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoIcon}>
              <Cloud size={16} color={colors.textHeading} strokeWidth={2.5} />
            </View>
            <View>
              <View style={styles.headerTitleRow}>
                <Text style={styles.appTitle}>Dojo Exam</Text>
                <Text style={styles.headerBadge}>{EXAM_TYPE_ID}</Text>
              </View>
              <Text style={styles.brandSubtitle}>by Tutorials Dojo</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Settings')}
            activeOpacity={0.7}
            style={styles.headerProfileBtn}
          >
            {isSignedIn && user ? (
              user.picture ? (
                <Image source={{ uri: user.picture }} style={styles.headerAvatarImg} />
              ) : (
                <View style={styles.headerAvatar}>
                  <Text style={styles.headerAvatarText}>
                    {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )
            ) : (
              <View style={[styles.headerAvatar, styles.headerAvatarGuest]}>
                <User size={16} color={colors.textMuted} strokeWidth={2} />
              </View>
            )}
            {isSignedIn && <View style={styles.onlineDot} />}
          </TouchableOpacity>
        </View>

        {/* ── Row 2: Countdown + Streak ── */}
        <View style={styles.statsRow}>
          {/* Countdown */}
          <TouchableOpacity
            style={styles.statsCard}
            activeOpacity={0.7}
            onPress={() => setShowDatePicker(true)}
          >
            <Calendar size={16} color={colors.primaryOrange} strokeWidth={2} />
            <Text style={styles.statsValue}>
              {streak?.examDate ? `${Math.max(0, daysUntilExam ?? 0)}` : '—'}
            </Text>
            <Text style={styles.statsLabel}>{streak?.examDate ? 'Days Left' : 'Set Date'}</Text>
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.statsRowDivider} />

          {/* Streak */}
          <View style={styles.statsCard}>
            <Flame
              size={16}
              color={completedToday ? colors.primaryOrange : colors.textMuted}
              strokeWidth={2}
              fill={completedToday ? 'rgba(255, 153, 0, 0.3)' : 'none'}
            />
            <Text style={styles.statsValue}>{streak?.currentStreak ?? 0}</Text>
            <Text style={styles.statsLabel}>Day Streak</Text>
          </View>
        </View>

        {/* ── Row 3: Calendar Strip ── */}
        <CalendarStrip examDate={streak?.examDate} />

        <View style={styles.content}>
          {/* ── Primary CTA ──
               Shows the most relevant action: resume an in-progress exam, start a new one, or cooldown notice.
               Diagnostic Test and Mock Exam are independent — each mode card handles its own resume/start.
               The primary CTA is for the "best next action" convenience button. */}
          {hasInProgressDiagnostic || hasInProgressMock ? (
            /* ── Resume Exam (strongest CTA) ── */
            <View style={styles.ctaSection}>
              <TouchableOpacity
                onPress={() => handleResumeExam(hasInProgressDiagnostic ? 'diagnostic' : 'mock')}
                disabled={isLoading}
                activeOpacity={0.85}
                style={styles.ctaWrapper}
              >
                <LinearGradient
                  colors={[colors.primaryOrange, colors.secondaryOrange]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <View style={styles.ctaContent}>
                      <View style={styles.ctaLeft}>
                        <View style={styles.ctaIconCircle}>
                          <Play
                            size={18}
                            color={colors.textHeading}
                            strokeWidth={2.5}
                            fill={colors.textHeading}
                          />
                        </View>
                        <View>
                          <Text style={styles.ctaTitle}>
                            Resume {hasInProgressDiagnostic ? 'Diagnostic Test' : 'Mock Exam'}
                          </Text>
                          <Text style={styles.ctaSub}>Continue where you left off</Text>
                        </View>
                      </View>
                      <ChevronRight size={20} color={colors.textHeading} strokeWidth={2} />
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => handleStartNewExam(hasInProgressDiagnostic ? 'diagnostic' : 'mock')}
                disabled={isLoading}
                activeOpacity={0.7}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionText}>or start a new exam</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* ── Start CTA: "Start Diagnostic Test" (FREE) or "Start Exam" (PREMIUM) ── */
            <TouchableOpacity
              onPress={() => (isPremium ? handleMockCardPress() : handleStartDiagnosticExam())}
              disabled={isLoading || !canStart}
              activeOpacity={0.85}
              style={[styles.ctaWrapper, !canStart && styles.ctaDisabled]}
            >
              <LinearGradient
                colors={
                  canStart
                    ? [colors.primaryOrange, colors.secondaryOrange]
                    : [colors.surfaceHover, colors.surface]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <View style={styles.ctaContent}>
                    <View style={styles.ctaLeft}>
                      <View
                        style={[
                          styles.ctaIconCircle,
                          !canStart && { backgroundColor: colors.trackGray },
                        ]}
                      >
                        {isPremium ? (
                          <Zap size={18} color={colors.textHeading} strokeWidth={2.5} />
                        ) : (
                          <Activity size={18} color={colors.textHeading} strokeWidth={2.5} />
                        )}
                      </View>
                      <View>
                        <Text style={styles.ctaTitle}>
                          {isPremium ? 'Start Exam' : 'Start Diagnostic Test'}
                        </Text>
                        <Text style={styles.ctaSub}>
                          {isPremium
                            ? `${EXAM_CONFIG.QUESTIONS_PER_EXAM} questions · ${EXAM_CONFIG.TIME_LIMIT_MINUTES} min`
                            : 'Assess your readiness'}
                        </Text>
                      </View>
                    </View>
                    <ChevronRight
                      size={20}
                      color={canStart ? colors.textHeading : colors.textMuted}
                      strokeWidth={2}
                    />
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Warning */}
          {!canStart && !hasInProgressDiagnostic && !hasInProgressMock && (
            <View style={styles.warningRow}>
              <AlertTriangle size={14} color={colors.errorLight} strokeWidth={2} />
              <Text style={styles.warningText}>
                Need {EXAM_CONFIG.QUESTIONS_PER_EXAM}+ questions to start ({questionCount} loaded)
              </Text>
            </View>
          )}
          {error && (
            <View style={styles.warningRow}>
              <AlertTriangle size={14} color={colors.errorLight} strokeWidth={2} />
              <Text style={styles.warningText}>{error}</Text>
            </View>
          )}

          {/* ── Tier Card ── */}
          <TierCard
            isPremium={isPremium}
            questionCount={questionCount}
            onUpgrade={() => navigation.navigate('Upgrade')}
          />

          {/* ── Modes section label ── */}
          <Text style={styles.sectionLabel}>Modes</Text>
        </View>

        {/* ── Modes grid (Daily Quiz · Mock Exam · Missed Question) ── */}
        <View style={styles.actionsGrid}>
          {gridModes.map((mode) => (
            <TouchableOpacity
              key={mode.key}
              onPress={mode.cooldown ? undefined : mode.onPress}
              disabled={mode.cooldown}
              activeOpacity={mode.locked ? 0.8 : mode.cooldown ? 1 : 0.7}
              style={[
                styles.actionCardGrid,
                mode.cooldown && styles.actionCardDisabled,
                mode.locked && styles.actionCardLocked,
              ]}
            >
              <View style={[styles.actionCardInner, mode.locked && styles.actionCardInnerLocked]}>
                <View style={[styles.actionIconWrap, { backgroundColor: mode.iconBg }]}>
                  {mode.icon}
                </View>
                <Text
                  style={[
                    styles.actionTitle,
                    (mode.locked || mode.cooldown) && styles.actionTitleMuted,
                  ]}
                >
                  {mode.label}
                </Text>
                {mode.locked ? (
                  <View style={styles.premiumBadge}>
                    <Crown size={12} color="#F59E0B" strokeWidth={2.2} />
                    <Text style={styles.premiumBadgeText}>Premium</Text>
                  </View>
                ) : (
                  <Text style={[styles.actionSub, mode.cooldown && styles.actionSubCooldown]}>
                    {mode.sub}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Resources Button ── */}
        <View style={styles.content}>
          <TouchableOpacity
            onPress={() => setShowResources(true)}
            activeOpacity={0.8}
            style={styles.resourcesBtn}
          >
            <View style={styles.resourcesBtnLeft}>
              <View style={styles.resourcesBtnIcon}>
                <BookOpen size={18} color={colors.primaryOrange} strokeWidth={2} />
              </View>
              <Text style={styles.resourcesBtnText}>Resources</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* ── Feedback Button ── */}
        <View style={styles.content}>
          <TouchableOpacity
            onPress={() => {
              WebBrowser.openBrowserAsync('https://forms.gle/uAwSbyFjXddZMSNF8');
            }}
            activeOpacity={0.8}
            style={styles.feedbackBtn}
          >
            <View style={styles.resourcesBtnLeft}>
              <View style={styles.feedbackBtnIcon}>
                <MessageSquare size={18} color={colors.success} strokeWidth={2} />
              </View>
              <Text style={styles.resourcesBtnText}>Bug Report & Suggestions</Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Bottom spacer */}
        <View style={{ height: Math.max(24, insets.bottom) }} />
      </ScrollView>

      {/* ── Resources Drawer ── */}
      <Modal
        visible={showResources}
        animationType="slide"
        transparent
        onRequestClose={() => setShowResources(false)}
      >
        <Pressable style={styles.drawerOverlay} onPress={() => setShowResources(false)}>
          <Pressable style={styles.drawerSheet} onPress={(e) => e.stopPropagation()}>
            {/* Drawer handle */}
            <View style={styles.drawerHandle} />

            {/* Drawer header */}
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Resources</Text>
              <TouchableOpacity
                onPress={() => setShowResources(false)}
                activeOpacity={0.7}
                style={styles.drawerCloseBtn}
              >
                <X size={20} color={colors.textBody} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {/* Resource items */}
            <View style={styles.drawerBody}>
              {resources.map((res, idx) => (
                <TouchableOpacity
                  key={res.key}
                  onPress={() => handleOpenResource(res.url)}
                  activeOpacity={0.7}
                  style={[styles.drawerItem, idx < resources.length - 1 && styles.drawerItemBorder]}
                >
                  <View style={[styles.drawerItemIcon, { borderColor: res.borderColor }]}>
                    {res.icon}
                  </View>
                  <View style={styles.drawerItemContent}>
                    <Text style={styles.drawerItemLabel}>{res.label}</Text>
                    <Text style={styles.drawerItemSub}>{res.sub}</Text>
                  </View>
                  <ExternalLink size={14} color={colors.textMuted} strokeWidth={2} />
                </TouchableOpacity>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── WebView Resource Viewer ── */}
      <Modal
        visible={webViewUrl !== null}
        animationType="slide"
        onRequestClose={handleCloseWebView}
      >
        <SafeAreaView style={styles.webViewSafe} edges={['top']}>
          {/* Nav bar */}
          <View style={styles.webViewNav}>
            <TouchableOpacity
              onPress={handleCloseWebView}
              activeOpacity={0.7}
              style={styles.webViewBackBtn}
            >
              <ArrowLeft size={20} color={colors.textHeading} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.webViewTitle} numberOfLines={1}>
              Resources
            </Text>
            {/* Remove right nav logo for Resources modal */}
            <View style={{ width: 38, height: 38 }} />
          </View>

          {/* Progress bar below nav */}
          {webViewLoading && <WebViewProgressBar />}

          {/* WebView */}
          {webViewUrl && (
            <WebView
              source={{ uri: webViewUrl }}
              style={styles.webView}
              onLoadStart={() => setWebViewLoading(true)}
              onLoadEnd={() => setWebViewLoading(false)}
              startInLoadingState={false}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* ── Date Picker Modal ── */}
      <DatePickerModal
        visible={showDatePicker}
        currentDate={streak?.examDate ?? null}
        onSave={async (date) => {
          await saveExamDate(date);
          setShowDatePicker(false);
        }}
        onClear={async () => {
          await saveExamDate(null);
          setShowDatePicker(false);
        }}
        onClose={() => setShowDatePicker(false)}
      />

      {/* ── Missed Questions Count Picker ── */}
      <Modal
        visible={showMissedPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMissedPicker(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowMissedPicker(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <CircleX size={20} color="#EF4444" strokeWidth={2} />
              <Text style={styles.pickerTitle}>Missed Question</Text>
            </View>
            <Text style={styles.pickerDescription}>
              Review questions you previously answered incorrectly. Choose how many to include.
            </Text>

            {/* Counter */}
            <View style={styles.pickerCounter}>
              <TouchableOpacity
                onPress={() => setSelectedMissedCount((c) => Math.max(1, c - 1))}
                disabled={selectedMissedCount <= 1}
                activeOpacity={0.7}
                style={[styles.pickerBtn, selectedMissedCount <= 1 && styles.pickerBtnDisabled]}
              >
                <Minus
                  size={18}
                  color={selectedMissedCount <= 1 ? colors.trackGray : colors.textHeading}
                  strokeWidth={2.5}
                />
              </TouchableOpacity>

              <View style={styles.pickerValueWrap}>
                <Text style={styles.pickerValue}>{selectedMissedCount}</Text>
                <Text style={styles.pickerValueLabel}>questions</Text>
              </View>

              <TouchableOpacity
                onPress={() => setSelectedMissedCount((c) => Math.min(missedCount, c + 1))}
                disabled={selectedMissedCount >= missedCount}
                activeOpacity={0.7}
                style={[
                  styles.pickerBtn,
                  selectedMissedCount >= missedCount && styles.pickerBtnDisabled,
                ]}
              >
                <Plus
                  size={18}
                  color={selectedMissedCount >= missedCount ? colors.trackGray : colors.textHeading}
                  strokeWidth={2.5}
                />
              </TouchableOpacity>
            </View>

            {/* Quick select chips */}
            <View style={styles.pickerChips}>
              {[5, 10, 15, 20]
                .filter((n) => n <= missedCount)
                .map((n) => (
                  <TouchableOpacity
                    key={n}
                    onPress={() => setSelectedMissedCount(n)}
                    activeOpacity={0.7}
                    style={[
                      styles.pickerChip,
                      selectedMissedCount === n && styles.pickerChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.pickerChipText,
                        selectedMissedCount === n && styles.pickerChipTextActive,
                      ]}
                    >
                      {n}
                    </Text>
                  </TouchableOpacity>
                ))}
              {/* "All" chip */}
              <TouchableOpacity
                onPress={() => setSelectedMissedCount(missedCount)}
                activeOpacity={0.7}
                style={[
                  styles.pickerChip,
                  selectedMissedCount === missedCount && styles.pickerChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.pickerChipText,
                    selectedMissedCount === missedCount && styles.pickerChipTextActive,
                  ]}
                >
                  All ({missedCount})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.pickerActions}>
              <TouchableOpacity
                onPress={() => setShowMissedPicker(false)}
                activeOpacity={0.7}
                style={styles.pickerCancelBtn}
              >
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowMissedPicker(false);
                  handleStartMissedExam(selectedMissedCount);
                }}
                activeOpacity={0.85}
                style={styles.pickerStartBtn}
              >
                <Text style={styles.pickerStartText}>Start Quiz</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Mock Exam Set Picker ── */}
      <Modal
        visible={showMockSetPicker}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMockSetPicker(false)}
      >
        <Pressable style={styles.pickerOverlay} onPress={() => setShowMockSetPicker(false)}>
          <Pressable style={styles.pickerSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.pickerHeader}>
              <Target size={20} color={colors.primaryOrange} strokeWidth={2} />
              <Text style={styles.pickerTitle}>Mock Exam</Text>
            </View>
            <Text style={styles.pickerDescription}>
              Select question sets to include, or start with all sets.
            </Text>

            {/* Set list */}
            <ScrollView style={styles.mockSetList} showsVerticalScrollIndicator={false}>
              {Object.entries(availableBySet)
                .filter(([slug]) => slug !== '_unassigned')
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([slug, count]) => {
                  const isSelected = selectedMockSets.includes(slug);
                  return (
                    <TouchableOpacity
                      key={slug}
                      onPress={() => toggleMockSet(slug)}
                      activeOpacity={0.7}
                      style={[styles.mockSetRow, isSelected && styles.mockSetRowSelected]}
                    >
                      <View
                        style={[
                          styles.mockSetCheckbox,
                          isSelected && styles.mockSetCheckboxSelected,
                        ]}
                      >
                        {isSelected && <CheckCircle2 size={16} color="#fff" strokeWidth={2.5} />}
                      </View>
                      <View style={styles.mockSetInfo}>
                        <Text
                          style={[styles.mockSetName, isSelected && styles.mockSetNameSelected]}
                          numberOfLines={1}
                        >
                          {setNames[slug] ?? slug}
                        </Text>
                        <Text style={styles.mockSetCount}>{count} questions</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>

            <Text style={styles.mockSetHint}>
              {selectedMockSets.length === 0
                ? `All sets · ${EXAM_CONFIG.QUESTIONS_PER_EXAM} questions`
                : `${selectedMockSets.length} set${selectedMockSets.length > 1 ? 's' : ''} selected · ${EXAM_CONFIG.QUESTIONS_PER_EXAM} questions`}
            </Text>

            {/* Actions */}
            <View style={styles.pickerActions}>
              <TouchableOpacity
                onPress={() => setShowMockSetPicker(false)}
                activeOpacity={0.7}
                style={styles.pickerCancelBtn}
              >
                <Text style={styles.pickerCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setShowMockSetPicker(false);
                  // If no sets explicitly selected, pass all available set slugs
                  // so questions are drawn from named sets only (not unassigned)
                  const setsToUse =
                    selectedMockSets.length > 0
                      ? selectedMockSets
                      : Object.keys(availableBySet).filter((s) => s !== '_unassigned');
                  handleStartExam('mock', setsToUse);
                }}
                activeOpacity={0.85}
                style={styles.pickerStartBtn}
              >
                <Text style={styles.pickerStartText}>Start Exam</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

// ── Styles ──
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, marginTop: 12 },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  loadingIcon: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  loadingText: { marginTop: 12, color: colors.textMuted, fontSize: 15 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logoIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appTitle: { fontSize: 18, fontWeight: 'bold', color: colors.textHeading, lineHeight: 22 },
  brandSubtitle: { fontSize: 10, color: colors.textMuted, letterSpacing: 0.3, marginTop: 1 },
  headerBadge: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.orangeLight,
    backgroundColor: colors.orangeDark,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },

  // Row 2: Countdown + Streak
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 0,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  statsCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  statsValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textHeading,
    lineHeight: 26,
  },
  statsLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  statsRowDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderDefault,
  },

  // Primary CTA
  ctaSection: { marginBottom: 8 },
  ctaWrapper: { borderRadius: 14, overflow: 'hidden', marginBottom: 4 },
  ctaDisabled: { opacity: 0.5 },
  ctaGradient: { paddingVertical: 18, paddingHorizontal: 20 },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  ctaIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: { fontSize: 17, fontWeight: 'bold', color: colors.textHeading },
  ctaSub: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 1 },
  secondaryAction: { alignItems: 'center', paddingVertical: 8 },
  secondaryActionText: { fontSize: 13, color: colors.textMuted },

  // Warning
  warningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.errorDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  warningText: { color: colors.errorLight, fontSize: 13, flex: 1 },

  // Section Label
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
    marginTop: 8,
  },

  // Quick Actions (2x2 Grid)
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  actionCardGrid: {
    width: (SCREEN_WIDTH - 52) / 2,
    flexShrink: 0,
    height: 140,
  },
  actionCardInner: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    flex: 1,
    justifyContent: 'center',
  },
  actionIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionTitle: { fontSize: 14, fontWeight: '700', color: colors.textHeading },
  actionSub: { fontSize: 12, color: colors.textMuted, marginTop: 4, textAlign: 'center' },
  // Locked card (Premium gate) — disabled look with subtle amber border
  actionCardLocked: { opacity: 0.55 },
  actionCardInnerLocked: { borderColor: 'rgba(245, 158, 11, 0.18)' },
  // Cooldown state (daily quiz already completed today — FREE only)
  actionCardDisabled: { opacity: 0.58 },
  actionTitleMuted: { color: colors.textMuted },
  actionSubCooldown: { color: '#F59E0B' }, // cooldown countdown timer
  // Premium badge — replaces sub text on locked cards
  premiumBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  premiumBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.3,
  },

  // Missed Questions Count Picker Modal
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 24,
    paddingBottom: 36,
    paddingHorizontal: 24,
  },
  pickerHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textHeading,
    marginBottom: 4,
  },
  pickerDescription: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  pickerCounter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 20,
  },
  pickerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerBtnDisabled: {
    opacity: 0.35,
  },
  pickerValueWrap: {
    alignItems: 'center',
    minWidth: 60,
  },
  pickerValue: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.textHeading,
    lineHeight: 38,
  },
  pickerValueLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  pickerChips: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  pickerChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: colors.surfaceHover,
  },
  pickerChipActive: {
    backgroundColor: colors.primaryOrange,
  },
  pickerChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  pickerChipTextActive: {
    color: '#fff',
  },
  pickerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  pickerCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
  },
  pickerCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textBody,
  },
  pickerStartBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
  },
  pickerStartText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },

  // Mock Exam Set Picker
  mockSetList: {
    maxHeight: 280,
    marginVertical: 16,
  },
  mockSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
    backgroundColor: colors.surfaceHover,
  },
  mockSetRowSelected: {
    backgroundColor: 'rgba(255, 153, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 153, 0, 0.3)',
  },
  mockSetCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.trackGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mockSetCheckboxSelected: {
    backgroundColor: colors.primaryOrange,
    borderColor: colors.primaryOrange,
  },
  mockSetInfo: {
    flex: 1,
  },
  mockSetName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textBody,
  },
  mockSetNameSelected: {
    color: colors.textHeading,
  },
  mockSetCount: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  mockSetHint: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: 16,
  },

  // Tier Card — unified FREE/PREMIUM surface, no gold border
  tierCard: {
    backgroundColor: '#273040',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    marginBottom: 16,
    // Elevation replaces the outlined border
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  tierCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tierCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  // Gold accent only on label — not the card border
  tierPlanLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.2,
  },
  // PREMIUM active pill — uses success green, not gold
  tierActivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 20,
  },
  tierActivePillText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.successLight,
  },
  tierCountText: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: 12,
  },
  tierProgressTrack: {
    height: 6,
    backgroundColor: colors.trackGray,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  tierProgressFill: {
    height: 6,
    backgroundColor: '#F59E0B',
    borderRadius: 4,
  },
  // PREMIUM: progress bar turns success green to signal complete
  tierProgressFillSuccess: {
    backgroundColor: colors.success,
  },
  // Always in layout — opacity 0 when premium to prevent height shift
  tierCtaRow: {
    flexDirection: 'row',
  },
  tierUpgradeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  // Secondary-style CTA: text + chevron, orange — no solid button fill
  tierUpgradeLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primaryOrange,
  },

  // Resources Button
  resourcesBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  resourcesBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  resourcesBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.orangeDark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resourcesBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textHeading,
  },

  // Feedback Button
  feedbackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  feedbackBtnIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Resources Drawer
  drawerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  drawerSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
  },
  drawerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.trackGray,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 8,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textHeading,
  },
  drawerCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerBody: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 14,
  },
  drawerItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  drawerItemIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  drawerItemContent: {
    flex: 1,
  },
  drawerItemLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textHeading,
  },
  drawerItemSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },

  // WebView Resource Viewer
  webViewSafe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  webViewNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  webViewBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webViewTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: colors.textHeading,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  webViewProgressTrack: {
    height: 3,
    backgroundColor: colors.borderDefault,
    overflow: 'hidden' as const,
  },
  webViewProgressBar: {
    height: 3,
    backgroundColor: colors.primaryOrange,
  },
  webView: {
    flex: 1,
    backgroundColor: '#fff',
  },

  // Header Profile
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerProfileBtn: {
    position: 'relative',
  },
  headerAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  headerAvatarGuest: {
    backgroundColor: colors.surfaceHover,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
  },
  headerAvatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2.5,
    borderColor: colors.background,
  },
});

export default HomeScreen;
