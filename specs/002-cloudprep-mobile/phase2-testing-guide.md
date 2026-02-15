# Phase 2 Manual Testing Guide

**Feature**: Authentication & Cloud Sync (Phase 2)  
**Last Updated**: 2026-02-14  
**Status**: Ready for QA Testing

---

## Overview

This guide provides step-by-step manual testing scenarios for Phase 2 features:

- **Google OAuth Sign-In**: User authentication via Google account
- **Offline Exam Submission**: Exam completion without internet connection
- **Cloud Sync on Restore**: Automatic synchronization when network restores
- **Token Expiration & Refresh**: Seamless JWT token renewal

---

## Prerequisites

### Environment Setup

1. **Backend API Running**
   ```bash
   cd api
   npm run start:dev
   # Server should be running on http://localhost:3000
   ```

2. **Mobile App in Development Mode**
   ```bash
   cd mobile
   npx expo start
   # Choose: Android emulator, iOS simulator, or physical device
   ```

3. **Test Credentials**
   - Google account (any valid Google email)
   - API accessible at `http://localhost:3000` or configured API_URL
   - Database seeded with exam questions (run `npm run prisma:seed` in api/)

4. **Network Control** (for offline testing)
   - **Android**: Settings → Network & Internet → Airplane Mode
   - **iOS**: Settings → Airplane Mode
   - **Emulator**: Disable network via emulator controls

### Verification

Before starting tests, verify:
- [ ] API returns 200 on `GET http://localhost:3000/health`
- [ ] Mobile app loads to home screen
- [ ] At least one ExamType configured (e.g., `aws-ccp`)
- [ ] Questions loaded for the exam type

---

## Test Scenarios

### Scenario 1: Google Sign-In Flow

**Objective**: Verify user can authenticate via Google OAuth and access protected features.

#### Steps

1. **Launch App** (First Time User)
   - Open mobile app
   - Navigate to **Profile** tab
   - Verify "Sign In" button is visible

2. **Initiate Sign-In**
   - Tap "Sign In with Google" button
   - **Expected**: Google OAuth consent screen opens in WebView or browser

3. **Authenticate with Google**
   - Enter Google credentials (email + password)
   - Grant consent for app permissions (email, profile)
   - **Expected**: Redirected back to app with success message

4. **Verify User Profile**
   - Return to **Profile** tab
   - **Expected**:
     - User name displayed (from Google profile)
     - User email displayed
     - Profile picture (if available)
     - "Sign Out" button visible
     - "Sign In" button replaced/hidden

5. **Verify JWT Token Storage**
   - **Developer Tools** (React Native Debugger or console):
     ```javascript
     import { getAccessToken } from './src/services/auth.service';
     const token = await getAccessToken();
     console.log(token); // Should print JWT token string
     ```
   - **Expected**: Valid JWT token stored locally

6. **Verify Backend User Creation**
   - **Database Check** (via Prisma Studio or psql):
     ```sql
     SELECT * FROM "User" WHERE email = 'your-google-email@gmail.com';
     ```
   - **Expected**: User record exists with `googleId`, `email`, `name`

#### Success Criteria

- ✅ OAuth flow completes without errors
- ✅ User profile displays correct information
- ✅ JWT tokens stored locally
- ✅ User record created in database
- ✅ No console errors or crashes

#### Troubleshooting

- **Error: "Invalid OAuth configuration"**
  - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `api/.env`
  - Ensure redirect URI matches Google Cloud Console configuration

- **Error: "Failed to exchange authorization code"**
  - Check API logs: `cd api && npm run start:dev`
  - Verify Google OAuth credentials are correct

- **App stuck on "Loading..."**
  - Check network connectivity
  - Verify API is reachable from mobile device/emulator

---

### Scenario 2: Offline Exam Submission

**Objective**: Verify exam submissions are queued locally when offline and synced when online.

#### Steps

1. **Ensure User is Signed In**
   - Complete Scenario 1 (Google Sign-In)
   - Verify user profile shows signed-in state

2. **Enable Offline Mode**
   - **Android/iOS**: Enable Airplane Mode
   - **Verify**: No internet connection (open browser, should fail)

