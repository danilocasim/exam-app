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
| Railway + Neon Deployment | T191-T205 | 15 | ✅ Complete | 8 hrs |
| **Phase 9 (Optional)** | | | | |
| Post-Launch Validation | T189.5, T206 | 2 | 📋 Optional | 3 hrs |
| **Phase 4: Multi-App Monorepo** | | | | |
| Phase 10: Monorepo Foundation | T207-T214 | 8 | 📋 Not Started | 6 hrs |
| Phase 11: App Wrapper Migration | T215-T220 | 6 | ✅ Complete | 5 hrs |
| Phase 12: Template & Script | T221-T224 | 4 | � In Progress | 3 hrs |
| Phase 13: Admin CRUD Backend | T225-T230 | 6 | 📋 Not Started | 5 hrs |
| Phase 14: Admin CRUD Frontend | T231-T238 | 8 | 📋 Not Started | 6 hrs |
| Phase 15: Testing & Docs | T239-T246 | 8 | 📋 Not Started | 6 hrs |
| **Total** | **T151–T246** + optional | **97** | **📋 READY** | **~69 hrs core (1-2 devs, 8-9 weeks)** |

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
- [X] **T189.5** (Optional) Performance Regression Prevention: Document T186 baseline measurements (first-launch <5s P95, cache-launch <3s P95, cache-hit <10ms) and create CI/CD pipeline regression check (±10% threshold, flag at +20% degradation). Add to quickstart.md and GitHub Actions workflow (.github/workflows/test.yml). Created .performance-baseline.json for baseline tracking.

**Checkpoint**: All tests passing; performance targets met; documentation complete; CI/CD regression checks configured

---

## Phase 8: Railway + Neon Production Deployment (Cost-Efficient Infrastructure)

**Purpose**: Deploy backend API to Railway with Neon PostgreSQL serverless database for production (cost-optimized)

### Neon PostgreSQL Database Setup

- [X] T191 Create Neon PostgreSQL project at https://neon.tech (free tier: 3 projects, 10 GB storage): project name `exam-app-prod`, database name `exam_app_prod`, auto-suspend inactive branches enabled (cost optimization). See [t191-neon-setup.md](t191-neon-setup.md) for step-by-step guide. Connection test: `DATABASE_URL="..." ./scripts/verify-neon-connection.sh`.
- [X] T192 [P] Configure Neon connection pooling: PgBouncer enabled (pool size: 10, max connections: 20, transaction mode). Pooled connection string configured in `.env.local`. See [t192-connection-pooling.md](t192-connection-pooling.md) for detailed configuration and verification steps.
- [X] T193 Create Neon read replica branch (optional, for backup/analytics): Guide created ([t193-read-replica.md](t193-read-replica.md)), .env.read-replica.example added. Manual step in Neon console. No code changes required.
- [X] T194 [P] Copy Neon connection string to secure location: pooled connection string in `.env.local` and `.env.production.example`. Format: `postgresql://[user]:[password]@[host]-pooler.c-X.region.aws.neon.tech/[db]?sslmode=require&channel_binding=require`
- [X] T195 Test local Neon connection: Prisma connection test successful via pooled connection string in `.env.local`. Run: `source .env.local && cd api && npx prisma db execute --stdin < /dev/null`

### Database Migration & Setup Tasks

- [X] T196 Update api/prisma/schema.prisma datasource to support `DATABASE_URL` environment variable: Verified Prisma 7+ config—`prisma.config.ts` loads from env, schema.prisma has no url property. Fully compliant.
- [X] T197 Create api/scripts/migrate-production.sh script: Script created, applies all migrations to Neon using pooled connection. Checks env, dependencies, migration status.
- [X] T198 [P] Create api/scripts/seed-production.sh script: Script created, runs `npx prisma db seed` for initial data. Skips if already seeded, verifies data after run.
- [X] T199 Test database connection and migrations: All migrations applied, seed script run, and data verified in Neon. Prisma CLI and client both confirm correct schema and data.

### Railway Application Deployment

