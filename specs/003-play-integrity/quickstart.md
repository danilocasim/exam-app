# Quickstart: Play Integrity Guard Development

**Feature**: 003-play-integrity  
**Date**: February 15, 2026  
**Status**: Development Guide

## Overview

This guide helps developers set up and test Play Integrity Guard locally during development.

## Prerequisites

- Branch: `003-play-integrity` (created from merged 002-cloudprep-mobile)
- Node.js 18+, npm 9+
- Android SDK / Emulator (for mobile testing)
- Expo CLI installed: `npm install -g expo-cli`
- Google Play Console project (for production; dev uses bypass)

## Local Development Setup

### 1. Environment Configuration

**No new environment variables required for development**. The `__DEV__` check in React Native automatically bypasses integrity verification in Expo dev builds.

For backend testing (optional):

```bash
# api/.env (if using staging/test credentials)
GOOGLE_PLAY_CONSOLE_CREDENTIALS_JSON=<base64-encoded service account JSON>
PLAY_INTEGRITY_API_KEY=<from Google Cloud Console>
```

Production: Credentials stored in deployment environment (not in repo).

### 2. Mobile Development

#### Running the App in Dev Mode

```bash
cd mobile
npm install  # Install dependencies (if needed)
npx expo start
# Select: i (iOS) or a (Android)
```

**Integrity Check Status**: 
- ✅ Automatically bypassed (`__DEV__ == true`)
- ✅ Console log shows: `[PlayIntegrity] Bypassed in development mode`
- ✅ No Play Store install required
- ✅ Full app access granted

---

## Phase 4: Monorepo Development Setup

This repo now uses npm workspaces with shared mobile code in `packages/shared/`.

### Install dependencies (root)

```bash
cd /Users/danilo/repos/exam-app
npm install
```

### Run a specific app

```bash
cd apps/aws-clp
npx expo start
```

### Create a new app (scaffold)

```bash
./scripts/create-app.sh --exam-type SAA-C03 --name "Dojo Exam SAA" --package com.danilocasim.dojoexam.saac03
```

### Run tests

```bash
# All workspaces
npm test

# Shared package only
cd packages/shared && npm test
```

### Build

```bash
# Build one app workspace
npm run build --workspace=apps/aws-clp

# Build all apps with EAS
npm run build:all
```

### Add an exam type in the admin portal

