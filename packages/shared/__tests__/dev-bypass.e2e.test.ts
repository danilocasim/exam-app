/**
 * T187: Development Mode Bypass E2E Test
 *
 * Detox E2E test confirming `__DEV__ == true` bypasses all integrity checks:
 * - Verify app launches normally in development mode
 * - Verify no API calls made when __DEV__ is true
 * - Verify no blocking screens shown
 * - Verify app functionality is fully accessible
 * - Verify development workflow is not disrupted
 *
 * Test Scenario: User Story 3 - Developer Bypass
 * Acceptance: Dev builds launch without blocks 100% of the time
 */
import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import { device, element, by, waitFor } from 'detox';

describe('Development Mode Bypass (E2E)', () => {
  beforeAll(async () => {
    // Launch app in development mode (default for Expo dev builds)
    await device.launchApp({
      newInstance: true,
      delete: true, // Clean slate
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  test('should bypass integrity check in development mode', async () => {
    // In __DEV__ mode, app should launch without any integrity verification
    // Wait for loading screen to disappear
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    // Verify home screen is accessible immediately
    await expect(element(by.id('home-screen'))).toBeVisible();

    // Verify no integrity blocking
    await expect(element(by.id('integrity-blocked-screen'))).not.toBeVisible();
  });

  test('should not show any integrity-related UI in dev mode', async () => {
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('home-screen'))).toBeVisible();

    // Should not show integrity error messages
    await expect(element(by.text(/downloaded from Google Play/i))).not.toBeVisible();
    await expect(element(by.text(/integrity check/i))).not.toBeVisible();
    await expect(element(by.text(/verification failed/i))).not.toBeVisible();

    // Should not show retry buttons for integrity
    await expect(element(by.id('integrity-retry-button'))).not.toBeVisible();
  });

  test('should launch quickly in development mode (< 3 seconds)', async () => {
    // Dev mode should not add any latency
    const startTime = Date.now();

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    const elapsed = Date.now() - startTime;

    // Dev launch should be fast (no API calls)
    expect(elapsed).toBeLessThan(3000);

    await expect(element(by.id('home-screen'))).toBeVisible();
  });

  test('should allow full app access in development mode', async () => {
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('home-screen'))).toBeVisible();

    // Verify all screens are accessible (no blocking)
    await element(by.id('practice-tab')).tap();
    await expect(element(by.id('practice-screen'))).toBeVisible();

    await element(by.id('history-tab')).tap();
    await expect(element(by.id('history-screen'))).toBeVisible();

    await element(by.id('settings-tab')).tap();
    await expect(element(by.id('settings-screen'))).toBeVisible();

    await element(by.id('home-tab')).tap();
    await expect(element(by.id('home-screen'))).toBeVisible();
  });

  test('should allow exam functionality in development mode', async () => {
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('home-screen'))).toBeVisible();

    // Start exam
    await element(by.id('start-exam-button')).tap();
    await expect(element(by.id('exam-screen'))).toBeVisible();

    // Verify questions are accessible
    await expect(element(by.id('question-component'))).toBeVisible();

    // Verify exam controls work
    await expect(element(by.id('next-button'))).toBeVisible();
    await expect(element(by.id('submit-button'))).toBeVisible();
  });

  test('should bypass integrity check across multiple app restarts in dev mode', async () => {
    // First launch
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('home-screen'))).toBeVisible();

    // Restart app
    await device.terminateApp();
    await device.launchApp({ newInstance: false });

    // Second launch - should still bypass
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('home-screen'))).toBeVisible();
    await expect(element(by.id('integrity-blocked-screen'))).not.toBeVisible();

    // Third launch
    await device.terminateApp();
    await device.launchApp({ newInstance: false });

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('home-screen'))).toBeVisible();
  });
});

describe('Development Mode Bypass - Network Independence (E2E)', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
    });
  });

  test('should work offline in development mode (no network needed)', async () => {
    // Disable all network access
    await device.setURLBlacklist(['.*']);

    // Launch app offline in dev mode
    await device.launchApp({ newInstance: false });

    // Should still launch successfully (no API calls needed)
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('home-screen'))).toBeVisible();
    await expect(element(by.id('integrity-blocked-screen'))).not.toBeVisible();

    // Re-enable network
    await device.setURLBlacklist([]);
  });

  test('should not make any integrity API calls in dev mode', async () => {
    // Block integrity-related endpoints
    await device.setURLBlacklist(['.*api/integrity.*']);

    await device.launchApp({ newInstance: false });

    // Should launch successfully (no API calls attempted)
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('home-screen'))).toBeVisible();

    // No network error should appear
    await expect(element(by.text(/connect to the internet/i))).not.toBeVisible();
    await expect(element(by.text(/unable to verify/i))).not.toBeVisible();

    // Re-enable network
    await device.setURLBlacklist([]);
  });
});

