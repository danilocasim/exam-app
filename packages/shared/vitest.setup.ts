// Vitest setup file for mobile tests
// This file runs before all tests to set up the test environment
import { vi } from 'vitest';

// Mock react-native (native modules cannot be loaded in Node)
vi.mock('react-native', () => ({
  Platform: { OS: 'android', select: (obj: any) => obj.android },
  NativeModules: {},
  StyleSheet: { create: (s: any) => s },
  Dimensions: { get: () => ({ width: 375, height: 812 }) },
  Alert: { alert: vi.fn() },
  Linking: { openURL: vi.fn() },
  AppState: { currentState: 'active', addEventListener: vi.fn(() => ({ remove: vi.fn() })) },
}));

// Mock react-native-google-play-integrity
vi.mock('react-native-google-play-integrity', () => ({
  default: {
    requestIntegrityToken: vi.fn(),
    isPlayIntegrityAvailable: vi.fn(() => Promise.resolve(true)),
  },
  requestIntegrityToken: vi.fn(),
  isPlayIntegrityAvailable: vi.fn(() => Promise.resolve(true)),
}));

// Mock axios (used via require('axios').default ?? require('axios') in production)
vi.mock('axios', () => {
  const mockAxios: Record<string, any> = {
    __esModule: true,
    post: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
    create: vi.fn(),
    isAxiosError: vi.fn(() => false),
    defaults: { headers: { common: {} } },
    interceptors: {
      request: { use: vi.fn(), eject: vi.fn() },
      response: { use: vi.fn(), eject: vi.fn() },
    },
  };
  mockAxios.default = mockAxios;
  return mockAxios;
});

// Mock expo-crypto
vi.mock('expo-crypto', () => ({
  randomUUID: vi.fn(() => 'mock-uuid-123'),
  digestStringAsync: vi.fn(async () => 'mock-hash'),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
}));

// Mock expo-sqlite
vi.mock('expo-sqlite', () => ({
  openDatabase: vi.fn(() => ({
    transaction: vi.fn(),
    readTransaction: vi.fn(),
    executeSql: vi.fn(),
    closeAsync: vi.fn(),
  })),
  openDatabaseSync: vi.fn(() => ({
    execSync: vi.fn(),
    getAllSync: vi.fn(() => []),
    getFirstSync: vi.fn(() => null),
    runSync: vi.fn(() => ({ changes: 0, lastInsertRowId: 0 })),
    closeSync: vi.fn(),
    withTransactionSync: vi.fn((fn: Function) => fn()),
    withExclusiveTransactionSync: vi.fn((fn: Function) => fn()),
  })),
  openDatabaseAsync: vi.fn(async () => ({
    execAsync: vi.fn(async () => {}),
    getAllAsync: vi.fn(async () => []),
    getFirstAsync: vi.fn(async () => null),
    runAsync: vi.fn(async () => ({ changes: 0, lastInsertRowId: 0 })),
    closeAsync: vi.fn(async () => {}),
    withTransactionAsync: vi.fn(async (fn: Function) => fn()),
    withExclusiveTransactionAsync: vi.fn(async (fn: Function) => fn()),
  })),
  SQLTransaction: {},
}));

// Mock expo-auth-session
vi.mock('expo-auth-session', () => ({
  makeRedirectUri: vi.fn(() => 'http://localhost'),
  useAuthRequest: vi.fn(),
  useAutoDiscovery: vi.fn(),
}));

// Mock expo-web-browser
vi.mock('expo-web-browser', () => ({
  openAuthSessionAsync: vi.fn(),
}));

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  setItem: vi.fn(async () => null),
  getItem: vi.fn(async () => null),
  removeItem: vi.fn(async () => null),
  clear: vi.fn(async () => null),
}));

// Mock NetInfo
vi.mock('@react-native-community/netinfo', () => ({
  fetch: vi.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
  addEventListener: vi.fn(() => vi.fn()),
}));

// Suppress console warnings/errors during tests
global.console = {
  ...console,
  warn: vi.fn(),
  error: vi.fn(),
};
