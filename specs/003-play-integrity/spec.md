# Feature Specification: Play Integrity Guard

**Feature Branch**: `003-play-integrity`  
**Created**: February 15, 2026  
**Status**: Ready for Implementation  
**Prerequisites**: Phase 2 (002-cloudprep-mobile) ✅ Complete  
**Input**: Protect the paid app from sideloaded APK installs and tampered builds using Play Integrity API only, while preserving pure offline functionality and fast deployment.

## Overview

Play Integrity Guard adds a one-time app integrity verification on first launch using Google's Play Integrity API. The check confirms the app was installed from Google Play Store, that the app signature matches the release key, and that basic device integrity is intact. Once verified, the result is cached locally and the app only re-verifies on cold start if the cache is older than 30 days—preserving the fully offline experience. Sideloaded, re-signed, or tampered builds are blocked entirely. A development bypass ensures local builds work without Play Store installation during development.

**Phase 2 Foundation**: This feature builds on Phase 2's authentication and cloud sync infrastructure. The API endpoint architecture, mobile services patterns, and JWT token management established in Phase 2 provide the foundation for the backend integrity verification proxy. The offline-first architecture from Phase 1-2 is preserved—after initial verification, apps work identically to Phase 2 behavior.

## Dependencies

### Phase 2 (002-cloudprep-mobile) - ✅ COMPLETE

Play Integrity Guard extends the existing authentication architecture from Phase 2:

- **Mobile Services Architecture**: Follows patterns from `ExamAttemptService` and `AuthService` (TypeScript classes with async/await, error handling, logging)
- **API Module Structure**: New `/api/src/integrity/` module mirrors existing `/api/src/auth/` and `/api/src/exam-attempts/` structure
- **JWT Token Management**: Uses existing token storage patterns for secure API communication
- **Offline-First Design**: 30-day cache TTL aligns with Phase 2's offline queue and sync architecture—verification is a one-time check, not a continuous requirement
- **AsyncStorage Patterns**: Reuses Phase 2's token storage infrastructure for caching verification status

### External Services

- **Google Play Integrity API**: Nonce generation, token issuance, verdict decryption
- **Google Play Console**: API credentials and package name configuration
- **React Native Libraries**: `react-native-google-play-integrity` for native Android integration

### No Changes Required

- **Prisma Schema**: No database changes (verification is fully client-side with stateless backend proxy)
- **Existing Features**: All Phase 1-2 features unchanged (question bank, exam flow, analytics, cloud sync)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Legitimate Play Store User Launches App (Priority: P1)

As a user who purchased the app from Google Play, I want the app to verify my installation once and then never ask again, so that I can use the app fully offline without interruption.

**Why this priority**: This is the primary happy path. If this doesn't work seamlessly, every paying customer is impacted. The verification must be invisible—users should not notice any delay or friction.

**Independent Test**: Install the AAB release build from Google Play (or internal test track), launch the app, confirm it loads normally with no blocking screen, close and reopen the app with airplane mode on, confirm it still works.

**Acceptance Scenarios**:

1. **Given** a user installs the app from Google Play for the first time, **When** they launch the app, **Then** the app performs an integrity check in the background during the existing initialization flow and grants full access upon success.
2. **Given** verification has already succeeded, **When** the user launches the app again (even fully offline), **Then** the app skips integrity verification entirely and loads normally.
3. **Given** verification has already succeeded, **When** the user has no network connectivity on subsequent launches, **Then** the app functions identically to current behavior with full offline access.
4. **Given** the integrity check is in progress, **When** the user sees the initialization screen, **Then** verification runs concurrently with database setup and does not add noticeable delay beyond the existing 3-second launch target.

---

### User Story 2 - Sideloaded APK Is Blocked (Priority: P1)

As the app developer, I want sideloaded or re-distributed APKs to be blocked on launch, so that only users who purchased the app through Google Play can use it.

**Why this priority**: This is the core security requirement. Without this, the paid app can be freely pirated and distributed, destroying the revenue model.

**Independent Test**: Build a release APK, manually install it on a device via `adb install`, launch the app, and confirm it displays a blocking screen with instructions to download from Google Play.

**Acceptance Scenarios**:

1. **Given** a user installs the APK via sideloading (not from Google Play), **When** they launch the app, **Then** a full-screen blocking message is displayed: "For security reasons, this app must be downloaded from Google Play."
2. **Given** a user has a re-signed or tampered APK, **When** they launch the app, **Then** the integrity check fails and the same blocking message is shown.
3. **Given** the blocking screen is displayed, **When** the user taps a button, **Then** the button opens the Google Play Store listing for the app (if Play Store is available) or shows a message to search for the app on Play Store.
4. **Given** the blocking screen is displayed, **When** the user attempts to navigate or use any feature, **Then** no app functionality is accessible—no partial access, no preview mode.

