// T071: DomainPerformanceCard - Shows domain performance with strength indicators
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { CheckCircle2, AlertCircle, XCircle } from 'lucide-react-native';
import { DomainScore } from '../../storage/schema';

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
  warning: '#F59E0B',
  warningDark: 'rgba(245, 158, 11, 0.15)',
};

interface DomainPerformanceCardProps {
  domains: DomainScore[];
}

const STRONG_THRESHOLD = 80;
const MODERATE_THRESHOLD = 70;

/**
 * Get strength level for a domain based on CHK011 thresholds
 */
const getStrengthLevel = (
  percentage: number,
): { label: string; color: string; bgColor: string; icon: React.ReactNode } => {
  if (percentage >= STRONG_THRESHOLD) {
    return {
      label: 'Strong',
      color: colors.success,
      bgColor: colors.successDark,
      icon: <CheckCircle2 size={14} color={colors.success} strokeWidth={2} />,
    };
  }
  if (percentage >= MODERATE_THRESHOLD) {
    return {
      label: 'Moderate',
      color: colors.warning,
      bgColor: colors.warningDark,
      icon: <AlertCircle size={14} color={colors.warning} strokeWidth={2} />,
    };
  }
  return {
    label: 'Weak',
    color: colors.error,
    bgColor: colors.errorDark,
    icon: <XCircle size={14} color={colors.error} strokeWidth={2} />,
  };
};

/**
 * DomainPerformanceCard - Displays all domains with performance bars
 */
export const DomainPerformanceCard: React.FC<DomainPerformanceCardProps> = ({ domains }) => {
  if (domains.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Domain Performance</Text>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Complete exams to see domain performance</Text>
        </View>
      </View>
    );
  }

  // Sort by percentage (weakest first for focus)
  const sorted = [...domains].sort((a, b) => a.percentage - b.percentage);

  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>Domain Performance</Text>

      {sorted.map((domain) => {
        const strength = getStrengthLevel(domain.percentage);

        return (
          <View key={domain.domainId} style={styles.domainRow}>
            <View style={styles.domainHeader}>
              <Text style={styles.domainName} numberOfLines={1}>
                {domain.domainName}
              </Text>
              <View style={[styles.strengthBadge, { backgroundColor: strength.bgColor }]}>
                {strength.icon}
                <Text style={[styles.strengthText, { color: strength.color }]}>
                  {strength.label}
                </Text>
              </View>
            </View>

            <View style={styles.progressRow}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${Math.min(domain.percentage, 100)}%`,
                      backgroundColor: strength.color,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.percentageText, { color: strength.color }]}>
                {domain.percentage}%
              </Text>
            </View>

            <Text style={styles.detailText}>
              {domain.correct}/{domain.total} correct
            </Text>
          </View>
        );
      })}
    </View>
  );
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
  domainRow: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  domainHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  domainName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textHeading,
    flex: 1,
    marginRight: 8,
  },
  strengthBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  strengthText: {
    fontSize: 11,
    fontWeight: '600',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBar: {
    flex: 1,
    height: 8,
    backgroundColor: colors.trackGray,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 14,
    fontWeight: 'bold',
    width: 42,
    textAlign: 'right',
  },
  detailText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default DomainPerformanceCard;