- [X] T200 Create Railway project at https://railway.app: project name `exam-app-prod`, link GitHub repository `003-play-integrity` branch (Railway auto-deploys on push)
- [X] T201 [P] Add Docker service to Railway: connect GitHub repo, set root directory to `api/`, enable automatic deployments (Railway auto-detects Node.js project)
- [X] T202 Configure Railway environment variables: `NODE_ENV=production`, `DATABASE_URL` (Neon pooled connection string from T194), `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PLAY_INTEGRITY_CREDENTIALS`
- [X] T203 [P] Configure Railway health check: set `PORT=3000`, create api/src/health/health.controller.ts with GET `/health` endpoint returning `{ status: 'ok' }` (Railway auto-detects port, enable Health Check in Railway dashboard)

### Mobile Configuration & Deployment Documentation

- [X] T204 Update mobile/src/services/api.config.ts: add production API URL (Railway service URL from T200, e.g., `https://api.example.railway.app`), environment-based URL selection (`__DEV__` → localhost, production → Railway URL detected from environment or hardcoded for release builds)
- [X] T205 Create specs/003-play-integrity/deployment-guide.md: document Neon setup (how to create project, get connection string), Railway deployment (connect GitHub, environment variables, auto-deploy on push), database migration steps, rollback procedure, monitoring (Railway dashboard, Neon dashboard, Docker logs)

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

---

## Phase 4: Multi-App Monorepo Architecture

**Input**: Phase 4 specification from spec.md § Phase 4, implementation plan from plan.md § Phase 4  
**Prerequisites**:  
- ✅ Phase 3 Phases 1-8 (T151-T205) complete  
- ✅ All 99+ existing tests passing  
- ✅ Railway + Neon production deployment operational  
**Status**: 📋 **READY FOR IMPLEMENTATION (40 tasks T207–T246)**

**Key Principle**: ALL existing logic (Play Integrity, Auth, Cloud Sync, Offline-First) MUST remain functionally identical. Only import paths and file locations change during extraction. Zero business logic modifications.

---

## Phase 10: Monorepo Foundation (Setup npm Workspaces + Extract Shared Code)

**Purpose**: Initialize monorepo structure and extract all shared mobile code into `packages/shared/`

### Monorepo Setup Tasks

- [x] T207 Create root package.json with npm workspaces configuration: `{ "private": true, "workspaces": ["packages/*", "apps/*", "api"] }`. Add root-level scripts: `"test": "npm run test --workspaces"`, `"build": "npm run build --workspaces"`. Ensure existing `api/package.json` and future packages are detected by workspace resolution.

- [x] T208 [P] Create packages/shared/ package structure: `packages/shared/package.json` (name: `@exam-app/shared`, version: `1.0.0`, main: `src/index.ts`), `packages/shared/tsconfig.json` (extends root tsconfig, paths alias `@exam-app/shared`), `packages/shared/src/index.ts` (barrel export file). Directory structure: `src/components/`, `src/services/`, `src/stores/`, `src/storage/`, `src/screens/`, `src/navigation/`, `src/config/`.

### Shared Code Extraction Tasks

**Critical**: Use `git mv` for all file moves to preserve git history. Do NOT copy-delete.

- [x] T209 [P] Extract shared components: `git mv mobile/src/components/* packages/shared/src/components/`. Files to move: ALL components from mobile/src/components/ including IntegrityBlockedScreen.tsx, QuestionCard.tsx, and all others. Update barrel export in packages/shared/src/index.ts.

- [x] T210 [P] Extract shared services: `git mv mobile/src/services/* packages/shared/src/services/`. Files to move: ALL services including play-integrity.service.ts, exam scoring logic, sync services, API services. Update barrel export. Note: play-integrity.service.ts uses `__DEV__` which works identically in shared package context.

- [x] T211 [P] Extract shared stores: `git mv mobile/src/stores/* packages/shared/src/stores/`. Files to move: ALL Zustand stores including play-integrity.store.ts and any existing stores. Update barrel export.

- [x] T212 [P] Extract shared storage: `git mv mobile/src/storage/* packages/shared/src/storage/`. Files to move: ALL SQLite database code, migrations, repositories (including integrity.repository.ts). Update barrel export.

- [x] T213 [P] Extract shared screens: `git mv mobile/src/screens/* packages/shared/src/screens/`. Files to move: ALL screens including HomeScreen.tsx and all exam/practice/settings screens. Update barrel export.

- [x] T214 [P] Extract shared navigation: `git mv mobile/src/navigation/* packages/shared/src/navigation/`. Files to move: ALL navigation configuration. Update barrel export. Create packages/shared/src/config/types.ts with `AppConfig` interface: `{ examTypeId: string; appName: string; branding?: { primaryColor?: string } }`. Create packages/shared/src/config/defaults.ts exporting default EXAM_CONFIG, SYNC_CONFIG, STORAGE_CONFIG from the current mobile/src/config/app.config.ts.