3. **Complete an Exam**
   - Navigate to **Home** tab
   - Tap "Start Practice Exam"
   - Answer all questions (e.g., 10 questions for quick test)
   - Tap "Submit Exam"

4. **Verify Local Storage**
   - **Expected**: 
     - Exam results displayed (score, pass/fail, duration)
     - Success message: "Exam saved locally. Will sync when online."
     - No error messages or crashes
   
5. **Check Sync Status**
   - Navigate to **History** tab
   - Find the submitted exam
   - **Expected**:
     - Exam listed with "Pending Sync" badge/indicator
     - Score and pass/fail status visible
     - SyncStatus: `PENDING` (if inspecting database/logs)

6. **Verify Database State** (SQLite on device)
   - **Developer Tools**:
     ```javascript
     import { getPendingExamSubmissions } from './src/storage/repositories/exam-submission.repository';
     const pending = await getPendingExamSubmissions('user-id');
     console.log(pending); // Should show 1 exam with syncStatus: PENDING
     ```

7. **Attempt Manual Sync (Optional)**
   - Tap "Sync Now" button (if available in History screen)
   - **Expected**: Error message "No internet connection" or "Sync failed, will retry automatically"

#### Success Criteria

- ✅ Exam submission succeeds while offline
- ✅ Exam stored in local SQLite database
- ✅ Sync status marked as `PENDING`
- ✅ No crashes or data loss
- ✅ User can view exam results locally

#### Troubleshooting

- **Error: "Failed to save exam"**
  - Check SQLite permissions
  - Verify `expo-sqlite` installed: `npx expo install expo-sqlite`

- **Exam not showing in History**
  - Check `getPendingExamSubmissions()` returns data
  - Verify History screen filters include `PENDING` submissions

---

### Scenario 3: Cloud Sync on Network Restore

**Objective**: Verify pending exams automatically sync to backend when network restores.

#### Steps

1. **Start with Pending Exams**
   - Complete Scenario 2 (Offline Exam Submission)
   - Verify at least 1 exam with `syncStatus: PENDING` exists

2. **Restore Network Connection**
   - **Android/iOS**: Disable Airplane Mode
   - **Verify**: Internet connection restored (open browser, load website)

3. **Trigger Automatic Sync**
   - **Option A**: Background sync (automatic)
     - Wait 30 seconds (app should auto-sync on network restore)
   - **Option B**: Manual trigger
     - Pull-to-refresh on History screen
     - Or tap "Sync Now" button

4. **Observe Sync Process**
   - **Expected**:
     - Loading indicator appears ("Syncing...")
     - Sync status updates in real-time
     - Success message: "X exams synced successfully"

5. **Verify Sync Status**
   - Navigate to **History** tab
   - Find the previously pending exam
   - **Expected**:
     - "Pending Sync" badge removed
     - "Synced" indicator/checkmark visible
     - SyncStatus: `SYNCED`

6. **Verify Backend Persistence**
   - **API Check** (via Postman or curl):
     ```bash
     curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
       http://localhost:3000/exam-attempts/my-history
     ```
   - **Expected**: Response includes the synced exam with `syncStatus: "SYNCED"`

7. **Check Database Consistency**
   - **Backend Database** (Prisma Studio or psql):
     ```sql
     SELECT * FROM "ExamAttempt" 
     WHERE "userId" = 'your-user-id' 
     ORDER BY "submittedAt" DESC LIMIT 1;
     ```
   - **Expected**: Exam record exists with correct score, duration, timestamps

#### Success Criteria

- ✅ Automatic sync triggers on network restore
- ✅ Pending exams transition to `SYNCED` status
- ✅ Backend database contains synced exams
- ✅ No duplicate submissions
- ✅ Sync completes within 5 seconds for typical batch (≤50 exams)

#### Troubleshooting

- **Sync not triggering automatically**
  - Check `NetInfo` listener: `import NetInfo from '@react-native-community/netinfo'`
  - Verify `syncPendingAttempts()` called on connectivity change
  - Manually trigger: `await examAttemptService.syncPendingAttempts(userId)`