---

### User Story 3 - Developer Builds Work Without Play Store (Priority: P1)

As a developer running the app locally during development, I want to bypass the integrity check automatically, so that I can test the app without needing Play Store installation.

**Why this priority**: Without this, development workflow is broken. Developers must be able to run debug builds locally via Expo or direct install. Equal priority to other stories because it is a prerequisite for developing and testing all other features.

**Independent Test**: Run `npx expo start` and launch the app on an emulator or physical device in development mode, confirm the app loads normally without any blocking screen.

**Acceptance Scenarios**:

1. **Given** the app is running in development mode (`__DEV__` is true), **When** the app launches, **Then** the integrity check is completely skipped and full access is granted.
2. **Given** the app is running in development mode, **When** the developer checks the console, **Then** a log message indicates integrity check was bypassed due to development mode.
3. **Given** the app is a release build installed from Play Store, **When** the app launches, **Then** the development bypass is not active and full integrity verification is performed.

---

### User Story 4 - Reinstall Requires Re-Verification (Priority: P2)

As the app developer, I want the integrity verification to reset when the app is reinstalled, so that a previously verified but now sideloaded copy cannot bypass the check.

**Why this priority**: Prevents a circumvention vector where someone backs up app data from a verified install and restores it onto a sideloaded copy. Lower priority because it's a secondary attack vector.

**Independent Test**: Install from Play Store, verify app works, uninstall, reinstall from Play Store, confirm integrity check runs again on first launch.

**Acceptance Scenarios**:

1. **Given** a user uninstalls and reinstalls the app, **When** they launch the reinstalled app, **Then** the integrity verification runs again as if it were the first launch.
2. **Given** verification data is stored locally, **When** the app is uninstalled, **Then** the verification cache is cleared along with all other app data.

---

### Edge Cases

- **No internet on first launch**: The integrity check fails (requires one-time network access). The app shows the message: "Please connect to the internet for first-time setup. A one-time connection is required." with a retry button. The app does not block permanently—once the user connects, they can retry.

- **Devices without Google Play Services** (e.g., Huawei): The integrity check fails. The blocking screen is shown. These devices cannot install from Google Play anyway, so this is expected behavior. The app is exclusively distributed through Google Play.

- **Google Play Integrity API temporarily unavailable**: Treat as a transient failure. Show a retry-friendly message: "Unable to verify your installation. Please check your internet connection and try again." with a retry button. Do not permanently block—allow the user to retry.

- **Local storage copied to another device**: The verification flag is stored in the app's private storage. On Android, this is sandboxed per-app and cannot be transferred without root access. For rooted devices, this is an accepted risk—Play Integrity's device integrity check will fail on most rooted devices.

- **Play Integrity token request succeeds but returns a negative verdict**: Treat as verification failure. Show the standard blocking screen.

- **Verdict field returns UNEVALUATED**: Treat as a transient failure (distinct from a definitive fail like UNLICENSED). Show the retry-friendly message, same as API unavailable. Do not cache the failure—allow the user to retry on next attempt.

## Requirements *(mandatory)*

### Functional Requirements

#### First Launch Verification

- **FR-001**: On first app launch (when no cached verification exists), the system MUST request a Play Integrity token from Google's Play Integrity API.
- **FR-002**: The system MUST validate the following fields from the integrity verdict:
  - App is recognized by Google Play (`appRecognitionVerdict` is `PLAY_RECOGNIZED` — this implicitly confirms the app signature matches the release signing key)
  - User installed or purchased the app from Google Play (`appLicensingVerdict` is `LICENSED`)
  - Device integrity is present (`deviceRecognitionVerdict` includes `MEETS_DEVICE_INTEGRITY`)
- **FR-003**: If all verification checks pass, the system MUST store `integrity_verified = true` and `verified_at = <timestamp>` in local storage.
- **FR-004**: If any verification check fails, the system MUST display a full-screen blocking message: "For security reasons, this app must be downloaded from Google Play."
- **FR-005**: The blocking screen MUST include a button to open the app's Google Play Store listing.
- **FR-006**: When blocked, the system MUST NOT allow access to any app functionality—no partial access, no preview mode, no navigation.

#### Subsequent Launches