**Checkpoint**: packages/shared/ contains all reusable code with barrel exports. Not yet imported by any app. `npm install` from root resolves workspace.

---

## Phase 11: App Wrapper Migration (Convert mobile/ → apps/aws-clp/)

**Purpose**: Create thin app wrapper for AWS Cloud Practitioner that imports everything from @exam-app/shared

### Migration Tasks

- [x] T215 Create apps/aws-clp/ directory structure. Move app-specific files from mobile/: `git mv mobile/app.json apps/aws-clp/app.json`, `git mv mobile/assets/ apps/aws-clp/assets/`, `git mv mobile/eas.json apps/aws-clp/eas.json`. Create apps/aws-clp/package.json with dependencies: `{ "@exam-app/shared": "*", "expo": "~50.0.0", "react": "18.x", "react-native": "0.73.x" }` and all necessary Expo/RN dependencies from current mobile/package.json.

- [x] T216 Create apps/aws-clp/metro.config.js configured for monorepo workspace resolution:
  ```js
  const { getDefaultConfig } = require('expo/metro-config');
  const path = require('path');
  const projectRoot = __dirname;
  const workspaceRoot = path.resolve(projectRoot, '../..');
  const config = getDefaultConfig(projectRoot);
  config.watchFolders = [workspaceRoot];
  config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ];
  module.exports = config;
  ```

- [x] T217 [P] Create apps/aws-clp/babel.config.js configured for workspace package resolution. Ensure NativeWind, Reanimated, and other Babel plugins from current mobile/babel.config.js are preserved. Add module-resolver alias for `@exam-app/shared`.

- [x] T218 Create apps/aws-clp/src/config/app.config.ts with AWS Cloud Practitioner specific config:
  ```ts
  export const APP_CONFIG = {
    examTypeId: 'CLF-C02',
    appName: 'Dojo Exam CLFC02',
    branding: { primaryColor: '#232F3E' }, // AWS orange/dark
  };
  ```
  This replaces the previous mobile/src/config/app.config.ts EXAM_TYPE_ID export.

- [x] T219 Create packages/shared/src/AppRoot.tsx — the root component that accepts `examTypeId` and branding as props. This component renders the full app tree (navigation, providers, initialization logic including Play Integrity check). Extracted from current mobile/App.tsx. Interface:
  ```ts
  interface AppRootProps {
    examTypeId: string;
    appName: string;
    branding?: { primaryColor?: string };
  }
  ```
  Create apps/aws-clp/App.tsx that imports AppRoot and passes CLF-C02 config:
  ```tsx
  import { AppRoot } from '@exam-app/shared';
  import { APP_CONFIG } from './src/config/app.config';
  export default function App() {
    return <AppRoot {...APP_CONFIG} />;
  }
  ```

- [x] T220 **CRITICAL REGRESSION TEST**: Verify apps/aws-clp produces identical behavior to original mobile/:
  1. Run `cd apps/aws-clp && npx expo start` — app launches normally
  2. Dev bypass works (`[PlayIntegrity] Bypassed in development mode` in logs)
  3. All screens render correctly (Home, Exam, Practice, Settings)
  4. Database initialization succeeds
  5. API connectivity works (questions sync from backend)
  6. Run `npm test` from apps/aws-clp — all existing mobile tests pass
  7. Compare startup behavior: no additional delays, no new errors

**Checkpoint**: apps/aws-clp is the new home for AWS CLP app. Uses @exam-app/shared for all logic. Zero functional regression.

---

## Phase 12: App Template & Scaffold Script

**Purpose**: Create template and automation so new apps take <5 minutes to scaffold

### Template Tasks

- [ ] T221 Create apps/template/ directory with template files using placeholder tokens:
  - `app.json.template`: `__APP_NAME__`, `__APP_SLUG__`, `__PACKAGE_NAME__`, `__BUNDLE_ID__`
  - `App.tsx.template`: `__EXAM_TYPE_ID__`, `__APP_NAME__`
  - `package.json.template`: `__APP_SLUG__`
  - `metro.config.js.template`: (no placeholders — identical for all apps)
  - `babel.config.js.template`: (no placeholders — identical for all apps)
  - `tsconfig.json.template`: (no placeholders — identical for all apps)
  - `src/config/app.config.ts.template`: `__EXAM_TYPE_ID__`, `__APP_NAME__`, `__PRIMARY_COLOR__`
  - `assets/`: Placeholder icon.png, splash-icon.png, adaptive-icon.png

