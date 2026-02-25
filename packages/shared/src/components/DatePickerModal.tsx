// DatePickerModal — scroll-wheel style date picker bottom sheet
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// AWS Theme
const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  surfaceHover: '#374151',
  borderDefault: '#374151',
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  orangeDark: 'rgba(255, 153, 0, 0.2)',
};

const ITEM_HEIGHT = 48;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export interface DatePickerModalProps {
  visible: boolean;
  currentDate: string | null; // YYYY-MM-DD or null
  onSave: (date: string) => void;
  onClear: () => void;
  onClose: () => void;
}

// ── Wheel Column ──
interface WheelColumnProps {
  data: string[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  width: number;
}

const WheelColumn: React.FC<WheelColumnProps> = ({ data, selectedIndex, onSelect, width }) => {
  const flatListRef = useRef<FlatList>(null);

  // Pad top/bottom so the selected item can sit in the center row
  const paddedData = ['', '', ...data, '', ''];

  useEffect(() => {
    if (flatListRef.current && selectedIndex >= 0) {
      flatListRef.current.scrollToOffset({
        offset: selectedIndex * ITEM_HEIGHT,
        animated: false,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleScrollEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = e.nativeEvent.contentOffset.y;
      const index = Math.round(offsetY / ITEM_HEIGHT);
      const clampedIndex = Math.max(0, Math.min(index, data.length - 1));
      onSelect(clampedIndex);
    },
    [data.length, onSelect],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: string; index: number }) => {
      const dataIndex = index - 2;
      const isSelected = dataIndex === selectedIndex;
      const distance = Math.abs(dataIndex - selectedIndex);

      return (
        <View style={[wst.wheelItem, { height: ITEM_HEIGHT, width }]}>
          <Text
            style={[
              wst.wheelText,
              isSelected && wst.wheelTextSelected,
              distance === 1 && wst.wheelTextNear,
              distance >= 2 && wst.wheelTextFar,
            ]}
            numberOfLines={1}
          >
            {item}
          </Text>
        </View>
      );
    },
    [selectedIndex, width],
  );

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: ITEM_HEIGHT,
      offset: ITEM_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <View style={[wst.wheelContainer, { width, height: PICKER_HEIGHT }]}>
      {/* Selection highlight band */}
      <View style={wst.selectionBand} pointerEvents="none" />
      <FlatList
        ref={flatListRef}
        data={paddedData}
        renderItem={renderItem}
        keyExtractor={(_, i) => String(i)}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        nestedScrollEnabled
        onMomentumScrollEnd={handleScrollEnd}
        onScrollEndDrag={(e) => {
          const velocity = e.nativeEvent.velocity?.y ?? 0;
          if (Math.abs(velocity) < 0.1) {
            handleScrollEnd(e);
          }
        }}
        getItemLayout={getItemLayout}
        initialScrollIndex={selectedIndex}
        bounces={false}
      />
    </View>
  );
};

const wst = StyleSheet.create({
  wheelContainer: {
    overflow: 'hidden',
  },
  selectionBand: {
    position: 'absolute',
    top: ITEM_HEIGHT * 2,
    left: 4,
    right: 4,
    height: ITEM_HEIGHT,
    backgroundColor: colors.orangeDark,
    borderRadius: 10,
    zIndex: 1,
  },
  wheelItem: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  wheelText: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: '500',
  },
  wheelTextSelected: {
    fontSize: 22,
    color: colors.textHeading,
    fontWeight: '700',
  },
  wheelTextNear: {
    fontSize: 17,
    color: colors.textBody,
    opacity: 0.6,
  },
  wheelTextFar: {
    fontSize: 15,
    opacity: 0.2,
  },
});

// ── Main component ──
export const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  currentDate,
  onSave,
  onClear,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const screenWidth = Dimensions.get('window').width;

  const parsedDate = currentDate ? new Date(currentDate + 'T00:00:00') : null;
  const defaultDate = new Date();
  defaultDate.setMonth(defaultDate.getMonth() + 1);
  const initDate = parsedDate || defaultDate;

  const [month, setMonth] = useState(initDate.getMonth());
  const [day, setDay] = useState(initDate.getDate());
  const [year, setYear] = useState(initDate.getFullYear());

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      const d = currentDate ? new Date(currentDate + 'T00:00:00') : null;
      const def = new Date();
      def.setMonth(def.getMonth() + 1);
      const init = d || def;
      setMonth(init.getMonth());
      setDay(init.getDate());
      setYear(init.getFullYear());
    }
  }, [visible, currentDate]);

  // Build dynamic data
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => String(currentYear + i));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => String(i + 1));
  const clampedDay = Math.min(day, daysInMonth);

  const colWidth = (screenWidth - 96) / 3; // 24px padding each side + 24px gap between cols

  const handleSave = () => {
    const m = String(month + 1).padStart(2, '0');
    const d = String(clampedDay).padStart(2, '0');
    onSave(`${year}-${m}-${d}`);
  };

  // Format preview
  const previewDate = new Date(year, month, clampedDay);
  const previewText = previewDate.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={st.overlay}>
        {/* Backdrop — only the area ABOVE the sheet dismisses on tap */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={st.backdrop} />
        </TouchableWithoutFeedback>

        {/* Sheet — sibling of backdrop so no parent steals scroll */}
        <View style={[st.sheet, { paddingBottom: Math.max(28, insets.bottom + 8) }]}>
          {/* Handle */}
          <View style={st.handle} />

          {/* Header */}
          <View style={st.header}>
            <Text style={st.title}>Set Exam Date</Text>
            <TouchableOpacity
              onPress={onClose}
              activeOpacity={0.7}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={st.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>

          {/* Date Preview */}
          <View style={st.previewWrap}>
            <Text style={st.preview}>{previewText}</Text>
          </View>

          {/* Column headers */}
          <View style={st.columnHeaders}>
            <Text style={[st.columnLabel, { width: colWidth }]}>Month</Text>
            <Text style={[st.columnLabel, { width: colWidth }]}>Day</Text>
            <Text style={[st.columnLabel, { width: colWidth }]}>Year</Text>
          </View>

          {/* Scroll wheels */}
          <View style={st.wheelsRow}>
            <WheelColumn data={MONTHS} selectedIndex={month} onSelect={setMonth} width={colWidth} />
            <WheelColumn
              data={days}
              selectedIndex={clampedDay - 1}
              onSelect={(i) => setDay(i + 1)}
              width={colWidth}
            />
            <WheelColumn
              data={years}
              selectedIndex={year - currentYear}
              onSelect={(i) => setYear(currentYear + i)}
              width={colWidth}
            />
          </View>

          {/* Actions */}
          <View style={st.actions}>
            {currentDate && (
              <TouchableOpacity style={st.clearBtn} onPress={onClear} activeOpacity={0.7}>
                <Text style={st.clearText}>Clear Date</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[st.saveBtn, !currentDate && { flex: 1 }]}
              onPress={handleSave}
              activeOpacity={0.85}
            >
              <Text style={st.saveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 28,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 12,
      },
      android: { elevation: 24 },
    }),
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceHover,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textHeading,
  },
  cancelText: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '500',
  },
  previewWrap: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  preview: {
    fontSize: 16,
    color: colors.primaryOrange,
    fontWeight: '600',
    textAlign: 'center',
  },
  columnHeaders: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  columnLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    textAlign: 'center',
  },
  wheelsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 24,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  clearBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
  },
  clearText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
  },
  saveText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});

export default DatePickerModal;
