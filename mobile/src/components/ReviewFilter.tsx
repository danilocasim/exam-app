// T064: ReviewFilter - filter chips for review (All / Incorrect / Correct)
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { CheckCircle2, XCircle } from 'lucide-react-native';
import { ReviewFilterType } from '../services/review.service';

// AWS Modern Color Palette
const colors = {
  surface: '#1F2937',
  borderDefault: '#374151',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  orangeDark: 'rgba(255, 153, 0, 0.2)',
  success: '#10B981',
  successDark: 'rgba(16, 185, 129, 0.15)',
  error: '#EF4444',
  errorDark: 'rgba(239, 68, 68, 0.15)',
};

interface FilterOption {
  id: ReviewFilterType;
  label: string;
  color: string;
  bgColor: string;
  icon: React.ReactElement | null;
}

const FILTER_OPTIONS: FilterOption[] = [
  {
    id: 'all',
    label: 'All',
    color: colors.primaryOrange,
    bgColor: colors.orangeDark,
    icon: null,
  },
  {
    id: 'incorrect',
    label: 'Incorrect',
    color: colors.error,
    bgColor: colors.errorDark,
    icon: <XCircle size={14} color={colors.error} strokeWidth={2} />,
  },
  {
    id: 'correct',
    label: 'Correct',
    color: colors.success,
    bgColor: colors.successDark,
    icon: <CheckCircle2 size={14} color={colors.success} strokeWidth={2} />,
  },
];

export interface ReviewFilterProps {
  selectedFilter: ReviewFilterType;
  onSelect: (filter: ReviewFilterType) => void;
  counts?: { all: number; incorrect: number; correct: number };
}

/**
 * ReviewFilter - selectable filter chips for exam review
 */
export const ReviewFilter: React.FC<ReviewFilterProps> = ({ selectedFilter, onSelect, counts }) => {
  return (
    <View style={styles.container}>
      <View style={styles.chipRow}>
        {FILTER_OPTIONS.map((option) => {
          const isSelected = selectedFilter === option.id;
          const count = counts ? counts[option.id] : undefined;

          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => onSelect(option.id)}
              activeOpacity={0.7}
              style={[
                styles.chip,
                isSelected && {
                  backgroundColor: option.bgColor,
                  borderColor: option.color,
                  borderWidth: 2,
                },
              ]}
            >
              {option.icon && <View style={styles.chipIcon}>{option.icon}</View>}
              <Text
                style={[styles.chipText, isSelected && { color: option.color, fontWeight: '600' }]}
              >
                {option.label}
              </Text>
              {count !== undefined && (
                <View style={[styles.countBadge, isSelected && { backgroundColor: option.color }]}>
                  <Text style={[styles.countText, isSelected && { color: '#232F3E' }]}>
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  chipIcon: {
    marginRight: 2,
  },
  chipText: {
    fontSize: 13,
    color: colors.textBody,
    fontWeight: '500',
  },
  countBadge: {
    backgroundColor: colors.borderDefault,
    borderRadius: 10,
    minWidth: 22,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
});

export default ReviewFilter;
