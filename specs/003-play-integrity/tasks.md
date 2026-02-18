# Tasks: Play Integrity Guard

**Input**: Design documents from `/specs/003-play-integrity/`  
**Prerequisites**:  
- ✅ Phase 2 (002-cloudprep-mobile) Complete - Authentication, cloud sync, JWT infrastructure
- ✅ Design: plan.md, spec.md, research.md, data-model.md, contracts/integrity-api.yaml  
**Status**: 📋 **READY FOR IMPLEMENTATION (40 tasks core T151–T205, +2 optional T189.5/T206)**

**Phase 2 Integration Notes**:  
- Uses existing mobile services architecture (Phase 2: ExamAttemptService, AuthService patterns)  
- Extends API module structure (Phase 2: auth/, exam-attempts/ → Phase 3: integrity/)  
- Leverages JWT token patterns for API communication  
- Preserves offline-first design from Phase 1-2

## Completion Summary

| Phase | Task Range | Count | Status | Duration |
|-------|-----------|-------|--------|----------|
| **Phase 1** | | | | |
| Setup | T151-T153 | 3 | 📋 Not Started | 2 hrs |
| Foundational | T154-T163 | 10 | 📋 Not Started | 4 hrs |
| **Phase 2** | | | | |
| US1: Play Store Happy Path | T164-T168 | 5 | 📋 Not Started | 6 hrs |
| US2: Sideload Blocking | T169-T173 | 5 | 📋 Not Started | 4 hrs |
| US3: Developer Bypass | T174-T177 | 4 | 📋 Not Started | 3 hrs |
| US4: Reinstall Reset | T178-T180 | 3 | 📋 Not Started | 2 hrs |
| **Phase 3** | | | | |
| Integration & Testing | T181-T188 | 8 | 📋 Ready | 6 hrs |
| Polish | T189-T190 | 2 | 📋 Ready | 2 hrs |
| **Phase 8** | | | | |
| Railway + Neon Deployment | T191-T205 | 15 | 📋 Ready | 8 hrs |
| **Phase 9 (Optional)** | | | | |
| Post-Launch Validation | T189.5, T206 | 2 | 📋 Optional | 3 hrs |
| **Total** | **T151–T205** + optional | **57** | **📋 READY** | **~38 hrs core (1-2 devs, 4 weeks)** |

---

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[ ]**: Checkbox to mark completion
- **[ID]**: Task identifier (T151–T190)
- **[P]**: Marker if parallelizable (different files, no blocking dependencies)
- **[Story]**: User story label (US1–US4)
- Include exact file paths in descriptions

## Path Conventions

