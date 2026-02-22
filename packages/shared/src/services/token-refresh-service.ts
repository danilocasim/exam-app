/**
 * T133: Token Refresh Service
 *
 * Handles automatic token refresh on 401 responses
 * Manages refresh token lifecycle and retry logic
 */
import { api } from './api';
import { TokenStorage } from '../storage/token-storage';
import { useAuthStore } from '../stores/auth-store';

interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Maximum retry attempts for token refresh */
const MAX_REFRESH_RETRIES = 3;

/** Delay between refresh attempts (milliseconds) */
const REFRESH_RETRY_DELAY = 1000;

/**
 * Manages token refresh with retry logic
 */
export const TokenRefreshService = {
  /**
   * Refresh access token using refresh token
   * Includes retry logic for transient failures
   */
  async refreshAccessToken(retryCount = 0): Promise<boolean> {
    try {
      // Skip if user is not signed in
      const { isSignedIn } = useAuthStore.getState();
      if (!isSignedIn) {
        return false;
      }

      const refreshToken = await TokenStorage.getRefreshToken();

      if (!refreshToken) {
        // Not an error if user signed in via offline fallback (no backend tokens)
        console.log('[TokenRefresh] No refresh token available, skipping');
        return false;
      }

      try {
        const response = await api.post<RefreshTokenResponse>('/auth/refresh', { refreshToken });

        const { accessToken, refreshToken: newRefreshToken, expiresIn } = response.data;

        // Save new tokens
        await TokenStorage.saveTokens(accessToken, newRefreshToken, expiresIn);

        // Update auth store
        useAuthStore.setState({ accessToken });

        return true;
      } catch (error) {
        // Handle 401 Unauthorized - refresh token is invalid
        if (error instanceof Error && 'response' in error) {
          const axiosError = error as any;
          if (axiosError.response?.status === 401) {
            console.error('[TokenRefresh] Refresh token expired or invalid');
            await this.handleRefreshFailure();
            return false;
          }
        }

        // Retry on other errors (network, 5xx, etc.)
        if (retryCount < MAX_REFRESH_RETRIES) {
          await new Promise((resolve) =>
            setTimeout(resolve, REFRESH_RETRY_DELAY * (retryCount + 1)),
          );
          return this.refreshAccessToken(retryCount + 1);
        }

        throw error;
      }
    } catch (error) {
      console.error('[TokenRefresh] Failed to refresh token:', error);
      await this.handleRefreshFailure();
      return false;
    }
  },

  /**
   * Check if token needs refresh (expiring within 5 minutes)
   */
  async shouldRefreshToken(): Promise<boolean> {
    try {
      const expiry = await TokenStorage.getTokenExpiry();

      if (!expiry) {
        return true; // No expiry = needs refresh
      }

      const expiresIn = expiry - Date.now();
      const refreshThreshold = 5 * 60 * 1000; // 5 minutes

      return expiresIn < refreshThreshold;
    } catch (error) {
      console.error('[TokenRefresh] Failed to check if refresh needed:', error);
      return true; // Assume needs refresh on error
    }
  },

  /**
   * Proactive token refresh
   * Refreshes token if it's expiring soon
   */
  async refreshIfNeeded(): Promise<boolean> {
    try {
      const shouldRefresh = await this.shouldRefreshToken();

      if (shouldRefresh) {
        return await this.refreshAccessToken();
      }

      return true;
    } catch (error) {
      console.error('[TokenRefresh] Proactive refresh failed:', error);
      return false;
    }
  },

  /**
   * Handle refresh failure - clear auth state
   */
  async handleRefreshFailure(): Promise<void> {
    try {
      await TokenStorage.clearTokens();
      useAuthStore.setState({
        isSignedIn: false,
        user: null,
        accessToken: null,
        error: 'Session expired. Please sign in again.',
      });
    } catch (error) {
      console.error('[TokenRefresh] Failed to handle refresh failure:', error);
    }
  },

  /**
   * Setup periodic token refresh
   * Call this once on app startup
   */
  setupPeriodicRefresh(intervalMs = 60000): () => void {
    // Refresh every minute
    const interval = setInterval(() => {
      this.refreshIfNeeded().catch((error) => {
        console.error('[TokenRefresh] Periodic refresh failed:', error);
      });
    }, intervalMs);

    // Return cleanup function
    return () => clearInterval(interval);
  },
};
