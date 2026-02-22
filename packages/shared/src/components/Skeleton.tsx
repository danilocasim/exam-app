import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';

const colors = {
  surface: '#0f172a',
  shimmer: '#1e293b',
};

interface SkeletonProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

/**
 * Skeleton loading placeholder with shimmer animation
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
}) => {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.7,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.3,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          width: width as number,
          height,
          borderRadius,
          backgroundColor: colors.shimmer,
          opacity,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton for a question card in list views
 */
export const QuestionCardSkeleton: React.FC = () => {
  return (
    <View style={skeletonStyles.card}>
      <Skeleton width="60%" height={14} />
      <View style={{ height: 12 }} />
      <Skeleton width="100%" height={18} />
      <View style={{ height: 8 }} />
      <Skeleton width="80%" height={18} />
      <View style={{ height: 16 }} />
      <View style={skeletonStyles.row}>
        <Skeleton width={70} height={24} borderRadius={12} />
        <Skeleton width={60} height={24} borderRadius={12} />
        <Skeleton width={50} height={24} borderRadius={12} />
      </View>
    </View>
  );
};

/**
 * Skeleton for exam/practice history list items
 */
export const HistoryItemSkeleton: React.FC = () => {
  return (
    <View style={skeletonStyles.card}>
      <View style={skeletonStyles.row}>
        <Skeleton width={48} height={48} borderRadius={12} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Skeleton width="70%" height={16} />
          <View style={{ height: 8 }} />
          <Skeleton width="50%" height={14} />
        </View>
        <Skeleton width={50} height={28} borderRadius={8} />
      </View>
    </View>
  );
};

/**
 * Skeleton for stats cards on dashboard/analytics
 */
export const StatsCardSkeleton: React.FC = () => {
  return (
    <View style={skeletonStyles.statsCard}>
      <Skeleton width="50%" height={14} />
      <View style={{ height: 8 }} />
      <Skeleton width="40%" height={28} />
      <View style={{ height: 12 }} />
      <Skeleton width="80%" height={8} borderRadius={4} />
    </View>
  );
};

/**
 * Full-screen loading skeleton for list pages
 */
export const ListPageSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => {
  return (
    <View style={skeletonStyles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <QuestionCardSkeleton key={i} />
      ))}
    </View>
  );
};

const skeletonStyles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    gap: 12,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    flex: 1,
    minWidth: 140,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
