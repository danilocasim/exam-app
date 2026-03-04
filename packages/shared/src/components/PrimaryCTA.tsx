/**
 * PrimaryCTA — full-width pill-shaped orange gradient button.
 *
 * Used for the main "Start Exam" / "Resume Exam" call-to-action.
 */
import React from 'react';
import {
  TouchableOpacity,
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { colors, spacing, radii } from '../theme';

export interface PrimaryCTAProps {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

export const PrimaryCTA: React.FC<PrimaryCTAProps> = ({
  title,
  subtitle,
  icon,
  onPress,
  disabled = false,
  loading = false,
  style,
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || loading}
    activeOpacity={0.85}
    style={[styles.wrapper, disabled && styles.disabled, style]}
  >
    <LinearGradient
      colors={
        disabled
          ? [colors.surfaceHover, colors.surface]
          : [colors.primaryOrange, colors.secondaryOrange]
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={styles.gradient}
    >
      {loading ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <View style={styles.content}>
          <View style={styles.left}>
            <View style={[styles.iconCircle, disabled && { backgroundColor: colors.trackGray }]}>
              {icon}
            </View>
            <View>
              <Text style={styles.title}>{title}</Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          <ChevronRight
            size={20}
            color={disabled ? colors.textMuted : colors.textHeading}
            strokeWidth={2}
          />
        </View>
      )}
    </LinearGradient>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  disabled: {
    opacity: 0.5,
  },
  gradient: {
    paddingVertical: 18,
    paddingHorizontal: spacing.md + 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textHeading,
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },
});

export default PrimaryCTA;
