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
- **FR-014**: When the Play Integrity API is temporarily unavailable (5xx error, timeout, or UNEVALUATED verdict), the system MUST:
  1. Display a retry-friendly dialog: "Unable to verify your installation. Please check your internet connection and try again."
  2. Show a "Retry" button that re-invokes the integrity check without closing the app
  3. Show a "Continue Offline" button (if cached verification exists and is not expired) that grants temporary app access
  4. If no cached verification exists, show "Retry" button only—do not allow offline access on first launch
  5. Implement exponential backoff for automatic retries: 2s, 4s, 8s, 16s between attempts (max 5 automatic retries before showing manual retry button)
  6. Do not permanently block access during transient failures; allow user to retry indefinitely
- **FR-015**: When integrity verification fails definitively (UNLICENSED, UNRECOGNIZED_VERSION, or device integrity failure), the system MUST display the blocking message from FR-004 with NO retry button.
- **FR-016**: The integrity verification MUST run concurrently with other app initialization tasks (database setup, questions cache loading, etc.) using Promise.all() execution model to minimize perceived launch delay.

#### Production Deployment (Railway + Neon)

- **FR-017**: The backend API MUST be deployed to Railway with automatic continuous deployment from the GitHub repository (`003-play-integrity` branch). Railway auto-detects Node.js projects and manages scaling automatically.
- **FR-018**: The production database MUST use Neon PostgreSQL serverless with connection pooling enabled (PgBouncer, default 10-20 max connections) and auto-suspend enabled for cost optimization. Automatic backups retained for 7 days (free tier default).
- **FR-019**: Database credentials (connection string with host, port, username, password, database name) MUST be provided via Railway environment variables (DATABASE_URL). No credentials MUST be committed to source code.
- **FR-020**: Non-sensitive configuration (JWT secret, Google OAuth client ID/secret, Play Integrity credentials) MUST be configured as Railway environment variables and accessed at runtime. Railway dashboard provides secure configuration UI.
- **FR-021**: The Neon PostgreSQL connection string includes SSL requirement (sslmode=require) for transit security. No manual VPC setup required—Neon provides built-in connection pooling and Railway manages networking automatically.
- **FR-022**: The backend API MUST expose a health check endpoint (GET /health) that returns HTTP 200 with JSON status when the service is operational and can connect to the database. Railway auto-detects health endpoints.
- **FR-023**: The mobile app MUST use environment-based API URL configuration: development mode (`__DEV__` true) connects to localhost, production builds connect to the Railway service URL (auto-generated: `https://api-[hash].railway.app`).
- **FR-024**: Database migrations MUST be applied via `npx prisma migrate deploy` before deploying new Railway revisions to ensure schema compatibility. Can be automated in Dockerfile or run manually before deployment.
- **FR-025**: Production deployment documentation MUST include: Neon PostgreSQL setup steps (project creation, connection string, pooling config), Railway deployment process (GitHub integration, environment variables), database migration procedures, rollback procedures (Railway instant rollback, Neon branch management), and monitoring (Railway logs dashboard, Neon metrics dashboard).

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

## Terminology Glossary

This glossary standardizes terminology used throughout the specification to ensure consistency and prevent miscommunication:

