// UpgradeScreen — 3-plan subscription selector with localized pricing
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
  ActivityIndicator,
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
  Calendar,
  Zap,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import {
  useTierLevel,
  useSubscriptionType,
  useExpiryDate,
  useIsAutoRenewing,
  usePendingProductId,
} from '../stores/purchase.store';
import { FREE_QUESTION_LIMIT, EXAM_TYPE_ID } from '../config';
import {
  fetchSubscriptions,
  handleSubscriptionPurchase,
  restorePurchases,
  cancelSubscription,
  initBilling,
  type SubscriptionInfo,
  type SubscriptionPlan,
  SUBSCRIPTION_PLANS,
} from '../services/billing.service';

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
  error: '#EF4444',
};

const SCREEN_WIDTH = Dimensions.get('window').width;

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Upgrade'>;

// ─── Plan card helpers ───────────────────────────────────────────────────────

interface PlanDisplayInfo {
  plan: SubscriptionPlan;
  label: string;
  localizedPrice: string;
  monthlyEquivalent: string;
  savings: string | null;
  badge: string | null;
  billingNote: string;
  offerToken: string;
  sku: string;
}

/**
 * Calculate the effective monthly cost for display.
 * Uses micros for accuracy, falls back to localized string parsing.
 */
const getMonthlyEquivalent = (info: SubscriptionInfo): string => {
  const micros = parseInt(info.priceAmountMicros, 10);
  if (isNaN(micros)) return info.localizedPrice;

  let monthlyMicros: number;
  switch (info.plan) {
    case 'monthly':
      monthlyMicros = micros;
      break;
    case 'quarterly':
      monthlyMicros = Math.round(micros / 3);
      break;
    case 'annual':
      monthlyMicros = Math.round(micros / 12);
      break;
  }

  // Format with the same currency. Extract currency symbol from localized price.
  const currencySymbol = info.localizedPrice.replace(/[\d.,\s]/g, '') || '$';
  const amount = (monthlyMicros / 1_000_000).toFixed(2);
  return `${currencySymbol}${amount}`;
};

const getBillingNote = (plan: SubscriptionPlan, price: string): string => {
  switch (plan) {
    case 'monthly':
      return `Billed ${price}/month`;
    case 'quarterly':
      return `Billed ${price} every 3 months`;
    case 'annual':
      return `Billed ${price}/year`;
  }
};

const toPlanDisplay = (info: SubscriptionInfo): PlanDisplayInfo => ({
  plan: info.plan,
  label: SUBSCRIPTION_PLANS[info.plan].label,
  localizedPrice: info.localizedPrice,
  monthlyEquivalent: getMonthlyEquivalent(info),
  savings: SUBSCRIPTION_PLANS[info.plan].savings,
  badge: info.plan === 'quarterly' ? 'MOST POPULAR' : info.plan === 'annual' ? 'BEST VALUE' : null,
  billingNote: getBillingNote(info.plan, info.localizedPrice),
  offerToken: info.offerToken,
  sku: info.productId,
});

// ─── Benefits list ───────────────────────────────────────────────────────────

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
    title: 'Continuous Updates',
    description: 'Receive all future question updates and new features',
  },
];