- [ ] T222 Create scripts/create-app.sh with parameters:
  ```bash
  Usage: ./scripts/create-app.sh --exam-type <ID> --name <NAME> --package <PACKAGE> [--color <HEX>]
  Example: ./scripts/create-app.sh --exam-type SAA-C03 --name "Dojo Exam SAA" --package com.danilocasim.dojoexam.saac03 --color "#FF9900"
  ```
  Script: copies template → replaces tokens → runs npm install → prints next steps (update assets, configure EAS, test). Validate that exam type ID exists in backend before creating (optional: `curl /exam-types/{id}` check).

- [ ] T223 Create first new app using the script: `./scripts/create-app.sh --exam-type SAA-C03 --name "Dojo Exam SAA" --package com.danilocasim.dojoexam.saac03`. Verify apps/aws-saa/ is generated with correct files and placeholders replaced.

- [ ] T224 Verify apps/aws-saa/ builds and runs:
  1. `cd apps/aws-saa && npx expo start` — app launches
  2. App shows correct exam name and connects to backend
  3. Backend returns SAA-C03 exam type config (if exam type exists in DB) or 404 (expected if not yet created)
  4. Play Integrity bypass works in dev mode
  5. All shared screens render correctly

**Checkpoint**: New exam apps can be created in minutes via script. Template is reusable.

---

## Phase 13: Admin Portal — ExamType CRUD Backend

**Purpose**: Add API endpoints for creating, updating, and deactivating exam types through the admin portal

### Backend DTO Tasks

- [ ] T225 Create api/src/admin/dto/create-exam-type.dto.ts:
  ```ts
  export class CreateExamTypeDomainDto {
    @IsString() id: string;
    @IsString() @MinLength(2) name: string;
    @IsNumber() @Min(0) @Max(100) weight: number;
    @IsInt() @Min(0) questionCount: number;
  }
  
  export class CreateExamTypeDto {
    @IsString() @Matches(/^[A-Za-z0-9-]+$/) id: string;
    @IsString() @MinLength(3) name: string;
    @IsString() @MinLength(2) displayName: string;
    @IsOptional() @IsString() description?: string;
    @IsArray() @ValidateNested({ each: true }) @Type(() => CreateExamTypeDomainDto)
    domains: CreateExamTypeDomainDto[];
    @IsInt() @Min(0) @Max(100) passingScore: number;
    @IsInt() @Min(1) timeLimit: number;
    @IsInt() @Min(1) @Max(500) questionCount: number;
  }
  ```
  Add custom validator: domain weights must sum to 100.

- [ ] T226 [P] Create api/src/admin/dto/update-exam-type.dto.ts using OmitType/PartialType pattern:
  ```ts
  export class UpdateExamTypeDto extends OmitType(CreateExamTypeDto, ['id'] as const) {}
  ```
  ID is immutable — only non-ID fields can be updated.

### Backend Service Tasks

- [ ] T227 Create api/src/admin/services/exam-types.service.ts (AdminExamTypesService) with methods:
  - `create(dto: CreateExamTypeDto): Promise<ExamType>` — validates unique ID, creates in DB, returns new entity
  - `update(id: string, dto: UpdateExamTypeDto): Promise<ExamType>` — validates exists, updates all fields, returns updated entity
  - `toggleActive(id: string): Promise<ExamType>` — flips isActive boolean, returns updated entity
  - All methods use PrismaService for database operations
  - Register AdminExamTypesService in AdminModule providers

### Backend Controller Tasks

- [ ] T228 [US5] Add POST /admin/exam-types endpoint to api/src/admin/controllers/admin-exam-types.controller.ts:
  ```ts
  @Post('exam-types')
  @HttpCode(HttpStatus.CREATED)
  async createExamType(@Body() dto: CreateExamTypeDto): Promise<ExamType> {
    return this.adminExamTypesService.create(dto);
  }
  ```
  Return 201 on success, 409 on duplicate ID, 400 on validation failure.