- **FR-007**: On subsequent launches, if `integrity_verified == true` exists in local storage, the system MUST skip the integrity check entirely.
- **FR-008**: After successful verification, the app MUST function fully offline with no network dependency on any future launch.
- **FR-009**: The system MUST NOT perform background re-checks or revalidation while the app is running. On cold start, if the cached verification is older than 30 days (2592000 seconds from verified_at timestamp), the system MUST re-verify (requiring a one-time network connection). If re-verification fails with a transient error, the system MUST allow the user to retry while keeping cached access enabled. If re-verification fails with a definitive failure, the system MUST block access per FR-004.

#### Reinstallation Behavior

- **FR-010**: When the app is uninstalled and reinstalled, all local storage including the verification flag MUST be cleared, requiring a fresh integrity check on next launch.

#### Development Mode

- **FR-011**: When the app is running in development mode (`__DEV__` is true), the system MUST bypass the integrity check completely and grant full app access.
- **FR-012**: In development mode, the system MUST log a message to the console indicating the integrity check was bypassed.

#### Error Handling & Messaging

- **FR-013**: When the device has no internet on first launch, the system MUST display: "Please connect to the internet for first-time setup. A one-time connection is required." with a retry button.
- **FR-014**: When the Play Integrity API is temporarily unavailable (5xx error, timeout, or UNEVALUATED verdict), the system MUST display: "Unable to verify your installation. Please check your internet connection and try again." with a retry button. Retry attempts have no maximum limit; user can retry indefinitely with a 2-second delay between attempts.
- **FR-015**: When integrity verification fails definitively (UNLICENSED, UNRECOGNIZED_VERSION, or device integrity failure), the system MUST display the blocking message from FR-004 with NO retry button.
- **FR-016**: The integrity verification MUST run concurrently with other app initialization tasks (database setup, questions cache loading, etc.) using Promise.all() execution model to minimize perceived launch delay.

#### AWS Production Deployment

- **FR-017**: The backend API MUST be deployed to AWS App Runner with automatic scaling (min 1 instance, max 10 instances) and continuous deployment from the GitHub repository.
- **FR-018**: The production database MUST use AWS Aurora PostgreSQL Serverless v2 (min capacity: 0.5 ACU, max capacity: 2 ACU) with automatic backups enabled (1-day retention minimum).
- **FR-019**: Database credentials (host, port, username, password, database name) MUST be stored in AWS Secrets Manager and accessed via environment variables at runtime. No credentials MUST be committed to source code.
- **FR-020**: Non-sensitive configuration (JWT secret, Google OAuth client ID/secret, Play Integrity credentials) MUST be stored in AWS Systems Manager Parameter Store and loaded as environment variables.
- **FR-021**: The App Runner service MUST be deployed in a VPC with a VPC Connector that allows access to Aurora in private subnets (no public internet access to database).
- **FR-022**: The backend API MUST expose a health check endpoint (GET /health) that returns HTTP 200 when the service is operational and can connect to the database.
- **FR-023**: The mobile app MUST use environment-based API URL configuration: development mode (`__DEV__` true) connects to localhost, production builds connect to the AWS App Runner service URL.
- **FR-024**: Database migrations MUST be applied via `npx prisma migrate deploy` before deploying new App Runner revisions to ensure schema compatibility.
- **FR-025**: Production deployment documentation MUST include: infrastructure setup steps, database migration procedures, environment variable configuration, rollback procedures, and monitoring dashboard links.

### Key Entities

- **IntegrityStatus**: Represents the cached result of the Play Integrity verification. Stored in app-private local storage (SQLite or AsyncStorage). Attributes:
  - `integrity_verified` (boolean): Whether the device passed all integrity checks
  - `verified_at` (ISO 8601 timestamp): When the verification was performed
  - Cleared on app uninstall

- **IntegrityVerdict**: The decrypted result received from Google Play Integrity API. Contains:
  - `appRecognitionVerdict`: Whether app is recognized by Google Play (PLAY_RECOGNIZED, UNRECOGNIZED_VERSION, or UNKNOWN)
  - `appLicensingVerdict`: Whether user is licensed (LICENSED, UNLICENSED, or UNKNOWN)
  - `deviceRecognitionVerdict`: Device attestation result (MEETS_DEVICE_INTEGRITY, MEETS_STRONG_INTEGRITY, or UNKNOWN)
  - Not persisted—only used to extract pass/fail decision

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A sideloaded APK (installed via `adb install`) is blocked on launch 100% of the time on devices with Google Play Services.
- **SC-002**: A re-signed or tampered APK is blocked on launch 100% of the time.
- **SC-003**: App launch time with integrity check (first launch) does not exceed 5 seconds (P95 latency measured over 10 runs) on supported devices with stable internet.
- **SC-004**: App launch time on subsequent launches (cached verification) remains within the existing 3-second target (P95 latency)—no regression.
- **SC-005**: After successful first-launch verification, the app functions fully offline on all subsequent launches (zero network dependency on exam functionality).
- **SC-006**: Development builds (`__DEV__` mode) launch without any blocking or integrity prompts 100% of the time.
- **SC-007**: Reinstalling the app clears the verification cache and requires a fresh integrity check.
- **SC-008**: When Play Integrity API is unavailable on first launch, the user can retry verification without restarting the app.
- **SC-009**: The backend API deploys successfully to AWS App Runner and passes health checks within 5 minutes of deployment.
- **SC-010**: The Aurora PostgreSQL database accepts connections from the App Runner service through the VPC Connector with <100ms latency (P95).
- **SC-011**: All Prisma migrations apply successfully to the production Aurora database without errors.
- **SC-012**: The mobile app successfully connects to the production API (App Runner URL) and all endpoints respond with valid data.
- **SC-013**: Database credentials and sensitive configuration are never exposed in logs, source code, or error messages.

