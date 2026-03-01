// ExamSummaryScreen — summary view for server-synced exams without local answer data
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { ArrowLeft, CheckCircle2, XCircle, AlertCircle, BookOpen, Clock, Target } from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { getExamSubmissionById } from '../storage/repositories/exam-submission.repository';
import { ExamSubmission } from '../storage/repositories/exam-submission.repository';
import { getCachedExamTypeConfig } from '../services/sync.service';
import { formatTimeSpent } from '../services/scoring.service';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'ExamSummary'>;
type RoutePropType = RouteProp<RootStackParamList, 'ExamSummary'>;

const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  borderDefault: '#374151',
  trackGray: '#4B5563',
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  orangeDark: 'rgba(255, 153, 0, 0.2)',
  success: '#10B981',
  successDark: 'rgba(16, 185, 129, 0.15)',
  error: '#EF4444',
  errorDark: 'rgba(239, 68, 68, 0.15)',
  warning: '#F59E0B',
  warningDark: 'rgba(245, 158, 11, 0.15)',
};

interface EnrichedDomain {
  domainId: string;
  domainName: string;
  correct: number;
  total: number;
  percentage: number;
}

export const ExamSummaryScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RoutePropType>();
  const insets = useSafeAreaInsets();
  const { submissionId } = route.params;

  const [submission, setSubmission] = useState<ExamSubmission | null>(null);
  const [domains, setDomains] = useState<EnrichedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const sub = await getExamSubmissionById(submissionId);
        if (!sub) {
          setError('Exam record not found');
          return;
        }
        setSubmission(sub);

        if (sub.domainScores && sub.domainScores.length > 0) {
          const config = await getCachedExamTypeConfig();
          const enriched: EnrichedDomain[] = sub.domainScores.map((ds) => {
            const configDomain = config?.domains.find((d) => d.id === ds.domainId);
            return {
              domainId: ds.domainId,
              domainName: configDomain?.name ?? ds.domainId,
              correct: ds.correct,
              total: ds.total,
              percentage: ds.total > 0 ? Math.round((ds.correct / ds.total) * 100) : 0,
            };
          });
          enriched.sort((a, b) => a.percentage - b.percentage);
          setDomains(enriched);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [submissionId]);

  const formatDate = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const getStrengthStyle = (pct: number) => {
    if (pct >= 80) return { color: colors.success, bg: colors.successDark };
    if (pct >= 70) return { color: colors.warning, bg: colors.warningDark };
    return { color: colors.error, bg: colors.errorDark };
  };

  const getStrengthIcon = (pct: number) => {
    if (pct >= 80) return <CheckCircle2 size={12} color={colors.success} strokeWidth={2.5} />;
    if (pct >= 70) return <AlertCircle size={12} color={colors.warning} strokeWidth={2.5} />;
    return <XCircle size={12} color={colors.error} strokeWidth={2.5} />;
  };

  if (loading) {
    return (
      <SafeAreaView style={st.safeArea}>
        <View style={st.centered}>
          <ActivityIndicator size="large" color={colors.primaryOrange} />
        </View>
      </SafeAreaView>
    );
  }

  if (error || !submission) {
    return (
      <SafeAreaView style={st.safeArea}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn}>
          <ArrowLeft size={20} color={colors.textHeading} strokeWidth={2} />
        </TouchableOpacity>
        <View style={st.centered}>
          <Text style={st.errorText}>{error ?? 'Record not found'}</Text>
        </View>
      </SafeAreaView>
    );
  }

  const scoreColor = submission.score >= 70 ? colors.success : colors.error;
  const passBg = submission.passed ? colors.successDark : colors.errorDark;
  const totalQuestions = domains.reduce((s, d) => s + d.total, 0);
  const totalCorrect = domains.reduce((s, d) => s + d.correct, 0);

  return (
    <SafeAreaView style={st.safeArea} edges={['top']}>
      {/* Header */}
      <View style={st.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.headerBack}>
          <ArrowLeft size={20} color={colors.textHeading} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={st.headerTitle}>Exam Summary</Text>
        <View style={{ width: 34 }} />
      </View>

      <ScrollView
        style={st.scroll}
        contentContainerStyle={[st.scrollContent, { paddingBottom: Math.max(32, insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Score card */}
        <View style={[st.scoreCard, { borderColor: scoreColor + '40' }]}>
          <Text style={[st.scoreBig, { color: scoreColor }]}>{submission.score}%</Text>
          <View style={[st.passBadge, { backgroundColor: passBg }]}>
            {submission.passed
              ? <CheckCircle2 size={14} color={colors.success} strokeWidth={2.5} />
              : <XCircle size={14} color={colors.error} strokeWidth={2.5} />}
            <Text style={[st.passBadgeText, { color: submission.passed ? colors.success : colors.error }]}>
              {submission.passed ? 'PASSED' : 'FAILED'}
            </Text>
          </View>

          {/* Meta row */}
          <View style={st.metaRow}>
            <View style={st.metaItem}>
              <Clock size={13} color={colors.textMuted} strokeWidth={1.5} />
              <Text style={st.metaText}>{formatTimeSpent(submission.duration * 1000)}</Text>
            </View>
            <View style={st.metaDot} />
            <Text style={st.metaText}>{formatDate(submission.submittedAt)}</Text>
            {totalQuestions > 0 && (
              <>
                <View style={st.metaDot} />
                <View style={st.metaItem}>
                  <Target size={13} color={colors.textMuted} strokeWidth={1.5} />
                  <Text style={st.metaText}>{totalCorrect}/{totalQuestions} correct</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Domain breakdown */}
        {domains.length > 0 ? (
          <>
            <Text style={st.sectionLabel}>Subject Analysis</Text>
            {domains.map((d) => {
              const s = getStrengthStyle(d.percentage);
              return (
                <View key={d.domainId} style={st.domainCard}>
                  <View style={st.domainHeader}>
                    <View style={st.domainIcon}>
                      <BookOpen size={14} color={colors.primaryOrange} strokeWidth={2} />
                    </View>
                    <Text style={st.domainName} numberOfLines={2}>{d.domainName}</Text>
                    <Text style={[st.domainPct, { color: s.color }]}>{d.percentage}%</Text>
                    <View style={st.domainStatusIcon}>{getStrengthIcon(d.percentage)}</View>
                  </View>

                  {/* Progress bar */}
                  <View style={st.progressTrack}>
                    <View style={[st.progressFill, { width: `${Math.min(d.percentage, 100)}%`, backgroundColor: s.color }]} />
                  </View>

                  {/* Stats */}
                  <View style={st.domainStats}>
                    <View style={st.statItem}>
                      <Text style={st.statValue}>{d.total}</Text>
                      <Text style={st.statLabel}>Questions</Text>
                    </View>
                    <View style={st.statItem}>
                      <Text style={[st.statValue, { color: colors.success }]}>{d.correct}</Text>
                      <Text style={st.statLabel}>Correct</Text>
                    </View>
                    <View style={st.statItem}>
                      <Text style={[st.statValue, { color: colors.error }]}>{d.total - d.correct}</Text>
                      <Text style={st.statLabel}>Missed</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        ) : (
          <View style={st.noDomainCard}>
            <Text style={st.noDomainText}>
              Detailed subject breakdown is not available for this exam.
            </Text>
          </View>
        )}

        {/* Note */}
        <Text style={st.syncNote}>
          This exam was synced from the server. Individual question answers are not available.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const CARD_RADIUS = 14;
const CARD_PAD = 16;

const st = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: colors.error, fontSize: 15, textAlign: 'center', paddingHorizontal: 24 },
  backBtn: { padding: 16 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  headerBack: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '600',
    color: colors.textHeading,
  },

  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  scoreCard: {
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    padding: CARD_PAD,
    alignItems: 'center',
    borderWidth: 1,
    gap: 10,
  },
  scoreBig: { fontSize: 56, fontWeight: 'bold', lineHeight: 64 },
  passBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  passBadgeText: { fontSize: 13, fontWeight: '700', letterSpacing: 0.5 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 13, color: colors.textMuted },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: colors.trackGray },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
    marginBottom: 2,
  },

  domainCard: {
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    padding: CARD_PAD,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  domainHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  domainIcon: {
    width: 26,
    height: 26,
    borderRadius: 7,
    backgroundColor: colors.orangeDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  domainName: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textHeading, marginRight: 6 },
  domainPct: { fontSize: 15, fontWeight: 'bold', marginRight: 6 },
  domainStatusIcon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },

  progressTrack: {
    height: 6,
    backgroundColor: colors.trackGray,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressFill: { height: '100%', borderRadius: 3 },

  domainStats: { flexDirection: 'row', gap: 0 },
  statItem: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 15, fontWeight: '700', color: colors.textHeading },
  statLabel: { fontSize: 11, color: colors.textMuted },

  noDomainCard: {
    backgroundColor: colors.surface,
    borderRadius: CARD_RADIUS,
    padding: CARD_PAD,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  noDomainText: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },

  syncNote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: 16,
    lineHeight: 18,
    marginTop: 4,
  },
});

export default ExamSummaryScreen;
