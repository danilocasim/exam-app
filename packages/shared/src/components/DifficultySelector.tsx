// T057: DifficultySelector - Difficulty filter chips for practice setup
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Difficulty } from '../storage/schema';

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

/**
 * Difficulty option with styling info
 */
interface DifficultyOption {
  id: Difficulty;
  label: string;
  color: string;
  bgColor: string;
}

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  { id: 'EASY', label: 'Easy', color: colors.success, bgColor: colors.successDark },
  { id: 'MEDIUM', label: 'Medium', color: colors.primaryOrange, bgColor: colors.orangeDark },
  { id: 'HARD', label: 'Hard', color: colors.error, bgColor: colors.errorDark },
];

export interface DifficultySelectorProps {
  selectedDifficulty: Difficulty | null;
  onSelect: (difficulty: Difficulty | null) => void;
}

/**
 * DifficultySelector - selectable difficulty chips
 */
export const DifficultySelector: React.FC<DifficultySelectorProps> = ({
  selectedDifficulty,
  onSelect,
}) => {
  const handlePress = (difficulty: Difficulty) => {
    // Toggle: tap again to deselect
    if (selectedDifficulty === difficulty) {
      onSelect(null);
    } else {
      onSelect(difficulty);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Difficulty</Text>

      <View style={styles.chipRow}>
        {/* All option */}
        <TouchableOpacity
          onPress={() => onSelect(null)}
          activeOpacity={0.7}
          style={[styles.chip, selectedDifficulty === null && styles.chipSelected]}
        >
          <Text style={[styles.chipText, selectedDifficulty === null && styles.chipTextSelected]}>
            All
          </Text>
        </TouchableOpacity>

        {/* Difficulty options */}
        {DIFFICULTY_OPTIONS.map((option) => {
          const isSelected = selectedDifficulty === option.id;
          return (
            <TouchableOpacity
              key={option.id}
              onPress={() => handlePress(option.id)}
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
              <View style={[styles.dot, { backgroundColor: option.color }]} />
              <Text
                style={[styles.chipText, isSelected && { color: option.color, fontWeight: '600' }]}
              >
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 6,
  },
  chipSelected: {
    backgroundColor: colors.orangeDark,
    borderColor: colors.primaryOrange,
    borderWidth: 2,
  },
  chipText: {
    fontSize: 14,
    color: colors.textBody,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: colors.primaryOrange,
    fontWeight: '600',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

export default DifficultySelector;
