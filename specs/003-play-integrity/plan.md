# Implementation Plan: Play Integrity Guard

**Branch**: `003-play-integrity` | **Date**: February 15, 2026 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/003-play-integrity/spec.md`  
**Prerequisites**: Phase 2 (002-cloudprep-mobile) ✅ Complete - Google OAuth authentication, cloud sync infrastructure, JWT token management

## Summary

Play Integrity Guard adds one-time device verification on first app launch using Google's Play Integrity API. Verification runs concurrently with app initialization, caches result locally for 30 days, and blocks sideloaded/tampered builds on Android. Development builds bypass verification automatically. Backend provides stateless token decryption proxy only; enforcement is entirely client-side. Production deployment uses Railway for backend hosting and Neon PostgreSQL serverless database (cost-optimized: ~$10-20/month vs $200+/month for AWS).

**Building on Phase 2**: This feature leverages the authentication infrastructure from Phase 2 (JWT tokens, API endpoints, mobile services architecture) and extends it with Play Integrity verification. The offline-first design from Phase 1-2 is preserved—after initial verification, the app runs fully offline.

**Implementation Scope**: 55 tasks (T151-T205) covering mobile + backend implementation, integration testing, and AWS production deployment infrastructure.

## Technical Context

**Language/Version**: TypeScript 5.x (all components)  
**Primary Dependencies**: @react-native-google-signin/google-signin ^10.0.0 (existing from Phase 2, supports Play Integrity token requests), expo-sqlite (existing), Google Play Console API credentials  
**Storage**: SQLite via expo-sqlite (mobile local verification cache), Neon PostgreSQL serverless (production backend database)  
**Production Infrastructure**: Railway (backend hosting, auto-deploy from GitHub), Neon PostgreSQL (serverless database with auto-scaling, connection pooling), Railway environment variables (credentials and configuration)  
**Testing**: Jest (mobile), Supertest (API), Detox (mobile E2E)  
**Target Platform**: Android 10+ Play Store distributed apps  
**Project Type**: mobile + api (Extends existing: Mobile app + Backend API)  
**Performance Goals**: First-launch verification <5s, cached launches <3s (no regression), <10ms for cache hit  
**Constraints**: Offline-capable after verification, zero backend state, development mode excluded, Android-exclusive  
**Scale/Scope**: Single-user per device, device-level enforcement, no user data stored server-side

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

✅ **Passes Constitution**:

- ✅ **No new projects**: Extends existing mobile + api structure. No new repos, languages, or frameworks.
- ✅ **Architecture preserved**: Offline-first, multi-tenant backend unmodified, mobile single-app design persists.
- ✅ **Backward compatible**: Existing users (verified pre-003) pass verification seamlessly. Phase 2 code (auth, sync) unaffected.
- ✅ **Incremental changes**:
  - Mobile: Add `src/services/play-integrity.service.ts`, `src/services/play-integrity.store.ts`, `src/components/IntegrityBlockedScreen.tsx`
  - API: Add `src/integrity/integrity.controller.ts`, `src/integrity/integrity.module.ts`
  - Database: Add `IntegrityStatus` table to mobile SQLite only. Zero Prisma schema changes.
- ✅ **Test coverage**: New unit tests (integrity verification logic), E2E tests (blocking flow), performance tests (launch time).
- ✅ **Development-friendly**: `__DEV__` bypass allows dev iteration without Play Store install.

**Risk Assessment**: Low. Verification is isolated; failure does NOT crash app (graceful retry loop). Backend remains stateless. Mobile fallback: transient errors allow cached access.

## Phase 2 Prerequisites ✅

**Branch**: 002-cloudprep-mobile | **Status**: COMPLETE | **Tasks**: T1-T150

Phase 3 (Play Integrity Guard) builds upon Phase 2 (Authentication & Cloud Sync) infrastructure:

### Phase 2 Deliverables (Now Available)

- ✅ **Google OAuth Authentication**: Users can sign in with Google accounts, JWT access tokens (1hr TTL) + refresh tokens (30 days)
- ✅ **Backend Authentication Module**: `/api/src/auth/` with controllers, guards, JWT service, OAuth strategies
- ✅ **Mobile Auth Services**: `AuthService.ts`, `TokenStorage.ts` with token refresh logic and interceptors
- ✅ **Cloud Sync Infrastructure**: Offline queue with exponential backoff (5000 * 2^retries ms), max 12 retries, PENDING→SYNCED→FAILED state machine
- ✅ **Exam Attempts Persistence**: `/api/src/exam-attempts/` module stores exam results server-side with authenticated endpoints
- ✅ **Analytics Service**: Backend aggregation (passRate, averageScore, averageDuration) with sync status filtering
- ✅ **Test Infrastructure**: Jest configured for mobile (React Native preset) + API (Node.js), 58 test cases, manual testing guide
- ✅ **Documentation**: Root README.md with architecture diagrams (OAuth flow, sync state machine, token lifecycle)

### How Phase 3 Uses Phase 2

**Mobile Architecture**:
- Play Integrity verification follows same service patterns as `ExamAttemptService` (TypeScript classes, async/await)
- Verification cache uses same AsyncStorage patterns as `TokenStorage`
- Integrity check runs concurrently with existing app initialization (similar to token refresh on app launch)

**Backend Architecture**:
- New `/api/src/integrity/` module follows structure from `/api/src/auth/` and `/api/src/exam-attempts/`
- Uses existing NestJS module patterns, decorators, and DTO validation
- Integrity endpoint (`POST /api/integrity/verify`) mirrors authentication endpoint patterns

**Offline-First Preservation**:
- 30-day cache TTL aligns with Phase 2's offline queue and token refresh strategy
- After verification, app behavior is identical to Phase 2 (full offline access to questions and exam flow)
- No backend state persists (stateless proxy, same philosophy as JWT token refresh in Phase 2)

**Reference**: See [Phase 2 completed tasks](../002-cloudprep-mobile/tasks.md) | [Phase 2 README](../../README.md)

## Project Structure

### Documentation (this feature)

```text
specs/003-play-integrity/
├── plan.md                      # This file (implementation roadmap)
├── spec.md                      # Feature specification
├── research.md                  # Technology research & decisions
├── data-model.md                # SQLite schema & API contracts
├── quickstart.md                # Setup & first-run instructions (Phase 1)
├── contracts/                   # Phase 1 output
│   └── integrity-api.yaml       # OpenAPI spec for /api/integrity/verify
├── checklists/
│   └── requirements.md          # Specification quality checklist
└── tasks.md                     # Phase 2 output (T151–T180 estimated)
```

### Source Code (repository root)

```text
# MOBILE APP (extends existing)
mobile/
├── src/
│   ├── services/
│   │   ├── play-integrity.service.ts          # (NEW) Integrity verification logic
│   │   └── play-integrity.store.ts            # (NEW) Zustand store for integrity state
│   ├── components/
│   │   └── IntegrityBlockedScreen.tsx         # (NEW) Blocking UI component
│   ├── storage/
│   │   ├── database.ts                        # (MODIFIED) Add IntegrityStatus migration
│   │   └── repositories/
│   │       └── integrity.repository.ts        # (NEW) SQLite queries for IntegrityStatus
│   ├── screens/
│   │   ├── HomeScreen.tsx                     # (MODIFIED) Guard with integrity check
│   │   └── [others]                           # (NO CHANGE) Unaffected
│   └── [config, stores, navigation, etc.]     # (NO CHANGE) Unaffected
└── __tests__/
    ├── play-integrity.service.test.ts         # (NEW) Unit tests
    ├── play-integrity.e2e.test.ts             # (NEW) E2E tests (Detox)
    └── [existing tests]                       # (NO CHANGE)