- [ ] T229 [US9] Add PUT /admin/exam-types/:id endpoint:
  ```ts
  @Put('exam-types/:id')
  async updateExamType(@Param('id') id: string, @Body() dto: UpdateExamTypeDto): Promise<ExamType> {
    return this.adminExamTypesService.update(id, dto);
  }
  ```
  Return 200 on success, 404 if not found, 400 on validation failure.

- [ ] T230 [US9] Add PATCH /admin/exam-types/:id endpoint for toggling isActive:
  ```ts
  @Patch('exam-types/:id')
  async toggleExamType(@Param('id') id: string): Promise<ExamType> {
    return this.adminExamTypesService.toggleActive(id);
  }
  ```
  Return 200 on success, 404 if not found.

**Checkpoint**: Backend ExamType CRUD fully operational. Test with: `curl -X POST localhost:3000/admin/exam-types -H "Authorization: Bearer <token>" -d '{"id":"SAA-C03", ...}'`

---

## Phase 14: Admin Portal — ExamType CRUD Frontend

**Purpose**: Add admin portal UI for managing exam types (create, edit, deactivate)

### Admin API Service Tasks

- [ ] T231 Add exam type CRUD methods to api/admin-portal/src/services/api.ts:
  ```ts
  createExamType(input: CreateExamTypeInput): Promise<ExamType>;
  updateExamType(id: string, input: UpdateExamTypeInput): Promise<ExamType>;
  toggleExamType(id: string): Promise<ExamType>;
  ```
  Add TypeScript interfaces: `CreateExamTypeInput`, `UpdateExamTypeInput` matching backend DTOs.

### Admin Portal Page Tasks

- [ ] T232 [US5] Create api/admin-portal/src/pages/ExamTypeListPage.tsx:
  - Table displaying all exam types: id, displayName, questionCount, passingScore, isActive status
  - "Create New" button → navigates to /exam-types/new
  - "Edit" button per row → navigates to /exam-types/:id
  - "Deactivate"/"Reactivate" toggle per row → calls toggleExamType API
  - Style consistent with existing DashboardPage and QuestionListPage

- [ ] T233 Create api/admin-portal/src/components/DomainEditor.tsx:
  - Renders list of domain rows, each with: id (text input), name (text input), weight (number input 0-100), questionCount (number input)
  - "Add Domain" button appends empty row
  - "Remove" button per row (with confirmation)
  - Drag handles for reordering (optional, can use up/down buttons)
  - Live validation: shows total weight and warning if not 100
  - Props: `domains: Domain[]`, `onChange: (domains: Domain[]) => void`

- [ ] T234 [US5] [US9] Create api/admin-portal/src/pages/ExamTypeFormPage.tsx:
  - Create mode (path: /exam-types/new): empty form
  - Edit mode (path: /exam-types/:id): pre-filled form (fetch exam type on mount)
  - Fields: id (text, read-only in edit mode), name, displayName, description (textarea), passingScore (number), timeLimit (number), questionCount (number)
  - DomainEditor component for domains field
  - Submit button: calls createExamType or updateExamType API
  - Success: navigate back to /exam-types with success toast
  - Error: display validation error messages inline
  - Style consistent with existing QuestionDetailPage form

### Admin Portal Routing & Navigation Tasks

- [ ] T235 Update api/admin-portal/src/App.tsx to add exam type routes:
  ```tsx
  <Route path="/exam-types" element={<ExamTypeListPage />} />
  <Route path="/exam-types/new" element={<ExamTypeFormPage />} />
  <Route path="/exam-types/:id" element={<ExamTypeFormPage />} />
  ```
  Import ExamTypeListPage and ExamTypeFormPage.

- [ ] T236 [P] Update api/admin-portal/src/components/Layout.tsx:
  - Add "Exam Types" link in sidebar navigation (between Dashboard and Questions)
  - Icon: settings/cog or document icon
  - Active state styling consistent with existing nav links

### Admin Portal Validation Tasks

- [ ] T237 [P] Add client-side validation to ExamTypeFormPage:
  - ID format: alphanumeric + hyphens only (regex: `/^[A-Za-z0-9-]+$/`)
  - Name: minimum 3 characters
  - DisplayName: minimum 2 characters
  - PassingScore: 0-100 range
  - TimeLimit: positive integer
  - QuestionCount: 1-500 range
  - Domains: at least 1 domain, weights sum to 100
  - Show inline error messages on invalid fields
  - Disable submit button until all validations pass

