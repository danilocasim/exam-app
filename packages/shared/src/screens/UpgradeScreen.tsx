// UpgradeScreen — Forever Access upgrade information
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ArrowLeft,
  Crown,
  Infinity,
  BookOpen,
  BarChart2,
  Target,
  RefreshCw,
  ShieldOff,
  Sparkles,
  Check,
  X,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useTierLevel } from '../stores/purchase.store';
import { FREE_QUESTION_LIMIT } from '../config';

// AWS Modern Color Palette (shared across app)
const colors = {
  background: '#232F3E',
  surface: '#1F2937',
  surfaceHover: '#374151',
  borderDefault: '#374151',
  trackGray: '#4B5563',
  textHeading: '#F9FAFB',
  textBody: '#D1D5DB',
  textMuted: '#9CA3AF',
  primaryOrange: '#FF9900',
  secondaryOrange: '#EC7211',
  orangeDark: 'rgba(255, 153, 0, 0.2)',
  orangeLight: '#FFB84D',
  success: '#10B981',
  successLight: '#6EE7B7',
  successDark: 'rgba(16, 185, 129, 0.15)',
};

const SCREEN_WIDTH = Dimensions.get('window').width;

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Upgrade'>;

interface BenefitItem {
  key: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}

const benefits: BenefitItem[] = [
  {
    key: 'daily',
    icon: <Infinity size={20} color={colors.primaryOrange} strokeWidth={2} />,
    title: 'Unlimited Daily Quizzes',
    description: 'No cooldowns — take daily quizzes as often as you want',
  },
  {
    key: 'missed',
    icon: <ShieldOff size={20} color={colors.successLight} strokeWidth={2} />,
    title: 'Missed Questions Quiz',
    description: 'Target your weak spots with a focused missed-questions mode',
  },
  {
    key: 'custom',
    icon: <Sparkles size={20} color="#F59E0B" strokeWidth={2} />,
    title: 'Custom Exam Builder',
    description: 'Pick domains, question count, and timing to match your goals',
  },
  {
    key: 'mock',
    icon: <Target size={20} color="#3B82F6" strokeWidth={2} />,
    title: 'Full Mock Exams',
    description: 'Realistic exam conditions with timed sessions and scoring',
  },
  {
    key: 'questions',
    icon: <BookOpen size={20} color={colors.success} strokeWidth={2} />,
    title: 'Full Question Bank Access',
    description: 'Access every question across all domains and difficulty levels',
  },
  {
    key: 'analytics',
    icon: <BarChart2 size={20} color="#8B5CF6" strokeWidth={2} />,
    title: 'Performance Analytics',
    description: 'Deep insights into your strengths and areas for improvement',
  },
  {
    key: 'updates',
    icon: <RefreshCw size={20} color="#06B6D4" strokeWidth={2} />,
    title: 'Lifetime Updates',
    description: 'Receive all future question updates and new features at no cost',
  },
];

