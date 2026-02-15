/**
 * T129: Google Sign-In Authentication Service
 *
 * Handles Google OAuth login/logout flow using WebBrowser + manual OAuth URL.
 * Bypasses expo-auth-session's Google provider which has proxy issues in Expo Go.
 *
 * Flow: WebBrowser → Google OAuth consent → auth.expo.io proxy → back to app
 *       → parse access_token from URL fragment → fetch userinfo
 *       → send accessToken to backend POST /auth/google/callback → receive JWT
 */
import { useState, useCallback } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { API_CONFIG } from '../config';
import { api } from './api';
import { TokenStorage } from '../storage/token-storage';
import { useAuthStore } from '../stores/auth-store';
import { useExamAttemptStore } from '../stores/exam-attempt.store';
import { useExamStore } from '../stores/exam.store';
import { deleteAllExamSubmissions } from '../storage/repositories/exam-submission.repository';
import { deleteAllPracticeSessions } from '../storage/repositories/practice-session.repository';
import { deleteAllPracticeAnswers } from '../storage/repositories/practice-answer.repository';
import { resetUserStats } from '../storage/repositories/user-stats.repository';
import { getDatabase } from '../storage/database';

// Complete any pending auth sessions (required for web-based OAuth)
WebBrowser.maybeCompleteAuthSession();

// Expo auth proxy config
const EXPO_PROXY_REDIRECT = 'https://auth.expo.io/@danilocasim/mobile';

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

/**
 * Initialize Google Sign-In configuration (no-op).
 * Kept for API compatibility with App.tsx startup flow.
 */
export async function initializeGoogleSignIn(): Promise<void> {
  console.log('[Auth] Using manual OAuth + WebBrowser (Expo Go compatible)');
}

/**
 * Build the Google OAuth authorization URL.
 * Uses implicit grant (response_type=token) to get an access token directly.
 */
function buildGoogleAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: API_CONFIG.GOOGLE_WEB_CLIENT_ID,
    redirect_uri: EXPO_PROXY_REDIRECT,
    response_type: 'token',
    scope: 'openid profile email',
    include_granted_scopes: 'true',
    prompt: 'select_account',
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Parse the access_token from a URL hash fragment.
 * Google returns: redirect_uri#access_token=xxx&token_type=Bearer&expires_in=3600&scope=...
 */
function parseTokenFromUrl(url: string): string | null {
  try {
    // The token can be in a hash fragment or query param depending on proxy behavior
    const hashIndex = url.indexOf('#');
    if (hashIndex !== -1) {
      const fragment = url.substring(hashIndex + 1);
      const params = new URLSearchParams(fragment);
      const token = params.get('access_token');
      if (token) return token;
    }
    // Also check query params (proxy may convert fragment to query)
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get('access_token');
    if (token) return token;
    return null;
  } catch {
    return null;
  }
}

/**
 * React hook that provides Google sign-in functionality for Expo Go.
 *
 * Usage:
 *   const { request, response, promptAsync } = useGoogleAuthRequest();
 */
export function useGoogleAuthRequest() {
  const [response, setResponse] = useState<{
    type: 'success' | 'error' | 'cancel';
    authentication?: { accessToken: string; idToken: string };
  } | null>(null);

  const promptAsync = useCallback(async () => {
    try {
      const authUrl = buildGoogleAuthUrl();
      // returnUrl tells the browser when to close — this is our app's deep link
      const returnUrl = Linking.createURL('/');

      console.log('[Auth] Opening Google OAuth...');
      console.log('[Auth] Redirect URI (for Google):', EXPO_PROXY_REDIRECT);
      console.log('[Auth] Return URL (for browser):', returnUrl);

      // The Expo auth proxy flow:
      // 1. Browser opens: auth.expo.io/.../start?authUrl=<google>&returnUrl=exp://...
      // 2. Google sees redirect_uri=https://auth.expo.io/@danilocasim/mobile
      // 3. After consent, Google redirects to auth.expo.io with token in fragment
      // 4. Proxy redirects to exp://... with token, browser closes
      const proxyStartUrl =
        `${EXPO_PROXY_REDIRECT}/start?` +
        `authUrl=${encodeURIComponent(authUrl)}&` +
        `returnUrl=${encodeURIComponent(returnUrl)}`;

      const result = await WebBrowser.openAuthSessionAsync(proxyStartUrl, returnUrl);

      if (result.type === 'success' && result.url) {
        console.log('[Auth] Auth session success, parsing token from URL...');
        const accessToken = parseTokenFromUrl(result.url);
        if (accessToken) {
          setResponse({
            type: 'success',
            authentication: { accessToken, idToken: '' },
          });
          return { type: 'success' as const };
        } else {
          console.error('[Auth] No access_token found in redirect URL:', result.url);
          setResponse({ type: 'error' });
          return { type: 'error' as const };
        }
      } else if (result.type === 'cancel' || result.type === 'dismiss') {
        setResponse({ type: 'cancel' });
        return { type: 'cancel' as const };
      } else {
        setResponse({ type: 'error' });
        return { type: 'error' as const };
      }
    } catch (err) {
      console.error('[Auth] OAuth flow error:', err);
      setResponse({ type: 'error' });
      return { type: 'error' as const };
    }
  }, []);

  // request is always "ready" since we don't need to pre-load anything
  return { request: true, response, promptAsync };
}

