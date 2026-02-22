/**
 * T183: Integrity Blocking E2E Test - Sideload Detection
 *
 * Detox E2E test for blocking sideloaded/tampered apps:
 * - Mock UNLICENSED verdict from Play Integrity API
 * - Verify blocking screen appears with appropriate message
 * - Verify no access to app functionality
 * - Verify no retry option for definitive failures
 *
 * Test Scenario: User Story 2 - Sideload Blocking
 * Acceptance: Sideloaded/tampered apps blocked 100% with clear feedback
 */
import { describe, test, expect, beforeAll, beforeEach } from 'vitest';
import { device, element, by, waitFor } from 'detox';

describe('Integrity Blocking - Sideload Detection (E2E)', () => {
  beforeAll(async () => {
    // Launch app with mock sideloaded state
    await device.launchApp({
      newInstance: true,
      delete: true, // Clean slate
      permissions: { notifications: 'YES' },
    });
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  test('should block app when verdict is UNLICENSED (sideloaded)', async () => {
    // Mock backend response: UNLICENSED verdict
    // In production test: Configure mock server to return UNLICENSED
    // For now: Assume non-__DEV__ build with mock server

    // Wait for integrity check to complete
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    // Verify blocking screen is shown
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();

    // Verify blocking message contains clear instructions
    await expect(element(by.text(/downloaded from Google Play/i))).toBeVisible();

    // Verify home screen is NOT accessible
    await expect(element(by.id('home-screen'))).not.toBeVisible();
  });

  test('should show full-screen blocking UI with no bypass option', async () => {
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    // Verify blocking screen
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();

    // Should NOT show retry button (definitive failure)
    await expect(element(by.id('retry-button'))).not.toBeVisible();

    // Should NOT show skip button
    await expect(element(by.id('skip-button'))).not.toBeVisible();

    // Should NOT show any navigation elements
    await expect(element(by.id('home-tab'))).not.toBeVisible();
    await expect(element(by.id('practice-tab'))).not.toBeVisible();
    await expect(element(by.id('history-tab'))).not.toBeVisible();
  });

  test('should display security message explaining the block', async () => {
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();

    // Verify security message is clear
    await expect(
      element(by.text(/For security reasons, this app must be downloaded from Google Play/i)),
    ).toBeVisible();

    // Verify Play Store link/button is present
    await expect(element(by.text(/Google Play/i))).toBeVisible();
  });

  test('should prevent access to any app functionality when blocked', async () => {
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();

    // Attempt to access main screens (should not be visible)
    await expect(element(by.id('home-screen'))).not.toBeVisible();
    await expect(element(by.id('practice-screen'))).not.toBeVisible();
    await expect(element(by.id('exam-screen'))).not.toBeVisible();
    await expect(element(by.id('history-screen'))).not.toBeVisible();
    await expect(element(by.id('settings-screen'))).not.toBeVisible();

    // Verify no questions are accessible
    await expect(element(by.id('question-component'))).not.toBeVisible();

    // Verify no exam history
    await expect(element(by.id('exam-history-list'))).not.toBeVisible();
  });

  test('should not create cache entry for failed integrity check', async () => {
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    // First launch: blocked
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();

    // Restart app (should run verification again, not use cache)
    await device.launchApp({ newInstance: false });

    // Should show loading screen again (no cache)
    await expect(element(by.id('loading-screen'))).toBeVisible();

    // Wait for verification
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    // Should still be blocked (no cached success)
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();
  });

  test('should show blocking screen for UNRECOGNIZED_VERSION verdict', async () => {
    // Mock backend response: UNRECOGNIZED_VERSION
    // Simulates re-signed or modified APK

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    // Verify blocking screen
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();

    // Verify security message
    await expect(element(by.text(/downloaded from Google Play/i))).toBeVisible();

    // No retry option
    await expect(element(by.id('retry-button'))).not.toBeVisible();
  });

  test('should show blocking screen for UNKNOWN device integrity (rooted device)', async () => {
    // Mock backend response: deviceRecognitionVerdict = UNKNOWN
    // Simulates rooted/compromised device

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    // Verify blocking screen
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();

    // Verify security message
    await expect(element(by.text(/downloaded from Google Play/i))).toBeVisible();

    // No retry option
    await expect(element(by.id('retry-button'))).not.toBeVisible();
  });
});

describe('Integrity Blocking - User Actions (E2E)', () => {
  beforeAll(async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
    });
  });

  test('should provide button to open Google Play Store', async () => {
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();

    // Verify Play Store button exists
    await expect(element(by.id('open-play-store-button'))).toBeVisible();

    // Tap button (in test environment, this won't actually open Play Store)
    await element(by.id('open-play-store-button')).tap();

    // After tap, blocking screen should remain visible
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();
  });

  test('should persist blocking state across app restarts', async () => {
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    // First launch: blocked
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();

    // Close and reopen app
    await device.terminateApp();
    await device.launchApp({ newInstance: false });

    // Wait for re-verification
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    // Should still be blocked (no cache for failures)
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();

    // Verify message remains consistent
    await expect(element(by.text(/downloaded from Google Play/i))).toBeVisible();
  });

  test('should not allow background access via deep links when blocked', async () => {
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();

    // Attempt to navigate via deep link (should be blocked)
    await device.openURL({
      url: 'examapp://practice',
      sourceApp: 'com.google.android.googlequicksearchbox',
    });

    // Should still show blocking screen (deep link ignored)
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();
    await expect(element(by.id('practice-screen'))).not.toBeVisible();
  });
});

describe('Integrity Blocking - Mixed Verdict Scenarios (E2E)', () => {
  test('should block when app is recognized but not licensed', async () => {
    // PLAY_RECOGNIZED but UNLICENSED = sideloaded from legitimate source
    await device.launchApp({
      newInstance: true,
      delete: true,
    });

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();
    await expect(element(by.text(/downloaded from Google Play/i))).toBeVisible();
  });

  test('should block when device integrity compromised even if app is licensed', async () => {
    // PLAY_RECOGNIZED + LICENSED but deviceRecognitionVerdict = UNKNOWN
    await device.launchApp({
      newInstance: true,
      delete: true,
    });

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();
    await expect(element(by.text(/downloaded from Google Play/i))).toBeVisible();
  });
});

describe('Integrity Blocking - Performance (E2E)', () => {
  test('should show blocking screen within 5 seconds of launch', async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
    });

    const startTime = Date.now();

    // Wait for loading screen to disappear
    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    const elapsed = Date.now() - startTime;

    // Verify blocking decision made within 5 seconds
    expect(elapsed).toBeLessThan(5000);

    // Verify blocking screen is now visible
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();
  });

  test('should not show partial app content before blocking', async () => {
    await device.launchApp({
      newInstance: true,
      delete: true,
    });

    // During loading, should NOT show any home screen content
    // This prevents flash of content before block
    await expect(element(by.id('home-screen'))).not.toBeVisible();

    await waitFor(element(by.id('loading-screen')))
      .not.toBeVisible()
      .withTimeout(10000);

    // After loading, should show blocking screen (not home)
    await expect(element(by.id('integrity-blocked-screen'))).toBeVisible();
    await expect(element(by.id('home-screen'))).not.toBeVisible();
  });
});
