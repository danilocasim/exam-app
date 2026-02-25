// CalendarStrip — horizontal weekly calendar for HomeScreen header
import React, { useMemo, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, Dimensions } from 'react-native';

// AWS Theme
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

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const TILE_WIDTH = 42;
const TILE_GAP = 8;

export interface CalendarStripProps {
  /** If set, highlight the exam date tile */
  examDate?: string | null;
}

interface DayItem {
  key: string;
  date: Date;
  dayNum: number;
  dayLabel: string;
  isToday: boolean;
  isExamDay: boolean;
  isPast: boolean;
}

/**
 * CalendarStrip — shows a 3-week horizontal strip centered on today.
 * Highlights today with accent ring, exam day with orange fill.
 */
export const CalendarStrip: React.FC<CalendarStripProps> = ({ examDate }) => {
  const flatListRef = useRef<FlatList>(null);
  const screenWidth = Dimensions.get('window').width;

  const days: DayItem[] = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = formatDateKey(today);

    // Show 7 days before + today + 13 days after = 21 days total
    const result: DayItem[] = [];
    for (let i = -7; i <= 13; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const key = formatDateKey(d);
      result.push({
        key,
        date: d,
        dayNum: d.getDate(),
        dayLabel: DAY_LABELS[d.getDay()],
        isToday: key === todayStr,
        isExamDay: examDate ? key === examDate : false,
        isPast: d < today,
      });
    }
    return result;
  }, [examDate]);

  // Auto-scroll to today (index 7)
  useEffect(() => {
    const todayIndex = days.findIndex((d) => d.isToday);
    if (todayIndex >= 0 && flatListRef.current) {
      // Center today on screen
      const tileTotal = TILE_WIDTH + TILE_GAP;
      const offset = todayIndex * tileTotal - (screenWidth - tileTotal) / 2;
      setTimeout(() => {
        flatListRef.current?.scrollToOffset({
          offset: Math.max(0, offset),
          animated: false,
        });
      }, 50);
    }
  }, [days, screenWidth]);

  const renderItem = ({ item }: { item: DayItem }) => {
    const tileStyle = item.isToday
      ? st.tileToday
      : item.isExamDay
        ? st.tileExam
        : item.isPast
          ? st.tilePast
          : st.tileDefault;

    const numStyle = item.isToday
      ? st.numToday
      : item.isExamDay
        ? st.numExam
        : item.isPast
          ? st.numPast
          : st.numDefault;

    const labelStyle = item.isPast ? st.labelPast : st.labelDefault;

    return (
      <View style={st.dayColumn}>
        <Text style={labelStyle}>{item.dayLabel}</Text>
        <View style={[st.tile, tileStyle]}>
          <Text style={numStyle}>{item.dayNum}</Text>
        </View>
        {item.isExamDay && !item.isToday && <View style={st.examDot} />}
      </View>
    );
  };

  return (
    <View style={st.container}>
      <FlatList
        ref={flatListRef}
        data={days}
        renderItem={renderItem}
        keyExtractor={(item) => item.key}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={st.listContent}
        ItemSeparatorComponent={() => <View style={{ width: TILE_GAP }} />}
      />
    </View>
  );
};

function formatDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const st = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  dayColumn: {
    alignItems: 'center',
    width: TILE_WIDTH,
    gap: 4,
  },
  labelDefault: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textMuted,
    textAlign: 'center',
  },
  labelPast: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.borderDefault,
    textAlign: 'center',
  },

  // Tile base
  tile: {
    width: TILE_WIDTH,
    height: TILE_WIDTH,
    borderRadius: TILE_WIDTH / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDefault: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  tileToday: {
    backgroundColor: colors.primaryOrange,
  },
  tileExam: {
    backgroundColor: colors.orangeDark,
    borderWidth: 1.5,
    borderColor: colors.primaryOrange,
  },
  tilePast: {
    backgroundColor: 'transparent',
  },

  // Number text
  numDefault: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textBody,
  },
  numToday: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  numExam: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.primaryOrange,
  },
  numPast: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.borderDefault,
  },

  // Exam indicator dot
  examDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primaryOrange,
    marginTop: 2,
  },
});

export default CalendarStrip;