export const UpgradeScreen: React.FC = () => {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const tierLevel = useTierLevel();
  const isPremium = tierLevel === 'PREMIUM';
  const subscriptionType = useSubscriptionType();
  const expiryDate = useExpiryDate();
  const autoRenewing = useIsAutoRenewing();
  const pendingProductId = usePendingProductId();

  // T266: Derived edge-case states
  const isExpired = expiryDate ? new Date(expiryDate) <= new Date() : false;
  const isCancelledButActive = isPremium && !autoRenewing && expiryDate && !isExpired;
  const isExpiredAndFree = !isPremium && isExpired && expiryDate;

  // State
  const [plans, setPlans] = useState<PlanDisplayInfo[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>('quarterly');
  const [isLoadingPlans, setIsLoadingPlans] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Load subscription plans from Play Store ─────────────────────────────

  const loadPlans = useCallback(async () => {
    setIsLoadingPlans(true);
    setError(null);
    try {
      await initBilling();
      const subs = await fetchSubscriptions(EXAM_TYPE_ID);
      const order: SubscriptionPlan[] = ['monthly', 'quarterly', 'annual'];
      const sorted = subs
        .map(toPlanDisplay)
        .sort((a, b) => order.indexOf(a.plan) - order.indexOf(b.plan));
      setPlans(sorted);
    } catch (err) {
      console.error('[UpgradeScreen] Failed to load plans:', err);
      const message =
        err instanceof Error && err.message?.includes('Not connected')
          ? 'Google Play Store is required to subscribe. Please make sure it is installed and up to date.'
          : 'Unable to load subscription plans. Please try again.';
      setError(message);
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    if (!isPremium) {
      loadPlans();
    } else {
      setIsLoadingPlans(false);
    }
  }, [isPremium, loadPlans]);

  // ─── Purchase flow ───────────────────────────────────────────────────────

  const handleSubscribe = useCallback(async () => {
    const plan = plans.find((p) => p.plan === selectedPlan);
    if (!plan) return;

    setIsPurchasing(true);
    setError(null);

    try {
      const result = await handleSubscriptionPurchase(plan.sku, plan.offerToken);

      if (result.success) {
        Alert.alert(
          'Welcome to Premium!',
          'Your subscription is now active. Enjoy unlimited access to all features.',
          [
            {
              text: 'Start Studying',
              onPress: () => navigation.navigate('MainTabs' as never),
            },
          ],
        );
      } else if (result.isPending) {
        Alert.alert(
          'Payment Pending',
          'Your subscription is being processed. It will activate once payment is confirmed.',
          [{ text: 'OK' }],
        );
      } else if (result.error?.code === 'E_USER_CANCELLED') {
        // User cancelled — no error message needed
      } else {
        setError(result.error?.message ?? 'Subscription failed. Please try again.');
      }
    } catch (err) {
      console.error('[UpgradeScreen] Subscription error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsPurchasing(false);
    }
  }, [plans, selectedPlan, navigation]);

  // ─── Restore flow ────────────────────────────────────────────────────────

  const handleRestore = useCallback(async () => {
    setIsRestoring(true);
    setError(null);

    try {
      await initBilling();
      const purchases = await restorePurchases();

      if (purchases.length > 0) {
        Alert.alert('Subscription Restored', 'Your premium access has been restored.', [
          {
            text: 'Continue',
            onPress: () => navigation.navigate('MainTabs' as never),
          },
        ]);
      } else {
        Alert.alert(
          'No Subscription Found',
          'We could not find an active subscription for this Google account.',
          [{ text: 'OK' }],
        );
      }
    } catch (err) {
      console.error('[UpgradeScreen] Restore error:', err);
      setError('Failed to restore subscription. Please try again.');
    } finally {
      setIsRestoring(false);
    }
  }, [navigation]);

  // ─── Format expiry date ──────────────────────────────────────────────────

  const formatExpiryDate = (iso: string): string => {
    const date = new Date(iso);
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
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

        {/* T266: Pending subscription badge */}
        {pendingProductId && !isPremium && (
          <View style={styles.pendingBanner}>
            <ActivityIndicator size="small" color={colors.primaryOrange} />
            <Text style={styles.pendingBannerText}>
              Subscription pending — it will activate once payment is confirmed.
            </Text>
          </View>
        )}

        {/* T266: Cancelled subscription warning (access until expiry) */}
        {isCancelledButActive && (
          <View style={styles.cancelledBanner}>
            <Calendar size={14} color={colors.primaryOrange} strokeWidth={2} />
            <Text style={styles.cancelledBannerText}>
              Your subscription is cancelled. Access continues until {formatExpiryDate(expiryDate!)}
              .
            </Text>
          </View>
        )}

        {/* T266: Expired subscription prompt */}
        {isExpiredAndFree && (
          <View style={styles.expiredBanner}>
            <ShieldOff size={14} color={colors.error} strokeWidth={2} />
            <Text style={styles.expiredBannerText}>
              Your subscription expired. Renew to continue with Premium features.
            </Text>
          </View>
        )}

        {/* ─── Premium Status View ─────────────────────────────────────── */}
        {isPremium ? (
          <View style={styles.premiumStatusSection}>
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
              <Text style={styles.heroTitle}>Premium Access</Text>
              <Text style={styles.heroSubtitle}>
                You have full access to all Dojo Exam features.
              </Text>
            </LinearGradient>

            {/* Subscription details card */}
            <View style={styles.subscriptionDetailsCard}>
              {subscriptionType && (
                <View style={styles.detailRow}>
                  <Zap size={16} color={colors.primaryOrange} strokeWidth={2} />
                  <Text style={styles.detailLabel}>Plan</Text>
                  <Text style={styles.detailValue}>
                    {SUBSCRIPTION_PLANS[subscriptionType].label}
                  </Text>
                </View>
              )}
              {expiryDate && (
                <View style={styles.detailRow}>
                  <Calendar size={16} color={colors.primaryOrange} strokeWidth={2} />
                  <Text style={styles.detailLabel}>
                    {autoRenewing ? 'Renews on' : 'Expires on'}
                  </Text>
                  <Text style={styles.detailValue}>{formatExpiryDate(expiryDate)}</Text>
                </View>
              )}
              <View style={styles.detailRow}>
                <RefreshCw
                  size={16}
                  color={autoRenewing ? colors.success : colors.textMuted}
                  strokeWidth={2}
                />
                <Text style={styles.detailLabel}>Auto-renew</Text>
                <Text
                  style={[
                    styles.detailValue,
                    { color: autoRenewing ? colors.success : colors.textMuted },
                  ]}
                >
                  {autoRenewing ? 'Active' : 'Off'}
                </Text>
              </View>
            </View>

            {/* Manage subscription link */}
            <TouchableOpacity
              style={styles.manageBtn}
              onPress={cancelSubscription}
              activeOpacity={0.7}
            >
              <Text style={styles.manageBtnText}>Manage Subscription on Google Play</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* ─── Hero Section ─────────────────────────────────────────── */}
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

                <Text style={styles.heroTitle}>Premium Access</Text>
                <Text style={styles.heroSubtitle}>
                  Unlock the full power of Dojo Exam. Unlimited daily quizzes, missed-question
                  drills, custom exams, and full mock tests.
                </Text>
              </LinearGradient>
            </View>

            {/* ─── Plan Selector Cards ──────────────────────────────────── */}
            <View style={styles.planSection}>
              <Text style={styles.sectionTitle}>Choose Your Plan</Text>

              {isLoadingPlans ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primaryOrange} />
                  <Text style={styles.loadingText}>Loading plans...</Text>
                </View>
              ) : plans.length === 0 && error ? (
                <View style={styles.errorContainer}>
                  <Text style={styles.errorText}>{error}</Text>
                  <TouchableOpacity style={styles.retryBtn} onPress={loadPlans} activeOpacity={0.7}>
                    <Text style={styles.retryBtnText}>Retry</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.planCards}>
                  {plans.map((plan) => {
                    const isSelected = selectedPlan === plan.plan;
                    const isPopular = plan.badge === 'MOST POPULAR';
                    return (
                      <TouchableOpacity
                        key={plan.plan}
                        activeOpacity={0.7}
                        onPress={() => setSelectedPlan(plan.plan)}
                        style={[
                          styles.planCard,
                          isSelected && styles.planCardSelected,
                          isPopular && styles.planCardPopular,
                        ]}
                      >
                        {/* Badge */}
                        {plan.badge && (
                          <View
                            style={[
                              styles.planBadge,
                              isPopular ? styles.planBadgePopular : styles.planBadgeBestValue,
                            ]}
                          >
                            <Text
                              style={[
                                styles.planBadgeText,
                                isPopular
                                  ? styles.planBadgeTextPopular
                                  : styles.planBadgeTextBestValue,
                              ]}
                            >
                              {plan.badge}
                            </Text>
                          </View>
                        )}

                        {/* Radio + content */}
                        <View style={styles.planCardContent}>
                          <View style={styles.planRadio}>
                            <View
                              style={[styles.radioOuter, isSelected && styles.radioOuterSelected]}
                            >
                              {isSelected && <View style={styles.radioInner} />}
                            </View>
                          </View>

                          <View style={styles.planInfo}>
                            <Text style={styles.planLabel}>{plan.label}</Text>
                            <Text style={styles.planBillingNote}>{plan.billingNote}</Text>
                          </View>

                          <View style={styles.planPricing}>
                            <Text style={styles.planMonthlyPrice}>{plan.monthlyEquivalent}</Text>
                            <Text style={styles.planPeriodLabel}>/month</Text>
                            {plan.savings && (
                              <View style={styles.savingsBadge}>
                                <Text style={styles.savingsText}>{plan.savings}</Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </>
        )}

        {/* ─── Free vs Premium Comparison ─────────────────────────────── */}
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
            { feature: 'Continuous updates', free: false, premium: true },
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
        {!isPremium && (
          <View style={styles.ctaSection}>
            {error && plans.length > 0 && <Text style={styles.ctaError}>{error}</Text>}
            <TouchableOpacity
              activeOpacity={0.85}
              style={[
                styles.ctaWrapper,
                (isPurchasing || isLoadingPlans || plans.length === 0) && styles.ctaWrapperDisabled,
              ]}
              onPress={handleSubscribe}
              disabled={isPurchasing || isLoadingPlans || plans.length === 0}
            >
              <LinearGradient
                colors={[colors.primaryOrange, colors.secondaryOrange]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.ctaGradient}
              >
                {isPurchasing ? (
                  <ActivityIndicator size="small" color={colors.textHeading} />
                ) : (
                  <Crown size={20} color={colors.textHeading} strokeWidth={2.5} />
                )}
                <Text style={styles.ctaText}>
                  {isPurchasing ? 'Processing...' : 'Subscribe Now'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
            <Text style={styles.ctaFootnote}>Cancel anytime · Managed by Google Play</Text>

            {/* Restore subscription link */}
            <TouchableOpacity
              style={styles.restoreBtn}
              onPress={handleRestore}
              disabled={isRestoring}
              activeOpacity={0.7}
            >
              {isRestoring ? (
                <ActivityIndicator size="small" color={colors.textMuted} />
              ) : (
                <Text style={styles.restoreBtnText}>Restore Subscription</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
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

  // Premium status
  premiumStatusSection: {
    marginBottom: 8,
  },
  subscriptionDetailsCard: {
    marginHorizontal: 20,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    padding: 16,
    marginBottom: 12,
    gap: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  detailLabel: {
    flex: 1,
    fontSize: 14,
    color: colors.textBody,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textHeading,
  },
  manageBtn: {
    marginHorizontal: 20,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.borderDefault,
    marginBottom: 24,
  },
  manageBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primaryOrange,
  },

  // Plan selector
  planSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  planCards: {
    gap: 10,
  },
  planCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.borderDefault,
    overflow: 'hidden',
  },
  planCardSelected: {
    borderColor: colors.primaryOrange,
    backgroundColor: 'rgba(255, 153, 0, 0.04)',
  },
  planCardPopular: {},
  planBadge: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    borderBottomRightRadius: 8,
  },
  planBadgePopular: {
    backgroundColor: colors.primaryOrange,
  },
  planBadgeBestValue: {
    backgroundColor: colors.success,
  },
  planBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  planBadgeTextPopular: {
    color: '#000',
  },
  planBadgeTextBestValue: {
    color: '#fff',
  },
  planCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  planRadio: {},
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: colors.primaryOrange,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primaryOrange,
  },
  planInfo: {
    flex: 1,
  },
  planLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textHeading,
    marginBottom: 2,
  },
  planBillingNote: {
    fontSize: 12,
    color: colors.textMuted,
  },
  planPricing: {
    alignItems: 'flex-end',
  },
  planMonthlyPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textHeading,
  },
  planPeriodLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: -2,
  },
  savingsBadge: {
    marginTop: 4,
    backgroundColor: colors.orangeDark,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 153, 0, 0.3)',
  },
  savingsText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.orangeLight,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 12,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textHeading,
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

  // T266: Edge case banners
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 153, 0, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 153, 0, 0.25)',
  },
  pendingBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.primaryOrange,
    lineHeight: 17,
  },
  cancelledBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 153, 0, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 153, 0, 0.25)',
  },
  cancelledBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.primaryOrange,
    lineHeight: 17,
  },
  expiredBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  expiredBannerText: {
    flex: 1,
    fontSize: 12,
    color: colors.error,
    lineHeight: 17,
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
  ctaError: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    marginBottom: 8,
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
    marginBottom: 8,
  },
  restoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
});

export default UpgradeScreen;