- **Integrity Verification** (primary term): The complete process of requesting, receiving, and validating the Play Integrity verdict. Synonym: "integrity check."
- **Integrity Verdict**: The decrypted response from Google's Play Integrity API containing app recognition, licensing, and device integrity verdicts.
- **Verify/Validation** (vs. other usage): Confirming that the integrity verdict meets the acceptance criteria (all three checks PASS). Synonym: "extract verdict" (determining the pass/fail result).
- **Caching**: Storing the result of a successful integrity check in local device storage (`IntegrityStatus`) for 30 days to minimize repeated verification requests.
- **Transient Failure/Error**: Temporary unavailability of the Play Integrity API (5xx, timeout, or UNEVALUATED verdict). Recovery: user retries manually or via automatic backoff.
- **Definitive Failure/Error**: Permanent integrity failure (UNLICENSED, UNRECOGNIZED_VERSION, UNKNOWN device integrity). Recovery: None—app is blocked.
- **Sideloaded APK**: App installation from outside Google Play Store (manually copied, alternative app store, or re-signed APK).
- **Integrity Check Bypass** (for development): Special code path that skips Play Integrity verification during local/dev builds (`__DEV__ === true`).
- **Cold Start**: App launch immediately after installation or after clearing app data/cache.
- **Cache Hit**: App launch when cached verification exists and is within 30-day TTL.
- **Cache Miss**: App launch when cached verification is expired or non-existent—requires fresh integrity check.

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
- **SC-009**: The backend API service deploys successfully and accepts HTTP requests within 5 minutes of deployment, with health check endpoint returning 200 status. *(Current implementation: Railway with GitHub auto-deploy; see deployment-guide.md for platform-specific setup)*
- **SC-010**: The PostgreSQL database accepts connections with <100ms query response latency (P95) for typical exam question lookups. *(Current implementation: Neon with connection pooling; see deployment-guide.md for connection optimization)*
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
- **Production Infrastructure**: The production backend will be deployed to Railway with Neon PostgreSQL serverless database. Railway handles automatic scaling and container orchestration. Neon provides PostgreSQL with built-in connection pooling (PgBouncer).
- **Database**: Neon PostgreSQL is fully compatible with Prisma ORM and all existing migrations. The database uses standard PostgreSQL wire protocol (port 5432) with SSL encryption (sslmode=require). Connection pooling is enabled by default.
- **Configuration Management**: Railway environment variables dashboard provides secure configuration UI. No AWS Secrets Manager or Parameter Store needed; Railway stores and encrypts all environment variables server-side.
- **Continuous Deployment**: GitHub integration with Railway enables automatic deployments on push to the `003-play-integrity` branch. Build and deployment succeed within 2-3 minutes. Railway automatically detects Node.js projects and creates Docker containers.
- **Cost Optimization**: Free tier includes Neon (10GB storage, auto-suspend, free backups) and Railway (512MB RAM, 100GB bandwidth/month). Total cost: ~$0-20/month (vs. ~$200+/month for AWS). Upgrade only if exceeding free tier limits.

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
- **Deployment Infrastructure (Out of Scope)**:
  - Multi-region deployment or global load balancing (single region deployment via Railway accepted)
  - Custom domain and SSL certificate management (uses Railway-provided domain; custom domains out of scope)
  - Advanced crash analytics and monitoring dashboards (Railway logs dashboard and Neon metrics dashboard only; Sentry/Datadog out of scope)
  - Infrastructure-as-Code (Terraform/Infrastructure provisioning) for automated setup (manual setup via Railway/Neon dashboards accepted)
  - Advanced CI/CD pipelines beyond GitHub integration (GitHub → Railway auto-deploy sufficient; GitLab CI/GitHub Actions workflows out of scope)
  - Canary or blue-green deployment strategies (Railway instant rollback capability sufficient; complex strategies out of scope)
  - Database read replicas or advanced clustering (Neon auto-suspend and single-database approach sufficient)

---

## Phase 4: Multi-App Monorepo Architecture

**Status**: 📋 Ready for Implementation  
**Prerequisites**: Phase 3 (003-play-integrity Phases 1-8) ✅ Complete  
**Input**: Transform the single-app project into a monorepo that produces multiple Play Store apps from one shared codebase, eliminating code duplication across exam types.

### Overview

The current architecture already supports multi-tenancy on the backend (ExamType entity, domain-per-exam-type, admin portal with ExamTypeSwitcher). However, the mobile app (`mobile/`) is a single Expo project hardcoded to `EXAM_TYPE_ID = 'CLF-C02'`. To ship multiple exam apps (AWS SAA, GCP ACE, Azure AZ-900, etc.), the naive approach of cloning `mobile/` per exam would create an 10x maintenance burden, exponential testing, and version drift across clones.

