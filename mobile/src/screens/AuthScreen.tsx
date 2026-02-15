/**
 * T134: Authentication Screen
 *
 * Displays Google Sign-In button or signed-in user profile.
 * Uses expo-auth-session for Expo Go compatible OAuth flow.
 * Design: AWS Modern palette, consistent with Home / Settings screens.
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  ChevronLeft,
  ChevronRight,
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
import { Image } from 'react-native';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuthStore } from '../stores/auth-store';
import { useGoogleAuthRequest, handleGoogleAuthSuccess, signOut } from '../services/auth-service';

// AWS Modern Color Palette (shared with Home / Settings)
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
  errorLight: '#FCA5A5',
  errorDark: 'rgba(239, 68, 68, 0.15)',
  info: '#3B82F6',
};

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function AuthScreen(): React.ReactElement {
  const navigation = useNavigation<NavigationProp>();
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
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft size={24} color={colors.textHeading} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Account</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
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
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <ChevronLeft size={24} color={colors.textHeading} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Account</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, styles.scrollContentCentered]}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          <View style={styles.heroIconOuter}>
            <View style={styles.heroIcon}>
              <Cloud size={32} color={colors.textHeading} strokeWidth={1.8} />
            </View>
          </View>
          <Text style={styles.heroTitle}>Sign in to sync</Text>
          <Text style={styles.heroSubtitle}>
            Back up your exam results and access them across all your devices
          </Text>
        </View>

        {/* Sign-in CTA */}
        <TouchableOpacity
          onPress={handleSignIn}
          disabled={isLoading || !request}
          activeOpacity={0.85}
          style={[styles.ctaWrapper, (!request || isLoading) && styles.ctaDisabled]}
        >
          <LinearGradient
            colors={[colors.primaryOrange, colors.secondaryOrange]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.ctaContent}>
                <View style={styles.ctaLeft}>
                  <View style={styles.ctaIconCircle}>
                    <User size={18} color={colors.textHeading} strokeWidth={2.5} />
                  </View>
                  <View>
                    <Text style={styles.ctaTitle}>Sign in with Google</Text>
                    <Text style={styles.ctaSub}>Quick & secure authentication</Text>
                  </View>
                </View>
                <ChevronRight size={20} color={colors.textHeading} strokeWidth={2} />
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Benefits Card */}
        <View style={[styles.section, { marginTop: 24 }]}>
          <Text style={styles.sectionTitle}>What you get</Text>
          <View style={styles.card}>
            <View style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: colors.orangeDark }]}>
                <Cloud size={16} color={colors.primaryOrange} strokeWidth={2} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>Cloud Backup</Text>
                <Text style={styles.benefitDesc}>Exam results are safely stored in the cloud</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.benefitRow}>
              <View style={[styles.benefitIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Smartphone size={16} color={colors.info} strokeWidth={2} />
              </View>
              <View style={styles.benefitText}>
                <Text style={styles.benefitTitle}>Cross-Device Access</Text>
                <Text style={styles.benefitDesc}>Continue studying on any device seamlessly</Text>
              </View>
            </View>
            <View style={styles.divider} />
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

        {/* Privacy note */}
        <View style={styles.privacyNote}>
          <Shield size={14} color={colors.textMuted} strokeWidth={2} />
          <Text style={styles.privacyText}>
            We only access your name and email. Your study data never leaves your device unless you
            choose to sync.
          </Text>
        </View>

        {/* Error display */}
        {error && (
          <View style={styles.errorRow}>
            <AlertTriangle size={14} color={colors.errorLight} strokeWidth={2} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderDefault,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textHeading,
  },

  // Scroll
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  scrollContentCentered: {
    flexGrow: 1,
  },

  // Hero (signed-out)
  heroSection: {
    alignItems: 'center',
    marginBottom: 28,
    marginTop: 12,
  },
  heroIconOuter: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.orangeDark,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primaryOrange,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textHeading,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },

  // CTA button (matching Home's Start Exam)
  ctaWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  ctaDisabled: {
    opacity: 0.5,
  },
  ctaGradient: {
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  ctaContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  ctaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  ctaIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.textHeading,
  },
  ctaSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 1,
  },

  // Sections & Cards (matching Settings)
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.borderDefault,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 12,
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
    marginHorizontal: 12,
  },

  // Benefits (signed-out)
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 14,
    gap: 12,
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
    gap: 8,
    paddingHorizontal: 4,
    marginTop: 4,
    marginBottom: 16,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },

  // Profile (signed-in)
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingVertical: 28,
    paddingHorizontal: 20,
    marginBottom: 24,
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
    marginBottom: 14,
  },
  avatarLargeImg: {
    width: 72,
    height: 72,
    borderRadius: 36,
    marginBottom: 14,
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
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: 14,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.successDark,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.successLight,
  },

  // Sign-out
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.errorDark,
    borderRadius: 12,
    paddingVertical: 14,
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
    gap: 8,
    backgroundColor: colors.errorDark,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
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