/**
 * Fetch user profile from Google using an access token.
 * Called after successful OAuth consent.
 */
export async function fetchGoogleUserInfo(
  accessToken: string,
): Promise<{ email: string; name: string; photo: string | null } | null> {
  try {
    const res = await fetch('https://www.googleapis.com/userinfo/v2/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
      console.error('[Auth] Failed to fetch Google user info:', res.status);
      return null;
    }
    const userInfo = await res.json();
    return {
      email: userInfo.email,
      name: userInfo.name,
      photo: userInfo.picture ?? null,
    };
  } catch (error) {
    console.error('[Auth] Error fetching Google user info:', error);
    return null;
  }
}

/**
 * Process a successful Google OAuth response.
 * Fetches user info, sends accessToken to backend, saves JWT tokens.
 *
 * @param googleAccessToken - OAuth access token from Google
 * @param googleIdToken - OAuth ID token from Google (may be empty)
 * @returns Backend JWT tokens and user info
 */
export async function handleGoogleAuthSuccess(
  googleAccessToken: string,
  googleIdToken: string = '',
): Promise<{
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; name?: string };
}> {
  try {
    useAuthStore.setState({ isLoading: true, error: null });

    // Fetch Google user info for display
    const googleUser = await fetchGoogleUserInfo(googleAccessToken);

    // Send tokens to backend for verification + JWT issuance
    const backendResponse = await api.post('/auth/google/callback', {
      accessToken: googleAccessToken,
      idToken: googleIdToken,
    });

    const { accessToken, refreshToken, user } = backendResponse.data;

    // Save JWT tokens locally
    await TokenStorage.saveTokens(accessToken, refreshToken);

    // Update auth store with user info
    useAuthStore.setState({
      isSignedIn: true,
      user: {
        ...user,
        name: user.name || googleUser?.name,
      },
      accessToken,
      isLoading: false,
    });

    return { accessToken, refreshToken, user };
  } catch (error) {
    console.error('[Auth] Sign-in backend verification failed:', error);

    // Offline fallback: store Google user info locally even if backend fails
    const googleUser = await fetchGoogleUserInfo(googleAccessToken);
    if (googleUser) {
      useAuthStore.setState({
        isSignedIn: true,
        user: {
          id: 'local',
          email: googleUser.email,
          name: googleUser.name,
        },
        accessToken: googleAccessToken,
        isLoading: false,
      });
      return {
        accessToken: googleAccessToken,
        refreshToken: '',
        user: { id: 'local', email: googleUser.email, name: googleUser.name },
      };
    }

    useAuthStore.setState({ isLoading: false, error: 'Sign-in failed' });
    throw error;
  }
}

/**
 * Sign out and clear all tokens, auth state, and user-specific local data.
 *
 * This is critical for multi-account isolation: when User A logs out and
 * User B logs in, User B must NOT see User A's exam history, stats, or
 * in-progress sessions. We clear all user-scoped data from SQLite and
 * reset in-memory Zustand stores.
 */
export async function signOut(): Promise<void> {
  try {
    console.log('[Auth] Signing out — clearing all user data...');

    // 1. Clear JWT tokens
    await TokenStorage.clearTokens();

    // 2. Clear all exam-related SQLite tables
    //    ExamAttempt + ExamAnswer (CASCADE) — in-progress and completed exams
    const db = await getDatabase();
    await db.runAsync('DELETE FROM ExamAnswer');
    await db.runAsync('DELETE FROM ExamAttempt');

    //    ExamSubmission — historical submissions with sync tracking
    await deleteAllExamSubmissions();

    //    PracticeSession + PracticeAnswer — practice mode history
    await deleteAllPracticeAnswers();
    await deleteAllPracticeSessions();

    //    UserStats — aggregate stats (exams taken, time spent, etc.)
    await resetUserStats();

    // 3. Reset in-memory Zustand stores
    useExamStore.getState().resetExamState();
    await useExamAttemptStore.getState().clearAll();

    // 4. Clear auth store (last, so UI reacts after data is gone)
    useAuthStore.setState({
      isSignedIn: false,
      user: null,
      accessToken: null,
      error: null,
    });

    console.log('[Auth] Sign-out complete — all user data cleared');
  } catch (error) {
    console.error('[Auth] Sign-out failed:', error);
    // Still clear auth state even if data cleanup partially fails
    useAuthStore.setState({
      isSignedIn: false,
      user: null,
      accessToken: null,
    });
    throw error;
  }
}

/**
 * Check if user is currently signed in (based on stored auth state).
 */
export async function isUserSignedIn(): Promise<boolean> {
  try {
    const { isSignedIn } = useAuthStore.getState();
    return isSignedIn;
  } catch (error) {
    console.error('[Auth] Failed to check sign-in status:', error);
    return false;
  }
}

/**
 * Get current user from auth store.
 */
export async function getCurrentUser() {
  try {
    const { user, isSignedIn } = useAuthStore.getState();
    return isSignedIn ? user : null;
  } catch (error) {
    console.error('[Auth] Failed to get current user:', error);
    return null;
  }
}