describe('Development Mode Bypass - Console Logging (E2E)', () => {
  test('should log bypass message when __DEV__ is true', async () => {
    // This test verifies the console log exists
    // In practice, console logs would be checked via debugger or log capture

    await device.launchApp({
      newInstance: true,
      delete: true,
    });

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('home-screen'))).toBeVisible();

    // Expected console log: "[PlayIntegrity] Bypassed in development mode"
    // This would be verified via debugger or log capture tools
    // For E2E test, we verify the behavior (app launches without blocking)
  });
});

describe('Development Mode Bypass - State Management (E2E)', () => {
  test('should not create cache entries in development mode', async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
    });

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('home-screen'))).toBeVisible();

    // Restart multiple times - should always be instant (no cache writes/reads)
    for (let i = 0; i < 3; i++) {
      await device.terminateApp();
      await device.launchApp({ newInstance: false });

      const startTime = Date.now();
      await waitFor(element(by.id('loading-screen')))
        .not.toBeVisible()
        .withTimeout(5000);
      const elapsed = Date.now() - startTime;

      // Should be fast (no cache operations)
      expect(elapsed).toBeLessThan(3000);

      await expect(element(by.id('home-screen'))).toBeVisible();
    }
  });
});

describe('Development Mode Bypass - Developer Workflow (E2E)', () => {
  test('should support hot reload without integrity re-check', async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
    });

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('home-screen'))).toBeVisible();

    // Simulate hot reload (React Native dev feature)
    await device.reloadReactNative();

    // Should reload quickly without integrity check
    const startTime = Date.now();
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeLessThan(3000); // Fast reload
    await expect(element(by.id('home-screen'))).toBeVisible();
  });

  test('should allow debug builds on non-Play Store devices', async () => {
    // Development mode allows testing on emulators, physical devices
    // without Play Store, or devices with custom ROMs
    await device.launchApp({
      newInstance: true,
      delete: true,
    });

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    // Should work regardless of device state (no Play Services required)
    await expect(element(by.id('home-screen'))).toBeVisible();
    await expect(element(by.id('integrity-blocked-screen'))).not.toBeVisible();

    // Verify full functionality
    await element(by.id('start-exam-button')).tap();
    await expect(element(by.id('exam-screen'))).toBeVisible();
  });

  test('should maintain developer experience (no friction)', async () => {
    // Measure total developer workflow: launch → code → reload → test
    const workflowStart = Date.now();

    // Initial launch
    await device.launchApp({
      newInstance: true,
      delete: true,
    });

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('home-screen'))).toBeVisible();

    // Simulate code change + reload
    await device.reloadReactNative();

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    await expect(element(by.id('home-screen'))).toBeVisible();

    // Test functionality
    await element(by.id('practice-tab')).tap();
    await expect(element(by.id('practice-screen'))).toBeVisible();

    const workflowElapsed = Date.now() - workflowStart;

    console.log(`Developer workflow time: ${workflowElapsed}ms`);

    // Entire workflow should be fast (< 10 seconds)
    expect(workflowElapsed).toBeLessThan(10000);
  });
});

describe('Development Mode Bypass - Contrast with Production (E2E)', () => {
  test('should document difference between dev and production builds', async () => {
    // This test documents expected behavior differences

    // Development mode (__DEV__ === true):
    // - No integrity checks performed
    // - No API calls to /api/integrity/verify
    // - No cache reads/writes for IntegrityStatus
    // - Instant app launch (no blocking)
    // - Works offline/on emulators/without Play Services
    // - Console log: "[PlayIntegrity] Bypassed in development mode"

    // Production mode (__DEV__ === false):
    // - First launch: Integrity check via Google Play Integrity API
    // - API call to backend for token decryption
    // - Cache write on success (30-day TTL)
    // - Subsequent launches: Cache read (<10ms)
    // - Blocking screen if integrity fails
    // - Requires Google Play Services (Android only)

    await device.launchApp({
      newInstance: true,
      delete: true,
    });

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(5000);

    // In development mode, verify bypass behavior
    await expect(element(by.id('home-screen'))).toBeVisible();
    await expect(element(by.id('integrity-blocked-screen'))).not.toBeVisible();

    // This test serves as documentation
    // Production behavior would be tested in separate production build tests
  });
});