- **api/**: Backend (NestJS + Prisma)
- **mobile/**: Mobile app (React Native + Expo)
- **specs/**: Feature documentation

---

## Phase 1: Setup (Project Initialization)

**Purpose**: Create structure and dependencies for Play Integrity integration

### Setup Tasks

- [x] T151 Create IntegrityStatus SQLite table migration in mobile/src/storage/migrations/ (add columns: `id TEXT PRIMARY KEY DEFAULT 'singleton'`, `integrity_verified BOOLEAN NOT NULL DEFAULT FALSE`, `verified_at TEXT NOT NULL`, `created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`, `updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`)
- [x] T152 [P] Create mobile/src/services/play-integrity.service.ts with stub functions for `checkIntegrity()`, `requestToken()`, `validateVerdict()`, `isCacheValid()`, `getCacheTTL()`
- [x] T153 [P] Create mobile/src/stores/play-integrity.store.ts with Zustand store for `integrityState`, `setIntegrityStatus()`, `clearIntegrityCache()` selectors

**Checkpoint**: Project structure in place for Phase 2 implementation

---

## Phase 2: Foundational (Core Infrastructure)

**Purpose**: Database schema, API module, and shared utility setup

### Mobile Foundational Tasks

- [x] T154 [P] Implement IntegrityStatusRepository in mobile/src/storage/repositories/integrity.repository.ts with methods: `getStatus()`, `saveStatus()`, `clearStatus()`, `checkCacheTTL()`
- [x] T155 Update mobile/src/storage/database.ts to initialize IntegrityStatus table on app startup in `initializeDatabase()` function
- [x] T156 [P] Create mobile/src/components/IntegrityBlockedScreen.tsx (full-screen blocking UI, "Get from Play Store" button, no navigation access)
- [x] T157 [P] Implement `__DEV__` bypass check in mobile/src/services/play-integrity.service.ts with console log: `[PlayIntegrity] Bypassed in development mode`

### Backend Foundational Tasks

- [x] T158 Create api/src/integrity/dto/verify-token.dto.ts with `VerifyTokenRequest` interface: `{ token: string }`
- [x] T159 [P] Create api/src/integrity/dto/integrity-verdict.dto.ts with `PlayIntegrityVerdict` interface per data-model.md
- [x] T160 Create api/src/integrity/integrity.service.ts stub with method `verifyToken(token: string): Promise<PlayIntegrityVerdict>`
- [x] T161 [P] Create api/src/integrity/integrity.controller.ts stub with `POST /api/integrity/verify` endpoint
- [x] T162 Create api/src/integrity/integrity.module.ts and register IntegrityModule in api/src/app.module.ts
- [x] T163 Add environment variable support for Google Play Console credentials in api/src/config/ (no actual credentials in code)

**Checkpoint**: Infrastructure ready; user story implementation can proceed

---

## Phase 3: User Story 1 - Legitimate Play Store User (Priority: P1) 🎯 MVP

**Goal**: User installs from Play Store, first launch verifies invisibly, subsequent launches cached—always offline-capable

**Independent Test**: Install from Play Store → app launches normally → airplane mode → relaunch → works offline

### Backend Tasks (US1)

- [x] T164 [P] [US1] Implement `verifyToken()` in api/src/integrity/integrity.service.ts: call Google Play Console API to decrypt token, extract verdict fields (`appRecognitionVerdict`, `appLicensingVerdict`, `deviceRecognitionVerdict`)
- [x] T165 [US1] Implement `POST /api/integrity/verify` endpoint in api/src/integrity/integrity.controller.ts: accept VerifyTokenRequest, return IntegrityVerdict (success: true) or error (success: false) with error message

### Mobile Tasks (US1)

- [x] T166 [US1] Implement `checkIntegrity()` in mobile/src/services/play-integrity.service.ts: on first launch, request token from Google Play Integrity API, call POST /api/integrity/verify, validate verdict (all pass → store cache with verified_at timestamp)
- [x] T167 [P] [US1] Implement cache validation in mobile/src/services/play-integrity.service.ts: check IntegrityStatus, if verified=true and verified_at < 30 days → skip verification, grant access. If verified_at >= 30 days (expired cache per FR-009) → re-verify using full checkIntegrity() flow from T166 (request new token, call API, validate verdict, update cache)
- [x] T168 [US1] Integrate integrity check into mobile/src/App.tsx: parallel Promise.all() with DB init and integrity check; if verification passes → render RootNavigator, else → hold init screen, app loads normally

**Checkpoint**: Play Store users can launch and verify; cached access works offline

---

## Phase 4: User Story 2 - Sideloaded APK Blocked (Priority: P1)

**Goal**: Sideloaded or re-signed APKs blocked on launch with clear user message and Play Store link

**Independent Test**: Build release APK → `adb install` (sideload) → blocking screen appears → taps "Open Play Store" → opens Play Store (or shows message)

### Backend Tasks (US2)

- [x] T169 [US2] Add error handling to api/src/integrity/integrity.service.ts: if Google API returns UNLICENSED, UNRECOGNIZED_VERSION, or device integrity fail → return verdict as-is (client interprets as block)

### Mobile Tasks (US2)

- [x] T170 [US2] Implement definitive failure detection in mobile/src/services/play-integrity.service.ts: if verdict contains UNLICENSED, UNRECOGNIZED_VERSION, or device fail → set error type: 'DEFINITIVE', return `{ verified: false, error: { type: 'DEFINITIVE', message: 'For security reasons, this app must be downloaded from Google Play.' } }`
- [x] T171 [US2] Update mobile/src/App.tsx to render IntegrityBlockedScreen when integrity check returns definitive failure (no RootNavigator access)
- [x] T172 [P] [US2] Implement "Open Play Store" button in mobile/src/components/IntegrityBlockedScreen.tsx: on press, navigate to Play Store (or show how-to message if unavailable) using `Linking.openURL()`
- [x] T173 [US2] Add error logging to mobile/src/services/play-integrity.service.ts: log definitive verdict details for debugging (don't expose to user)

**Checkpoint**: Sideloaded users blocked; no app access granted

---

## Phase 5: User Story 3 - Developer Bypass (Priority: P1)

**Goal**: Dev builds auto-bypass integrity check; developers can iterate locally via Expo without Play Store

**Independent Test**: `npx expo start` → launch on emulator → app loads normally → console shows "[PlayIntegrity] Bypassed in development mode"

### Mobile Tasks (US3)

- [x] T174 [US3] Enhance `checkIntegrity()` in mobile/src/services/play-integrity.service.ts to check `__DEV__` at start: if true, log message and return `{ verified: true, cachedResult: true }` immediately (skip all API calls)
- [x] T175 [P] [US3] Add console logging in mobile/src/services/play-integrity.service.ts: `[PlayIntegrity] Bypassed in development mode` when `__DEV__ == true`
- [x] T176 [P] [US3] Add fallback log in mobile/src/services/play-integrity.service.ts: `[PlayIntegrity] Checking cached integrity status...` and `[PlayIntegrity] Cache hit/miss` for debugging
- [x] T177 [US3] Update mobile/src/App.tsx initialization to continue even if integrity check returns dev bypass (no blocking, same as cache hit)

**Checkpoint**: Developers can run app locally via Expo without restrictions; iteration unblocked

---

## Phase 6: User Story 4 - Reinstall Reset (Priority: P2)

**Goal**: Uninstall + reinstall clears verification cache; fresh verification required on next launch

**Independent Test**: Take exam on verified install → uninstall → reinstall from Play Store → fresh verification required on launch

### Mobile Tasks (US4)

- [x] T178 [US4] Implement `clearStatus()` in mobile/src/storage/repositories/integrity.repository.ts: DELETE from IntegrityStatus table on app reinstall (verified through Android's app-data clear behavior—no explicit code needed, auto-handled by OS)
- [x] T179 [P] [US4] Add lifecycle hook in mobile/src/services/persistence.service.ts to check for version mismatch (if app major version changed, treat as fresh install, clear integrity cache)
- [x] T180 [US4] Document cache clearing behavior in mobile app: integrity status is per-device-installation, not per-user; uninstall → all app data cleared by OS → fresh verification on reinstall

**Checkpoint**: Reinstall resets verification; security maintained across installs

---

## Phase 7: Integration & Testing (Core Validation)

**Purpose**: Mobile-to-backend integration, E2E tests, performance validation

### Integration Testing Tasks

- [X] T181 [P] Create mobile/__tests__/play-integrity.service.test.ts: Jest unit tests for verdict parsing, cache TTL logic, definitive vs. transient error distinction (mock Google API responses, SQLite queries)
- [X] T182 [P] Create mobile/__tests__/play-integrity.e2e.test.ts: Detox E2E test for first-launch happy path (mock API, verify app launches normally)
- [X] T183 [P] Create mobile/__tests__/integrity-blocking.e2e.test.ts: Detox E2E test for sideload blocking scenario (mock UNLICENSED verdict, verify blocking screen appears)
- [X] T184 [P] Create mobile/__tests__/integrity-cached-launch.e2e.test.ts: Detox E2E test for cached launch (no API call, verify fast load <1s, airplane mode works)
- [X] T185 Create api/test/integrity.e2e-spec.ts: Supertest E2E tests for POST /api/integrity/verify endpoint (mock Google API, test success and error responses)
- [X] T186 [P] Add performance benchmarks to mobile/__tests__/integrity-performance.test.ts: measure first-launch with API (target <5s), cached-launch (target <3s), cache-hit query time (<10ms)
- [X] T187 [P] Create mobile/__tests__/dev-bypass.e2e.test.ts: Detox test confirming `__DEV__ == true` bypasses all checks, app loads normally
- [X] T188 [US4] Create mobile/__tests__/reinstall-reset.integration.test.ts: Jest test for cache clearing lifecycle (mock uninstall, verify IntegrityStatus cleared)

### Polish & Documentation Tasks

- [X] T189 Update specs/003-play-integrity/quickstart.md with test execution instructions: `npm test` commands, E2E setup, performance baseline measurement
- [X] T190 Code review checklist: verify no console logs in production builds, no hardcoded credentials, Play Integrity error messages match spec, all edge cases handled (network, UNEVALUATED, rooted devices)
- [ ] **T189.5** (Optional) Performance Regression Prevention: Document T186 baseline measurements (first-launch <5s P95, cache-launch <3s P95, cache-hit <10ms) and create CI/CD pipeline regression check (±10% threshold, flag at +20% degradation). Add to quickstart.md and consider adding to GitHub Actions workflow.

**Checkpoint**: All tests passing; performance targets met; documentation complete

---

## Phase 8: Railway + Neon Production Deployment (Cost-Efficient Infrastructure)

**Purpose**: Deploy backend API to Railway with Neon PostgreSQL serverless database for production (cost-optimized)

### Neon PostgreSQL Database Setup

- [ ] T191 Create Neon PostgreSQL project at https://neon.tech (free tier: 3 projects, 10 GB storage): project name `exam-app-prod`, database name `exam_app_prod`, auto-suspend inactive branches enabled (cost optimization)
- [ ] T192 [P] Configure Neon connection pooling: enable PgBouncer on branch (default: 10 connections), set max connections to 20; note the pooled connection string (ending in `-pooler.neon.tech`)
- [ ] T193 Create Neon read replica branch (optional, for backup/analytics): allows branching data without additional cost, enables quick rollback if needed
- [ ] T194 [P] Copy Neon connection string to secure location: format `postgresql://[user]:[password]@pgXXXX.neon.tech:5432/exam_app_prod?sslmode=require` (will be used as `DATABASE_URL` in Railway)
- [ ] T195 Test local Neon connection: `psql [connection-string]` to verify connection works (can be done from local machine or CI/CD)

### Database Migration & Setup Tasks

- [ ] T196 Update api/prisma/schema.prisma datasource to support `DATABASE_URL` environment variable (already supports env vars, verify `env("DATABASE_URL")` is set as datasource URL)
- [ ] T197 Create api/scripts/migrate-production.sh script: pull `DATABASE_URL` from environment, run `npx prisma migrate deploy` to apply all migrations to Neon
- [ ] T198 [P] Create api/scripts/seed-production.sh script: run `npx prisma db seed` to populate initial exam types and seed questions (configure for production environment)
- [ ] T199 Test database connection and migrations: from local machine, set `DATABASE_URL` to Neon connection string, run `npm run migrate:prod` to verify Prisma connects and migrations apply

### Railway Application Deployment

- [ ] T200 Create Railway project at https://railway.app: project name `exam-app-prod`, link GitHub repository `003-play-integrity` branch (Railway auto-deploys on push)
- [ ] T201 [P] Add Docker service to Railway: connect GitHub repo, set root directory to `api/`, enable automatic deployments (Railway auto-detects Node.js project)
- [ ] T202 Configure Railway environment variables: `NODE_ENV=production`, `DATABASE_URL` (Neon pooled connection string from T194), `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PLAY_INTEGRITY_CREDENTIALS`
- [ ] T203 [P] Configure Railway health check: set `PORT=3000`, create api/src/health/health.controller.ts with GET `/health` endpoint returning `{ status: 'ok' }` (Railway auto-detects port, enable Health Check in Railway dashboard)

### Mobile Configuration & Deployment Documentation

- [ ] T204 Update mobile/src/services/api.config.ts: add production API URL (Railway service URL from T200, e.g., `https://api.example.railway.app`), environment-based URL selection (`__DEV__` → localhost, production → Railway URL detected from environment or hardcoded for release builds)
- [ ] T205 Create specs/003-play-integrity/deployment-guide.md: document Neon setup (how to create project, get connection string), Railway deployment (connect GitHub, environment variables, auto-deploy on push), database migration steps, rollback procedure, monitoring (Railway dashboard, Neon dashboard, Docker logs)

**Checkpoint**: Backend API deployed to Railway, Neon PostgreSQL operational, mobile app configured with production API URL (~$10-20/month for Neon + Railway free tier, vs $200+/month for AWS)

---

## Phase 9 (Optional): Post-Launch Validation & Hardening

**Purpose**: Optional post-launch tasks for device security validation and observability improvements

- [ ] **T206** (Optional) Rooted Device Testing: Test Play Integrity API behavior on rooted devices with Magisk/SuperSU installed to validate that sideload blocking works as expected. Document findings: Does Play Integrity still detect rooting? Are rooted devices blocked properly? Update assumptions in spec.md if findings differ from expectations. Tools: BurpSuite for network inspection, Magisk Manager, LocalSocket proxy for Play Integrity token debugging.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion
- **User Stories (Phase 3-6)**: All depend on Foundational completion
  - US1 (Play Store, P1): Can start after Foundational
  - US2 (Blocking, P1): Can start after Foundational (builds on US1)
  - US3 (Dev Bypass, P1): Can start in parallel with US1/US2 (__DEV__ is independent)
  - US4 (Reinstall, P2): Depends on US1 (cache logic already implemented)
- **Integration (Phase 7)**: Depends on all user stories
- **Polish (Phase 7)**: Final cleanup
- **AWS Deployment (Phase 8)**: Depends on Integration & Polish (all tests passing, code production-ready)

### Parallel Opportunities

**Sprint 1 (Mobile Foundation)**: T151-T157 can be parallelized
- T152, T153 parallelizable (different files)

**Sprint 2 (Backend + Mobile)**: T154-T163 mostly sequential (T154, T156, T157, T158, T159 can be [P])

**Sprint 3 (User Stories)**: All tasks parallelizable **after Foundational**
- T164-T173: Backend US1-US2 can run in parallel (different endpoints)
- T166-T177: Mobile US1-US3 can run in parallel (different services/screens)
- T178-T180: US4 sequential, depends on US1 cache implementation

**Sprint 4 (Testing)**: T181-T190 mostly parallelizable ([P] marked for independent test files)

**Sprint 5 (AWS Deployment)**: T191-T205 sequential AWS infrastructure setup
- T192, T194, T198, T201, T203 can be [P] after their dependencies complete
- AWS infrastructure (T191-T195) must complete before App Runner deployment (T200-T203)

### Recommended Execution (2 Developers)

**Week 1**:
- Dev A: T151-T157 (Setup + Mobile foundational)
- Dev B: T158-T163 (Backend foundational)
- Sync: Verify interfaces match

**Week 2**:
- Dev A: T166-T177 (Mobile US1-US3)
- Dev B: T164-T165, T169-T170 (Backend US1-US2)
- Mid-week: Integration testing (T164-T170 endpoints with T166-T177 mobile)

**Week 3**:
- Dev A: T181-T184, T187-T188 (Mobile E2E tests)
- Dev B: T178-T180, T185-T186 (US4, backend tests, performance)
- Final: T189-T190 (Polish, docs, review)

**Week 4**:
- DevOps/Dev A: T191-T195 (AWS infrastructure: Aurora, Secrets Manager, VPC Connector)
- Dev B: T196-T199 (Database migration scripts, seed scripts, connection testing)
- Final: T200-T205 (App Runner deployment, health checks, mobile API config, deployment docs)

---

## Success Criteria (Acceptance)

Each task is complete when:

1. **Code**: Compiles, TypeScript strict mode, no linting errors
2. **Tests**: Pass (unit tests run, E2E tests green, performance targets met)
3. **Spec Compliance**: Implements required FR-XXX from spec.md
4. **File Paths**: Exactly match paths specified in task description

---

## Testing Strategy by Phase

| Phase | Test Type | Tool | Coverage |
|-------|-----------|------|----------|
| **T151-T157** | Unit | Jest | Schema, store selectors |
| **T158-T163** | Unit | Jest | DTO validation, module import |
| **T164-T177** | Unit + E2E | Jest + Detox + Supertest | All verdicts, bypass, blocking, caching |
| **T178-T180** | Integration | Jest mock | Cache lifecycle, reinstall reset |
| **T181-T188** | E2E + Performance | Detox + Supertest | All 4 user stories, launch time <5s / <3s |
| **T189-T190** | Documentation | Manual review | Quickstart executable, checklist verified |

---

## Risk Mitigation During Implementation

| Risk | Task Range | Mitigation |
|------|-----------|------------|
| Google API decryption fails | T164-T165 | Mock responses in dev; test with test tokens from Google |
| Cache TTL calculation wrong | T166-T167 | Unit test with various timestamps; verify ISO8601 parsing |
| Sideload still gets access | T169-T173 | Test with actual `adb install` and verify blocking screen |
| Dev bypass leaks to production | T174-T177 | Verify `__DEV__ == false` in release builds; add CI check |
| Performance regression | T186 | Measure baseline before T166, compare after; profile with Detox |
| Network failure on first launch | T166 | Test with airplane mode + no cached status; show transient error UI |

---

## Checklist Template (Copy & Use)

```markdown
### Task [TID]: [Title]

- [ ] Code written in [file path]
- [ ] Tested: [test file] passes
- [ ] TypeScript strict: yarn tsc --noEmit passes
- [ ] Linting: yarn lint passes
- [ ] Spec compliance: Implements [FR-XXX]
- [ ] Documentation: Updated if needed
- [ ] Reviewed: Code style, edge cases
```

---

## Notes for Implementers

1. **No Prisma changes**: This feature adds zero database tables to PostgreSQL. All state is mobile-local (SQLite).
2. **Backend is stateless**: The /api/integrity/verify endpoint decrypts tokens and returns verdicts. It does NOT enforce verdicts, store results, or modify user data.
3. **Client-side enforcement**: The mobile app makes all block/allow decisions. Integrity is a permission gate, not a server-side policy.
4. **Backward compatible**: Phase 2 (auth, sync) is completely unaffected. Users already using the app see no change in behavior on initial launch.
5. **Test with mocks first**: Use mock Google API responses in unit/E2E tests before connecting to real API. Reduces test flakiness.
6. **Performance is critical**: Launch time targets (SC-003, SC-004) must be verified on actual hardware. Emulator numbers may differ.

---

## Validation Commands (Run After Each Phase)

```bash
# Setup complete
cd mobile && npm run build
cd api && npm run build

# Foundational complete
cd mobile && npm test -- play-integrity
cd api && npm test -- integrity

# User stories complete
cd mobile && npm run test:e2e -- play-integrity
cd api && npm run test:e2e -- integrity

# All complete
yarn workspaces run test
chmod +x scripts/validate-spec-003.sh && ./scripts/validate-spec-003.sh
```

