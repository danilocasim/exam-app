/**
 * OnboardingScreen — First-time user onboarding carousel.
 *
 * Shown after Google Sign-In on the user's first launch.
 * 3 slides: Set exam date → Start diagnostic test → Build daily streak.
 *
 * The exam-date slide embeds the DatePickerModal inline so users can set
 * their target date without extra navigation.
 */
import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Dimensions,
  TouchableOpacity,
  ViewToken,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { CalendarDays, ClipboardCheck, Flame, ChevronRight, ArrowRight } from 'lucide-react-native';
import { colors, spacing, radii, typography } from '../theme';
import { DatePickerModal } from '../components/DatePickerModal';
import { useStreakStore } from '../stores/streak.store';
import { useOnboardingStore } from '../stores/onboarding-store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ── Slide data ────────────────────────────────────────────────

interface SlideData {
  id: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  description: string;
  accentColor: string;
}

const SLIDES: SlideData[] = [
  {
    id: 'exam-date',
    icon: <CalendarDays size={48} color={colors.primaryOrange} strokeWidth={1.5} />,
    title: 'Set Your Exam Date',
    subtitle: 'Stay on track',
    description:
      "Pick your target exam date and we'll show a countdown to keep you motivated and focused.",
    accentColor: colors.primaryOrange,
  },
  {
    id: 'diagnostic',
    icon: <ClipboardCheck size={48} color={colors.info} strokeWidth={1.5} />,
    title: 'Take a Diagnostic Test',
    subtitle: 'Know where you stand',
    description:
      'Start with a quick diagnostic to identify your strengths and weak areas — then study smarter, not harder.',
    accentColor: colors.info,
  },
  {
    id: 'streak',
    icon: <Flame size={48} color={colors.success} strokeWidth={1.5} />,
    title: 'Build Your Streak',
    subtitle: 'Consistency wins',
    description:
      'Practice daily, even just a few questions. Your streak counter will keep you accountable on the road to passing.',
    accentColor: colors.success,
  },
];

// ── Component ─────────────────────────────────────────────────

interface OnboardingScreenProps {
  onComplete: () => void;
}

export const OnboardingScreen: React.FC<OnboardingScreenProps> = ({ onComplete }) => {
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const saveExamDate = useStreakStore((s) => s.saveExamDate);
  const completeOnboarding = useOnboardingStore((s) => s.completeOnboarding);

  const isLastSlide = activeIndex === SLIDES.length - 1;

  // ── Pagination ──

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index != null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const goToNext = () => {
    if (isLastSlide) {
      handleFinish();
    } else {
      flatListRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = () => {
    completeOnboarding();
    onComplete();
  };

  // ── Date handling ──

  const handleDateSave = async (date: string) => {
    setSelectedDate(date);
    setShowDatePicker(false);
    await saveExamDate(date);
  };

  const handleDateClear = async () => {
    setSelectedDate(null);
    setShowDatePicker(false);
    await saveExamDate(null);
  };

  // ── Render slide ──

  const renderSlide = ({ item }: { item: SlideData; index: number }) => {
    const isDateSlide = item.id === 'exam-date';

    return (
      <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
        {/* Icon container */}
        <View style={[styles.iconContainer, { backgroundColor: `${item.accentColor}15` }]}>
          {item.icon}
        </View>

        {/* Badge */}
        <View style={[styles.subtitleBadge, { backgroundColor: `${item.accentColor}20` }]}>
          <Text style={[styles.subtitleText, { color: item.accentColor }]}>{item.subtitle}</Text>
        </View>

        {/* Title */}
        <Text style={styles.title}>{item.title}</Text>

        {/* Description */}
        <Text style={styles.description}>{item.description}</Text>

        {/* Exam date action (slide 1 only) */}
        {isDateSlide && (
          <View style={styles.dateActionContainer}>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              style={styles.dateButton}
              activeOpacity={0.8}
            >
              <CalendarDays size={20} color={colors.primaryOrange} strokeWidth={2} />
              <Text style={styles.dateButtonText}>
                {selectedDate ? formatDisplayDate(selectedDate) : 'Pick your exam date'}
              </Text>
              <ChevronRight size={16} color={colors.textMuted} strokeWidth={2} />
            </TouchableOpacity>
            {selectedDate && <Text style={styles.dateConfirm}>Countdown starts now!</Text>}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Skip button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleSkip} style={styles.skipButton} activeOpacity={0.7}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Carousel */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        renderItem={renderSlide}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={(_, index) => ({
          length: SCREEN_WIDTH,
          offset: SCREEN_WIDTH * index,
          index,
        })}
        style={styles.flatList}
        contentContainerStyle={styles.flatListContent}
      />

      {/* Bottom section — dots + button */}
      <View style={[styles.bottomSection, { paddingBottom: insets.bottom + spacing.lg }]}>
        {/* Pagination dots */}
        <View style={styles.pagination}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === activeIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        {/* CTA button */}
        <TouchableOpacity onPress={goToNext} activeOpacity={0.85} style={styles.ctaWrapper}>
          <LinearGradient
            colors={
              isLastSlide
                ? [colors.primaryOrange, colors.secondaryOrange]
                : [colors.surface, colors.surfaceHover]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text style={[styles.ctaText, isLastSlide && styles.ctaTextFinal]}>
              {isLastSlide ? "Let's Go!" : 'Next'}
            </Text>
            <ArrowRight
              size={20}
              color={isLastSlide ? colors.textHeading : colors.textBody}
              strokeWidth={2}
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Date picker modal (for slide 1) */}
      <DatePickerModal
        visible={showDatePicker}
        currentDate={selectedDate}
        onSave={handleDateSave}
        onClear={handleDateClear}
        onClose={() => setShowDatePicker(false)}
      />
    </View>
  );
};

// ── Helpers ──────────────────────────────────────────────────

function formatDisplayDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[month - 1]} ${day}, ${year}`;
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  skipButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  skipText: {
    ...typography.label,
    color: colors.textMuted,
  },

  // Carousel
  flatList: {
    flex: 1,
  },
  flatListContent: {},
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl + spacing.sm,
  },

  // Icon
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: radii.xl + 4,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },

  // Badge
  subtitleBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radii.pill,
    marginBottom: spacing.md,
  },
  subtitleText: {
    ...typography.badge,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },

  // Title
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.textHeading,
    textAlign: 'center',
    marginBottom: spacing.md,
    lineHeight: 34,
  },

  // Description
  description: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    color: colors.textBody,
    textAlign: 'center',
    maxWidth: 300,
  },

  // Date action (slide 1)
  dateActionContainer: {
    marginTop: spacing.xl,
    alignItems: 'center',
    width: '100%',
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: spacing.md + 4,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    gap: spacing.sm + 2,
    width: '100%',
    maxWidth: 300,
  },
  dateButtonText: {
    ...typography.label,
    color: colors.textBody,
    flex: 1,
  },
  dateConfirm: {
    ...typography.caption,
    color: colors.success,
    marginTop: spacing.sm,
  },

  // Bottom section
  bottomSection: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
    alignItems: 'center',
  },

  // Pagination
  pagination: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.primaryOrange,
  },
  dotInactive: {
    width: 8,
    backgroundColor: colors.borderSubtle,
  },

  // CTA
  ctaWrapper: {
    width: '100%',
    borderRadius: radii.lg,
    overflow: 'hidden',
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: spacing.sm,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textBody,
  },
  ctaTextFinal: {
    color: colors.textHeading,
  },
});

export default OnboardingScreen;