- **Error: "Sync failed after 3 retries"**
  - Check API logs for errors (401 Unauthorized, 500 Server Error)
  - Verify JWT token is valid (not expired)
  - Check network logs: `npx react-native log-android` or `log-ios`

- **Exam shows "Synced" but not in backend**
  - Verify API endpoint: `POST /exam-attempts/submit-authenticated`
  - Check if exam marked synced prematurely (bug in `markExamSubmissionSynced`)
  - Inspect backend logs for request processing

---

### Scenario 4: Token Expiration & Automatic Refresh

**Objective**: Verify JWT tokens refresh seamlessly when expired, without user intervention.

#### Steps

1. **Sign In and Verify Initial Token**
   - Complete Scenario 1 (Google Sign-In)
   - Note the current time
   - **Developer Tools**:
     ```javascript
     import { getAccessToken } from './src/services/auth.service';
     const token = await getAccessToken();
     console.log('Initial Token:', token);
     ```

2. **Simulate Token Expiration** (Fast Testing)
   - **Option A**: Modify token expiry in backend
     - Edit `api/src/auth/services/jwt.service.ts`:
       ```typescript
       expiresIn: '30s' // Change from '1h' to 30 seconds
       ```
     - Restart API: `npm run start:dev`
   
   - **Option B**: Wait for natural expiration (1 hour)
     - Keep app running for 60+ minutes
     - Perform actions periodically to stay active

3. **Trigger Protected API Call**
   - After token expires (30s or 60min), perform an action requiring authentication:
     - Navigate to **Analytics** screen (calls `GET /exam-attempts/analytics/my-analytics`)
     - Or submit a new exam (calls `POST /exam-attempts/submit-authenticated`)

4. **Observe Token Refresh**
   - **Expected** (behind the scenes):
     - API returns `401 Unauthorized` (token expired)
     - Mobile app intercepts response
     - Automatic refresh: `POST /auth/refresh` with refresh token
     - New access token received and stored
     - Original request retried with new token
     - User sees no error (seamless experience)

5. **Verify New Token**
   - **Developer Tools**:
     ```javascript
     const newToken = await getAccessToken();
     console.log('Refreshed Token:', newToken);
     // Should be different from initial token
     ```

6. **Verify Refresh Token Rotation**
   - **Backend Logs** (check API console output):
     ```
     [AuthService] Token refresh successful for user: user-uuid-123
     [AuthService] New access token issued, expires at: 2026-02-14T10:30:00Z
     ```

7. **Test Multiple Requests**
   - Perform 3-5 actions requiring authentication
   - **Expected**: All requests succeed, no login prompts

#### Success Criteria

- ✅ Token expiration detected automatically
- ✅ Refresh token exchange succeeds
- ✅ New access token stored and used
- ✅ No user-facing errors or login prompts
- ✅ Token refresh completes within 500ms
- ✅ Refresh token rotates on each refresh (security best practice)

#### Troubleshooting

- **Error: "Session expired, please sign in again"**
  - Check refresh token expiration (should be 30 days)
  - Verify `POST /auth/refresh` endpoint works:
    ```bash
    curl -X POST http://localhost:3000/auth/refresh \
      -H "Content-Type: application/json" \
      -d '{"refreshToken": "YOUR_REFRESH_TOKEN"}'
    ```
  - If refresh token also expired, user must re-authenticate (expected behavior)

- **Infinite refresh loop**
  - Bug: Refresh logic might be triggering on every request
  - Check Axios interceptor: Should only refresh on 401, not on 200
  - Add logging: `console.log('Refreshing token...')` to detect loops

- **Token refresh fails with 403 Forbidden**
  - Refresh token might be invalid or revoked
  - Check backend: Refresh token exists in database and matches user

---

## Edge Cases & Negative Testing

### Edge Case 1: Multiple Failed Sync Attempts

**Objective**: Verify exponential backoff and max retry limit (12 attempts).

#### Steps