- [ ] T238 [P] Add confirmation dialogs for state-changing actions:
  - Deactivate: "Deactivating this exam type will prevent mobile apps from receiving new questions. Existing questions remain accessible. Continue?"
  - Reactivate: "Reactivating this exam type will make it available to mobile apps again. Continue?"
  - Style: modal dialog consistent with existing app patterns

**Checkpoint**: Admin portal fully supports ExamType management. Admins can create SAA-C03, GCP-ACE, AZ-900 exam types entirely through the UI.

---

## Phase 15: Testing, EAS Build Configuration & Documentation

**Purpose**: Validate all existing tests pass, add new tests, configure per-app builds, update all docs

### Regression Testing Tasks

- [ ] T239 **CRITICAL**: Run ALL existing tests in monorepo structure:
  1. `cd packages/shared && npm test` — all shared code tests pass
  2. `cd apps/aws-clp && npm test` — all app-specific tests pass
  3. `cd api && npm test` — all backend tests pass (should have zero changes needed)
  4. Fix any import path issues from extraction (T209-T214)
  5. Verify test count: minimum 99 tests pass (same as pre-monorepo)
  6. Document any test modifications needed (should be import paths only)

### New Test Tasks

- [ ] T240 Create api/test/admin-exam-types.e2e-spec.ts with Supertest E2E tests:
  - POST /admin/exam-types: create new exam type → 201 with correct response body
  - POST /admin/exam-types: duplicate ID → 409 Conflict
  - POST /admin/exam-types: invalid domain weights (sum != 100) → 400
  - POST /admin/exam-types: missing required fields → 400
  - PUT /admin/exam-types/:id: update existing → 200
  - PUT /admin/exam-types/:id: non-existent → 404
  - PATCH /admin/exam-types/:id: toggle active → 200, isActive flipped
  - All endpoints require auth: no token → 401

- [ ] T241 [P] Create admin portal component tests (Jest + React Testing Library):
  - DomainEditor: renders domains, add domain, remove domain, weight validation display
  - ExamTypeFormPage: renders form fields, submit triggers API call, validation errors shown
  - ExamTypeListPage: renders table rows, deactivate toggle calls API

### EAS Build Configuration Tasks

- [ ] T242 Configure EAS Build in apps/aws-clp/eas.json:
  - Copy existing eas.json from mobile/ if not already moved in T215
  - Verify projectId matches existing EAS project
  - Configure build profiles: development, preview, production
  - Test: `cd apps/aws-clp && eas build --platform android --profile preview` succeeds

- [ ] T243 [P] Create scripts/build-all.sh:
  ```bash
  #!/bin/bash
  # Build all exam apps
  for app_dir in apps/*/; do
    if [ -f "$app_dir/eas.json" ]; then
      echo "Building $(basename $app_dir)..."
      (cd "$app_dir" && eas build --platform android --profile production --non-interactive)
    fi
  done
  ```
  Also add `npm run build:all` script to root package.json.

### End-to-End Workflow Validation

- [ ] T244 Test complete create-app workflow end-to-end:
  1. Admin creates exam type SAA-C03 via admin portal (if not already created)
  2. Developer runs: `./scripts/create-app.sh --exam-type SAA-C03 --name "Dojo Exam SAA" --package com.danilocasim.dojoexam.saac03`
  3. Verify apps/aws-saa/ generated correctly
  4. `cd apps/aws-saa && npx expo start` — app launches
  5. App displays "Dojo Exam SAA" branding
  6. Backend returns SAA-C03 config via API
  7. Play Integrity dev bypass works
  8. Admin adds a question for SAA-C03 → app syncs it
  9. Document: time-to-first-working-app should be <30 minutes

### Documentation Tasks

- [ ] T245 Update specs/003-play-integrity/quickstart.md with Phase 4 monorepo instructions:
  - New section: "Monorepo Development Setup"
  - Commands: `npm install` (from root), `cd apps/aws-clp && npx expo start`
  - How to create a new app: reference create-app.sh
  - How to run tests: `npm test` (root runs all), or per-workspace
  - How to build: `npm run build --workspace=apps/aws-clp`
  - How to add an exam type in admin portal
  - Troubleshooting: Metro resolver issues, npm workspace hoisting

- [ ] T246 Update root documentation:
  - CLAUDE.md: Add Phase 4 section to Recent Changes, update Project Structure to reflect monorepo layout, add new commands section
  - README.md: Update architecture overview, add monorepo structure diagram, add "Adding a New Exam App" section
  - Add comparison table: before (single app) vs after (monorepo) for developer reference

