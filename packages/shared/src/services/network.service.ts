// Network connectivity detection service (T106)
// Lightweight approach using fetch-based ping — no extra dependency required
import { API_CONFIG } from '../config';

export type NetworkStatus = 'online' | 'offline' | 'unknown';

type NetworkListener = (status: NetworkStatus) => void;

let currentStatus: NetworkStatus = 'unknown';
let pollingInterval: ReturnType<typeof setInterval> | null = null;
const listeners: Set<NetworkListener> = new Set();

/** Check interval in ms (30 seconds) */
const POLL_INTERVAL_MS = 30_000;

/** Timeout for connectivity check in ms */
const CHECK_TIMEOUT_MS = 5_000;

/**
 * Check if the device can reach the API server
 */
export const checkConnectivity = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    const baseUrl = API_CONFIG.BASE_URL.replace(/\/+$/, '');
    const response = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Get current network status
 */
export const getNetworkStatus = (): NetworkStatus => currentStatus;

/**
 * Check connectivity and update status
 */
export const refreshNetworkStatus = async (): Promise<NetworkStatus> => {
  const isOnline = await checkConnectivity();
  const newStatus: NetworkStatus = isOnline ? 'online' : 'offline';

  if (newStatus !== currentStatus) {
    currentStatus = newStatus;
    listeners.forEach((listener) => {
      try {
        listener(newStatus);
      } catch (e) {
        console.error('[NetworkService] Listener error:', e);
      }
    });
  }

  return newStatus;
};

/**
 * Subscribe to network status changes
 * Returns an unsubscribe function
 */
export const onNetworkStatusChange = (listener: NetworkListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Start periodic connectivity polling
 */
export const startNetworkMonitoring = (): void => {
  if (pollingInterval) return;

  // Initial check
  refreshNetworkStatus();

  pollingInterval = setInterval(() => {
    refreshNetworkStatus();
  }, POLL_INTERVAL_MS);
};

/**
 * Stop periodic connectivity polling
 */
export const stopNetworkMonitoring = (): void => {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
};

/**
 * Check if the device is currently online
 */
export const isOnline = (): boolean => currentStatus === 'online';
