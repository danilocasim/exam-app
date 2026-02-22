/**
 * T153: Play Integrity Store (Zustand)
 *
 * Global state management for Play Integrity verification status.
 * Tracks verification state, errors, and loading status.
 * Used by App.tsx to determine whether to show blocking screen.
 */
import { create } from 'zustand';

// ─── Type Definitions ────────────────────────────────────────────────────────

export type IntegrityStatus = 'unknown' | 'checking' | 'verified' | 'blocked' | 'error';

export type IntegrityErrorType = 'TRANSIENT' | 'DEFINITIVE' | 'NETWORK';

export interface IntegrityError {
  type: IntegrityErrorType;
  message: string;
  code?: string;
}

// ─── Store State Interface ───────────────────────────────────────────────────

interface PlayIntegrityStoreState {
  // Verification state
  status: IntegrityStatus;
  verified: boolean;
  verifiedAt: string | null; // ISO 8601 timestamp of last verification
  cachedResult: boolean; // true if using cached verification

  // Error state
  error: IntegrityError | null;

  // UI state
  isLoading: boolean;
  showBlockingScreen: boolean;

  // Actions
  setStatus: (status: IntegrityStatus) => void;
  setVerified: (verified: boolean, verifiedAt?: string) => void;
  setCachedResult: (cached: boolean) => void;
  setError: (error: IntegrityError | null) => void;
  setLoading: (isLoading: boolean) => void;
  setShowBlockingScreen: (show: boolean) => void;
  reset: () => void;
}

// ─── Store Implementation ────────────────────────────────────────────────────

/**
 * Zustand store for Play Integrity verification state
 *
 * State flow:
 * 1. unknown → checking (on app init)
 * 2. checking → verified (cache hit or successful verification)
 * 3. checking → blocked (definitive failure)
 * 4. checking → error (transient failure)
 */
export const usePlayIntegrityStore = create<PlayIntegrityStoreState>((set) => ({
  // Initial state
  status: 'unknown',
  verified: false,
  verifiedAt: null,
  cachedResult: false,
  error: null,
  isLoading: false,
  showBlockingScreen: false,

  // Actions
  setStatus: (status) => {
    set({ status });
  },

  setVerified: (verified, verifiedAt) => {
    set({
      verified,
      verifiedAt: verifiedAt || null,
      status: verified ? 'verified' : 'unknown',
      error: null,
    });
  },

  setCachedResult: (cached) => {
    set({ cachedResult: cached });
  },

  setError: (error) => {
    set({
      error,
      status: error ? 'error' : 'unknown',
      verified: false,
    });
  },

  setLoading: (isLoading) => {
    set({
      isLoading,
      status: isLoading ? 'checking' : 'unknown',
    });
  },

  setShowBlockingScreen: (show) => {
    set({
      showBlockingScreen: show,
      status: show ? 'blocked' : 'unknown',
    });
  },

  reset: () => {
    set({
      status: 'unknown',
      verified: false,
      verifiedAt: null,
      cachedResult: false,
      error: null,
      isLoading: false,
      showBlockingScreen: false,
    });
  },
}));

// ─── Selectors (Convenience Exports) ─────────────────────────────────────────

/**
 * Check if integrity verification passed (cached or fresh)
 */
export const useIsVerified = () => usePlayIntegrityStore((state) => state.verified);

/**
 * Check if blocking screen should be shown
 */
export const useShowBlockingScreen = () =>
  usePlayIntegrityStore((state) => state.showBlockingScreen);

/**
 * Get current verification status
 */
export const useIntegrityStatus = () => usePlayIntegrityStore((state) => state.status);

/**
 * Get current error (if any)
 */
export const useIntegrityError = () => usePlayIntegrityStore((state) => state.error);

/**
 * Check if currently checking integrity
 */
export const useIsCheckingIntegrity = () => usePlayIntegrityStore((state) => state.isLoading);