Phase 4 refactors the project into an npm workspaces monorepo where shared mobile code lives in `packages/shared/` and each exam app is a thin wrapper in `apps/{exam-id}/` containing only config, branding, and assets. The backend and admin portal remain unchanged structurally, but the admin portal gains ExamType CRUD so new exams can be created without developer intervention.

**Key Outcome**: Adding a new exam app takes ~30 minutes (admin creates ExamType + developer runs `create-app` script) instead of days of cloning and modifying. Bug fixes and features propagate instantly to all apps.

### Dependencies

#### Phase 3 (003-play-integrity) - Prerequisite

- ✅ All Phase 1-8 tasks (T151-T205) complete
- ✅ Play Integrity Guard fully operational
- ✅ Railway + Neon production deployment operational
- ✅ All existing tests passing

#### External

- **npm workspaces**: Built-in to npm 7+, no additional tooling needed
- **Expo monorepo support**: Expo SDK 50+ fully supports monorepo configurations with Metro bundler
- **EAS Build**: Supports building individual apps within a monorepo

#### No Changes Required

- **Prisma Schema**: Zero database schema changes. ExamType model already supports multi-tenant. No new tables, no migrations.
- **Backend API Endpoints**: Public endpoints (`GET /exam-types/{id}`, `GET /exam-types/{id}/questions`) already work for any exam type. No changes to business logic.
- **Play Integrity Guard**: Integrity verification is device-scoped and app-independent. Each app wrapper inherits the same Play Integrity service from shared code.
- **Authentication & Cloud Sync**: Phase 2 auth/sync infrastructure works identically for all exam apps.

### User Scenarios & Testing

#### User Story 5 - Admin Creates New Exam Type via Portal (Priority: P1)

As an admin, I want to create a new exam type through the admin portal with its domains, passing score, and configuration, so that new exam apps can be launched without code changes to the backend.

**Why this priority**: This unblocks the entire multi-app workflow. Without admin-managed exam types, every new exam requires manual database seeding by a developer.

**Independent Test**: Log in to admin portal → navigate to Exam Types → click "Create Exam Type" → fill in form (id: `SAA-C03`, name: `AWS Solutions Architect Associate`, domains, passing score 72%, time limit 130 min) → submit → verify exam type appears in list and is accessible via `GET /exam-types/SAA-C03` API.

**Acceptance Scenarios**:

1. **Given** an admin is logged in, **When** they navigate to the Exam Types page, **Then** they see a list of all exam types with a "Create New" button.
2. **Given** the admin clicks "Create New", **When** the ExamType form loads, **Then** it displays fields for: ID (text), name, displayName, description, passingScore, timeLimit, questionCount, and a dynamic domain editor.
3. **Given** the admin fills in all required fields and at least one domain, **When** they submit the form, **Then** the exam type is created in the database and appears in the list.
4. **Given** the admin enters an ID that already exists, **When** they submit, **Then** the form shows a validation error without creating a duplicate.
5. **Given** an exam type is created, **When** a mobile app configured with that exam type ID makes API calls, **Then** the API returns the correct configuration and empty question bank.

---

#### User Story 6 - Developer Creates New App from Shared Code (Priority: P1)

As a developer, I want to create a new exam app by running a single script and providing only exam-specific config and branding, so that new app creation takes less than 30 minutes.

**Why this priority**: This is the core engineering outcome. If creating new apps still requires extensive manual work, the monorepo architecture fails to deliver its value.

**Independent Test**: Run `npm run create-app -- --exam-type SAA-C03 --name "Dojo Exam SAA" --package com.danilocasim.dojoexam.saac03"` → verify `apps/aws-saa/` is created with correct config → run `cd apps/aws-saa && npx expo start` → app launches and connects to backend → displays empty question bank (no questions for SAA-C03 yet).

**Acceptance Scenarios**:

1. **Given** a developer runs the create-app script with valid parameters, **When** the script completes, **Then** a new directory `apps/{app-name}/` is created with app.json, App.tsx, config, and placeholder assets.
2. **Given** the new app is created, **When** the developer runs `npx expo start` from the app directory, **Then** the app launches using shared code from `packages/shared/` and displays the correct exam type name.
3. **Given** the new app imports shared code, **When** a bug is fixed in `packages/shared/`, **Then** the fix is immediately available to all apps without any additional action.
4. **Given** a new app is created, **When** compared to the existing AWS CLP app, **Then** all screens, components, and services function identically—only the exam type ID, app name, and branding differ.

