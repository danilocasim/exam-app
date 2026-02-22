// T072: StudyStatsCard - Total exams, questions answered, time spent
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BookOpen, Clock, Target, Activity } from 'lucide-react-native';
import { StudyStats } from '../../services/analytics.service';

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
};

interface StudyStatsCardProps {
  studyStats: StudyStats;
}

/**
 * StudyStatsCard - Displays aggregate study statistics
 */
export const StudyStatsCard: React.FC<StudyStatsCardProps> = ({ studyStats }) => {
  const statItems = [
    {
      icon: <Target size={20} color={colors.primaryOrange} strokeWidth={1.5} />,
      label: 'Exams',
      value: studyStats.totalExams.toString(),
    },
    {
      icon: <BookOpen size={20} color={colors.success} strokeWidth={1.5} />,
      label: 'Practice',
      value: studyStats.totalPractice.toString(),
    },
    {
      icon: <Activity size={20} color={colors.orangeLight} strokeWidth={1.5} />,
      label: 'Questions',
      value: studyStats.totalQuestions.toString(),
    },
    {
      icon: <Clock size={20} color={colors.textBody} strokeWidth={1.5} />,
      label: 'Time Spent',
      value: studyStats.totalTimeSpentMs > 0 ? studyStats.totalTimeSpent : '0s',
    },
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Study Activity</Text>

      <View style={styles.statsGrid}>
        {statItems.map((item, index) => (
          <View key={index} style={styles.statItem}>
            <View style={styles.statIconContainer}>{item.icon}</View>
            <Text style={styles.statValue}>{item.value}</Text>
            <Text style={styles.statLabel}>{item.label}</Text>
          </View>
        ))}
      </View>

      {studyStats.lastActivityAt && (
        <View style={styles.lastActivityRow}>
          <Text style={styles.lastActivityLabel}>Last Activity</Text>
          <Text style={styles.lastActivityValue}>
            {formatRelativeDate(studyStats.lastActivityAt)}
          </Text>
        </View>
      )}
    </View>
  );
};

/**
 * Format a date string as a relative date
 */
const formatRelativeDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'Just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
};

const styles = StyleSheet.create({
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
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    alignItems: 'center',
    paddingVertical: 12,
  },
  statIconContainer: {
    marginBottom: 8,
  },
  statValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.textHeading,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  lastActivityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderDefault,
  },
  lastActivityLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  lastActivityValue: {
    fontSize: 13,
    color: colors.textBody,
    fontWeight: '500',
  },
});

export default StudyStatsCard;
