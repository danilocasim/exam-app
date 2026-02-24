// UpgradeScreen — Forever Access upgrade information
import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Dimensions } from 'react-native';
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
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';

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
    key: 'unlimited',
    icon: <Infinity size={20} color={colors.primaryOrange} strokeWidth={2} />,
    title: 'Unlimited Exam Attempts',
    description: 'Take as many practice exams as you need with no restrictions',
  },
  {
    key: 'questions',
    icon: <BookOpen size={20} color={colors.success} strokeWidth={2} />,
    title: 'Full Question Bank Access',
    description: 'Access every question across all domains and difficulty levels',
  },
  {
    key: 'mock',
    icon: <Target size={20} color="#3B82F6" strokeWidth={2} />,
    title: 'Mock Exam Simulation',
    description: 'Realistic exam conditions with timed sessions and scoring',
  },
  {
    key: 'analytics',
    icon: <BarChart2 size={20} color="#8B5CF6" strokeWidth={2} />,
    title: 'Performance Analytics',
    description: 'Deep insights into your strengths and areas for improvement',
  },
  {
    key: 'tracking',
    icon: <Sparkles size={20} color="#F59E0B" strokeWidth={2} />,
    title: 'Progress Tracking',
    description: 'Track your improvement over time with detailed statistics',
  },
  {
    key: 'updates',
    icon: <RefreshCw size={20} color="#06B6D4" strokeWidth={2} />,
    title: 'Lifetime Updates',
    description: 'Receive all future question updates and new features at no cost',
  },
  {
    key: 'noads',
    icon: <ShieldOff size={20} color={colors.successLight} strokeWidth={2} />,
    title: 'No Ads',
    description: 'Enjoy a completely distraction-free study experience',
  },
];

export const UpgradeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();

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
              Unlock the full power of Dojo Exam. One purchase, lifetime access to everything you
              need to ace your certification.
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
          <TouchableOpacity activeOpacity={0.85} style={styles.ctaWrapper}>
            <LinearGradient
              colors={[colors.primaryOrange, colors.secondaryOrange]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.ctaGradient}
            >
              <Crown size={20} color={colors.textHeading} strokeWidth={2.5} />
              <Text style={styles.ctaText}>Upgrade Now</Text>
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
  ctaFootnote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default UpgradeScreen;