---

#### User Story 7 - All Apps Share Bug Fixes Instantly (Priority: P1)

As a developer maintaining multiple exam apps, I want all apps to automatically receive bug fixes and feature updates from shared code, so that I only fix bugs once and the maintenance burden remains at 1x regardless of app count.

**Why this priority**: Without code sharing, 10 apps = 10x maintenance. This story validates that the monorepo architecture achieves its primary goal of 1x maintenance.

**Independent Test**: Introduce an intentional bug in `packages/shared/src/components/QuestionCard.tsx` → verify the bug appears in ALL apps (aws-clp, aws-saa) → fix the bug in shared → verify ALL apps are fixed with a single change.

**Acceptance Scenarios**:

1. **Given** shared code is modified, **When** any individual app is run, **Then** it immediately uses the updated shared code without any manual sync, copy, or version bump.
2. **Given** 5 exam apps exist, **When** a developer runs `npm test` from the root, **Then** ALL apps' tests run against the same shared code.
3. **Given** a developer updates a shared component, **When** they build any individual app, **Then** only that app's build runs (not all apps), while still using the latest shared code.

---

#### User Story 8 - Per-App Branding and Identity (Priority: P2)

As a user browsing the Play Store, I want each exam app to have a distinct name, icon, and description, so that I can easily find and distinguish between different certification exam prep apps.

**Why this priority**: Important for Play Store presence but does not affect core functionality. Can use placeholder branding initially and refine later.

**Independent Test**: Build both aws-clp and aws-saa apps → install both on a device → verify they appear as separate apps with different names and icons in the app drawer.

**Acceptance Scenarios**:

1. **Given** two apps are built, **When** both are installed on the same device, **Then** they appear as separate applications with distinct names and icons.
2. **Given** each app has its own `app.json`, **When** the app launches, **Then** it shows the correct splash screen and branding for that exam type.
3. **Given** each app has a unique Android package name, **When** published to Play Store, **Then** they appear as completely independent listings.

---

#### User Story 9 - Admin Edits Existing Exam Type (Priority: P2)

As an admin, I want to edit an existing exam type's configuration (domains, passing score, time limit), so that I can update exam parameters as certifications evolve without requiring developer intervention.

**Why this priority**: Certifications change their exam structure periodically. Admin-editable exam types ensure the system stays current without code deployments.

**Acceptance Scenarios**:

1. **Given** an exam type exists, **When** the admin navigates to its detail page, **Then** they see an "Edit" button that opens the form pre-filled with current values.
2. **Given** the admin modifies domain weights, **When** they submit, **Then** the updated domains are saved and immediately reflected in API responses.
3. **Given** the admin wants to retire an exam type, **When** they toggle the isActive flag to false, **Then** mobile apps for that exam type stop receiving new questions and the exam type is hidden from the admin list (unless an "include inactive" filter is applied).

### Requirements

#### Functional Requirements: Monorepo Structure

- **FR-026**: The project MUST use npm workspaces for monorepo package management. The root `package.json` MUST define `workspaces` pointing to `packages/*` and `apps/*`.
- **FR-027**: All shared mobile code (components, services, stores, storage, screens, navigation) MUST be extracted into `packages/shared/` as a workspace package named `@exam-app/shared`.
- **FR-028**: Each exam app MUST be a thin wrapper in `apps/{app-name}/` containing ONLY: `app.json` (app identity), `App.tsx` (root component importing shared), `src/config/` (EXAM_TYPE_ID and branding), `assets/` (icons, splash), and `package.json` (declaring `@exam-app/shared` as dependency).
- **FR-029**: Metro bundler MUST be configured per-app to resolve `@exam-app/shared` from the workspace root using `metro.config.js` with `watchFolders` and `nodeModulesPaths`.
- **FR-030**: ALL existing tests (unit, integration, E2E, performance) MUST pass after monorepo migration with zero code logic changes. Only import paths may change.

