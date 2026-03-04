/**
 * HeaderNav — shared top navigation bar.
 *
 * Layout: [Logo + Title + Tag]  …  [Crown (free)]  [Profile Avatar]
 */
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { Cloud, User, Crown } from 'lucide-react-native';
import { colors, spacing, radii, typography, MIN_TAP_SIZE } from '../theme';

export interface HeaderNavProps {
  /** Exam type badge text, e.g. "CLF-C02" */
  examTypeId: string;
  isPremium: boolean;
  isSignedIn: boolean;
  user?: { name?: string | null; email?: string | null; picture?: string | null } | null;
  onSettingsPress: () => void;
  onUpgradePress: () => void;
}

export const HeaderNav: React.FC<HeaderNavProps> = ({
  examTypeId,
  isPremium,
  isSignedIn,
  user,
  onSettingsPress,
  onUpgradePress,
}) => (
  <View style={styles.header}>
    {/* Left: Logo + Title + Badge */}
    <View style={styles.left}>
      <View style={styles.logoIcon}>
        <Cloud size={14} color={colors.textHeading} strokeWidth={2.5} />
      </View>
      <View>
        <View style={styles.titleRow}>
          <Text style={styles.appTitle}>Dojo Exam</Text>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{examTypeId}</Text>
          </View>
        </View>
      </View>
    </View>

    {/* Right: Crown (free) + Avatar */}
    <View style={styles.right}>
      {!isPremium && (
        <TouchableOpacity onPress={onUpgradePress} activeOpacity={0.7} style={styles.crownBtn}>
          <Crown size={22} color={colors.gold} strokeWidth={2} />
        </TouchableOpacity>
      )}

      <TouchableOpacity onPress={onSettingsPress} activeOpacity={0.7} style={styles.avatarBtn}>
        {isSignedIn && user ? (
          user.picture ? (
            <Image source={{ uri: user.picture }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )
        ) : (
          <View style={[styles.avatar, styles.avatarGuest]}>
            <User size={16} color={colors.textMuted} strokeWidth={2} />
          </View>
        )}
        {isSignedIn && <View style={styles.onlineDot} />}
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: radii.sm,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  appTitle: {
    fontSize: typography.title.fontSize,
    fontWeight: typography.title.fontWeight,
    color: colors.textHeading,
    lineHeight: 22,
  },
  badge: {
    backgroundColor: colors.orangeDark,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.orangeLight,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  crownBtn: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBtn: {
    position: 'relative',
  },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  avatarGuest: {
    backgroundColor: colors.surfaceHover,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
    borderWidth: 2.5,
    borderColor: colors.background,
  },
});

export default HeaderNav;
