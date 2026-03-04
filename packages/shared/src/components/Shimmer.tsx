/**
 * Shimmer — premium branded skeleton placeholder with animated gradient sweep.
 *
 * Base: Surface navy (#242A38).
 * Gradient: Surface → slightly lighter Surface → Surface.
 * Animation: ~900ms loop – slightly faster than standard for perceived speed.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, radii, spacing } from '../theme';

// ── Constants ──

/** Width of the moving gradient band (px). */
const GRADIENT_WIDTH = 300;

/** Full sweep duration (ms) — slightly faster than standard loaders. */
const DURATION = 900;

/** Base color for shimmer blocks (Surface). */
const SHIMMER_BASE = colors.surface; // #242A38

/** Shimmer block "bone" — one step lighter than surface for visibility. */
const SHIMMER_BONE = colors.surfaceHover; // #2E3545

/** Peak highlight during sweep. */
const SHIMMER_HIGHLIGHT = '#3D4656';

// ── Shimmer primitive ──

export interface ShimmerProps {
  /** Block width. Number for fixed px, string for percentage. Default '100%'. */
  width?: number | string;
  /** Block height in px. */
  height: number;
  /** Corner radius. Default 4. */
  borderRadius?: number;
  /** Additional styles. */
  style?: ViewStyle;
}

/**
 * Animated shimmer placeholder block.
 *
 * Renders a Surface-navy rectangle with a smooth left-to-right gradient sweep.
 */
export const Shimmer: React.FC<ShimmerProps> = ({
  width = '100%',
  height,
  borderRadius = 4,
  style,
}) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(anim, {
        toValue: 1,
        duration: DURATION,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-GRADIENT_WIDTH, GRADIENT_WIDTH],
  });

  return (
    <View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: SHIMMER_BONE,
          overflow: 'hidden' as const,
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          position: 'absolute' as const,
          top: 0,
          bottom: 0,
          left: 0,
          width: GRADIENT_WIDTH * 2,
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={[SHIMMER_BONE, SHIMMER_HIGHLIGHT, SHIMMER_BONE]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{ flex: 1 }}
        />
      </Animated.View>
    </View>
  );
};

// ── ShimmerCard ──

/**
 * Card-shaped skeleton placeholder.
 *
 * Matches final card specs: 12px border radius, 16px padding, 16px bottom margin.
 * Pass children for custom inner layout, or use defaults (two text-line shimmers).
 */
export const ShimmerCard: React.FC<{
  children?: React.ReactNode;
  style?: ViewStyle;
}> = ({ children, style }) => (
  <View style={[cardStyles.card, style]}>
    {children ?? (
      <>
        <Shimmer height={14} width="70%" borderRadius={4} style={{ marginBottom: 10 }} />
        <Shimmer height={10} width="45%" borderRadius={4} />
      </>
    )}
  </View>
);

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: SHIMMER_BASE,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
});

// ── Screen-specific skeleton layouts ──

/**
 * HomeScreen loading skeleton.
 *
 * Mimics: Header row → Stats row → Calendar strip → CTA card → 2×2 mode grid.
 */
export const HomeScreenSkeleton: React.FC = () => (
  <View style={layoutStyles.fill}>
    {/* Header row */}
    <View style={layoutStyles.headerRow}>
      <View style={layoutStyles.headerLeft}>
        <Shimmer width={28} height={28} borderRadius={radii.sm} />
        <Shimmer width={100} height={18} borderRadius={4} />
        <Shimmer width={52} height={20} borderRadius={6} />
      </View>
      <Shimmer width={34} height={34} borderRadius={17} />
    </View>

    {/* Stats row */}
    <View style={layoutStyles.statsRow}>
      <Shimmer height={44} borderRadius={14} style={{ marginBottom: 0 }} />
    </View>

    {/* Calendar strip */}
    <View style={layoutStyles.calendarRow}>
      {Array.from({ length: 7 }).map((_, i) => (
        <Shimmer key={i} width={38} height={56} borderRadius={radii.sm} style={{ flex: 1 }} />
      ))}
    </View>

    {/* CTA card */}
    <View style={layoutStyles.contentArea}>
      <ShimmerCard style={{ height: 76, borderRadius: radii.lg }}>
        <View style={layoutStyles.ctaInner}>
          <Shimmer width={40} height={40} borderRadius={20} />
          <View style={{ flex: 1, gap: 8 }}>
            <Shimmer height={16} width="60%" borderRadius={4} />
            <Shimmer height={11} width="40%" borderRadius={4} />
          </View>
        </View>
      </ShimmerCard>
    </View>

    {/* Modes label */}
    <View style={layoutStyles.contentArea}>
      <Shimmer
        height={10}
        width={56}
        borderRadius={4}
        style={{ marginBottom: 14, marginTop: spacing.sm }}
      />
    </View>

    {/* 2×2 mode grid */}
    <View style={layoutStyles.modeGrid}>
      {Array.from({ length: 4 }).map((_, i) => (
        <ShimmerCard key={i} style={layoutStyles.modeCard}>
          <View style={{ alignItems: 'center', gap: 10 }}>
            <Shimmer width={44} height={44} borderRadius={radii.md} />
            <Shimmer height={12} width="60%" borderRadius={4} />
            <Shimmer height={9} width="45%" borderRadius={4} />
          </View>
        </ShimmerCard>
      ))}
    </View>
  </View>
);

/**
 * ExamHistoryScreen loading skeleton.
 *
 * Mimics: Header → section label → 4 entry rows.
 */
