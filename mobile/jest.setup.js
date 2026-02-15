// Jest setup file for mobile tests
// This file runs before all tests to set up the test environment

// Mock expo-crypto
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid-123'),
  digestStringAsync: jest.fn(async () => 'mock-hash'),
  CryptoDigestAlgorithm: {
    SHA256: 'SHA256',
  },
}));

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabase: jest.fn(() => ({
    transaction: jest.fn(),
    readTransaction: jest.fn(),
    executeSql: jest.fn(),
    closeAsync: jest.fn(),
  })),
  SQLTransaction: {},
}));

// Mock expo-auth-session
jest.mock('expo-auth-session', () => ({
  makeRedirectUri: jest.fn(() => 'http://localhost'),
  useAuthRequest: jest.fn(),
  useAutoDiscovery: jest.fn(),
}));

// Mock expo-web-browser
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => null),
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => null),
  clear: jest.fn(async () => null),
}));

// Mock NetInfo
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
  addEventListener: jest.fn(() => jest.fn()),
}));

// Suppress console warnings/errors during tests
global.console = {
  ...console,
  warn: jest.fn(),
  error: jest.fn(),
};
