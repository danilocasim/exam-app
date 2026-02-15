/**
 * T132: Authentication Store (Zustand)
 *
 * Global state management for authentication
 * Tracks signed-in status, user info, and access tokens
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface User {
  id: string;
  email: string;
  name?: string;
  googleId?: string;
  picture?: string;
}

interface AuthStoreState {
  // Authentication state
  isSignedIn: boolean;
  user: User | null;
  accessToken: string | null;

  // UI state
  isLoading: boolean;
  error: string | null;

  // Actions
  setSignedIn: (isSignedIn: boolean) => void;
  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  clearAuth: () => void;
}

/**
 * Zustand store for authentication state
 * Persists auth state to AsyncStorage (via middleware)
 */
export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      // Initial state
      isSignedIn: false,
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,

      // Actions
      setSignedIn: (isSignedIn) => {
        set({ isSignedIn });
      },

      setUser: (user) => {
        set({ user });
      },

      setAccessToken: (accessToken) => {
        set({ accessToken });
      },

      setLoading: (isLoading) => {
        set({ isLoading });
      },

      setError: (error) => {
        set({ error });
      },

      clearAuth: () => {
        set({
          isSignedIn: false,
          user: null,
          accessToken: null,
          error: null,
        });
      },
    }),
    {
      name: '@exam_app:auth_store', // Storage key
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        isSignedIn: state.isSignedIn,
        user: state.user,
        accessToken: state.accessToken,
      }),
    },
  ),
);
