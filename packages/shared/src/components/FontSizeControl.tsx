import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Pressable, StyleSheet } from 'react-native';
import { Type } from 'lucide-react-native';

// AWS Modern Color Palette
const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  surfaceHover: '#374151',
  borderDefault: '#374151',
  borderSubtle: '#4B5563',
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  textDisabled: '#6B7280',
  primaryOrange: '#FF9900',
};

export type FontSizeLevel = 0 | 1 | 2 | 3 | 4;

export const FONT_SIZE_LABELS: Record<FontSizeLevel, string> = {
  0: 'XS',
  1: 'S',
  2: 'M',
  3: 'L',
  4: 'XL',
};

/** Returns a multiplier: 0.8, 0.9, 1.0, 1.1, 1.2 */
export const getFontScale = (level: FontSizeLevel): number => {
  return 0.8 + level * 0.1;
};

export interface FontSizeControlProps {
  level: FontSizeLevel;
  onChangeLevel: (level: FontSizeLevel) => void;
}

/**
 * FontSizeControl - A button that opens a popup to adjust font size.
 * Shows A- / A / A+ style progression bar.
 */
export const FontSizeControl: React.FC<FontSizeControlProps> = ({ level, onChangeLevel }) => {
  const [visible, setVisible] = useState(false);

  const decrease = () => {
    if (level > 0) onChangeLevel((level - 1) as FontSizeLevel);
  };

  const increase = () => {
    if (level < 4) onChangeLevel((level + 1) as FontSizeLevel);
  };

  return (
    <>
      {/* Trigger button */}
      <TouchableOpacity
        onPress={() => setVisible(true)}
        activeOpacity={0.7}
        style={styles.triggerButton}
      >
        <Type size={18} color={colors.textMuted} strokeWidth={2} />
      </TouchableOpacity>

      {/* Popup */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={styles.popup}>
            <Text style={styles.title}>Font Size</Text>

            {/* Size control row */}
            <View style={styles.controlRow}>
              {/* Decrease button */}
              <TouchableOpacity
                onPress={decrease}
                disabled={level === 0}
                activeOpacity={0.7}
                style={[styles.sizeButton, level === 0 && styles.sizeButtonDisabled]}
              >
                <Text
                  style={[styles.sizeButtonTextSmall, level === 0 && styles.sizeButtonTextDisabled]}
                >
                  A
                </Text>
              </TouchableOpacity>

              {/* Level indicators */}
              <View style={styles.levelIndicators}>
                {([0, 1, 2, 3, 4] as FontSizeLevel[]).map((l) => (
                  <TouchableOpacity
                    key={l}
                    onPress={() => onChangeLevel(l)}
                    activeOpacity={0.7}
                    style={[styles.levelDot, l === level && styles.levelDotActive]}
                  >
                    <Text style={[styles.levelLabel, l === level && styles.levelLabelActive]}>
                      {FONT_SIZE_LABELS[l]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Increase button */}
              <TouchableOpacity
                onPress={increase}
                disabled={level === 4}
                activeOpacity={0.7}
                style={[styles.sizeButton, level === 4 && styles.sizeButtonDisabled]}
              >
                <Text
                  style={[styles.sizeButtonTextLarge, level === 4 && styles.sizeButtonTextDisabled]}
                >
                  A
                </Text>
              </TouchableOpacity>
            </View>

            {/* Progress bar */}
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(level / 4) * 100}%` }]} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  triggerButton: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.borderDefault,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  popup: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 28,
    marginHorizontal: 24,
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.borderSubtle,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.5,
    shadowRadius: 32,
    elevation: 20,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textHeading,
    textAlign: 'center',
    marginBottom: 24,
    letterSpacing: 0.3,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  sizeButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sizeButtonDisabled: {
    opacity: 0.3,
  },
  sizeButtonTextSmall: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textBody,
  },
  sizeButtonTextLarge: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textBody,
  },
  sizeButtonTextDisabled: {
    color: colors.textDisabled,
  },
  levelIndicators: {
    flexDirection: 'row',
    gap: 8,
    flex: 1,
    justifyContent: 'space-evenly',
  },
  levelDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  levelDotActive: {
    backgroundColor: 'rgba(255, 153, 0, 0.2)',
  },
  levelLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textDisabled,
  },
  levelLabelActive: {
    color: colors.primaryOrange,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.surfaceHover,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primaryOrange,
    borderRadius: 2,
  },
});

export default FontSizeControl;
