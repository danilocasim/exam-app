/**
 * T131: API Interceptor
 *
 * Injects JWT access token in Authorization header for all API requests
 * Handles token refresh on 401 responses
 */
import type { AxiosInstance, AxiosError } from 'axios';
import { TokenStorage } from '../storage/token-storage';
import { useAuthStore } from '../stores/auth-store';

/**
 * Setup API interceptors for token injection and refresh
 * Should be called once during app initialization
 */
export function setupApiInterceptors(api: AxiosInstance): void {
  // Request interceptor: inject access token
  api.interceptors.request.use(
    async (config) => {
      try {
        const accessToken = await TokenStorage.getAccessToken();

        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }

        return config;
      } catch (error) {
        console.error('[ApiInterceptor] Failed to inject token:', error);
        return config;
      }
    },
    (error) => {
      return Promise.reject(error);
    },
  );

  // Response interceptor: handle 401 and refresh token
  api.interceptors.response.use(
    (response) => {
      return response;
    },
    async (error: AxiosError) => {
      const originalRequest = error.config;

      // Skip refresh logic for certain endpoints
      if (
        error.response?.status === 401 &&
        originalRequest &&
        !originalRequest.url?.includes('/auth/refresh') &&
        !originalRequest.url?.includes('/auth/logout')
      ) {
        try {
          // Try to refresh access token
          const refreshToken = await TokenStorage.getRefreshToken();

          if (!refreshToken) {
            // No refresh token available, sign out
            useAuthStore.setState({
              isSignedIn: false,
              user: null,
              accessToken: null,
            });
            return Promise.reject(error);
          }

          // Call refresh endpoint
          const response = await api.post('/auth/refresh', { refreshToken });
          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data;

          // Save new tokens
          await TokenStorage.saveTokens(newAccessToken, newRefreshToken);

          // Update auth store
          useAuthStore.setState({ accessToken: newAccessToken });

          // Retry original request with new token
          if (originalRequest.headers) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }

          return api(originalRequest);
        } catch (refreshError) {
          console.error('[ApiInterceptor] Token refresh failed:', refreshError);

          // Clear tokens and sign out on refresh failure
          await TokenStorage.clearTokens();
          useAuthStore.setState({
            isSignedIn: false,
            user: null,
            accessToken: null,
          });

          return Promise.reject(refreshError);
        }
      }

      return Promise.reject(error);
    },
  );
}
