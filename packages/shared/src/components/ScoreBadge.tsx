/**
 * ScoreBadge — compact pass/fail score indicator.
 *
 * Pass → green background; Fail → red/orange background.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radii } from '../theme';

export interface ScoreBadgeProps {
  score: number;
  passed: boolean;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, passed }) => (
  <View style={[styles.badge, passed ? styles.pass : styles.fail]}>
    <Text style={[styles.text, passed ? styles.passText : styles.failText]}>{score}%</Text>
  </View>
);

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
    minWidth: 48,
    alignItems: 'center',
  },
  pass: {
    backgroundColor: colors.successDark,
  },
  fail: {
    backgroundColor: colors.errorDark,
  },
  text: {
    fontSize: 14,
    fontWeight: '700',
  },
  passText: {
    color: colors.successLight,
  },
  failText: {
    color: colors.errorLight,
  },
});

export default ScoreBadge;
