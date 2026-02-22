// T056: DomainSelector - Domain filter chips for practice setup
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { DomainId } from '../storage/schema';

// AWS Modern Color Palette
const colors = {
  surface: '#1F2937',
  surfaceHover: '#374151',
  borderDefault: '#374151',
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  orangeDark: 'rgba(255, 153, 0, 0.2)',
};

/**
 * Domain option with id and display info
 */
export interface DomainOption {
  id: DomainId;
  name: string;
  questionCount: number;
}

export interface DomainSelectorProps {
  domains: DomainOption[];
  selectedDomain: DomainId | null;
  onSelect: (domain: DomainId | null) => void;
}

/**
 * DomainSelector - selectable domain chips for practice filtering
 */
export const DomainSelector: React.FC<DomainSelectorProps> = ({
  domains,
  selectedDomain,
  onSelect,
}) => {
  const handlePress = (domainId: DomainId) => {
    // Toggle: tap again to deselect
    if (selectedDomain === domainId) {
      onSelect(null);
    } else {
      onSelect(domainId);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Domain</Text>

      {/* All domains option */}
      <TouchableOpacity
        onPress={() => onSelect(null)}
        activeOpacity={0.7}
        style={[styles.chip, selectedDomain === null && styles.chipSelected]}
      >
        <Text style={[styles.chipText, selectedDomain === null && styles.chipTextSelected]}>
          All Domains
        </Text>
        <Text style={[styles.chipCount, selectedDomain === null && styles.chipCountSelected]}>
          {domains.reduce((sum, d) => sum + d.questionCount, 0)}
        </Text>
      </TouchableOpacity>

      {/* Individual domain chips */}
      {domains.map((domain) => (
        <TouchableOpacity
          key={domain.id}
          onPress={() => handlePress(domain.id)}
          activeOpacity={0.7}
          style={[styles.chip, selectedDomain === domain.id && styles.chipSelected]}
        >
          <Text
            style={[styles.chipText, selectedDomain === domain.id && styles.chipTextSelected]}
            numberOfLines={1}
          >
            {domain.name}
          </Text>
          <Text
            style={[styles.chipCount, selectedDomain === domain.id && styles.chipCountSelected]}
          >
            {domain.questionCount}
          </Text>
        </TouchableOpacity>
      ))}
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
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  chipSelected: {
    backgroundColor: colors.orangeDark,
    borderColor: colors.primaryOrange,
    borderWidth: 2,
  },
  chipText: {
    fontSize: 15,
    color: colors.textBody,
    fontWeight: '500',
    flex: 1,
  },
  chipTextSelected: {
    color: colors.primaryOrange,
    fontWeight: '600',
  },
  chipCount: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
    marginLeft: 8,
  },
  chipCountSelected: {
    color: colors.primaryOrange,
  },
});

export default DomainSelector;
