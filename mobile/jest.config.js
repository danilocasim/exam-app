module.exports = {
  preset: 'react-native',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/build/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-native',
      },
    }],
  },
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/__tests__/**/*.spec.ts',
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    'src/**/*.tsx',
    '!src/index.ts',
    '!src/main.tsx',
    '!src/**/*.d.ts',
  ],
  coverageThresholds: {
    global: {
      branches: 60,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    './src/services/**': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
