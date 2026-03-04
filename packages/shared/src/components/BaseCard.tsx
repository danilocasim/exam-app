/**
 * BaseCard — reusable surface container.
 * 16px padding, 12px border-radius, Surface background.
 */
import React from 'react';
import { View, ViewStyle, StyleSheet } from 'react-native';
import { colors, spacing, radii } from '../theme';

export interface BaseCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Remove default padding */
  noPadding?: boolean;
}

export const BaseCard: React.FC<BaseCardProps> = ({ children, style, noPadding }) => (
  <View style={[styles.card, noPadding && styles.noPadding, style]}>{children}</View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  noPadding: {
    padding: 0,
  },
});

export default BaseCard;