## Assumptions

- The app is distributed exclusively through Google Play Store as a paid app.
- Google Play Services are available on all target devices (implicit Google Play distribution requirement).
- The Play Integrity API is available via an Expo-compatible React Native library (e.g., `@react-native-google-signin/google-signin` or `expo-play-integrity`).
- The app uses Android App Bundle (AAB) format for Play Store distribution.
- Development mode is reliably detected via the `__DEV__` global in React Native.
- Local storage (SQLite via `expo-sqlite` or AsyncStorage) is sandboxed per-app by Android and cleared on uninstall.
- Play Integrity tokens are encrypted and can only be decoded server-side via Google's API. A thin backend endpoint (`POST /api/integrity/verify`) on the existing NestJS server acts as a stateless decryption proxy. Enforcement remains client-side—the backend does not gate any other API calls.
- Rooted devices that pass Play Integrity's basic device integrity check are acceptable (no MEETS_STRONG_INTEGRITY requirement).
- First-time internet requirement is acceptable since users download the app from Play Store (which requires internet).
- The mobile app is exam-type specific (e.g., AWS CCP) with a hardcoded `EXAM_TYPE_ID`, so Play Integrity is per-exam-app, not multi-app.
- **AWS Infrastructure**: The production backend will be deployed to AWS App Runner with Aurora PostgreSQL Serverless v2 in a VPC with private subnets. AWS services (Secrets Manager, Systems Manager Parameter Store, CloudWatch) are available in the target AWS region (default: us-east-1).
- **Database**: Aurora PostgreSQL is compatible with Prisma ORM and all existing migrations. The database will use standard PostgreSQL wire protocol (port 5432) for connections.
- **Secrets Management**: AWS Secrets Manager and Systems Manager Parameter Store are used for credential and configuration management. IAM roles for App Runner provide secure access without hardcoded keys.
- **Continuous Deployment**: GitHub integration with App Runner enables automatic deployments on push to the `003-play-integrity` branch. Build and deployment succeed within 5-10 minutes.
- **Cost**: Aurora Serverless v2 with 0.5-2 ACU and App Runner with 1 vCPU/2GB instance configuration stay within acceptable budget limits for a small-scale production deployment.

## Out of Scope

- Backend-side enforcement of integrity verdicts (the backend decrypts tokens but does not block API access based on verdict results)
- Google Play Billing or license verification (purchase status checking via Play Billing API)
- Periodic or background re-verification after initial check (cache-based approach only)
- iOS App Store verification or attestation (Android/Play Store only)
- Root detection beyond what Play Integrity provides
- Device-binding or hardware attestation
- Obfuscation or anti-reverse-engineering measures beyond integrity check
- Offline first-launch verification (one-time internet requirement is accepted)
- Admin portal changes or new endpoints for integrity management
- Multi-app integrity coordination
- Integrity API key/credential storage guidance (assumes Google Play Console service account configuration)
- **AWS Infrastructure (Out of Scope)**:
  - Multi-region deployment or global load balancing (single region: us-east-1)
  - Custom domain and SSL certificate management (uses default App Runner domain)
  - Advanced monitoring and alerting (CloudWatch dashboards not configured; basic logs only)
  - Auto-scaling policies beyond App Runner defaults (uses default scaling: min 1, max 10 instances)
  - Database read replicas or multi-AZ deployments (Aurora Serverless v2 handles availability automatically)
  - Infrastructure-as-Code (Terraform/CloudFormation) for automated provisioning (manual AWS Console setup accepted)
  - CI/CD pipelines for automated testing and deployment (manual deployment via GitHub integration accepted)
  - Blue-green or canary deployment strategies (App Runner instant deployment with rollback capability)
  - Cost optimization or reserved capacity planning (pay-as-you-go billing accepted)
