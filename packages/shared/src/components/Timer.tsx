// T044: Timer component with countdown display
import React, { useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Clock } from 'lucide-react-native';
import { formatRemainingTime } from '../services';

export interface TimerProps {
  remainingTimeMs: number;
  onTick: (remainingMs: number) => void;
  onTimeUp: () => void;
  isPaused?: boolean;
  persistInterval?: number; // How often to persist time (default 30s)
  onPersist?: () => void;
}

// AWS Modern Color Palette
const colors = {
  // Backgrounds
  surface: '#1F2937', // Slate for cards
  surfaceHover: '#374151',
  // Borders
  borderDefault: '#374151', // Gray border
  // Text
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  // Warning states
  warningBg: 'rgba(255, 153, 0, 0.15)',
  warningBorder: '#FF9900',
  warningText: '#FFB84D',
  // Critical states
  criticalBg: 'rgba(239, 68, 68, 0.15)',
  criticalBorder: '#EF4444',
  criticalText: '#FCA5A5',
  criticalDot: '#EF4444',
};

/**
 * Timer - countdown timer for exam mode
 * Updates every second, persists periodically
 */
export const Timer: React.FC<TimerProps> = ({
  remainingTimeMs,
  onTick,
  onTimeUp,
  isPaused = false,
  persistInterval = 30000,
  onPersist,
}) => {
  const lastPersistRef = useRef<number>(Date.now());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Get color based on remaining time
  const getTimeColor = () => {
    const minutes = remainingTimeMs / 60000;
    if (minutes <= 5) return colors.criticalText;
    if (minutes <= 15) return colors.warningText;
    return colors.textBody;
  };

  // Get background/border colors based on remaining time
  const getBgStyle = () => {
    const minutes = remainingTimeMs / 60000;
    if (minutes <= 5)
      return { backgroundColor: colors.criticalBg, borderColor: colors.criticalBorder };
    if (minutes <= 15)
      return { backgroundColor: colors.warningBg, borderColor: colors.warningBorder };
    return { backgroundColor: 'transparent', borderColor: colors.borderDefault };
  };

  // Get icon color based on remaining time
  const getIconColor = () => {
    const minutes = remainingTimeMs / 60000;
    if (minutes <= 5) return colors.criticalText;
    if (minutes <= 15) return colors.warningText;
    return colors.textMuted;
  };

  const tick = useCallback(() => {
    if (isPaused) return;

    const newTime = remainingTimeMs - 1000;

    if (newTime <= 0) {
      onTick(0);
      onTimeUp();
      return;
    }

    onTick(newTime);

    // Check if we should persist
    const now = Date.now();
    if (onPersist && now - lastPersistRef.current >= persistInterval) {
      lastPersistRef.current = now;
      onPersist();
    }
  }, [remainingTimeMs, isPaused, onTick, onTimeUp, onPersist, persistInterval]);

  useEffect(() => {
    if (isPaused) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [tick, isPaused]);

  // Format display
  const displayTime = formatRemainingTime(remainingTimeMs);
  const minutes = Math.floor(remainingTimeMs / 60000);
  const isLowTime = minutes <= 5;

  return (
    <View style={[styles.container, getBgStyle()]}>
      <Clock size={14} color={getIconColor()} strokeWidth={2} />
      <Text style={[styles.time, { color: getTimeColor() }]}>{displayTime}</Text>
      {isLowTime && <View style={styles.lowTimeIndicator} />}
    </View>
  );
};

/**
 * Compact timer for header display
 */
export const CompactTimer: React.FC<{
  remainingTimeMs: number;
}> = ({ remainingTimeMs }) => {
  const displayTime = formatRemainingTime(remainingTimeMs);
  const minutes = remainingTimeMs / 60000;

  const getColor = () => {
    if (minutes <= 5) return colors.criticalText;
    if (minutes <= 15) return colors.warningText;
    return colors.textBody;
  };

  return (
    <View style={styles.compactContainer}>
      <Clock size={12} color={colors.textMuted} strokeWidth={2} />
      <Text style={[styles.compactTime, { color: getColor() }]}>{displayTime}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  time: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  lowTimeIndicator: {
    marginLeft: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.criticalDot,
  },
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    gap: 6,
  },
  compactTime: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});

export default Timer;
