import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  AppState,
  AppStateStatus,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './navigation/RootNavigator';
import { initializeDatabase, switchUserDatabase } from './storage/database';
import { performFullSync } from './services/sync.service';
import { initPersistence, stopPersistence } from './services/persistence.service';
import { pullAndMergeAllStats } from './services/stats-sync.service';
import { getTotalQuestionCount } from './storage/repositories/question.repository';
import {
  initializeGoogleSignIn,
  useGoogleAuthRequest,
  handleGoogleAuthSuccess,
} from './services/auth-service';
import { TokenRefreshService } from './services/token-refresh-service';
import { ErrorBoundary } from './components/ErrorBoundary';
import { IntegrityBlockedScreen } from './components/IntegrityBlockedScreen';
import { useAuthStore } from './stores/auth-store';
import { usePurchaseStore } from './stores/purchase.store'; // ← add this line
import { checkIntegrity } from './services/play-integrity.service';
import { configureNotifications } from './services/notification.service';

export interface AppRootProps {
  examTypeId: string;
  appName: string;
  branding?: {
    primaryColor?: string;
  };
}

export function AppRoot({ examTypeId, appName, branding }: AppRootProps) {
  const [isReady, setIsReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState('Initializing...');
  const [error, setError] = useState<string | null>(null);
  const [integrityBlockedMessage, setIntegrityBlockedMessage] = useState<string | null>(null);
  const [integrityShowRetry, setIntegrityShowRetry] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // T251: Phase tracking for two-phase init (integrity → auth gate → sync)
  const [integrityPassed, setIntegrityPassed] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const phase2Started = useRef(false);

  // T251: Subscribe to auth state for phase 2 trigger
  const isSignedIn = useAuthStore((state) => state.isSignedIn);

  // T251: Google auth hook (must be at top level — no nav context required)
  const { promptAsync: promptGoogleAuth, response: googleAuthResponse } = useGoogleAuthRequest();

  const primaryColor = branding?.primaryColor ?? '#f59e0b';

  const handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'active') {
      console.log('[App] App came to foreground, triggering token refresh');
      TokenRefreshService.refreshIfNeeded().catch((err) => {
        console.error('[App] Token refresh failed:', err);
      });
    } else if (state === 'background') {
      console.log('[App] App went to background');
    }
  };

  // ─── Phase 1: DB init + integrity check ──────────────────────────────────

  useEffect(() => {
    const phase1 = async () => {
      try {
        setSyncStatus('Initializing authentication...');
        try {
          await initializeGoogleSignIn();
          console.log('[App] Google Sign-In initialized');
        } catch (err) {
          console.warn('[App] Google Sign-In initialization failed (continuing):', err);
        }

        // Setup periodic token refresh (every minute)
        TokenRefreshService.setupPeriodicRefresh(60000);
        console.log('[App] Token refresh service started');

        // Configure local notification handler for cooldown alerts
        configureNotifications();

        // Initialize SQLite database FIRST (integrity check needs IntegrityStatus table)
        setSyncStatus('Setting up database...');
        await initializeDatabase();
        console.log('[App] Database initialized');

        // Run Play Integrity check (needs database ready)
        setSyncStatus('Verifying integrity...');
        const integrityResult = await checkIntegrity();

        if (!integrityResult.verified && integrityResult.error?.type === 'DEFINITIVE') {
          // Permanent block — sideloaded/re-signed APK detected
          console.error('[App] DEFINITIVE integrity failure - blocking app');
          setIntegrityBlockedMessage(
            integrityResult.error.message ||
              'For security reasons, this app must be downloaded from Google Play.',
          );
          setIntegrityShowRetry(false);
          return; // Don't set integrityPassed — blocked screen shows via render check
        }

        if (!integrityResult.verified && !integrityResult.cachedResult) {
          console.warn(
            '[App] Integrity check failed (TRANSIENT/NETWORK), allowing proceed:',
            integrityResult.error?.message,
          );
        }
        console.log('[App] Integrity verified or dev bypass');

        // T251: Signal that phase 2 can start once the user is authenticated
        // TEMP TEST: force FREE tier — remove after testing
        usePurchaseStore.getState().reset();

        // T251: Signal that phase 2 can start once the user is authenticated
        setIntegrityPassed(true);
      } catch (e) {
        console.error('[App] Phase 1 initialization failed:', e);
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    };

    phase1();

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
      stopPersistence();
    };
  }, [retryCount]);

  // ─── T251: Handle Google auth response ───────────────────────────────────

  useEffect(() => {
    if (!googleAuthResponse) return;

    if (googleAuthResponse.type === 'success' && googleAuthResponse.authentication) {
      setIsAuthLoading(true);
      setAuthError(null);
      handleGoogleAuthSuccess(
        googleAuthResponse.authentication.accessToken,
        googleAuthResponse.authentication.idToken ?? '',
      )
        .then(() => console.log('[App] Google auth success, phase 2 will start'))
        .catch((err) => {
          console.error('[App] Google auth failed:', err);
          setAuthError('Sign in failed. Please try again.');
        })
        .finally(() => setIsAuthLoading(false));
    } else if (googleAuthResponse.type === 'error') {
      setAuthError('Sign in failed. Please try again.');
    }
  }, [googleAuthResponse]);

  // ─── Phase 2: DB switch + sync (runs once when integrity passed + signed in) ─

  useEffect(() => {
    if (!integrityPassed || !isSignedIn || phase2Started.current) return;
    phase2Started.current = true;

    const phase2 = async () => {
      try {
        const authState = useAuthStore.getState();

        // Switch to user-specific database
        if (authState.user?.email) {
          console.log(`[App] Switching to user database for ${authState.user.email}`);
          setSyncStatus('Setting up your account...');
          await switchUserDatabase(authState.user.email);

          if (authState.accessToken) {
            setSyncStatus('Syncing your history...');
            await pullAndMergeAllStats(authState.accessToken).catch((err) =>
              console.warn('[App] Stats pull on resume failed (non-fatal):', err),
            );
          }
        }

        // Check existing cached questions
        const existingCount = await getTotalQuestionCount();
        console.log(`[App] Existing questions in DB: ${existingCount}`);

        // Sync questions from API
        setSyncStatus('Syncing questions from server...');
        const result = await performFullSync();

        if (!result.success) {
          console.warn('[App] Sync failed:', result.error);
          if (existingCount === 0) {
            Alert.alert(
              'Sync Failed',
              `Could not download questions: ${result.error}\n\nMake sure the API server is running and accessible.`,
              [{ text: 'OK' }],
            );
          }
        } else {
          console.log(
            `[App] Sync complete: ${result.questionsAdded} added, ${result.questionsUpdated} updated`,
          );
        }

        // Initialize persistence service (exam attempt sync + stats push)
        setSyncStatus('Setting up sync service...');
        await initPersistence(
          { autoSyncEnabled: true, autoSyncInterval: 300000 },
          authState.user?.id,
          () => useAuthStore.getState().accessToken,
        );

        setIsReady(true);
      } catch (e) {
        console.error('[App] Phase 2 initialization failed:', e);
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    };

    phase2();
  }, [integrityPassed, isSignedIn]);

  // ─── Render ───────────────────────────────────────────────────────────────

  if (integrityBlockedMessage) {
    return (
      <IntegrityBlockedScreen
        message={integrityBlockedMessage}
        showRetry={integrityShowRetry}
        onRetry={() => {
          setIntegrityBlockedMessage(null);
          setIntegrityShowRetry(false);
          setIntegrityPassed(false);
          setSyncStatus('Retrying verification...');
          setRetryCount((c) => c + 1);
        }}
      />
    );
  }

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          padding: 24,
          backgroundColor: '#0f172a',
        }}
      >
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <Text style={{ fontSize: 32 }}>⚠️</Text>
        </View>
        <Text style={{ color: '#f87171', fontSize: 16, textAlign: 'center', fontWeight: '500' }}>
          {error}
        </Text>
      </View>
    );
  }

  // T251: Auth gate — shown when integrity passed but user is not signed in
  if (integrityPassed && !isSignedIn && !isReady) {
    return (
      <SafeAreaProvider>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#0f172a',
            padding: 32,
          }}
        >
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 24,
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: 24,
            }}
          >
            <Text style={{ fontSize: 40 }}>☁️</Text>
          </View>

          <Text
            style={{
              fontSize: 26,
              fontWeight: 'bold',
              color: '#fff',
              marginBottom: 8,
              textAlign: 'center',
            }}
          >
            {appName}
          </Text>
          <Text style={{ color: '#94a3b8', fontSize: 15, marginBottom: 48, textAlign: 'center' }}>
            Sign in to access your exam prep
          </Text>

          {authError ? (
            <Text
              style={{
                color: '#f87171',
                fontSize: 14,
                textAlign: 'center',
                marginBottom: 16,
              }}
            >
              {authError}
            </Text>
          ) : null}

          <TouchableOpacity
            onPress={() => {
              setAuthError(null);
              promptGoogleAuth();
            }}
            disabled={isAuthLoading}
            style={{
              backgroundColor: primaryColor,
              paddingHorizontal: 36,
              paddingVertical: 16,
              borderRadius: 12,
              alignItems: 'center',
              minWidth: 220,
              opacity: isAuthLoading ? 0.7 : 1,
            }}
          >
            {isAuthLoading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ color: '#000', fontWeight: '700', fontSize: 16 }}>
                Sign in with Google
              </Text>
            )}
          </TouchableOpacity>

          <Text style={{ color: '#475569', fontSize: 12, marginTop: 32, textAlign: 'center' }}>
            Your progress syncs securely to the cloud
          </Text>
        </View>
      </SafeAreaProvider>
    );
  }

  // Phase 1 running or phase 2 syncing
  if (!isReady) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#0f172a',
        }}
      >
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 24,
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            justifyContent: 'center',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <Text style={{ fontSize: 40 }}>☁️</Text>
        </View>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 8 }}>
          {appName}
        </Text>
        <ActivityIndicator size="large" color={primaryColor} style={{ marginTop: 16 }} />
        <Text style={{ marginTop: 16, color: '#94a3b8', fontWeight: '500' }}>{syncStatus}</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <RootNavigator />
        <StatusBar style="light" />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
