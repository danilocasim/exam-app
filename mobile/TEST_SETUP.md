# Mobile Test Setup Guide

## Current Status

The mobile test suite has been configured with:
- ✅ **Test script**: `npm test` added to package.json
- ✅ **Jest configuration**: jest.config.js with React Native preset
- ✅ **Babel configuration**: babel.config.js for transpiling TypeScript
- ✅ **Mock setup**: jest.setup.js with Expo module mocks

## Test Files Created (T144-T148)

| Task | File | Description | Status |
|------|------|-------------|--------|
| T144 | `__tests__/offline-queue.integration.test.ts` | Queue persistence & sync flow | ⚠️ Requires setup |
| T147 | `__tests__/sync-processor.test.ts` | Exponential backoff & retry logic | ⚠️ Requires setup |
| T148 | `__tests__/performance.bench.ts` | Performance benchmarks | ⚠️ Requires setup |

## Known Issues

### Issue: Jest Cannot Run Integration Tests

**Problem**: Integration tests (T144, T147, T148) depend on:
- SQLite database (`expo-sqlite`)
- Cryptographic functions (`expo-crypto`)
- Native storage (`@react-native-async-storage`)

These modules require a React Native runtime environment and cannot run in Node.js Jest.

### Solutions

#### Option 1: Run Tests on Device/Emulator (Recommended)

Use **Detox** for E2E testing in actual React Native environment:

```bash
# Install Detox
npm install --save-dev detox detox-cli

# Configure Detox
npx detox init

# Run tests on Android emulator
npx detox test --configuration android.emu.debug

# Run tests on iOS simulator
npx detox test --configuration ios.sim.debug
```

#### Option 2: Mock All Dependencies

Convert integration tests to unit tests with full mocking:

**Example**: Mock `ExamSubmissionRepo` and `axios` completely

```typescript
// __tests__/offline-queue.unit.test.ts
jest.mock('../src/storage/repositories/exam-submission.repository');
jest.mock('axios');

// Then use jest.spyOn() for each function
```

#### Option 3: Use React Native Testing Library

For component-level tests:

```bash
# Already installed
npm install --save-dev @testing-library/react-native

# Run component tests (not integration)
npm test -- __tests__/services/*.test.ts
```

## Current Workaround

**Skip integration tests** and run only unit tests:

```bash
# Run unit tests only (existing tests in __tests__/services/)
npm test -- --testPathIgnorePatterns="integration|e2e|bench"
```

## Recommended Next Steps

1. **Short-term**: Document test expectations in phase2-testing-guide.md manual  testing scenarios
2. **Medium-term**: Set up Detox for true E2E testing on emulator/device
3. **Long-term**: Refactor services to be more testable with dependency injection

## Test Configuration Files

- **jest.config.js**: Jest configuration for React Native
- **jest.setup.js**: Global mocks for Expo modules
- **babel.config.js**: Babel preset for Expo/React Native
- **package.json**: Test scripts (test, test:watch, test:coverage)

## Alternative: Manual Testing

For Phase 2 validation, refer to:
- [specs/002-cloudprep-mobile/phase2-testing-guide.md](../specs/002-cloudprep-mobile/phase2-testing-guide.md)

This guide provides step-by-step manual testing scenarios for:
- Google Sign-In flow
- Offline exam submission
- Cloud sync on network restore
- Token expiration & refresh

## Running API Tests

API tests (T145, T146) work correctly:

```bash
cd ../api
npm run test:e2e --  exam-attempts.e2e-spec.ts
npm test -- analytics.service.spec.ts
```

---

**Status**: Test infrastructure configured ✅  
**Next action**: Choose Option 1 (Detox), Option 2 (Mocks), or use manual testing guide  
**Updated**: February 15, 2026