1. Start the backend: `cd api && npm run start:dev`
2. Start the admin portal: `cd api/admin-portal && npm run dev`
3. Create a new ExamType in the UI (id must match the app's EXAM_TYPE_ID)

### Troubleshooting

- Metro module resolution: restart Expo with cache clear: `npx expo start -c`
- Workspace installs: always run `npm install` from the repo root
- If `@exam-app/shared` fails to resolve, verify `apps/*/metro.config.js` watchFolders and nodeModulesPaths

### 3. Backend Setup

#### Start Backend API

```bash
cd api
npm install  # If needed
npm run start:dev
```

**Endpoint Available**: `POST http://localhost:3000/api/integrity/verify`

#### Test Integrity Endpoint (Mock)

```bash
# Terminal: POST request to backend
curl -X POST http://localhost:3000/api/integrity/verify \
  -H "Content-Type: application/json" \
  -d '{"token": "mock-token-for-testing"}'

# Expected Response (dev/test):
# {
#   "success": false,
#   "error": "Mock/test token. Real tokens require google-auth-library."
# }
```

## Testing Scenarios

### Scenario 1: First Launch (Development Mode)

**Goal**: Verify app launches without integrity blocking in dev mode.

```bash
# Terminal 1: Run backend
cd api && npm run start:dev

# Terminal 2: Run mobile
cd mobile && npx expo start
# Select: a (Android emulator)
```

**Expected Behavior**:
1. Emulator launches app
2. Initialization screen shows (database setup, questions sync)
3. No blocking screen appears
4. Console output shows: `[PlayIntegrity] Bypassed in development mode`
5. App navigates to HomeScreen normally

**Success Criteria**: ✅ App fully accessible without integrity prompt

---

### Scenario 2: Integrity Blocked Screen (Simulated)

**Goal**: Test blocking UI without releasing to Play Store.

**Manual Test** (modify code temporarily):

```typescript
// mobile/src/services/play-integrity.service.ts
// Temporarily change bypass logic for testing:

export async function checkIntegrity(): Promise<IntegrityCheckResult> {
  // TEMPORARY: Force block for testing
  if (true) { // Override __DEV__ check
    return {
      verified: false,
      error: {
        type: 'DEFINITIVE',
        message: 'For security reasons, this app must be downloaded from Google Play.',
      },
    };
  }
  // ... rest of implementation
}
```

Run app:

```bash
npx expo start
# Select: a
```

**Expected Behavior**:
1. App initializes
2. Blocking screen appears with message: "For security reasons, this app must be downloaded from Google Play."
3. Button: "Open Google Play" (taps should open Play Store or show message)
4. No navigation available; user cannot dismiss screen

**Success Criteria**: ✅ Blocking screen displays, prevents app access

**Cleanup**: Revert the temporary change before committing.

---

### Scenario 3: Offline After Verification

**Goal**: Verify app works offline after initial verification.

**Steps**:

1. **Enable Network** (first launch):
   ```bash
   npx expo start
   # Select: a
   ```
   App launches with integrity check (bypassed in dev, but would verify in production)

2. **Enable Airplane Mode** (on device/emulator):
   - Go to Settings → Airplane Mode → ON
   - Or use Android Emulator: Extended controls → Network → Airplane mode ON

3. **Restart App** (force close + relaunch):
   ```bash
   # In Android Emulator:
   # - Close app (back button or swipe)
   # - Relaunch via home screen
   ```

**Expected Behavior**:
1. App relaunch in airplane mode
2. Database loads from local cache (no network needed)
3. Questions accessible offline
4. Exam simulation works normally

**Success Criteria**: ✅ App fully functional offline (no integrity-related network calls)

---

### Scenario 4: 30-Day Cache TTL Expiry (Simulated)

**Goal**: Verify re-verification triggers after 30 days.

**Mock Test** (unit test):

```typescript
// mobile/__tests__/play-integrity.service.test.ts
describe('IntegrityStatus TTL', () => {
  it('should re-verify if cache older than 30 days', async () => {
    // Create fake cache with verified_at = 31 days ago
    const oldVerifiedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    
    // Mock database
    const mockStatus = { integrity_verified: true, verified_at: oldVerifiedAt };
    
    // Call integrity check
    const result = await checkIntegrity();
    
    // Should trigger fresh verification (would call API in production)
    expect(result.needsReVerification).toBe(true);
  });
});
```

Run test:

```bash
cd mobile
npm test -- play-integrity.service.test.ts
```

**Success Criteria**: ✅ Test passes; logic correctly identifies stale cache

---

## Production Testing (Release Build)

### Pre-Release Checklist

- [ ] APK built with release signing key (Google Play signature)
- [ ] Installed on Android device (not via adb sideload)
- [ ] Installed via Google Play internal test track or beta track
- [ ] Device has internet connection
- [ ] Google Play Services available on device
- [ ] Google Play Console service account credentials configured in backend

### Testing Steps

1. **First Launch**:
   ```bash
   # On device: Uninstall app
   # On Play Console: Release to internal test track
   # On device: Install from Play Store (or test track)
   # Expected: App verifies, displays no blocking screen, loads normally
   ```

2. **Sideload Test** (verify blocking works):
   ```bash
   # Build release APK
   cd android && ./gradlew assembleRelease
   
   # Sideload to device (NOT Play Store)
   adb install -r app/release/app-release.apk
   
   # Launch app on device
   # Expected: Blocking screen appears immediately
   ```

3. **Offline Test**:
   ```bash
   # On device: Enable Airplane Mode
   # Close app + relaunch
   # Expected: App loads from cache, works normally
   ```

### Rollback

If blocking happens unexpectedly:

1. **Backend rollback**: Remove `/api/integrity/verify` endpoint (non-breaking change)
2. **Mobile rollback**: Push hotfix that returns `verified=true` from `checkIntegrity()`
3. **User recovery**: User can uninstall and reinstall from Play Store

---

## Uploading to Google Play Store

### Prerequisites for Upload

- [ ] Google Play Console project created (app package: `com.awsccp.exampre`)
- [ ] App signed with release signing key
- [ ] Version code incremented (each upload must have higher version code)
- [ ] Build tested thoroughly (all scenarios 1-4 above)
- [ ] Google Play Console service account (for automated uploads)

### Step 1: Setup Release Signing Configuration

**CRITICAL**: Before building, you must configure release signing. This is the most common cause of "signed in debug mode" errors.

#### 1.1: Generate Release Keystore

```bash
cd mobile/android
keytool -genkey -v \
  -keystore app/release.keystore \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias android-release-key \
  -storepass YOUR_PASSWORD \
  -keypass YOUR_PASSWORD \
  -dname "CN=Your Name, OU=Engineering, O=YourCompany, L=City, ST=State, C=US"
```

**Important Notes:**
- Replace `YOUR_PASSWORD` with a strong password
- Store the password securely (password manager)
- **DO NOT COMMIT** the keystore to Git (already in `.gitignore`)
- Keep a backup of the keystore file - you cannot update your app without it

#### 1.2: Configure Gradle Signing

Edit `mobile/android/app/build.gradle` and ensure the signing configuration is correct:

```gradle
android {
    // ... other config ...
    
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            storeFile file('release.keystore')
            storePassword 'YOUR_PASSWORD'  // Replace with your password
            keyAlias 'android-release-key'
            keyPassword 'YOUR_PASSWORD'    // Replace with your password
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release  // MUST use release config
            minifyEnabled true
            // ... other release config ...
        }
    }
}
```

**Common Mistake**: If `release` buildType uses `signingConfigs.debug`, you'll get "signed in debug mode" error.

#### 1.3: Create local.properties (Required)

Create `mobile/android/local.properties` with your Android SDK path:

```properties
sdk.dir=/Users/YOUR_USERNAME/Library/Android/sdk
```

Or on Linux/Windows:
```properties
sdk.dir=/home/YOUR_USERNAME/Android/Sdk
```

**Note**: This file is auto-generated by Android Studio but required for command-line builds.

#### 1.4: Important Warning About expo prebuild

⚠️ **CRITICAL**: Running `npx expo prebuild -p android --clean` will:
- Delete `mobile/android/app/release.keystore`
- Reset `build.gradle` to default (debug signing for release)
- Delete `local.properties`

**After running expo prebuild, you MUST:**
1. Regenerate `release.keystore` (Step 1.1)
2. Fix `build.gradle` signing config (Step 1.2)
3. Recreate `local.properties` (Step 1.3)

### Step 2: Build Release APK/AAB

**Option A: Build Android App Bundle (AAB)** (Recommended - Required by Play Store)

```bash
cd mobile/android
./gradlew clean
./gradlew bundleRelease
```

Outputs: `mobile/android/app/build/outputs/bundle/release/app-release.aab`

**Option B: Build APK (for testing)**

```bash
cd mobile/android
./gradlew clean
./gradlew assembleRelease
```

Outputs: `mobile/android/app/build/outputs/apk/release/app-release.apk`

**Build Troubleshooting:**

If you see:
- `SDK location not found` → Create `local.properties` (Step 1.3)
- `release.keystore not found` → Generate keystore (Step 1.1)
- `CMake Error: directory not found` → Reinstall dependencies:
  ```bash
  cd mobile
  rm -rf node_modules android/app/build android/build
  npm install --legacy-peer-deps
  npx expo prebuild -p android --clean
  # Then redo Steps 1.1, 1.2, 1.3
  cd android
  ./gradlew bundleRelease
  ```

### Step 3: Verify Build Integrity and Signing

**CRITICAL**: Verify your build is signed with the release key BEFORE uploading to Play Store.

```bash
cd mobile/android

# Verify the build file exists
ls -lh app/build/outputs/bundle/release/app-release.aab

# Check signing configuration
./gradlew signingReport
```

**Expected Output:**
```
Variant: release
Config: release
Store: /path/to/app/release.keystore
Alias: android-release-key
MD5: <hash>
SHA1: <hash>
SHA-256: <hash>
Valid from: <date> until: <date>
Certificate fingerprints:
     MD5:  <fingerprint>
     SHA1: <fingerprint>
     SHA256: <fingerprint>
```

**Warning Signs:**
- If you see `Alias: androiddebugkey` → Your release build is using debug signing (fix Step 1.2)
- If you see `Store: debug.keystore` → Your release build is using debug signing (fix Step 1.2)
- If signing report fails → Keystore file is missing or path is wrong (fix Step 1.1)

### Step 4: Upload via Google Play Console (Manual)

**For First Release:**

1. Go to [Google Play Console](https://play.google.com/console)
2. Select your app: **AWS CloudPractitioner Exam Prep**
3. Navigate to **Testing** > **Internal Testing**
4. Click **Create new release**
5. Click **Upload APK** or **Upload AAB**
6. Select your build file (`app-release.apk` or `app-release.aab`)
7. Review details:
   - Version name: `1.0.0` (or increment: `1.0.1`)
   - Version code: Must be higher than previous release
   - Release notes: Document Play Integrity Guard changes
8. Click **Review** then **Start rollout to internal testing**

**For Subsequent Releases:**

1. Navigate to **Testing** > **Internal Testing**
2. Click **Create new release**
3. Upload new AAB/APK with **incremented version code**
4. Review and start rollout

### Step 5: Testing Phases

**Phase 1: Internal Testing** (T206-T208)

```
Track: Internal Testing
Testers: 5-10 (your team)
Duration: 3-5 days
Criteria:
  ✅ App installs from Play Store
  ✅ Integrity check passes (verified=true)
  ✅ No blocking screen on first launch
  ✅ Can complete exam offline
  ✅ Cloud sync works (if enabled)
```

**Phase 2: Closed Testing** (T209-T210)

```
Track: Closed Testing
Testers: 30-50 (beta testers, friends, colleagues)
Duration: 1 week
Criteria:
  ✅ Same as Phase 1
  ✅ Gather feedback on UI/UX
  ✅ Monitor crash reports
  ✅ Test on real devices (multiple Android versions)
```

**Phase 3: Beta Testing** (T211-T212)

```
Track: Beta / Open Testing
Testers: Unlimited (public)
Duration: 1-2 weeks
Criteria:
  ✅ Same as Phase 2
  ✅ Monitor 1-star reviews for critical issues
```

**Phase 4: Production Release** (T213+)

```
Track: Production
Rollout: Staged (10% → 25% → 50% → 100%)
Timeline:
  Day 1: 10% rollout (monitor crashes)
  Day 3: 25% rollout
  Day 5: 50% rollout
  Day 7: 100% rollout (full release)

Post-launch Checklist:
  ✅ Monitor crash rate (target: <1%)
  ✅ Monitor reviews
  ✅ Ready to rollback if critical issues found
```

### Step 6: Automated Upload via GitHub Actions (Optional)

**Setup Service Account:**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new service account or use existing
3. Grant role: **Service Account User** + **Editor**
4. Download JSON credentials file
5. Add to GitHub Secrets:
   ```
   PLAY_STORE_SERVICE_ACCOUNT = <contents of JSON file, base64 encoded>
   PLAY_STORE_APP_PACKAGE = com.awsccp.exampre
   PLAY_STORE_TRACK = internal  # or closed, beta, production
   ```

**Setup Release Keystore in GitHub Secrets:**

Since `expo prebuild --clean` deletes the keystore, you must restore it in CI/CD:

```bash
# Base64 encode your keystore
base64 -i mobile/android/app/release.keystore | pbcopy

# Add to GitHub Secrets:
# RELEASE_KEYSTORE_BASE64 = <paste the base64 string>
# RELEASE_KEYSTORE_PASSWORD = <your keystore password>
# RELEASE_KEY_ALIAS = android-release-key
# RELEASE_KEY_PASSWORD = <your key password>
```

**Create GitHub Actions Workflow:**

Create `.github/workflows/build-and-upload.yml`:

```yaml
name: Build and Upload to Play Store

on:
  push:
    tags:
      - 'v*'  # Trigger on version tags (v1.0.0, v1.0.1, etc.)

jobs:
  build-and-upload:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        working-directory: ./mobile
        run: npm ci --legacy-peer-deps
      
      - name: Setup Android SDK
        uses: android-actions/setup-android@v3
      
      - name: Prebuild Android
        working-directory: ./mobile
        run: npx expo prebuild -p android --clean
      
      - name: Restore Release Keystore
        working-directory: ./mobile/android
        run: |
          echo "${{ secrets.RELEASE_KEYSTORE_BASE64 }}" | base64 -d > app/release.keystore
          echo "sdk.dir=$ANDROID_HOME" > local.properties
      
      - name: Update Signing Config
        working-directory: ./mobile/android/app
        run: |
          # Inject signing config into build.gradle
          sed -i "s/signingConfig signingConfigs.debug/signingConfig signingConfigs.release/g" build.gradle
          sed -i "/signingConfigs {/a\\
          release {\\
              storeFile file('release.keystore')\\
              storePassword '${{ secrets.RELEASE_KEYSTORE_PASSWORD }}'\\
              keyAlias '${{ secrets.RELEASE_KEY_ALIAS }}'\\
              keyPassword '${{ secrets.RELEASE_KEY_PASSWORD }}'\\
          }" build.gradle
      
      - name: Build release AAB
        working-directory: ./mobile/android
        run: ./gradlew bundleRelease
      
      - name: Upload to Play Store
        uses: r0adkll/upload-google-play@v1
        with:
          serviceAccountJsonPlainText: ${{ secrets.PLAY_STORE_SERVICE_ACCOUNT }}
          packageName: com.awsccp.exampre
          releaseFiles: mobile/android/app/build/outputs/bundle/release/app-release.aab
          track: ${{ secrets.PLAY_STORE_TRACK }}
          inAppUpdatePriority: 3
```

**Trigger Workflow:**

```bash
# Tag a release
git tag -a v1.0.0 -m "Play Integrity Guard release"
git push origin v1.0.0

# GitHub Actions will automatically build and upload to Play Store
```

**Monitor Upload:**

- Go to **Actions** tab in GitHub
- Watch workflow progress
- Play Console will show new release in selected track

### Step 7: Troubleshooting Upload Issues

**Error: "You uploaded an APK or Android App Bundle that was signed in debug mode"**

This is the MOST COMMON error. It means your release build is using debug signing.

**Root Causes:**
1. `build.gradle` has `release` buildType using `signingConfigs.debug`
2. `release.keystore` file is missing from `android/app/`
3. You ran `expo prebuild --clean` which reset your signing config
4. Keystore password/alias in `build.gradle` doesn't match actual keystore

**Solution:**
```bash
cd mobile/android

# 1. Verify keystore exists
ls -lh app/release.keystore

# 2. If missing, regenerate it (use YOUR password)
keytool -genkey -v \
  -keystore app/release.keystore \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -alias android-release-key \
  -storepass YOUR_PASSWORD \
  -keypass YOUR_PASSWORD \
  -dname "CN=Your Name, OU=Eng, O=Co, L=City, ST=State, C=US"

# 3. Verify build.gradle has correct signing config
#    Edit app/build.gradle and ensure:
#    - signingConfigs.release exists with correct storeFile, alias, passwords
#    - buildTypes.release uses signingConfigs.release (NOT debug)

# 4. Delete old builds
rm -rf app/build

# 5. Rebuild bundle
./gradlew clean
./gradlew bundleRelease

# 6. Verify signing BEFORE uploading
./gradlew signingReport
# Look for release variant - should show android-release-key, NOT androiddebugkey

# 7. Upload the NEW app-release.aab
```

**Error: "Could not validate APK signature"**

- Solution: Verify signing key is correct
- Check: `./gradlew signingReport`
- Ensure: Same keystore used for all releases

**Error: "Version code X already exists"**

- Solution: Increment version code in `app.json`
- Current: `versionCode: 1` → Change to `versionCode: 2`
- Run build again

**Error: "Invalid package name"**

- Ensure: Package name matches Play Console entry
- Current: `com.awsccp.exampre`
- Check: `android/app/src/AndroidManifest.xml` or `app.json`

**Error: "Target API level too low"**

- Current target: API 36
- Google Play minimum: API 35 (as of Feb 2025)
- Update if needed: `android/build.gradle`

**Upload Hangs or Times Out**

- File size > 100MB: Consider splitting with Play Console's modular features
- Solution: Switch to AAB format (smaller than APK)
- Command: `./gradlew bundleRelease` (not `assembleRelease`)

**General Troubleshooting Checklist:**

- [ ] APK/AAB file exists: `ls -lh mobile/android/app/build/outputs/**/app-release.*`
- [ ] Version code incremented in `app.json` or `build.gradle`
- [ ] Signing certificate matches previous releases
- [ ] Network connectivity stable during upload
- [ ] Play Console project permissions granted for your account
- [ ] Service account has "Release Manager" role (for automated uploads)

### Rollback Procedure

If critical issues found post-release:

**Immediate Rollback (within 2 hours):**

```
Play Console > Select Release > Click "..." > Halt Rollout
```

**Hotfix Release:**

1. Fix issue in code
2. Increment version code
3. Rebuild: `cd mobile && ./build-release.sh`
4. Upload to **internal testing** first (validation)
5. If successful, release to production with staged rollout

**Emergency: Disable App**

```
Play Console > Store settings > Remove from Play Store
Users retain access; new installs blocked
```

---

## Debugging

### Console Logs

Mobile app will log integrity checks:

```
[PlayIntegrity] Bypassed in development mode
[PlayIntegrity] Checking cached integrity status...
[PlayIntegrity] Cache hit: verified=true, age=5 days
[PlayIntegrity] Verification passed
[PlayIntegrity] Starting verification request...
[PlayIntegrity] Verification failed: TRANSIENT (UNEVALUATED)
[PlayIntegrity] Showing retry screen
```

### Backend Logs

API endpoint logs:

```
[IntegrityController] POST /api/integrity/verify received
[IntegrityService] Decrypting token...
[IntegrityService] Google API response: {appRecognitionVerdict: 'PLAY_RECOGNIZED', ...}
[IntegrityController] Verdict returned: success=true
```

### SQLite Inspection (Mobile)

On device/emulator:

```bash
# Via Expo CLI, if using expo-sqlite-explorer (optional):
# Check local database state
# SELECT * FROM IntegrityStatus;
```

Via Android Studio:

```
Device Explorer → data/data/com.example.exam/files/SQLite → [db file]
```

---

## Common Issues

### Issue: Development Mode Still Blocks App

**Symptoms**: Blocking screen appears even with `__DEV__ == true`

**Solution**:
1. Verify `__DEV__` is true: Add log to App.tsx
2. Check Expo build: `npx expo start --clear`
3. Fallback: Re-enable network and test bypass server-side

---

## Test Execution

### Running Unit & Integration Tests

#### Mobile Tests (Jest)

**Run all Play Integrity tests**:

```bash
cd mobile

# Run all Play Integrity tests
npm test -- __tests__/play-integrity.service.test.ts --no-coverage

# Run performance benchmarks
npm test -- __tests__/integrity-performance.test.ts --no-coverage

# Run reinstall-reset lifecycle tests
npm test -- __tests__/reinstall-reset.integration.test.ts --no-coverage

# Run all three together
npm test -- --testNamePattern="play-integrity|integrity-performance|reinstall-reset" --no-coverage
```

**Expected Output**:
- T181 (play-integrity.service.test.ts): 27 tests passing
- T186 (integrity-performance.test.ts): 10 tests passing (includes performance benchmarks)
- T188 (reinstall-reset.integration.test.ts): 17 tests passing
- **Total: 54 tests passing**

**Individual Test Categories**:

```bash
# Verdict validation tests
npm test -- __tests__/play-integrity.service.test.ts -t "Verdict Validation"

# Cache TTL logic tests
npm test -- __tests__/play-integrity.service.test.ts -t "Cache TTL Logic"

# Cache hit tests
npm test -- __tests__/play-integrity.service.test.ts -t "checkIntegrity - Cache Hit"

# Network error handling
npm test -- __tests__/play-integrity.service.test.ts -t "checkIntegrity - Network Errors"

# Definitive vs transient errors
npm test -- __tests__/play-integrity.service.test.ts -t "Definitive vs. Transient Errors"
```

#### Backend Tests (Jest + Supertest)

**Run API integrity tests**:

```bash
cd api

# Run all integrity endpoint tests
npm test -- test/integrity.e2e-spec.ts

# Expected output: All 8+ endpoint tests passing
```

#### E2E Tests (Detox)

**Setup Detox environment** (first time only):

```bash
cd mobile

# Install Detox CLI globally
npm install -g detox-cli

# Build Detox test app for Android
detox build-framework-cache --framework ios   # if testing iOS
detox build-framework-cache --framework android # if testing Android

# Build the test app (creates binary for testing)
detox build-framework-cache --method ios
# or
detox build-framework-cache --method android
```

**Run E2E tests**:

```bash
# Dev bypass E2E test (verifies __DEV__ bypass works)
detox test __tests__/dev-bypass.e2e.test.ts --configuration ios.sim.release
# or for Android:
detox test __tests__/dev-bypass.e2e.test.ts --configuration android.emu.release

# Expected: 16 tests passing (dev bypass scenarios)
```

**Run Full E2E Suite**:

```bash
npm run test:e2e
# Runs all Detox tests in parallel
```

### Performance Baseline Measurement & Regression Prevention  *(T189.5: Performance Monitoring)*

**Baseline Targets** (from T186 integrity-performance.test.ts):

| Metric | Target | Regression Threshold | CI/CD Flag |
|--------|--------|----------------------|-----------|
| First Launch with API (P95) | <5000ms | ±10% (4500-5500ms) | ⚠️ at ≥6000ms (+20%) |
| Cached Launch (P95) | <3000ms | ±10% (2700-3300ms) | ⚠️ at ≥3600ms (+20%) |
| Cache Hit Query (P95) | <10ms | ±10% (9-11ms) | ⚠️ at ≥12ms (+20%) |

**Establish baseline before optimizations**:

```bash
cd mobile

# Run performance benchmark tests
npm test -- __tests__/integrity-performance.test.ts --no-coverage

# Output shows:
# ✅ PASS First Launch with API: <5000ms (5 seconds target)
# ✅ PASS Cached Launch: <3000ms (3 seconds target)  
# ✅ PASS Cache Hit Query: <10ms (10 milliseconds target)
```

**Capture & Document Baseline Numbers**:

After initial implementation, save baseline metrics in `mobile/.performance-baseline.json`:

```json
{
  "date": "2026-02-18",
  "environment": "iPhone 14 Simulator (iOS 17.2)",
  "metrics": {
    "firstLaunchWithAPI": { "measured": 4200, "target": 5000, "unit": "ms" },
    "cachedLaunch": { "measured": 1800, "target": 3000, "unit": "ms" },
    "cacheHitQuery": { "measured": 5, "target": 10, "unit": "ms" }
  },
  "status": "baseline_established"
}
```

**Monitor Performance Regressions**:

For each code change, re-run performance tests:

```bash
cd mobile

# Compare against baseline (verbose output shows metric breakdown)
npm test -- __tests__/integrity-performance.test.ts --verbose

# CI/CD Pipeline Check (see section below for GitHub Actions setup)
# Automatic regression detection flags any metric exceeding ±10% threshold
```

**CI/CD Regression Prevention** (GitHub Actions):

Add this check to `.github/workflows/test.yml` to automatically detect performance regressions:

```yaml
# In .github/workflows/test.yml, add step after mobile tests:

- name: Performance Regression Check
  if: always()
  run: |
    cd mobile
    npm test -- __tests__/integrity-performance.test.ts --no-coverage --json --outputFile=test-results.json
    
    # Parse results and compare against baseline thresholds
    FIRST_LAUNCH=$(jq '.testResults[0].assertionResults[0].duration' test-results.json)
    CACHED_LAUNCH=$(jq '.testResults[0].assertionResults[1].duration' test-results.json)
    CACHE_HIT=$(jq '.testResults[0].assertionResults[2].duration' test-results.json)
    
    # Check thresholds (flag at +20% degradation)
    if [ $FIRST_LAUNCH -gt 6000 ] || [ $CACHED_LAUNCH -gt 3600 ] || [ $CACHE_HIT -gt 12 ]; then
      echo "⚠️ PERFORMANCE REGRESSION DETECTED"
      echo "First Launch: ${FIRST_LAUNCH}ms (target: <5000ms)"
      echo "Cached Launch: ${CACHED_LAUNCH}ms (target: <3000ms)"
      echo "Cache Hit: ${CACHE_HIT}ms (target: <10ms)"
      exit 1
    else
      echo "✅ Performance targets met"
    fi
```

**Manual Regression Detection** (if CI/CD unavailable):

If performance degrades in local testing:

```bash
cd mobile

# Get detailed metrics
npm test -- __tests__/integrity-performance.test.ts --verbose

# Compare with baseline and calculate % change
# If >±10%: investigate code changes for performance impact
# If >+20%: fail PR review (regression too severe)

# Profile problematic code:
npm run android -- --profile  # For Android emulator
npm run ios -- --profile      # For iOS simulator
```

**Common Performance Regressions** (debugging):

- **First Launch Slow**: Check Play Integrity token request time (T181 tests verify <5s)
- **Cache Launch Slow**: Check SQLite query time for cached verification lookup
- **Cache Hit Slow**: Check JSON parsing of cached IntegrityStatus object
- **All Slow**: Check for new synchronous I/O in app initialization (use async/await)

**Regression Prevention Checklist**:

Before merging performance-sensitive code:
- ✅ Run T186 performance tests locally
- ✅ Compare metrics against baseline (±10% acceptable)
- ✅ If >+10% degradation, profile code and optimize
- ✅ Document baseline changes if optimization intended
- ✅ Verify CI/CD performance check passes on PR
- ✅ Add performance regression comment to PR description

### Test Coverage Report

**Generate coverage report** (optional, for metrics):

```bash
cd mobile

# Generate coverage without watch mode
npm test -- --coverage --watchAll=false

# Output files in: mobile/coverage/
# Open in browser: open coverage/lcov-report/index.html
```

**Coverage Goals**:
- play-integrity.service.ts: >95%
- integrity.repository.ts: >90%
- play-integrity.store.ts: >85%

### Continuous Integration Testing

**For CI/CD pipelines** (GitHub Actions, etc.):

```bash
#!/bin/bash
set -e

# Test mobile Play Integrity
cd mobile
npm ci
npm test -- --testPathPattern="play-integrity|integrity-performance|reinstall-reset" --coverage
npm run test:e2e -- --headless

# Test backend integrity API
cd ../api
npm ci
npm test -- test/integrity.e2e-spec.ts

echo "✅ All Play Integrity tests passed"
```

**Expected CI Output**:
```
✅ 54 unit/integration tests passing
✅ 16 E2E tests passing
✅ Performance targets met
✅ No coverage regressions
```

### Troubleshooting Tests

**If tests fail to run**:

1. **Clear Jest cache**:
   ```bash
   npm test -- --clearCache
   ```

2. **Rebuild native modules** (if needed):
   ```bash
   cd mobile
   npm run clean:native
   npm install
   ```

3. **Verify mock setup**:
   - Check `jest.mock('react-native-google-play-integrity')` in test files
   - Verify `@jest/globals` imported in test files

4. **Debug individual test**:
   ```bash
   npm test -- __tests__/play-integrity.service.test.ts -t "should validate verdict"
   ```

---

### Issue: Integrity Endpoint Returns 404

**Symptoms**: Mobile requests `/api/integrity/verify`, backend returns 404

**Solution**:
1. Verify backend running: `curl http://localhost:3000/health`
2. Check IntegrityModule imported in app.module.ts
3. Check NestJS route prefix (if any) doesn't interfere

---

### Issue: Sideload Install Fails

**Symptoms**: `adb install` returns error

**Solution**:
```bash
# Ensure device/emulator connected
adb devices

# Use -r flag to replace existing
adb install -r path/to/app-release.apk

# Check permissions in AndroidManifest.xml (if modified)
```

---

## Performance Baseline

During early testing, measure & document:

| Metric | Before 003 | After 003 | Delta |
|--------|-----------|----------|-------|
| First-launch time | ~3s | <5s | <+2s acceptable |
| Cached-launch time | ~3s | ~3s | 0s (no regression) |

Use Detox profiler:

```bash
npm run test:e2e -- --record-logs all
# Check output for [IntegrityCheck] timing
```

---

## Next Steps

1. **Local Development**: Run through Scenarios 1–3 above
2. **Unit Testing**: Add tests in `mobile/__tests__/play-integrity.service.test.ts`
3. **E2E Testing**: Run full integration with backend API
4. **Pre-Release**: Complete checklist above before production release

For detailed implementation, see: [plan.md](plan.md)

---

## Support

- **Specification**: [spec.md](spec.md)
- **Research**: [research.md](research.md)
- **Data Model**: [data-model.md](data-model.md)
- **Implementation Plan**: [plan.md](plan.md)
- **GitHub Issue**: Track as T151–T180 in tasks.md (when generated)
