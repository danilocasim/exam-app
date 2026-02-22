/**
 * T130: Token Storage Service
 *
 * Persists JWT access and refresh tokens in AsyncStorage
 * Provides secure token retrieval and management
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage keys
const ACCESS_TOKEN_KEY = '@exam_app:access_token';
const REFRESH_TOKEN_KEY = '@exam_app:refresh_token';
const TOKEN_EXPIRY_KEY = '@exam_app:token_expiry';

/**
 * Manage JWT token persistence in AsyncStorage
 */
export const TokenStorage = {
  /**
   * Save tokens to AsyncStorage
   * @param accessToken JWT access token
   * @param refreshToken JWT refresh token
   * @param expiresIn Access token expiry in seconds (default: 3600 = 1 hour)
   */
  async saveTokens(
    accessToken: string,
    refreshToken: string,
    expiresIn: number = 3600,
  ): Promise<void> {
    try {
      const now = Date.now();
      const expiryTime = now + expiresIn * 1000;

      await AsyncStorage.multiSet([
        [ACCESS_TOKEN_KEY, accessToken],
        [REFRESH_TOKEN_KEY, refreshToken],
        [TOKEN_EXPIRY_KEY, expiryTime.toString()],
      ]);
    } catch (error) {
      console.error('[TokenStorage] Failed to save tokens:', error);
      throw error;
    }
  },

  /**
   * Get stored access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
      return token;
    } catch (error) {
      console.error('[TokenStorage] Failed to get access token:', error);
      return null;
    }
  },

  /**
   * Get stored refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      const token = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
      return token;
    } catch (error) {
      console.error('[TokenStorage] Failed to get refresh token:', error);
      return null;
    }
  },

  /**
   * Get cached token expiry time
   */
  async getTokenExpiry(): Promise<number | null> {
    try {
      const expiry = await AsyncStorage.getItem(TOKEN_EXPIRY_KEY);
      return expiry ? parseInt(expiry, 10) : null;
    } catch (error) {
      console.error('[TokenStorage] Failed to get token expiry:', error);
      return null;
    }
  },

  /**
   * Check if access token is expired
   */
  async isAccessTokenExpired(): Promise<boolean> {
    try {
      const expiry = await this.getTokenExpiry();
      if (!expiry) {
        return true; // No expiry time = expired
      }
      return Date.now() > expiry;
    } catch (error) {
      console.error('[TokenStorage] Failed to check token expiry:', error);
      return true; // Assume expired on error
    }
  },

  /**
   * Clear all tokens from storage
   */
  async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, TOKEN_EXPIRY_KEY]);
    } catch (error) {
      console.error('[TokenStorage] Failed to clear tokens:', error);
      throw error;
    }
  },

  /**
   * Get both tokens as a pair
   */
  async getTokenPair(): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
  }> {
    try {
      const [accessToken, refreshToken] = await AsyncStorage.multiGet([
        ACCESS_TOKEN_KEY,
        REFRESH_TOKEN_KEY,
      ]);
      return {
        accessToken: accessToken[1],
        refreshToken: refreshToken[1],
      };
    } catch (error) {
      console.error('[TokenStorage] Failed to get token pair:', error);
      return {
        accessToken: null,
        refreshToken: null,
      };
    }
  },
};