**Checkpoint**: All tests passing (99+ existing + new ExamType CRUD tests). EAS builds configured. Documentation complete. Phase 4 fully implemented.

---

## Phase 4 Dependencies & Execution Order

### Phase Dependencies

- **Phase 10 (Monorepo Foundation)**: No dependencies beyond Phase 1-8 completion — can start immediately
- **Phase 11 (App Wrapper)**: Depends on Phase 10 (shared code must be extracted first)
- **Phase 12 (Template & Script)**: Depends on Phase 11 (need working app wrapper as reference)
- **Phase 13 (Admin CRUD Backend)**: **INDEPENDENT** — can run in parallel with Phases 10-12 (no shared code dependency)
- **Phase 14 (Admin CRUD Frontend)**: Depends on Phase 13 (needs backend endpoints)
- **Phase 15 (Testing & Docs)**: Depends on all previous phases

### Parallel Opportunities (Phase 4)

**Week 1-2 (Monorepo + Backend in parallel)**:
- Dev A: T207-T220 (Phases 10-11: Monorepo setup + app wrapper migration)
- Dev B: T225-T230 (Phase 13: Backend ExamType CRUD — completely independent)

**Week 2-3 (Template + Frontend in parallel)**:
- Dev A: T221-T224 (Phase 12: Template and scaffold script)
- Dev B: T231-T238 (Phase 14: Admin portal ExamType CRUD frontend)

**Week 4 (Testing together)**:
- Both: T239-T246 (Phase 15: Testing, EAS build, documentation)

### What CAN Be Parallelized ([P] Marked)

| Tasks | Parallelizable? | Reason |
|-------|-----------------|--------|
| T208-T214 | ✅ Yes | Different directories, no shared state |
| T215-T217 | ✅ Yes | Different files in apps/aws-clp/ |
| T225-T226 | ✅ Yes | Independent DTO files |
| T231, T233, T237, T238 | ✅ Yes | Independent frontend files |
| T240-T241 | ✅ Yes | Independent test files |
| T242-T243 | ✅ Yes | Independent build config files |
| Phase 10-12 ↔ Phase 13 | ✅ Yes | Backend CRUD is independent of monorepo |

---

## Phase 4 Checklist Template

```markdown
### Task [TID]: [Title]

- [ ] Code written in [file path]
- [ ] Tested: [test file] passes
- [ ] TypeScript strict: tsc --noEmit passes
- [ ] No breaking changes to existing exports/interfaces
- [ ] Import paths updated (if extraction task)
- [ ] Barrel export updated in packages/shared/src/index.ts (if applicable)
- [ ] Spec compliance: Implements [FR-XXX]
- [ ] Documentation: Updated if needed
- [ ] Reviewed: Code style, edge cases
```

---

## Notes for Implementers (Phase 4)

1. **Use `git mv` for all file moves**: This preserves git blame history. Never copy-delete.
2. **Test after every extraction task**: Run existing tests after each T209-T214 to catch import issues early.
3. **Metro bundler configuration is critical**: If Metro can't resolve `@exam-app/shared`, nothing works. T216 is the highest-risk task — validate thoroughly.
4. **Backend ExamType CRUD is fully independent**: Phase 13 (T225-T230) has zero dependency on the monorepo migration. It can be done first, last, or in parallel.
5. **Admin portal follows existing patterns**: The ExamTypeFormPage should look and feel like the existing QuestionDetailPage. Use the same form layout, validation approach, and navigation patterns.
6. **Domain weight validation is business-critical**: Domains must sum to 100%. Validate on both frontend (real-time) and backend (DTO validator). Frontend shows a live counter.
7. **EAS Build monorepo support**: Expo/EAS officially supports monorepo builds. Key setting: `"extends"` in eas.json can share base config. Each app needs its own `projectId`.
8. **No Prisma schema changes**: ExamType model already has all needed fields. CRUD operations use existing Prisma client. Zero migrations.
9. **Preserve all environment variable patterns**: `EXPO_PUBLIC_*` variables must work identically in `apps/{name}/` as they did in `mobile/`.
10. **The `mobile/` directory**: After Phase 11 migration is verified, `mobile/` can be removed or converted to a symlink to `apps/aws-clp/` for backward compatibility. Do NOT delete until all CI/CD and documentation references are updated.