# BACKEND API (extends existing)
api/
├── src/
│   ├── integrity/                             # (NEW MODULE)
│   │   ├── integrity.controller.ts            # (NEW) POST /api/integrity/verify
│   │   ├── integrity.service.ts               # (NEW) Google API client wrapper
│   │   ├── integrity.module.ts                # (NEW) Module definition
│   │   └── dto/
│   │       ├── verify-token.dto.ts            # (NEW) Request schema
│   │       └── integrity-verdict.dto.ts       # (NEW) Response schema
│   ├── app.module.ts                          # (MODIFIED) Import IntegrityModule
│   └── [exam-types, questions, admin, auth/] # (NO CHANGE) Unaffected
├── prisma/
│   └── schema.prisma                          # (NO CHANGE) Zero schema changes
└── test/
    ├── integrity.e2e-spec.ts                  # (NEW) E2E tests for /api/integrity/verify
    └── [existing tests]                       # (NO CHANGE)
```

**Structure Decision**: Mobile-first integration. Integrity check injected into App.tsx initialization flow. Backend endpoint minimal (stateless proxy). Zero Prisma schema changes—verification data stored only on mobile device.

---

## Phase 1: Research & Design (✅ COMPLETE)

### Phase 1 Outputs

✅ **research.md**: Technology stack validated  
  - Play Integrity via `@react-native-google-signin/google-signin` extension  
  - SQLite local cache with 30-day TTL  
  - Parallel initialization in App.tsx  
  - Transient vs. definitive error distinction  
  - `__DEV__` bypass mechanism  
  - Backend stateless proxy architecture

✅ **data-model.md**: Schemas & contracts defined  
  - `IntegrityStatus` SQLite table (mobile-only)  
  - `PlayIntegrityVerdict` TypeScript interfaces  
  - `POST /api/integrity/verify` OpenAPI contract  
  - No Prisma schema changes (backend stateless)  
  - Error states & user messaging matrix  
  - Zero impact on ExamType, Question, User, ExamAttempt models

✅ **spec.md**: Verified & validated  
  - 4 user stories (US1–4, P1/P2 prioritized)  
  - 16 functional requirements (FR-001–016)  
  - 8 success criteria (SC-001–008)  
  - 6 edge case scenarios with remediation  
  - Specification Quality Checklist: PASS (all items verified)

---

## Phase 2: Implementation Planning (THIS DOCUMENT)

### Implementation Scope

**Total Estimated Tasks**: 40 tasks (T151–T190) across 3 phases

**Phase 1: Setup & Foundational** (T151–T163, ~6 dev-hours)
- T151: Create `play-integrity.service.ts` (token request, verdict parsing)
- T152: Create `play-integrity.store.ts` (Zustand store for integrity state)
- T153: Create `IntegrityBlockedScreen.tsx` (blocking UI, Play Store link button)
- T154: Create `integrity.repository.ts` (SQLite IntegrityStatus queries)
- T155: Modify `database.ts` to add IntegrityStatus table migration
- T156: Modify `App.tsx` to integrate integrity check into initialization flow
- T157: Add `__DEV__` bypass logic to integrity service
- T158: Implement transient vs. definitive error distinction logic
- T159: Add error message UI (retry dialogs, blocking screen)
- T160: Unit test suite for integrity service (Jest)

**Sprint 2: Backend & API** (T161–T170, ~8 dev-hours)
- T161: Create `integrity/integrity.controller.ts` (POST /api/integrity/verify endpoint)
- T162: Create `integrity/integrity.service.ts` (Google API client wrapper)
- T163: Create `integrity/dto/verify-token.dto.ts` (request schema)
- T164: Create `integrity/dto/integrity-verdict.dto.ts` (response schema)
- T165: Create `integrity/integrity.module.ts` (module definition)
- T166: Integrate IntegrityModule into `app.module.ts`
- T167: Set up Google Play Console service account credentials (env config)
- T168: Unit test suite for integrity controller (Jest)
- T169: E2E test suite for /api/integrity/verify (Supertest)
- T170: Add OpenAPI documentation to integrity controller

**Sprint 3: Integration & Testing** (T171–T180, ~10 dev-hours)
- T171: Mobile-to-backend integration testing (real API calls)
- T172: E2E test: First-launch verification happy path (Detox)
- T173: E2E test: Sideloaded APK blocking (Detox + adb)
- T174: E2E test: Cached launch (offline scenario)
- T175: E2E test: Developer bypass (__DEV__ true)
- T176: E2E test: Transient error retry flow
- T177: Performance test: Launch time (<5s first, <3s cached)
- T178: Integration test: 30-day cache TTL expiry
- T179: Quickstart guide & local setup documentation
- T180: Code review checklist & PR templates

**Sprint 4: Railway + Neon Production Deployment** (T191–T205, ~6 dev-hours, cost-optimized)
- T191-T195: Neon PostgreSQL serverless setup, connection pooling, local testing
- T196-T199: Database migration and seed scripts for production
- T200-T203: Railway service configuration and deployment
- T204-T205: Mobile API configuration for production and deployment documentation

**Total Dev-Hours**: ~38 hours (can be split 1–2 developers over 4 weeks)

---

## Implementation Constraints & Guidelines

### ✅ DO: Incremental, Non-Breaking Changes

- ✅ Add new service files (`play-integrity.service.ts`); don't modify existing ones
- ✅ Add new database table; zero Prisma schema changes
- ✅ Extend App.tsx init flow; preserve existing initialization order
- ✅ New backend module (`integrity/`); don't touch exam-types, questions, admin modules
- ✅ Guard HomeScreen with integrity check; don't modify screen logic

### ❌ DON'T: Breaking Changes

- ❌ Do NOT modify Prisma schema.prisma (backend stateless—verdicts not stored)
- ❌ Do NOT add integrity check to Question API (public endpoint unmarked)
- ❌ Do NOT modify ExamType, Question, or User models
- ❌ Do NOT introduce new npm dependencies beyond Google Play API client
- ❌ Do NOT change RootNavigator structure; render blocking screen conditionally
- ❌ Do NOT add new Zustand stores; extend existing pattern via new store file

### Architecture Preservation

| Component | Before (002) | After (003) | Impact |
|-----------|--------------|-------------|--------|
| **Mobile App Init** | DB + Sync + Navigation | DB + Sync + **Integrity** + Navigation | Parallel tasks (no delay) |
| **Backend API** | Exam/Question/Admin endpoints | **+ Stateless Integrity endpoint** | No business logic change |
| **Database** | ExamType, Question, User, ExamAttempt | **+ Mobile IntegrityStatus (SQLite)** | Zero Prisma changes |
| **Offline-First** | Questions cached, no user sync | **Integrity cached, no verdict sync** | Preserved |
| **Multi-Tenant** | Admin manages all exam-types | **Integrity per-device (Phase 3 scope)** | Unaffected |

---

## Testing Strategy

### Unit Tests (Jest)

| Component | Tests | Coverage Goal |
|-----------|-------|--------------|
| `play-integrity.service.ts` | Verdict parsing, cache TTL, transient vs. definitive | 90%+ |
| `play-integrity.store.ts` | State mutations, selectors | 85%+ |
| `integrity.controller.ts` | Token validation, error responses | 85%+ |
| `integrity.service.ts` | Google API mocking, error handling | 80%+ |
| `integrity.repository.ts` | SQLite CRUD, TTL query | 85%+ |

### E2E Tests (Detox + Supertest)

| Scenario | Tool | Success Criteria |
|----------|------|-----------------|
| **Happy Path**: First launch, Play Store | Detox | User sees app without blocking |
| **Sideload Block**: adb install release APK | Detox + adb | Blocking screen shown, no app access |
| **Cache Hit**: Relaunch with cache valid | Detox + Network Toggle | Load <3s, no API call in logs |
| **Dev Bypass**: `npx expo start` | Detox | No blocking, console message logged |
| **Transient Error**: Network timeout | Supertest mock + Detox | Retry button shown, user can proceed with cache |
| **API Endpoint**: POST /api/integrity/verify | Supertest | Token decrypted, verdict returned |
| **Reinstall**: Uninstall + reinstall | Detox | Cache cleared, fresh verification required |

### Performance Tests

| Metric | Target | Tool | Pass Criteria |
|--------|--------|------|---------------|
| First-launch verification time | <5s | Detox profiler | P95 latency <5s over 10 runs |
| Cached launch latency | <3s (no regression) | Detox profiler | Δ < 100ms vs. current baseline |
| Cache hit query time | <10ms | Jest (SQLite mock) | SELECT IntegrityStatus latency |
| API endpoint latency | <2s (Google API + overhead) | Supertest benchmark | Mean <2s, P95 <3s |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Google Play API unavailable on first launch | Medium | User blocked on first app use | Transient error flow: retry button, cached access if available |
| Cached result corrupted | Low | User cannot launch app | Validation: check verified_at format, re-fetch if invalid |
| Sideloaded user circumvents via cache backup/restore | Low | Security breach | Android sandboxing + Play Integrity device integrity check catch most; accepted risk |
| Development iteration friction (__DEV__ check fails) | Low | Developer experience | Verify __DEV__ detection in Expo dev builds; add console logs for debugging |
| Performance regression from parallel init | Medium | User sees slower launch | Measure baseline; verify concurrent execution, not sequential; Profile with Detox |
| Backend endpoint exposed without auth | Medium | Token forgery risk | Token is encrypted by Google; only decryptable with app signing key; stateless endpoint safe |

---

## Success Metrics

### Functional Success
- ✅ SC-001: Sideloaded APK blocked 100% on devices with Play Services
- ✅ SC-002: Re-signed APK blocked 100%
- ✅ SC-003: First-launch verification <5s
- ✅ SC-004: Cached-launch <3s (no regression)
- ✅ SC-005: Offline functionality after verification
- ✅ SC-006: Dev builds bypass 100%
- ✅ SC-007: Reinstall clears cache
- ✅ SC-008: Transient errors retryable

### Code Quality
- ✅ Unit test coverage >85% (integrity services)
- ✅ E2E test coverage: All 4 user stories tested
- ✅ Zero breaking changes to existing code
- ✅ All new code follows TypeScript strict mode
- ✅ API documentation (OpenAPI) complete

### Non-Functional
- ✅ Backward compatible (Phase 2 unaffected)
- ✅ Maintainable (new service files, clear separation of concerns)
- ✅ Observable (console logs, error messages)
- ✅ Secure (offline-first, client-side enforcement, no server state)

---

## Deployment Strategy

### Phase 3a: Staging Deployment (Local/Dev Environment)
1. Merge `003-play-integrity` into staging branch
2. Test locally with development database (PostgreSQL via Docker or local install)
3. Obtain Google Play Console service account credentials
4. Configure local API env variables (.env.local)
5. Internal testing: sideload APK to device, verify blocking works
6. Performance testing: measure launch time impact

### Phase 3b: Railway + Neon Production Deployment (Sprint 4, Cost-Optimized)

**Cost Comparison**: Neon (free tier) + Railway (free tier) = ~$0-20/month vs AWS Aurora + App Runner = $200+/month

1. **Neon PostgreSQL Setup** (T191-T195):
   - Create Neon project (free tier: 3 projects, 10 GB storage, auto-suspend enabled)
   - Create database and copy connection string (pooled connection via PgBouncer)
   - Enable connection pooling (10-20 max connections for cost optimization)
   - Test local connection with psql to verify network accessibility
   - Optional: Create read replica branch for backup/analytics (zero cost per branch)

2. **Database Migration** (T196-T199):
   - Update Prisma schema to use DATABASE_URL from environment (already supports env vars)
   - Create production migration script (scripts/migrate-production.sh) that reads DATABASE_URL
   - Create production seed script (scripts/seed-production.sh) for exam types and questions
   - Test database connection from local machine using Neon connection string

3. **Railway Deployment** (T200-T203):
   - Create Railway project and connect GitHub repository (003-play-integrity branch)
   - Railway auto-detects Node.js project and builds Docker container automatically
   - Configure environment variables in Railway dashboard (DATABASE_URL, JWT_SECRET, Google OAuth, Play Integrity credentials)
   - Enable auto-deploy on GitHub push (continuous deployment with zero downtime)
   - Set up health check (GET /health endpoint, Railway auto-detects health status)

4. **Mobile Configuration** (T204):
   - Update mobile API config with Railway service URL (auto-generated: https://api.example.railway.app)
   - Environment-based URL selection (__DEV__ → localhost, production → Railway)

5. **Documentation & Monitoring** (T205):
   - Create deployment-guide.md with Neon setup, Railway deployment, migration steps, rollback procedures
   - Monitor Railway dashboard (logs, deployments, analytics)
   - Monitor Neon dashboard (storage usage, connection pool stats, auto-suspend activity)
   - Monitor Play Store metrics: crash rates, user feedback

### Rollback Plan
- **Backend**: Railway supports instant rollback to previous deployment (zero downtime via automatic version rollback)
- **Database**: Neon provides branch management for zero-cost backup/rollback (create branch, test, promote, or discard)
- **Mobile**: If blocking persists after fix, user must uninstall + reinstall from Play Store (re-verification clears block)

---

## Timeline Estimate

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Sprint 1: Mobile Foundation | 1 week (12 hrs) | Phase 0 research complete |
| Sprint 2: Backend & API | 1 week (8 hrs) | Sprint 1 mobile service signatures locked |
| Sprint 3: Integration & Testing | 1 week (10 hrs) | Sprint 2 backend endpoint operational |
| Sprint 4: AWS Production Deployment | 1 week (8 hrs) | Sprint 3 all tests passing |
| **Total** | **4 weeks** | **~38 dev-hours (1–2 developers)** |

---

## Next Steps: Phase 2 → Tasks

When ready to proceed, run:

```bash
cd /Users/danilo/repos/exam-app
speckit tasks  # Generates tasks.md (T151–T205) with detailed checklist
```

This plan is **implementation-ready**. All research complete, all models defined, all constraints documented, AWS production deployment architecture finalized.

---

## Phase 4: Multi-App Monorepo Architecture (T207–T246)

**Status**: 📋 Ready for Implementation  
**Prerequisites**: Phase 3 Phases 1-8 (T151-T205) ✅ Complete  
**Spec**: [spec.md § Phase 4](spec.md#phase-4-multi-app-monorepo-architecture)  
**Goal**: Refactor from single-app to npm workspaces monorepo producing multiple Play Store apps from one shared codebase. Add ExamType CRUD to admin portal.

### Summary

The current mobile app (`mobile/`) is a single Expo project for AWS Cloud Practitioner (CLF-C02). The backend already supports multi-tenancy (ExamType entity), but adding a new exam requires cloning `mobile/` — creating 10x maintenance, exponential testing, and version drift.

Phase 4 extracts shared code into `packages/shared/`, converts `mobile/` into a thin app wrapper in `apps/aws-clp/`, and provides tooling to create new exam apps in ~30 minutes. The admin portal gains ExamType create/edit capability. All existing logic (Play Integrity, auth, sync, offline-first) is fully preserved — only import paths change.

**Implementation Scope**: 40 tasks (T207–T246) across 6 phases.

### Technical Context

**Monorepo Tooling**: npm workspaces (built-in to npm 7+)  
**Expo Monorepo**: Expo SDK 50+ native monorepo support via Metro bundler `watchFolders` configuration  
**Package Name**: `@exam-app/shared` for the shared workspace package  
**Build System**: EAS Build per-app with unique `eas.json` and `projectId` per app  
**Admin Portal**: Extend existing React SPA with ExamType CRUD pages  
**Backend**: Add 3 new admin endpoints (POST, PUT, PATCH) to existing `AdminExamTypesController`

### Constitution Check (Phase 4)

✅ **Passes Constitution**:

- ✅ **No new projects**: Restructures existing code; no new repos or languages
- ✅ **Architecture preserved**: Offline-first, multi-tenant backend, Play Integrity — all unchanged
- ✅ **Backward compatible**: `apps/aws-clp/` produces identical output to current `mobile/`; zero user-facing changes
- ✅ **Incremental**: Each phase can be validated independently before proceeding
- ✅ **Test coverage**: All 99 existing tests must pass after migration; new tests for ExamType CRUD
- ✅ **Development-friendly**: `npx expo start` from any `apps/{name}/` works exactly as before

### Project Structure (After Phase 4)

```text
exam-app/
├── package.json                        # Root workspace: { "workspaces": ["packages/*", "apps/*", "api"] }
├── packages/
│   └── shared/                         # (NEW) Shared mobile code package
│       ├── package.json                # name: @exam-app/shared
│       ├── tsconfig.json
│       └── src/
│           ├── components/             # (MOVED from mobile/src/components/)
│           │   ├── QuestionCard.tsx
│           │   ├── IntegrityBlockedScreen.tsx
│           │   └── ...
│           ├── services/               # (MOVED from mobile/src/services/)
│           │   ├── play-integrity.service.ts
│           │   ├── exam.service.ts
│           │   └── ...
│           ├── stores/                 # (MOVED from mobile/src/stores/)
│           ├── storage/                # (MOVED from mobile/src/storage/)
│           ├── screens/                # (MOVED from mobile/src/screens/)
│           ├── navigation/             # (MOVED from mobile/src/navigation/)
│           ├── config/                 # (NEW) Shared config types & defaults
│           │   ├── types.ts            # AppConfig interface
│           │   └── defaults.ts         # Default exam/sync/storage config
│           └── AppRoot.tsx             # (NEW) Root component accepting examTypeId prop
│
├── apps/
│   ├── template/                       # (NEW) App skeleton for create-app script
│   │   ├── app.json.template
│   │   ├── App.tsx.template
│   │   ├── package.json.template
│   │   ├── metro.config.js.template
│   │   ├── babel.config.js.template
│   │   ├── tsconfig.json.template
│   │   └── src/config/
│   │       └── app.config.ts.template
│   │
│   ├── aws-clp/                        # (MIGRATED from mobile/) AWS Cloud Practitioner
│   │   ├── app.json                    # name: "Dojo Exam CLFC02", package: com.danilocasim.dojoexam.clfc02
│   │   ├── App.tsx                     # import { AppRoot } from '@exam-app/shared'; + examTypeId='CLF-C02'
│   │   ├── package.json               # dependencies: { "@exam-app/shared": "*" }
│   │   ├── metro.config.js            # watchFolders: [shared package path]
│   │   ├── babel.config.js
│   │   ├── eas.json
│   │   ├── tsconfig.json
│   │   ├── src/config/
│   │   │   └── app.config.ts           # EXAM_TYPE_ID = 'CLF-C02', branding config
│   │   └── assets/                     # App-specific icons, splash, favicon
│   │       ├── icon.png
│   │       ├── splash-icon.png
│   │       └── adaptive-icon.png
│   │
│   └── [aws-saa/]                      # (EXAMPLE) Second app — created via create-app script
│       ├── app.json                    # name: "Dojo Exam SAA", package: com.danilocasim.dojoexam.saac03
│       ├── App.tsx
│       └── ...
│
├── api/                                # (UNCHANGED) NestJS Backend API
│   ├── src/
│   │   ├── admin/
│   │   │   ├── controllers/
│   │   │   │   └── admin-exam-types.controller.ts  # (MODIFIED) Add POST, PUT, PATCH endpoints
│   │   │   ├── services/
│   │   │   │   └── exam-types.service.ts           # (NEW) Admin ExamType CRUD service
│   │   │   └── dto/
│   │   │       ├── create-exam-type.dto.ts         # (NEW) CreateExamType validation
│   │   │       └── update-exam-type.dto.ts         # (NEW) UpdateExamType validation
│   │   └── [exam-types, questions, integrity, ...]  # (NO CHANGE)
│   ├── admin-portal/src/
│   │   ├── pages/
│   │   │   ├── ExamTypeListPage.tsx                # (NEW) List exam types with create button
│   │   │   └── ExamTypeFormPage.tsx                # (NEW) Create/edit exam type form
│   │   ├── components/
│   │   │   └── DomainEditor.tsx                    # (NEW) Dynamic domain list editor
│   │   ├── services/
│   │   │   └── api.ts                              # (MODIFIED) Add exam type CRUD methods
│   │   └── App.tsx                                 # (MODIFIED) Add exam type routes
│   └── prisma/schema.prisma                         # (NO CHANGE) ExamType model already exists
│
├── scripts/
│   ├── create-app.sh                   # (NEW) Scaffold new app from template
│   └── build-all.sh                    # (NEW) Build all apps
│
├── mobile/ → apps/aws-clp/             # (REDIRECT) Symlink or remove after migration
└── specs/003-play-integrity/           # (UPDATED) This documentation
```

### Current Implementation Status (as of February 25, 2026)

**Codebase features beyond original spec** (implemented but not previously documented):
- **UpgradeScreen**: Subscription plan selector UI in `packages/shared/src/screens/UpgradeScreen.tsx` — 3-plan layout (Monthly $2.99, Quarterly $6.99, Annual $19.99), benefits list, CTA button. No billing integration yet (placeholder — Phase 17 connects it).
- **Bundle Service**: `packages/shared/src/services/bundle.service.ts` — loads initial question bank from bundled JSON assets for offline-first experience.
- **14 screens**: HomeScreen, ExamScreen, ExamResultsScreen, PracticeScreen, PracticeSetupScreen, PracticeSummaryScreen, ReviewScreen, ExamHistoryScreen, AnalyticsScreen, CloudAnalyticsScreen, AuthScreen, SettingsScreen, UpgradeScreen + navigation route for each.
- **14+ components**: Including DifficultySelector, DomainSelector, ErrorBoundary, FeedbackCard, Skeleton, SyncStatusIndicator, Timer, analytics subfolder (DomainPerformanceCard, ScoreTrendChart, StudyStatsCard).
- **7 Zustand stores**: analytics, auth, exam-attempt, exam, play-integrity, practice, review.
- **18 services**: Including network.service.ts, token-refresh-service.ts, api-interceptor.ts, bundle.service.ts.
- **8 storage repositories**: question, exam-attempt, exam-answer, exam-submission, integrity, practice-answer, practice-session, user-stats.
- **Performance benchmarks**: vitest setup with launch.bench.ts, rendering.bench.ts, transitions.bench.ts.
- **mobile/ directory removed**: Fully migrated to `packages/shared/` + `apps/aws-clp/`.

### Implementation Phases (Phase 4)

#### Phase 10: Monorepo Foundation (T207–T214, ~6 dev-hours) ✅ COMPLETE

**Goal**: Set up npm workspaces, create packages/shared/, and extract shared code.

| Task | Description | Est. | Status |
|------|-------------|------|--------|
| T207 | Initialize npm workspaces at root, create packages/shared/package.json | 30 min | ✅ |
| T208 | Create packages/shared/ directory structure and tsconfig.json | 30 min | ✅ |
| T209 | Extract shared components from mobile/src/components/ → packages/shared/src/components/ | 45 min | ✅ |
| T210 | Extract shared services from mobile/src/services/ → packages/shared/src/services/ | 45 min | ✅ |
| T211 | Extract shared stores from mobile/src/stores/ → packages/shared/src/stores/ | 30 min | ✅ |
| T212 | Extract shared storage from mobile/src/storage/ → packages/shared/src/storage/ | 30 min | ✅ |
| T213 | Extract shared screens from mobile/src/screens/ → packages/shared/src/screens/ | 45 min | ✅ |
| T214 | Extract shared navigation from mobile/src/navigation/ → packages/shared/src/navigation/ | 30 min | ✅ |

**Checkpoint**: ✅ packages/shared/ contains all reusable code (18 services, 14 screens, 14+ components, 7 stores, 8 repositories). Barrel export in src/index.ts.

#### Phase 11: App Wrapper Migration (T215–T220, ~5 dev-hours) ✅ COMPLETE

**Goal**: Convert mobile/ into apps/aws-clp/ thin wrapper using shared code.

| Task | Description | Est. | Status |
|------|-------------|------|--------|
| T215 | Create apps/aws-clp/ directory, move mobile/ app-specific files (app.json, assets/, eas.json) | 45 min | ✅ |
| T216 | Configure Metro bundler in apps/aws-clp/metro.config.js for workspace package resolution | 30 min | ✅ |
| T217 | Configure Babel in apps/aws-clp/babel.config.js for workspace module resolution | 20 min | ✅ |
| T218 | Create apps/aws-clp/src/config/app.config.ts with examTypeId='CLF-C02', branding config | 30 min | ✅ |
| T219 | Create packages/shared/src/AppRoot.tsx (246 lines) — full init sequence: Google Sign-In → token refresh → SQLite → Play Integrity → user DB switch → sync → persistence → RootNavigator | 45 min | ✅ |
| T220 | Verify apps/aws-clp builds and runs identically to original mobile/ (zero regression) | 60 min | ✅ |

**Checkpoint**: ✅ apps/aws-clp is the active app. `mobile/` directory fully removed. AppRoot accepts `AppRootProps { examTypeId, appName, branding? }`.

#### Phase 12: Admin Portal — ExamType CRUD Backend (T225–T230, ~5 dev-hours)

**Goal**: Add backend endpoints for creating, updating, and deactivating exam types. **Prioritized before template/scaffold to ensure exam data is available for new apps.**

**Rationale**: Admin portal must be able to create exam types (e.g., SAA-C03) before the scaffold script generates a new app for that exam. Without backend CRUD, new exam types require manual database seeding.

| Task | Description | Est. |
|------|-------------|------|
| T225 | Create api/src/admin/dto/create-exam-type.dto.ts with validation (IsString, Min, Max, IsArray, domain weight sum = 100) | 45 min |
| T226 | Create api/src/admin/dto/update-exam-type.dto.ts (PartialType of CreateExamTypeDto, ID immutable) | 20 min |
| T227 | Create api/src/admin/services/exam-types.service.ts with create(), update(), toggleActive() methods | 60 min |
| T228 | Add POST /admin/exam-types endpoint to AdminExamTypesController (create exam type, return 201) | 30 min |
| T229 | Add PUT /admin/exam-types/:id endpoint to AdminExamTypesController (update exam type, return 200) | 30 min |
| T230 | Add PATCH /admin/exam-types/:id endpoint to AdminExamTypesController (toggle isActive, return 200) | 20 min |

**Current state**: AdminExamTypesController only has `GET /admin/exam-types` and `GET /admin/stats` (read-only). No POST/PUT/PATCH endpoints exist yet.

**Checkpoint**: Backend CRUD for ExamType fully operational. Testable with curl/Postman.

#### Phase 13: Admin Portal — ExamType CRUD Frontend (T231–T238, ~6 dev-hours)

**Goal**: Add admin portal UI for managing exam types.

**Current admin portal state**: 4 pages (LoginPage, DashboardPage, QuestionListPage, QuestionDetailPage), 4 components (Layout, ExamTypeSwitcher, QuestionCard, QuestionForm). No ExamType management pages.

| Task | Description | Est. |
|------|-------------|------|
| T231 | Add exam type CRUD methods to admin-portal/src/services/api.ts (createExamType, updateExamType, toggleActive) | 30 min |
| T232 | Create admin-portal/src/pages/ExamTypeListPage.tsx with table, create button, edit/deactivate actions | 60 min |
| T233 | Create admin-portal/src/components/DomainEditor.tsx — dynamic add/remove/reorder domain rows with weight validation | 60 min |
| T234 | Create admin-portal/src/pages/ExamTypeFormPage.tsx — create/edit form with DomainEditor, field validation | 60 min |
| T235 | Update admin-portal/src/App.tsx routing to include /exam-types and /exam-types/:id routes | 20 min |
| T236 | Update admin-portal/src/components/Layout.tsx sidebar navigation to include Exam Types link | 15 min |
| T237 | Add form validation: ID format (alphanumeric + hyphens), domain weights sum to 100, required fields | 30 min |
| T238 | Add confirmation dialogs for deactivate/reactivate actions with explanation of impact | 15 min |

**Checkpoint**: Admin portal supports full ExamType lifecycle. Admins can create SAA-C03, GCP-ACE, AZ-900 exam types entirely through the UI.

#### Phase 14: App Template & Scaffold Script (T221–T224, ~3 dev-hours)

**Goal**: Create template and script so new apps can be generated in <5 minutes. **Depends on admin portal being complete** so exam types exist in the backend before apps are scaffolded.

| Task | Description | Est. |
|------|-------------|------|
| T221 | Create apps/template/ skeleton with placeholder tokens (__EXAM_TYPE_ID__, __APP_NAME__, __PACKAGE_NAME__) | 30 min |
| T222 | Create scripts/create-app.sh — accepts exam-type, name, package; copies template with substitution | 45 min |
| T223 | Create first new app (apps/aws-saa/) using create-app script for SAA-C03 exam type | 30 min |
| T224 | Verify apps/aws-saa builds, connects to backend, displays correct exam type config | 30 min |

**Checkpoint**: New apps can be created in minutes. aws-saa successfully runs against backend with admin-created SAA-C03 exam type.

#### Phase 15: Testing, EAS Build & Documentation (T239–T246, ~6 dev-hours)

**Goal**: Validate all existing tests pass, add new tests, configure per-app builds, update docs.

| Task | Description | Est. |
|------|-------------|------|
| T239 | Run ALL existing tests in monorepo structure — fix any import path issues | 60 min |
| T240 | Create api/test/admin-exam-types.e2e-spec.ts — E2E tests for POST, PUT, PATCH /admin/exam-types endpoints | 45 min |
| T241 | Create admin portal unit tests for ExamTypeFormPage and DomainEditor components | 30 min |
| T242 | Configure EAS Build in apps/aws-clp/eas.json with existing projectId and signing config | 30 min |
| T243 | Create scripts/build-all.sh to build all apps sequentially or in parallel | 20 min |
| T244 | Test create-app workflow end-to-end: create exam type in admin → run script → build app → verify | 45 min |
| T245 | Update specs/003-play-integrity/quickstart.md with monorepo setup instructions and commands | 30 min |
| T246 | Update CLAUDE.md and README.md with Phase 4 monorepo structure, commands, and architecture notes | 30 min |

**Checkpoint**: All tests passing. Build system configured. Documentation updated. Phase 4 complete.

### Implementation Constraints & Guidelines (Phase 4)

#### ✅ DO: Non-Breaking Migration

- ✅ Use `git mv` to preserve file history when moving code to packages/shared/
- ✅ Keep all function signatures, class names, and export names identical
- ✅ Use TypeScript path aliases (`@exam-app/shared`) for clean imports
- ✅ Ensure `npx expo start` works from each `apps/{name}/` directory
- ✅ Preserve all environment variable patterns (EXPO_PUBLIC_*)
- ✅ Keep `api/` and `api/admin-portal/` in their current locations (no restructuring)

#### ❌ DON'T: Breaking Changes

- ❌ Do NOT modify any business logic during extraction (only import paths change)
- ❌ Do NOT rename exported symbols (components, services, stores, types)
- ❌ Do NOT change the Prisma schema (ExamType model already supports everything needed)
- ❌ Do NOT change public API endpoint paths or contracts
- ❌ Do NOT modify Play Integrity verification logic
- ❌ Do NOT change authentication or cloud sync behavior
- ❌ Do NOT introduce additional monorepo tools (Turborepo, Nx, Lerna)

### Architecture Preservation (Phase 4)

| Component | Before (Phase 1-8) | After (Phase 4) | Impact |
|-----------|-------------------|-----------------|--------|
| **Mobile Code** | `mobile/src/*` | `packages/shared/src/*` | Import path change only |
| **App Identity** | `mobile/app.json` | `apps/aws-clp/app.json` | File location change only |
| **EXAM_TYPE_ID** | `mobile/src/config/app.config.ts` | `apps/{name}/src/config/app.config.ts` | Per-app config (was already config-driven) |
| **Backend API** | `api/src/*` | `api/src/*` (unchanged) | Zero changes |
| **Admin Portal** | Read-only ExamType list | **+ CRUD for ExamType** | Additive only |
| **Play Integrity** | `mobile/src/services/play-integrity.service.ts` | Shared in `packages/shared/` | Same logic, different location |
| **Offline-First** | Questions cached per device | Identical per-app caching | Each app has own SQLite DB |
| **Multi-Tenant** | Backend serves all exam types | Unchanged | Already supported |
| **Build Output** | Single APK/AAB | **Multiple APK/AABs** | One per exam type app |

### Testing Strategy (Phase 4)

| Phase | Test Type | Tool | What |
|-------|-----------|------|------|
| T239 | Regression | Jest + Detox | All 99 existing tests pass in monorepo |
| T240 | E2E | Supertest | ExamType CRUD backend endpoints |
| T241 | Unit | Jest | Admin portal form components |
| T244 | Integration | Manual | End-to-end app creation workflow |

### Risk Mitigation (Phase 4)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Metro bundler fails to resolve workspace packages | Medium | App won't build | Configure `watchFolders`, `nodeModulesPaths` per Expo monorepo docs; validate in T216 |
| Import path changes break existing tests | Medium | Test suite fails | Run tests after each extraction task (T209-T214); fix import paths immediately |
| EAS Build doesn't support monorepo project structure | Low | Can't build release APK | EAS has official monorepo support; configure per-app `eas.json` with correct root |
| Admin ExamType creation allows invalid domain weights | Medium | Bad exam config | Backend validation (DTO) ensures weights sum to 100; frontend provides real-time feedback |
| npm workspaces hoisting breaks native modules | Medium | Expo build fails | Use `.npmrc` with `hoist=true` or configure `nohoist` for problematic packages |

### Success Metrics (Phase 4)

#### Functional Success
- ✅ SC-009: `apps/aws-clp/` produces identical app to original `mobile/`
- ✅ SC-010: New app creation takes <30 minutes end-to-end
- ✅ SC-011: Bug fix in `packages/shared/` immediately available to all apps
- ✅ SC-012: Admin can create new exam type without developer
- ✅ SC-013: All 99+ existing tests pass with zero logic changes
- ✅ SC-014: Each app has unique Play Store identity (package name, icon)

#### Code Quality
- ✅ Shared code: 95%+ of mobile logic in `packages/shared/`
- ✅ App wrapper: <10 files per app (config + branding only)
- ✅ Zero code duplication across apps
- ✅ Admin CRUD test coverage >85%

### Timeline Estimate (Phase 4-6)

| Phase | Duration | Dependencies | Status |
|-------|----------|--------------|--------|
| Phase 10: Monorepo Foundation | 1 week (6 hrs) | Phase 1-8 complete | ✅ Complete |
| Phase 11: App Wrapper Migration | 1 week (5 hrs) | Phase 10 complete | ✅ Complete |
| Phase 12: Admin CRUD Backend | 1 week (5 hrs) | Phase 11 complete | 📋 Not Started |
| Phase 13: Admin CRUD Frontend | 1 week (6 hrs) | Phase 12 complete | 📋 Not Started |
| Phase 14: Template & Script | 0.5 week (3 hrs) | Phase 13 complete | 📋 Not Started |
| Phase 15: Testing & Docs | 1 week (6 hrs) | Phase 14 complete | 📋 Not Started |
| Phase 16: Login-Gated Free Tier | 1.5 weeks (10 hrs) | Phase 15 complete | 📋 Not Started |
| Phase 17: Play Billing Subscription | 2 weeks (12 hrs) | Phase 16 complete + Play monetization access (granted) | 📋 Ready |
| **Total** | **~8-9 weeks** | **~53 dev-hours (1 developer)** | |

### Recommended Execution (1 Developer — Updated Order)

**Week 1** (Admin Portal Backend):
- T225-T230: Backend ExamType CRUD endpoints (POST, PUT, PATCH)

**Week 2** (Admin Portal Frontend):
- T231-T238: Admin portal ExamType management UI

**Week 3** (Template & Scaffold):
- T221-T224: App template skeleton + create-app.sh script + verify with SAA-C03

**Week 4** (Testing & Docs):
- T239-T246: Regression tests, E2E tests, EAS build config, documentation

**Week 5-6** (Free Tier — after MVP stable):
- T247-T258: Login-gated free tier, 15 free questions, upgrade flow

**Week 7-8** (Play Billing Subscriptions — Play access granted):
- T259-T264: Subscription infrastructure (billing service, SQLite extension, expiry/renewal logic)
- T265-T266: Subscription UI (3-plan selector on UpgradeScreen, edge case handling)
- T267: Multi-app subscription SKU config + deprecate one-time purchase references
- T268-T270: Testing, subscription setup guide, E2E validation

### Comparison: Clone vs Monorepo

| Aspect | Clone folders | Monorepo (Phase 4) |
|--------|--------------|-------------------|
| **Maintenance** | 10x work per bug fix | 1x work — fix in shared, all apps get it |
| **Disk Usage** | ~500MB per app clone | ~50MB per app wrapper + shared |
| **Build Time** | 10x independent builds | 1x shared + thin per-app build |
| **Code Reuse** | 0% — full duplication | 95%+ — only config differs |
| **Testing** | 10x test suites | 1x shared tests + per-app smoke tests |
| **New App Time** | Days (clone + modify) | 30 minutes (script + config) |
| **Version Drift** | High risk | Impossible — single source of truth |
| **Recommended** | ❌ No | ✅ Yes |

---

## Phase 5: Monetization — Login-Gated Free Tier + Play Billing (T247–T270)

**Status**: 📋 Ready for Implementation (Phase 16-17)  
**Prerequisites**: Phase 4 (T207-T246) ✅ Complete, all MVP features stable  
**Spec**: [spec.md § Phase 5](spec.md#phase-5-monetization--login-gated-free-tier--play-billing)  
**Goal**: Convert from paid app model to freemium model: require Google login for all users, provide 15 free exam questions, and integrate Play Billing API for a subscription-based model (Monthly $2.99, Quarterly $6.99, Annual $19.99) to unlock the full question bank.

### Summary

The current UpgradeScreen (`packages/shared/src/screens/UpgradeScreen.tsx`) already has a purchase UI with benefits list and CTA button — but no actual billing integration. Phase 5 adds the backend and mobile logic to make it functional with a 3-plan subscription model.

**Why this order**: Monetization is intentionally placed after all MVP features are stable. The free tier provides conversion funnel data, and Play Billing requires active Play Console monetization access (now granted). This separation ensures the core app experience is polished before adding billing complexity.

**Multi-app compatibility**: Each exam app has its own Play Store listing and its own set of subscription product SKUs (3 per app: monthly, quarterly, annual). Subscription status is per-app, per-user — no cross-app entitlement issues. The free question limit and billing logic live in `packages/shared/` so all apps share the same implementation.

**Subscription Pricing**:
| Plan | Price | Effective $/mo | Savings | Badge |
|------|-------|----------------|---------|-------|
| Monthly | $2.99/mo | $2.99 | — | — |
| Quarterly | $6.99/qtr | $2.33 | 22% | **MOST POPULAR** |
| Annual | $19.99/yr | $1.67 | 44% | **BEST VALUE** |

### Technical Context

**Billing Library**: `react-native-iap` (React Native In-App Purchases) — supports Google Play Billing Library v6+ subscriptions  
**Purchase Type**: Subscription-based (auto-renewable) — 3 plans per app: Monthly ($2.99), Quarterly ($6.99), Annual ($19.99)  
**Free Tier**: 15 questions accessible without subscription, login required  
**Question Gating**: Client-side enforcement using purchase store + server-side validation optional  
**Existing Foundation**: UpgradeScreen UI, Google OAuth login, question repository, Zustand stores

### Constitution Check (Phase 5)

✅ **Passes Constitution**:

- ✅ **No new projects**: Adds billing service + purchase store to existing packages/shared/
- ✅ **Architecture preserved**: Offline-first preserved (purchase status cached locally). Multi-tenant preserved (per-app SKUs).
- ✅ **Backward compatible**: Existing users who already have the app continue to work. Free tier is the new default for new installs. PurchaseStatus table extended (not replaced) with subscription fields.
- ✅ **Incremental**: Phase 16 (free tier) works independently of Phase 17 (billing). Phase 16 can ship while waiting for Play access. Phase 17 adds subscription columns via ALTER TABLE (non-breaking).
- ✅ **Test coverage**: Unit tests for gating logic, E2E tests for purchase flow
- ✅ **Development-friendly**: Dev mode bypasses purchase check (similar to Play Integrity bypass)

### Implementation Phases (Phase 5)

#### Phase 16: Login-Gated Free Tier (T247–T258, ~10 dev-hours)

**Goal**: Require Google login for all users. Free tier gives access to 15 questions. Motivate upgrade via limited access + UpgradeScreen.

| Task | Description | Est. |
|------|-------------|------|
| T247 | Define tier constants in packages/shared/src/config/tiers.ts: `FREE_QUESTION_LIMIT = 15`, `TierLevel = 'FREE' \| 'PREMIUM'` | 20 min |
| T248 | Create packages/shared/src/stores/purchase.store.ts (Zustand): `tierLevel`, `isPremium`, `setPremium()`, `reset()`. Persist to SQLite. | 45 min |
| T249 | Create packages/shared/src/storage/repositories/purchase.repository.ts: `getPurchaseStatus()`, `savePurchaseStatus()`, `clearPurchaseStatus()` with SQLite table `PurchaseStatus` | 45 min |
| T250 | Update packages/shared/src/storage/database.ts: add PurchaseStatus table migration (`id TEXT PRIMARY KEY DEFAULT 'singleton'`, `tier_level TEXT NOT NULL DEFAULT 'FREE'`, `product_id TEXT`, `purchase_token TEXT`, `purchased_at TEXT`, `created_at TEXT`, `updated_at TEXT`) | 30 min |
| T251 | Make login mandatory: update packages/shared/src/AppRoot.tsx to require Google authentication before granting any access. Show AuthScreen as gate if not logged in. | 45 min |
| T252 | Implement question gating in packages/shared/src/storage/repositories/question.repository.ts: add `getQuestionsForTier(tier, limit?)` method that returns all questions for PREMIUM or first N for FREE. Use consistent ordering (by domain, then id) so free users always see the same 15. | 60 min |
| T253 | Update packages/shared/src/services/exam-generator.service.ts: respect tier limits when generating exams. FREE tier generates mini-exams from the 15 available questions. PREMIUM generates full exams. | 45 min |
| T254 | Update packages/shared/src/services/practice.service.ts: respect tier limits in practice mode. FREE tier limits practice to the 15 free questions. | 30 min |
| T255 | Update packages/shared/src/screens/HomeScreen.tsx: show free tier indicator (e.g., "15/200 questions available"), upgrade prompt card, and link to UpgradeScreen. | 45 min |
| T256 | Add locked question UI indicators in packages/shared/src/components/QuestionCard.tsx: show lock icon and "Upgrade to access" overlay for premium-only questions in listing views. | 30 min |
| T257 | Create packages/shared/__tests__/purchase-tier.test.ts: unit tests for tier gating logic, question limiting, exam generation with tier limits, purchase store state transitions. | 60 min |
| T258 | Update packages/shared/src/screens/UpgradeScreen.tsx: add free vs premium comparison table, update CTA to prepare for billing integration (placeholder handler). | 30 min |

**Checkpoint**: Login required. Free tier limited to 15 questions. Upgrade prompt visible. UpgradeScreen accessible. No billing yet.

#### Phase 17: Play Billing Subscription Model (T259–T270, ~12 dev-hours)

**Goal**: Integrate Google Play Billing API for subscription-based access (Monthly $2.99, Quarterly $6.99, Annual $19.99). Active subscription unlocks full question bank. Expired subscription auto-downgrades to FREE. **READY — Play Console monetization access granted.**

**Prerequisite**: Active Google Play Console monetization profile and subscription products created (3 per app).

**Sub-phases**:
- **Phase 17A** (T259–T264): Subscription infrastructure — billing service, SQLite extension, expiry/renewal handling
- **Phase 17B** (T265–T266): Subscription UI — 3-plan selector on UpgradeScreen, edge case handling
- **Phase 17C** (T267): Multi-app SKU config, deprecate one-time purchase references
- **Testing** (T268–T270): Unit tests, setup guide, E2E validation

| Task | Description | Est. |
|------|-------------|------|
| T259 | Add `react-native-iap` dependency. Configure for Android subscriptions. Verify build. | 30 min |
| T260 | Create packages/shared/src/services/billing.service.ts: `initBilling()`, `getSubscriptions()`, `subscribe(sku)`, `restorePurchases()`, `validateSubscription()`, `checkExpiry()`, `handleRenewal()`, `cancelSubscription()`. Handle connection lifecycle. | 90 min |
| T261 | Implement subscription flow: connect → fetch plan details → initiate subscription → handle success/failure/pending → update purchase store with expiry data → acknowledge. | 60 min |
| T262 | Extend PurchaseStatus SQLite table (ALTER TABLE): add `subscription_type TEXT`, `expiry_date TEXT`, `auto_renewing INTEGER`. Non-breaking — existing rows keep null values. Update repository interface. | 45 min |
| T262.5 | (Optional) Create api/src/billing/ module: `POST /api/billing/verify-subscription` — validates subscription via Google Play Developer API (`purchases.subscriptionsv2.get`). Returns expiry, auto-renew status, payment state. | 60 min |
| T263 | Update purchase store: add `subscriptionType`, `expiryDate`, `autoRenewing` state. Add `setSubscription()` and `checkAndDowngrade()` actions. On launch: load → check expiry → downgrade if expired. | 45 min |
| T264 | Implement subscription restoration and expiry: restore active subscriptions on reinstall. `checkExpiry()` on each launch. Auto-downgrade expired + non-renewing to FREE. Attempt restore for expired + auto-renewing. Grace period + account hold handling. | 60 min |
| T265 | Update UpgradeScreen: 3-plan subscription selector (Monthly/Quarterly/Annual). Quarterly highlighted as "MOST POPULAR". Connect CTA to `subscribe()`. Show localized prices. Add "Restore Subscription" and "Manage Subscription" links. | 60 min |
| T266 | Handle subscription edge cases: pending payment, cancelled (access until expiry), expired auto-downgrade, refund, network error, grace period, account hold, plan switching. | 45 min |
| T267 | Configure per-app subscription SKUs: `monthly_{exam_type}`, `quarterly_{exam_type}`, `annual_{exam_type}`. Update AppConfig, app configs, template, create-app.sh. Deprecate `forever_access_*` references. | 45 min |
| T268 | Create billing.service.test.ts: mock react-native-iap. Test all 3 plans, subscription/restore/expiry/renewal/downgrade/grace period flows. | 60 min |
| T269 | Create subscription-setup-guide.md: Play Console setup for 3 subscription products per app, pricing, test mode, lifecycle docs. | 30 min |
| T270 | E2E validation: full subscription flow → expiry → downgrade → resubscribe → restore. Test plan switching. Test with 2 apps. | 60 min |

**Checkpoint**: Subscription model works end-to-end. Free users see 15 questions. Subscribed users see all. Expired subscription = auto-downgrade to FREE. 3 SKUs per app.

### Implementation Constraints & Guidelines (Phase 5)

#### ✅ DO: Non-Breaking Monetization

- ✅ Free tier is the default — no subscription required to use core app features
- ✅ Login required but frictionless via existing Google OAuth
- ✅ Subscription status cached locally for offline-first compatibility
- ✅ Per-app subscription SKUs prevent cross-app conflicts (3 SKUs per app)
- ✅ `__DEV__` bypass for billing (skip subscription check in dev mode)
- ✅ Restore subscriptions on reinstall (no double-charging)
- ✅ Auto-downgrade to FREE on subscription expiry (no manual intervention required)

#### ❌ DON'T: Breaking Changes

- ❌ Do NOT remove or modify Play Integrity logic — it remains independent of billing
- ❌ Do NOT gate ALL features behind subscription — free tier must be functional
- ❌ Do NOT require network for subscription validation on every launch (cache locally, check expiry date)
- ❌ Do NOT share subscription entitlements across different exam apps
- ❌ Do NOT hardcode prices — use Play Billing API to fetch localized prices
- ❌ Do NOT store sensitive purchase tokens in plain text (use purchase repository with SQLite)
- ❌ Do NOT introduce new TierLevel values — keep only FREE | PREMIUM
- ❌ Do NOT drop or recreate PurchaseStatus table — use ALTER TABLE to add subscription columns

### Architecture Preservation (Phase 5)

| Component | Before (Phase 4) | After (Phase 5) | Impact |
|-----------|-----------------|-----------------|--------|
| **App Access** | Full access after Play Integrity | **Login required + free tier** | Additive gate |
| **Question Access** | All questions available | **15 free, rest behind subscription** | Additive gating |
| **UpgradeScreen** | Static UI (no billing) | **3-plan subscription selector** | Enhanced existing |
| **Play Integrity** | Blocks sideloaded APKs | Unchanged | Zero impact |
| **Offline-First** | Full offline after verification | Subscription status cached locally + expiry check | Preserved |
| **Multi-App** | Per-app config | **+ per-app subscription SKUs (3 per app)** | Additive only |
| **Auth** | Optional Google login | **Required Google login** | Enforcement change |
| **Backend** | Stateless integrity proxy | **+ optional subscription verification** | Additive only |
| **PurchaseStatus** | Stores tier_level, product_id | **+ subscription_type, expiry_date, auto_renewing** | Extended (ALTER TABLE) |

### Risk Mitigation (Phase 5)

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Play Console access delays | Low | Phase 17 unblocked | Phase 16 ships independently. Play Console monetization access now granted. |
| Users dislike mandatory login | Medium | Lower adoption | Free tier is generous (15 questions). Login enables cloud sync benefits. |
| Subscription fatigue | Medium | Lower conversion | Quarterly plan ($6.99) positioned as default — aligns with typical 2-3 month exam study cycle. Annual ($19.99) provides best value anchor. |
| Subscription spoofing | Low | Revenue loss | Server-side validation (T262.5) + Play Integrity blocks sideloaded apps |
| react-native-iap compatibility issues | Medium | Billing broken | Library is mature (10K+ GitHub stars). Test on multiple devices. Subscriptions API well-supported. |
| Cross-app SKU conflicts | Low | Wrong subscription | Per-app subscription SKUs with examTypeId in name prevents conflicts (3 SKUs per app) |
| Expiry handling race conditions | Medium | PREMIUM shown to expired user | Check expiry on every app launch. If auto-renewing + expired, attempt restore before granting access. |
| Subscription cancellation UX | Low | User confusion | Show clear status in SettingsScreen and UpgradeScreen. Link to Play Store subscription management. |

### Success Metrics (Phase 5)

#### Functional Success
- ✅ SC-015: Login required for all users (no anonymous access)
- ✅ SC-016: Free tier limited to exactly 15 questions (consistent set per exam type)
- ✅ SC-017: Subscription unlocks full question bank immediately upon activation
- ✅ SC-018: Active subscription persists across reinstalls via Google Play restore
- ✅ SC-019: Each app has 3 unique subscription SKUs (monthly, quarterly, annual — no cross-app conflicts)
- ✅ SC-020: Dev mode bypasses subscription check
- ✅ SC-021: Offline access preserved after subscription (no network required for cached subscription)
- ✅ SC-022: Expired subscription auto-downgrades to FREE tier
- ✅ SC-023: Quarterly plan presented as default recommended option

#### Code Quality
- ✅ Billing service test coverage >85%
- ✅ Purchase gating logic test coverage >90%
- ✅ Subscription lifecycle test coverage (active, expired, cancelled, grace period, account hold)
- ✅ Zero breaking changes to existing Play Integrity, auth, sync logic
- ✅ PurchaseStatus table extended, not replaced (ALTER TABLE for new columns)
