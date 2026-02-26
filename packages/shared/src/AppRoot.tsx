import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert, AppState, AppStateStatus } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RootNavigator } from './navigation/RootNavigator';
import { initializeDatabase, switchUserDatabase } from './storage/database';
import { performFullSync } from './services/sync.service';
import { initPersistence, stopPersistence } from './services/persistence.service';
import { getTotalQuestionCount } from './storage/repositories/question.repository';
import { initializeGoogleSignIn } from './services/auth-service';
import { TokenRefreshService } from './services/token-refresh-service';
import { ErrorBoundary } from './components/ErrorBoundary';
import { IntegrityBlockedScreen } from './components/IntegrityBlockedScreen';
import { useAuthStore } from './stores/auth-store';
import { checkIntegrity } from './services/play-integrity.service';

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

  const handleAppStateChange = (state: AppStateStatus) => {
    if (state === 'active') {
      // App came to foreground - trigger sync and token refresh
      console.log('[App] App came to foreground, triggering sync and token refresh');
      TokenRefreshService.refreshIfNeeded().catch((err) => {
        console.error('[App] Token refresh failed:', err);
      });
    } else if (state === 'background') {
      // App went to background
      console.log('[App] App went to background');
    }
  };

  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize Google Sign-In
        setSyncStatus('Initializing authentication...');
        try {
          await initializeGoogleSignIn();
          console.log('[App] Google Sign-In initialized');
        } catch (err) {
          console.warn('[App] Google Sign-In initialization failed (continuing):', err);
        }

        // Setup periodic token refresh (every minute)
        const stopTokenRefresh = TokenRefreshService.setupPeriodicRefresh(60000);
        console.log('[App] Token refresh service started');

        // Initialize SQLite database FIRST (integrity check needs IntegrityStatus table)
        setSyncStatus('Setting up database...');
        await initializeDatabase();
        console.log('[App] Database initialized');

        // Then run integrity check (needs database to be ready)
        setSyncStatus('Verifying integrity...');
        const integrityResult = await checkIntegrity();

        // T177: Dev bypass or cache hit should not block initialization
        // Only block DEFINITIVE failures (sideloaded APKs), not TRANSIENT errors
        if (!integrityResult.verified && integrityResult.error?.type === 'DEFINITIVE') {
          // Permanent block — sideloaded/re-signed APK detected
          console.error('[App] DEFINITIVE integrity failure - blocking app');
          setIntegrityBlockedMessage(
            integrityResult.error.message ||
              'For security reasons, this app must be downloaded from Google Play.',
          );
          setIntegrityShowRetry(false);
          setIsReady(true);
          return;
        }

        // TRANSIENT/NETWORK errors: log warning but allow app to proceed
        if (!integrityResult.verified && !integrityResult.cachedResult) {
          console.warn(
            '[App] Integrity check failed (TRANSIENT/NETWORK), but allowing app to proceed:',
            integrityResult.error?.message,
          );
        }
        console.warn('[App] Integrity verified or dev bypass, proceeding with app initialization');

        // If user was signed in (persisted in AsyncStorage), switch to their database
        const authState = useAuthStore.getState();
        if (authState.isSignedIn && authState.user?.email) {
          console.warn(`[App] Restoring user database for ${authState.user.email}`);
          await switchUserDatabase(authState.user.email);
        }

        // Check if we already have cached questions
        const existingCount = await getTotalQuestionCount();
        console.warn(`[App] Existing questions in DB: ${existingCount}`);

        // Sync questions from API
        setSyncStatus('Syncing questions from server...');
        const result = await performFullSync();

        if (!result.success) {
          console.warn('[App] Sync failed:', result.error);
          if (existingCount === 0) {
            // No cached questions and sync failed - show warning
            Alert.alert(
              'Sync Failed',
              `Could not download questions: ${result.error}\n\nMake sure the API server is running and accessible.`,
              [{ text: 'OK' }],
            );
          }
        } else {
          console.warn(
            `[App] Sync complete: ${result.questionsAdded} added, ${result.questionsUpdated} updated`,
          );
        }

        // Get final question count
        const finalCount = await getTotalQuestionCount();
        console.warn(`[App] Total questions after sync: ${finalCount}`);

        // Initialize persistence service for exam attempt sync + stats push
        setSyncStatus('Setting up sync service...');
        await initPersistence(
          { autoSyncEnabled: true, autoSyncInterval: 300000 },
          authState.isSignedIn ? authState.user?.id : undefined,
          // Token getter: always reads the freshest token from the auth store
          () => useAuthStore.getState().accessToken,
        );

        setIsReady(true);
      } catch (e) {
        console.error('[App] Initialization failed:', e);
        setError(e instanceof Error ? e.message : 'Unknown error');
      }
    };

    initialize();

    // Handle app state changes
    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
      stopPersistence();
    };
  }, [retryCount]);

  if (integrityBlockedMessage) {
    return (
      <IntegrityBlockedScreen
        message={integrityBlockedMessage}
        showRetry={integrityShowRetry}
        onRetry={() => {
          setIntegrityBlockedMessage(null);
          setIntegrityShowRetry(false);
          setIsReady(false);
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
        <ActivityIndicator
          size="large"
          color={branding?.primaryColor ?? '#f59e0b'}
          style={{ marginTop: 16 }}
        />
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