#### Functional Requirements: Admin Portal - ExamType CRUD

- **FR-031**: The admin portal MUST provide a page listing all exam types with "Create New" and "Edit" actions.
- **FR-032**: The admin portal MUST provide a form for creating a new exam type with fields: `id` (required, unique, alphanumeric + hyphens), `name` (required, min 3 chars), `displayName` (required), `description` (optional), `passingScore` (required, 0-100), `timeLimit` (required, minutes), `questionCount` (required, 1-500).
- **FR-033**: The admin portal MUST provide a dynamic domain editor allowing admins to add, remove, and reorder domains. Each domain has: `id` (required, unique within exam type), `name` (required), `weight` (required, 0-100, all weights must sum to 100), `questionCount` (required, integer).
- **FR-034**: The backend MUST expose `POST /admin/exam-types` to create a new exam type. Request body matches the ExamType schema. Returns 201 on success, 409 on duplicate ID.
- **FR-035**: The backend MUST expose `PUT /admin/exam-types/:id` to update an existing exam type (all fields except `id`). Returns 200 on success, 404 if not found.
- **FR-036**: The backend MUST expose `PATCH /admin/exam-types/:id` to toggle `isActive` for soft-delete/reactivation. Returns 200 on success.
- **FR-037**: All admin exam type endpoints MUST require JWT authentication (using existing `JwtAuthGuard`).

#### Functional Requirements: App Wrapper Configuration

- **FR-038**: Each app's `app.json` MUST have a unique `android.package` (e.g., `com.danilocasim.dojoexam.{examid}`) and `ios.bundleIdentifier`.
- **FR-039**: Each app's `App.tsx` MUST import and render the shared `AppRoot` component from `@exam-app/shared`, passing `examTypeId` and optional branding overrides as props.
- **FR-040**: The shared `AppRoot` MUST accept `examTypeId: string` as a required prop and use it to configure all API calls, question syncing, and exam flow.
- **FR-041**: EAS Build configuration MUST support per-app builds using `eas.json` in each app directory with unique `projectId` and build profiles.

#### Functional Requirements: Build System & Tooling

- **FR-042**: A `scripts/create-app.sh` (or equivalent) MUST exist to scaffold a new app from a template. Required parameters: exam type ID, app display name, Android package name. The script MUST generate all required files from the template.
- **FR-043**: Build scripts MUST support building a single app (`npm run build --workspace=apps/aws-clp`) or all apps (`npm run build:all`).
- **FR-044**: The existing `apps/aws-clp/` app (migrated from `mobile/`) MUST produce an identical APK/AAB to the current `mobile/` build. Zero functional regression.
- **FR-045**: TypeScript path aliases MUST resolve `@exam-app/shared` correctly in all apps, tests, and IDE tooling.

### Key Entities (Phase 4 additions)

- **AppConfig**: Per-app configuration stored in `apps/{app-name}/src/config/app.config.ts`. Contains `EXAM_TYPE_ID`, app-specific branding (colors, theme), and API URL overrides. Imported by the app's `App.tsx` and passed to shared code.

- **AppTemplate**: Skeleton in `apps/template/` used by `create-app` script to generate new apps. Contains placeholder values (e.g., `__EXAM_TYPE_ID__`, `__APP_NAME__`, `__PACKAGE_NAME__`) that are replaced during generation.

### Phase 4 Out of Scope

- Advanced monorepo tooling (Turborepo, Nx, Lerna) — npm workspaces is sufficient for this project size
- Automated Play Store deployment (manual upload of AAB per app)
- Cross-app shared user accounts (each app is independent; users purchase separately)
- White-labeling or runtime theme switching (branding is set at build time only)
- Shared analytics dashboard across apps (each app tracks independently)
- iOS App Store deployment (Android/Play Store only in current scope)
- Automated icon/splash screen generation from templates (manual asset creation per app)
- Monorepo CI/CD with app-specific change detection (all apps rebuild on shared code changes)
