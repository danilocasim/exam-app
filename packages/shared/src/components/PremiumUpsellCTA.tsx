/**
 * PremiumGlowCard — gradient-bordered premium upgrade prompt.
 *
 * Gold-to-orange gradient border (simulated via LinearGradient wrapper),
 * surface navy interior, row layout: Crown · label · ChevronRight.
 * Subtle gold box-shadow glow. Only shown to free-tier users.
 *
 * Backward-compatible: still exported as PremiumUpsellCTA.
 */
import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Crown, ChevronRight } from 'lucide-react-native';
import { colors, spacing, radii } from '../theme';

/** Gradient endpoints */
const GOLD = '#FFD700';
const VIBRANT_ORANGE = '#FF8C00';
const BORDER_WIDTH = 1.5;
const OUTER_RADIUS = radii.md;
const INNER_RADIUS = OUTER_RADIUS - BORDER_WIDTH;

export interface PremiumUpsellCTAProps {
  /** Descriptive text, e.g. "Unlock 200 more questions" */
  label: string;
  onPress: () => void;
  style?: ViewStyle;
}

export const PremiumUpsellCTA: React.FC<PremiumUpsellCTAProps> = ({ label, onPress, style }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.88} style={[styles.outer, style]}>
    <LinearGradient
      colors={[GOLD, VIBRANT_ORANGE]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradientBorder}
    >
      <View style={styles.inner}>
        <View style={styles.left}>
          <Crown size={16} color={GOLD} strokeWidth={2.2} />
          <Text style={styles.label}>{label}</Text>
        </View>
        <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
      </View>
    </LinearGradient>
  </TouchableOpacity>
);

/** Alias for discoverability */
export const PremiumGlowCard = PremiumUpsellCTA;

const styles = StyleSheet.create({
  outer: {
    borderRadius: OUTER_RADIUS,
    // Gold glow shadow
    shadowColor: GOLD,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 6,
  },
  gradientBorder: {
    borderRadius: OUTER_RADIUS,
    padding: BORDER_WIDTH,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: INNER_RADIUS,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textHeading,
  },
});

export default PremiumUpsellCTA;
