/**
 * T134: Authentication Screen
 *
 * Displays Google Sign-In button or signed-in user profile.
 * Uses expo-auth-session for Expo Go compatible OAuth flow.
 * Design: Premium dark mode using shared design tokens.
 */
import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ChevronLeft,
  LogOut,
  Cloud,
  Smartphone,
  BarChart2,
  Shield,
  User,
  AlertTriangle,
  CheckCircle2,
  Mail,
} from 'lucide-react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuthStore } from '../stores/auth-store';
import { useGoogleAuthRequest, handleGoogleAuthSuccess, signOut } from '../services/auth-service';
import { colors, spacing, radii, typography, MIN_TAP_SIZE } from '../theme';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function AuthScreen(): React.ReactElement {
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const { isSignedIn, user, isLoading, error } = useAuthStore();
  const { request, response, promptAsync } = useGoogleAuthRequest();

  // Process Google OAuth response when it arrives
  useEffect(() => {
    if (response?.type === 'success' && response.authentication) {
      const { accessToken, idToken } = response.authentication;
      if (accessToken) {
        handleGoogleAuthSuccess(accessToken, idToken ?? '').catch((err) => {
          useAuthStore.setState({
            error: err instanceof Error ? err.message : 'Sign-in failed',
            isLoading: false,
          });
        });
      }
    } else if (response?.type === 'error') {
      useAuthStore.setState({
        error: 'Google sign-in was cancelled or failed',
        isLoading: false,
      });
    }
  }, [response]);

  const handleSignIn = async () => {
    try {
      useAuthStore.setState({ isLoading: true, error: null });
      const result = await promptAsync();
      // If promptAsync returned cancel/error without setting response
      if (result?.type === 'cancel') {
        useAuthStore.setState({ isLoading: false });
      } else if (result?.type === 'error') {
        useAuthStore.setState({ error: 'Sign-in failed', isLoading: false });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign-in failed';
      useAuthStore.setState({ error: errorMessage, isLoading: false });
    }
  };

  const handleSignOut = async () => {
    try {
      useAuthStore.setState({ isLoading: true });
      await signOut();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Sign-out failed';
      useAuthStore.setState({ error: errorMessage });
    } finally {
      useAuthStore.setState({ isLoading: false });
    }
  };

  // ── Signed-in state ──
  if (isSignedIn && user) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
            style={styles.backButton}
          >
            <ChevronLeft size={24} color={colors.textHeading} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account</Text>
          <View style={{ width: MIN_TAP_SIZE }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(spacing.xxl, insets.bottom) },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Card */}
          <View style={styles.profileCard}>
            {user.picture ? (
              <Image source={{ uri: user.picture }} style={styles.avatarLargeImg} />
            ) : (
              <View style={styles.avatarLarge}>
                <Text style={styles.avatarLargeText}>
                  {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <Text style={styles.profileName}>{user.name || 'Signed In'}</Text>
            <Text style={styles.profileEmail}>{user.email}</Text>
            <View style={styles.statusBadge}>
              <CheckCircle2 size={12} color={colors.success} strokeWidth={2.5} />
              <Text style={styles.statusBadgeText}>Connected</Text>
            </View>
          </View>

          {/* Account Details Card */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <User size={18} color={colors.primaryOrange} strokeWidth={2} />
                <Text style={styles.rowLabel}>Name</Text>
                <Text style={styles.rowValue}>{user.name || '—'}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Mail size={18} color={colors.info} strokeWidth={2} />
                <Text style={styles.rowLabel}>Email</Text>
                <Text style={styles.rowValue} numberOfLines={1}>
                  {user.email}
                </Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Shield size={18} color={colors.success} strokeWidth={2} />
                <Text style={styles.rowLabel}>Provider</Text>
                <Text style={styles.rowValue}>Google</Text>
              </View>
            </View>
          </View>

          {/* Sync Benefits Card */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sync Features</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Cloud size={18} color={colors.primaryOrange} strokeWidth={2} />
                <Text style={styles.rowLabel}>Cloud backup</Text>
                <Text style={[styles.rowValue, { color: colors.success }]}>Active</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Smartphone size={18} color={colors.info} strokeWidth={2} />
                <Text style={styles.rowLabel}>Cross-device sync</Text>
                <Text style={[styles.rowValue, { color: colors.success }]}>Active</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.row}>
                <BarChart2 size={18} color={colors.orangeLight} strokeWidth={2} />
                <Text style={styles.rowLabel}>Cloud analytics</Text>
                <Text style={[styles.rowValue, { color: colors.success }]}>Active</Text>
              </View>
            </View>
          </View>

          {/* Error display */}
          {error && (
            <View style={styles.errorRow}>
              <AlertTriangle size={14} color={colors.errorLight} strokeWidth={2} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Sign Out */}
          <TouchableOpacity
            onPress={handleSignOut}
            disabled={isLoading}
            activeOpacity={0.7}
            style={styles.signOutBtn}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <LogOut size={16} color={colors.error} strokeWidth={2} />
                <Text style={styles.signOutText}>Sign Out</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Signed-out state ──
  return (
    <View style={styles.container}>
      {/* ── Atmospheric gradient orb (top-right) ── */}
      <View style={styles.atmosphereOrb}>
        <LinearGradient
          colors={['rgba(255, 140, 0, 0.18)', 'rgba(255, 140, 0, 0.06)', 'transparent']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.7, y: 0 }}
          end={{ x: 0.2, y: 1 }}
        />
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
              style={styles.backButton}
            >
              <ChevronLeft size={24} color={colors.textHeading} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Account</Text>
            <View style={{ width: MIN_TAP_SIZE }} />
          </View>

          {/* ── Top Branding ── */}
          <View style={styles.brandSection}>
            <View style={styles.logoContainer}>
              <View style={styles.logoIcon}>
                <Cloud size={28} color={colors.textHeading} strokeWidth={2.5} />
              </View>
            </View>
            <Text style={styles.brandTitle}>Dojo Exam</Text>
            <Text style={styles.brandSubtitle}>Sign in to sync your progress across devices</Text>
          </View>

          {/* ── Glass Card (bottom sheet–style) ── */}
          <View style={styles.glassCard}>
            <View style={styles.glassTopBorder} />

            <ScrollView
              contentContainerStyle={[
                styles.glassContent,
                { paddingBottom: Math.max(spacing.xxl, insets.bottom + spacing.md) },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {/* Primary CTA — Google Sign-In */}
              <TouchableOpacity
                onPress={handleSignIn}
                disabled={isLoading || !request}
                activeOpacity={0.85}
                style={[styles.googleBtn, (!request || isLoading) && styles.btnDisabled]}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.textHeading} />
                ) : (
                  <>
                    <GoogleIcon />
                    <Text style={styles.googleBtnText}>Continue with Google</Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* Continue without account */}
              <TouchableOpacity
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
                style={styles.skipBtn}
              >
                <Text style={styles.skipBtnText}>Continue without an account</Text>
              </TouchableOpacity>

              {/* ── Benefits ── */}
              <View style={styles.benefitsSection}>
                <Text style={styles.benefitsSectionTitle}>What you get</Text>
                <View style={styles.card}>
                  <View style={styles.benefitRow}>
                    <View style={[styles.benefitIcon, { backgroundColor: colors.orangeDark }]}>
                      <Cloud size={16} color={colors.primaryOrange} strokeWidth={2} />
                    </View>
                    <View style={styles.benefitText}>
                      <Text style={styles.benefitTitle}>Cloud Backup</Text>
                      <Text style={styles.benefitDesc}>
                        Exam results safely stored in the cloud
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.benefitRow}>
                    <View style={[styles.benefitIcon, { backgroundColor: colors.infoDark }]}>
                      <Smartphone size={16} color={colors.info} strokeWidth={2} />
                    </View>
                    <View style={styles.benefitText}>
                      <Text style={styles.benefitTitle}>Cross-Device Access</Text>
                      <Text style={styles.benefitDesc}>
                        Continue studying on any device seamlessly
                      </Text>
                    </View>
                  </View>
                  <View style={styles.cardDivider} />
                  <View style={styles.benefitRow}>
                    <View style={[styles.benefitIcon, { backgroundColor: colors.successDark }]}>
                      <BarChart2 size={16} color={colors.success} strokeWidth={2} />
                    </View>
                    <View style={styles.benefitText}>
                      <Text style={styles.benefitTitle}>Cloud Analytics</Text>
                      <Text style={styles.benefitDesc}>
                        Detailed performance insights across all exams
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* ── Privacy note ── */}
              <View style={styles.privacyNote}>
                <Shield size={14} color={colors.textMuted} strokeWidth={2} />
                <Text style={styles.privacyText}>
                  We only access your name and email. Your study data never leaves your device
                  unless you choose to sync.
                </Text>
              </View>

              {/* ── Error ── */}
              {error && (
                <View style={styles.errorRow}>
                  <AlertTriangle size={14} color={colors.errorLight} strokeWidth={2} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

// ── Google "G" icon (inline SVG-style component) ──
const GoogleIcon: React.FC = () => (
  <View style={googleStyles.container}>
    <Text style={googleStyles.letter}>G</Text>
  </View>
);

const googleStyles = StyleSheet.create({
  container: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  letter: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4285F4',
    marginTop: -1,
  },
});

// ── Styles ──
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  backButton: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.sm,
  },
  headerTitle: {
    ...typography.title,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md + 4,
  },

  // ── Signed-out layout ──
  signedOutContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.md + 4,
  },

  // Atmospheric radial gradient orb
  atmosphereOrb: {
    position: 'absolute',
    top: -60,
    right: -60,
    width: 280,
    height: 280,
    borderRadius: 140,
    overflow: 'hidden',
  },

  // Branding (top section with 64px margin)
  brandSection: {
    alignItems: 'center',
    marginTop: 64,
    paddingHorizontal: spacing.md + 4,
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: radii.xl,
    backgroundColor: colors.orangeDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  logoIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.md,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.textHeading,
    letterSpacing: -0.3,
    marginBottom: spacing.sm,
  },
  brandSubtitle: {
    fontSize: 15,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 280,
  },

  // Actions (inside glass card, no extra margin)
  actionsSection: {
    marginTop: spacing.xxl,
  },

  // ── Glass card container (bottom sheet) ──
  glassCard: {
    flex: 1,
    marginTop: spacing.xl,
    backgroundColor: 'rgba(36, 42, 56, 0.65)',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    overflow: 'hidden',
  },
  glassTopBorder: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  glassContent: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.md + 4,
  },

  // Google sign-in button — solid orange pill
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md - 4,
    height: 52,
    backgroundColor: '#FF8C00',
    borderRadius: radii.pill,
  },
  googleBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textHeading,
  },
  btnDisabled: {
    opacity: 0.5,
  },

  // Divider row
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
    gap: spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.borderDefault,
  },
  dividerText: {
    ...typography.caption,
    color: colors.textDisabled,
  },

  // Skip / continue without account
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md - 2,
  },
  skipBtnText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textMuted,
  },

  // Benefits section
  benefitsSection: {
    marginTop: spacing.xl,
  },
  benefitsSectionTitle: {
    ...typography.sectionHeader,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  cardDivider: {
    height: 1,
    backgroundColor: colors.borderDefault,
    marginHorizontal: spacing.md,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 2,
    gap: spacing.md,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    flex: 1,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textHeading,
  },
  benefitDesc: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },

  // Privacy
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },

  // ── Signed-in styles ──

  // Profile
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingVertical: spacing.lg + 4,
    paddingHorizontal: spacing.md + 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md - 2,
  },
  avatarLargeImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: spacing.md - 2,
  },
  avatarLargeText: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textHeading,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textHeading,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.md - 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successDark,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.successLight,
  },

  // Sections & cards (signed-in)
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.sectionHeader,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md - 4,
    gap: spacing.md,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    color: colors.textBody,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textHeading,
    maxWidth: 180,
  },
  divider: {
    height: 1,
    backgroundColor: colors.borderDefault,
    marginHorizontal: spacing.md,
  },

  // Sign-out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorDark,
    borderRadius: radii.md,
    paddingVertical: spacing.md - 2,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.error,
  },

  // Error
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.errorDark,
    borderRadius: radii.sm + 2,
    paddingHorizontal: spacing.md - 2,
    paddingVertical: spacing.sm + 2,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: colors.errorLight,
    fontSize: 13,
    flex: 1,
  },
});

export default AuthScreen;