1. Sign in and complete 3 exams offline
2. Corrupt the API endpoint (e.g., change API_URL to invalid address)
3. Restore network and wait for sync attempts
4. **Expected**:
   - First retry: immediate
   - Second retry: 5 seconds delay
   - Third retry: 10 seconds delay
   - Fourth retry: 20 seconds delay
   - ... up to 12th retry
5. After 12 failed attempts, exams remain `FAILED` (not deleted)
6. User can manually retry later or contact support

---

### Edge Case 2: Concurrent Exam Submissions

**Objective**: Verify FIFO queue order is maintained.

#### Steps

1. Enable Airplane Mode
2. Complete 5 exams rapidly (within 1 minute)
3. Note submission timestamps
4. Restore network
5. **Expected**: Exams sync in submission order (oldest first)

---

### Edge Case 3: Sign Out While Pending Syncs

**Objective**: Verify pending exams persist after sign-out.

#### Steps

1. Complete 2 exams offline
2. Sign out (without syncing)
3. Sign in again (same Google account)
4. **Expected**: Previous pending exams appear in History, marked for sync

---

## Performance Benchmarks

### Cloud Sync Performance

- **Target**: <5 seconds for 50 exam submissions
- **Test**: Complete 50 exams offline, restore network, measure sync time
- **Tool**: Use `mobile/__tests__/performance.bench.ts` script

### Analytics Query Performance

- **Target**: <2 seconds for analytics calculation (100+ exams)
- **Test**: Query analytics endpoint after syncing large dataset
- **Tool**: Network tab in React Native Debugger

### Token Refresh Performance

- **Target**: <500ms for token refresh
- **Test**: Measure time from 401 response to retry with new token
- **Tool**: Axios interceptor logging

---

## Known Issues & Limitations

### Issue 1: Slow Sync on Poor Network

- **Symptom**: Sync takes >10 seconds on 2G network
- **Workaround**: User can manually pause/resume sync
- **Fix Planned**: Implement adaptive batch sizes (Phase 3)

### Issue 2: Token Refresh on App Startup

- **Symptom**: First API call after app launch might fail with 401
- **Workaround**: App automatically retries, user sees brief loading
- **Fix Planned**: Proactively refresh tokens on app startup (Phase 3)

---

## Test Completion Checklist

Mark each scenario as you complete testing:

- [ ] Scenario 1: Google Sign-In Flow
- [ ] Scenario 2: Offline Exam Submission
- [ ] Scenario 3: Cloud Sync on Network Restore
- [ ] Scenario 4: Token Expiration & Automatic Refresh
- [ ] Edge Case 1: Multiple Failed Sync Attempts
- [ ] Edge Case 2: Concurrent Exam Submissions
- [ ] Edge Case 3: Sign Out While Pending Syncs
- [ ] Performance Benchmark: Cloud Sync (<5s)
- [ ] Performance Benchmark: Analytics Query (<2s)
- [ ] Performance Benchmark: Token Refresh (<500ms)

---

## Reporting Issues

When reporting bugs or inconsistencies:

1. **Include**:
   - Device/emulator details (OS, version)
   - Steps to reproduce
   - Expected vs. actual behavior
   - Screenshots or screen recordings
   - Console logs (React Native Debugger)
   - API logs (backend console)

2. **Submit To**:
   - GitHub Issues: `https://github.com/your-repo/exam-app/issues`
   - Tag: `phase-2`, `testing`, `bug`

---

## Appendix: API Endpoints Reference

### Authentication Endpoints

```
POST   /auth/google/callback        # Exchange Google code for JWT tokens
GET    /auth/me                     # Get current user profile
POST   /auth/refresh                # Refresh access token
```

### Exam Attempts Endpoints

```
POST   /exam-attempts/submit-authenticated   # Submit exam (requires JWT)
GET    /exam-attempts/my-history             # Get user's exam history (paginated)
GET    /exam-attempts/:id                    # Get single exam attempt
GET    /exam-attempts/analytics/my-analytics # Get user analytics
```

---

**Last Updated**: 2026-02-14  
**Version**: Phase 2 (Authentication & Cloud Sync)  
**Maintainer**: Development Team