export const HistoryScreenSkeleton: React.FC = () => (
  <View style={layoutStyles.fill}>
    {/* Header */}
    <View style={layoutStyles.listHeader}>
      <Shimmer width={40} height={40} borderRadius={radii.md} />
      <Shimmer height={18} width={120} borderRadius={4} style={{ marginLeft: spacing.md }} />
    </View>

    {/* Section label */}
    <View style={layoutStyles.sectionLabel}>
      <Shimmer height={10} width={60} borderRadius={4} />
    </View>

    {/* Entry rows */}
    <View style={layoutStyles.listArea}>
      {Array.from({ length: 4 }).map((_, i) => (
        <ShimmerCard key={i}>
          <View style={layoutStyles.entryRow}>
            <Shimmer width={48} height={24} borderRadius={radii.sm} />
            <Shimmer height={12} width={50} borderRadius={4} />
            <Shimmer height={10} width={40} borderRadius={4} />
            <View style={{ flex: 1 }} />
            <Shimmer width={16} height={16} borderRadius={4} />
          </View>
        </ShimmerCard>
      ))}
    </View>
  </View>
);

/**
 * PracticeSetupScreen loading skeleton.
 *
 * Mimics: Header → domain selector chips → difficulty row → sets card → count card.
 */
export const PracticeSetupSkeleton: React.FC = () => (
  <View style={layoutStyles.fill}>
    {/* Header */}
    <View style={layoutStyles.setupHeader}>
      <Shimmer width={40} height={40} borderRadius={radii.sm} />
      <View style={{ flex: 1, alignItems: 'center' as const }}>
        <Shimmer height={16} width={120} borderRadius={4} style={{ marginBottom: 6 }} />
        <Shimmer height={10} width={100} borderRadius={4} />
      </View>
      <View style={{ width: 40 }} />
    </View>

    <View style={layoutStyles.setupContent}>
      {/* Domain label + chips */}
      <Shimmer height={10} width={56} borderRadius={4} style={{ marginBottom: spacing.sm }} />
      {Array.from({ length: 4 }).map((_, i) => (
        <Shimmer
          key={`d${i}`}
          height={48}
          borderRadius={radii.md}
          style={{ marginBottom: spacing.sm }}
        />
      ))}

      {/* Difficulty label + row */}
      <Shimmer
        height={10}
        width={64}
        borderRadius={4}
        style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
      />
      <View style={layoutStyles.difficultyRow}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Shimmer key={`df${i}`} height={40} borderRadius={10} style={{ flex: 1 }} />
        ))}
      </View>

      {/* Sets card */}
      <ShimmerCard style={{ marginTop: spacing.md }}>
        <Shimmer height={14} width="50%" borderRadius={4} style={{ marginBottom: 12 }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <View key={`s${i}`} style={layoutStyles.setRow}>
            <Shimmer width={24} height={24} borderRadius={6} />
            <View style={{ flex: 1, gap: 6 }}>
              <Shimmer height={12} width="65%" borderRadius={4} />
              <Shimmer height={9} width="30%" borderRadius={4} />
            </View>
          </View>
        ))}
      </ShimmerCard>

      {/* Count card */}
      <ShimmerCard>
        <View style={layoutStyles.entryRow}>
          <Shimmer height={12} width="45%" borderRadius={4} />
          <View style={{ flex: 1 }} />
          <Shimmer width={44} height={24} borderRadius={4} />
        </View>
      </ShimmerCard>
    </View>
  </View>
);

/**
 * CustomExamSetupScreen loading skeleton.
 *
 * Mimics: Header → question count section → domain selector → time limit.
 */
export const CustomExamSetupSkeleton: React.FC = () => (
  <View style={layoutStyles.fill}>
    {/* Header */}
    <View style={layoutStyles.listHeader}>
      <Shimmer width={40} height={40} borderRadius={radii.md} />
      <Shimmer height={18} width={110} borderRadius={4} style={{ marginLeft: spacing.md }} />
    </View>

    <View style={layoutStyles.setupContent}>
      {/* Question count section */}
      <Shimmer height={14} width="50%" borderRadius={4} style={{ marginBottom: spacing.sm }} />
      <ShimmerCard style={{ height: 64 }}>
        <View style={{ alignItems: 'center' as const, justifyContent: 'center' as const, flex: 1 }}>
          <Shimmer height={20} width={80} borderRadius={4} />
        </View>
      </ShimmerCard>

      {/* Domain label + chips */}
      <Shimmer
        height={14}
        width={56}
        borderRadius={4}
        style={{ marginBottom: spacing.sm, marginTop: spacing.sm }}
      />
      {Array.from({ length: 3 }).map((_, i) => (
        <Shimmer
          key={`d${i}`}
          height={48}
          borderRadius={radii.md}
          style={{ marginBottom: spacing.sm }}
        />
      ))}

      {/* Time section */}
      <Shimmer
        height={14}
        width={80}
        borderRadius={4}
        style={{ marginTop: spacing.md, marginBottom: spacing.sm }}
      />
      <ShimmerCard style={{ height: 56 }}>
        <View style={{ alignItems: 'center' as const, justifyContent: 'center' as const, flex: 1 }}>
          <Shimmer height={16} width={100} borderRadius={4} />
        </View>
      </ShimmerCard>
    </View>
  </View>
);

// ── Layout styles for skeletons ──

const layoutStyles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statsRow: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  calendarRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginTop: 12,
    gap: 6,
  },
  contentArea: {
    paddingHorizontal: 20,
    marginTop: spacing.md,
  },
  ctaInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  modeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
  },
  modeCard: {
    width: '46%',
    height: 130,
    marginBottom: 0,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  sectionLabel: {
    paddingHorizontal: spacing.md + 4,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  listArea: {
    paddingHorizontal: spacing.md + 4,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    backgroundColor: colors.surface,
  },
  setupContent: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
  },
  difficultyRow: {
    flexDirection: 'row',
    gap: 6,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
});

export default Shimmer;