export const UpgradeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const tierLevel = useTierLevel();
  const isPremium = tierLevel === 'PREMIUM';

  const handleUpgradePress = () => {
    Alert.alert(
      'Coming Soon',
      'In-app purchase will be available in the next update. Stay tuned!',
      [{ text: 'OK' }],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        style={styles.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(32, insets.bottom + 16) }}
      >
        {/* Back Nav */}
        <View style={styles.navBar}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={styles.backBtn}
          >
            <ArrowLeft size={20} color={colors.textHeading} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        {/* Current tier status banner */}
        <View style={[styles.tierBanner, isPremium && styles.tierBannerPremium]}>
          <Crown
            size={14}
            color={isPremium ? colors.primaryOrange : colors.textMuted}
            strokeWidth={2}
          />
          <Text style={[styles.tierBannerText, isPremium && styles.tierBannerTextPremium]}>
            {isPremium ? "You're on the Premium plan" : "You're on the Free plan"}
          </Text>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={['rgba(255, 153, 0, 0.18)', 'rgba(236, 114, 17, 0.06)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.crownContainer}>
              <LinearGradient
                colors={[colors.primaryOrange, colors.secondaryOrange]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.crownCircle}
              >
                <Crown size={32} color={colors.textHeading} strokeWidth={2} />
              </LinearGradient>
            </View>

            <Text style={styles.heroTitle}>Forever Access</Text>
            <Text style={styles.heroSubtitle}>
              Unlock the full power of Dojo Exam. Unlimited daily quizzes, missed-question drills,
              custom exams, and full mock tests — all in one lifetime upgrade.
            </Text>

            {/* Price badge */}
            <View style={styles.priceBadge}>
              <Text style={styles.priceOld}>$29.99</Text>
              <Text style={styles.priceNew}>$14.99</Text>
              <View style={styles.discountChip}>
                <Text style={styles.discountText}>49% OFF</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Free vs Premium comparison table */}
        <View style={styles.comparisonSection}>
          <Text style={styles.sectionTitle}>Free vs Premium</Text>
          {/* Header row */}
          <View style={styles.comparisonRow}>
            <View style={styles.comparisonFeatureCol} />
            <View style={styles.comparisonPlanCol}>
              <Text style={styles.comparisonPlanLabel}>Free</Text>
            </View>
            <View style={[styles.comparisonPlanCol, styles.comparisonPremiumCol]}>
              <Crown size={12} color={colors.primaryOrange} strokeWidth={2} />
              <Text style={[styles.comparisonPlanLabel, styles.comparisonPremiumLabel]}>
                Premium
              </Text>
            </View>
          </View>
          {/* Rows */}
          {[
            { feature: 'Daily quiz attempts', free: '1 / 24h', premium: 'Unlimited' },
            { feature: 'Missed questions quiz', free: false, premium: true },
            { feature: 'Custom exam builder', free: false, premium: true },
            { feature: 'Mock exams', free: false, premium: 'Full exam' },
            { feature: 'Question bank', free: `${FREE_QUESTION_LIMIT}`, premium: 'All' },
            { feature: 'Analytics', free: false, premium: true },
            { feature: 'Lifetime updates', free: false, premium: true },
          ].map(({ feature, free, premium }) => (
            <View key={feature} style={styles.comparisonDataRow}>
              <View style={styles.comparisonFeatureCol}>
                <Text style={styles.comparisonFeatureText}>{feature}</Text>
              </View>
              <View style={styles.comparisonPlanCol}>
                {typeof free === 'boolean' ? (
                  free ? (
                    <Check size={15} color={colors.success} strokeWidth={3} />
                  ) : (
                    <X size={15} color={colors.textMuted} strokeWidth={2.5} />
                  )
                ) : (
                  <Text style={styles.comparisonValueText}>{free}</Text>
                )}
              </View>
              <View style={[styles.comparisonPlanCol, styles.comparisonPremiumCol]}>
                {typeof premium === 'boolean' ? (
                  premium ? (
                    <Check size={15} color={colors.primaryOrange} strokeWidth={3} />
                  ) : (
                    <X size={15} color={colors.textMuted} strokeWidth={2.5} />
                  )
                ) : (
                  <Text style={[styles.comparisonValueText, { color: colors.primaryOrange }]}>
                    {premium}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Benefits List */}
        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>What You Get</Text>
          {benefits.map((benefit) => (
            <View key={benefit.key} style={styles.benefitCard}>
              <View style={styles.benefitIconWrap}>{benefit.icon}</View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{benefit.title}</Text>
                <Text style={styles.benefitDesc}>{benefit.description}</Text>
              </View>
              <View style={styles.benefitCheck}>
                <Check size={14} color={colors.success} strokeWidth={3} />
              </View>
            </View>
          ))}
        </View>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <TouchableOpacity
            activeOpacity={isPremium ? 1 : 0.85}
            style={[styles.ctaWrapper, isPremium && styles.ctaWrapperDisabled]}
            onPress={isPremium ? undefined : handleUpgradePress}
          >
            <LinearGradient
              colors={[colors.primaryOrange, colors.secondaryOrange]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Crown size={20} color={colors.textHeading} strokeWidth={2.5} />
              <Text style={styles.ctaText}>{isPremium ? 'Already Unlocked' : 'Upgrade Now'}</Text>
            </LinearGradient>
          </TouchableOpacity>
          <Text style={styles.ctaFootnote}>
            One-time purchase · No subscriptions · No hidden fees
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },

  // Nav
  navBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },

  // Hero
  heroSection: { marginBottom: 8 },
  heroGradient: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  crownContainer: { marginBottom: 20 },
  crownCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.textHeading,
    marginBottom: 12,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 15,
    color: colors.textBody,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: SCREEN_WIDTH * 0.85,
    marginBottom: 24,
  },
  priceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  priceOld: {
    fontSize: 18,
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  priceNew: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.primaryOrange,
  },
  discountChip: {
    backgroundColor: colors.orangeDark,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 153, 0, 0.3)',
  },
  discountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.orangeLight,
  },

  // Benefits
  benefitsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 16,
  },
  benefitCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    gap: 12,
  },
  benefitIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitContent: { flex: 1 },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textHeading,
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  benefitCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.successDark,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tier banner
  tierBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  tierBannerPremium: {
    backgroundColor: 'rgba(255, 153, 0, 0.08)',
    borderColor: 'rgba(255, 153, 0, 0.25)',
  },
  tierBannerText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textMuted,
  },
  tierBannerTextPremium: {
    color: colors.primaryOrange,
  },

  // Comparison table
  comparisonSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  comparisonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  comparisonDataRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(55, 65, 81, 0.5)',
  },
  comparisonFeatureCol: {
    flex: 2,
  },
  comparisonPlanCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  comparisonPremiumCol: {
    backgroundColor: 'rgba(255, 153, 0, 0.06)',
    borderRadius: 6,
    paddingVertical: 2,
  },
  comparisonPlanLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  comparisonPremiumLabel: {
    color: colors.primaryOrange,
  },
  comparisonFeatureText: {
    fontSize: 14,
    color: colors.textBody,
  },
  comparisonValueText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textBody,
  },

  // CTA
  ctaSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  ctaWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    width: '100%',
    marginBottom: 12,
  },
  ctaGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  ctaText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textHeading,
  },
  ctaWrapperDisabled: {
    opacity: 0.6,
  },
  ctaFootnote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default UpgradeScreen;
