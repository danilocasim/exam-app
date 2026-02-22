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

### Implementation Phases (Phase 4)

#### Phase 10: Monorepo Foundation (T207–T214, ~6 dev-hours)

**Goal**: Set up npm workspaces, create packages/shared/, and extract shared code.

| Task | Description | Est. |
|------|-------------|------|
| T207 | Initialize npm workspaces at root, create packages/shared/package.json | 30 min |
| T208 | Create packages/shared/ directory structure and tsconfig.json | 30 min |
| T209 | Extract shared components from mobile/src/components/ → packages/shared/src/components/ | 45 min |
| T210 | Extract shared services from mobile/src/services/ → packages/shared/src/services/ | 45 min |
| T211 | Extract shared stores from mobile/src/stores/ → packages/shared/src/stores/ | 30 min |
| T212 | Extract shared storage from mobile/src/storage/ → packages/shared/src/storage/ | 30 min |
| T213 | Extract shared screens from mobile/src/screens/ → packages/shared/src/screens/ | 45 min |
| T214 | Extract shared navigation from mobile/src/navigation/ → packages/shared/src/navigation/ | 30 min |

**Checkpoint**: packages/shared/ contains all reusable code. Not yet imported by any app.

#### Phase 11: App Wrapper Migration (T215–T220, ~5 dev-hours)

**Goal**: Convert mobile/ into apps/aws-clp/ thin wrapper using shared code.

| Task | Description | Est. |
|------|-------------|------|
| T215 | Create apps/aws-clp/ directory, move mobile/ app-specific files (app.json, assets/, eas.json) | 45 min |
| T216 | Configure Metro bundler in apps/aws-clp/metro.config.js for workspace package resolution | 30 min |
| T217 | Configure Babel in apps/aws-clp/babel.config.js for workspace module resolution | 20 min |
| T218 | Create apps/aws-clp/App.tsx importing AppRoot from @exam-app/shared with examTypeId='CLF-C02' | 30 min |
| T219 | Create packages/shared/src/AppRoot.tsx that accepts examTypeId prop and renders the full app tree | 45 min |
| T220 | Verify apps/aws-clp builds and runs identically to original mobile/ (zero regression) | 60 min |

**Checkpoint**: aws-clp app runs from apps/aws-clp/ using shared code. Original mobile/ behavior preserved exactly.

#### Phase 12: App Template & Scaffold Script (T221–T224, ~3 dev-hours)

**Goal**: Create template and script so new apps can be generated in <5 minutes.

| Task | Description | Est. |
|------|-------------|------|
| T221 | Create apps/template/ skeleton with placeholder tokens (__EXAM_TYPE_ID__, __APP_NAME__, __PACKAGE_NAME__) | 30 min |
| T222 | Create scripts/create-app.sh — accepts exam-type, name, package; copies template with substitution | 45 min |
| T223 | Create first new app (apps/aws-saa/) using create-app script for SAA-C03 exam type | 30 min |
| T224 | Verify apps/aws-saa builds, connects to backend, displays correct exam type config | 30 min |

**Checkpoint**: New apps can be created in minutes. aws-saa successfully runs against backend.

#### Phase 13: Admin Portal — ExamType CRUD Backend (T225–T230, ~5 dev-hours)

**Goal**: Add backend endpoints for creating, updating, and deactivating exam types.

| Task | Description | Est. |
|------|-------------|------|
| T225 | Create api/src/admin/dto/create-exam-type.dto.ts with validation (IsString, Min, Max, IsArray, domain weight sum = 100) | 45 min |
| T226 | Create api/src/admin/dto/update-exam-type.dto.ts (PartialType of CreateExamTypeDto, ID immutable) | 20 min |
| T227 | Create api/src/admin/services/exam-types.service.ts with create(), update(), toggleActive() methods | 60 min |
| T228 | Add POST /admin/exam-types endpoint to AdminExamTypesController (create exam type, return 201) | 30 min |
| T229 | Add PUT /admin/exam-types/:id endpoint to AdminExamTypesController (update exam type, return 200) | 30 min |
| T230 | Add PATCH /admin/exam-types/:id endpoint to AdminExamTypesController (toggle isActive, return 200) | 20 min |

**Checkpoint**: Backend CRUD for ExamType fully operational. Testable with curl/Postman.

#### Phase 14: Admin Portal — ExamType CRUD Frontend (T231–T238, ~6 dev-hours)

**Goal**: Add admin portal UI for managing exam types.

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

**Checkpoint**: Admin portal supports full ExamType lifecycle. Admins can create new exam types without developer help.

#### Phase 15: Testing, EAS Build & Documentation (T239–T246, ~6 dev-hours)

**Goal**: Validate all existing tests pass, add new tests, configure per-app builds, update docs.

| Task | Description | Est. |
|------|-------------|------|
| T239 | Run ALL existing tests (99 tests from Phase 1-8) in monorepo structure — fix any import path issues | 60 min |
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

### Timeline Estimate (Phase 4)

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 10: Monorepo Foundation | 1 week (6 hrs) | Phase 1-8 complete |
| Phase 11: App Wrapper Migration | 1 week (5 hrs) | Phase 10 complete |
| Phase 12: Template & Script | 0.5 week (3 hrs) | Phase 11 complete |
| Phase 13: Admin CRUD Backend | 1 week (5 hrs) | Can parallel with Phase 10-12 |
| Phase 14: Admin CRUD Frontend | 1 week (6 hrs) | Phase 13 complete |
| Phase 15: Testing & Docs | 1 week (6 hrs) | All previous phases |
| **Total** | **~4-5 weeks** | **~31 dev-hours (1 developer)** |

### Recommended Execution (1-2 Developers)

**Week 1**:
- Dev A: T207-T214 (Monorepo foundation, extract shared code)
- Dev B (optional): T225-T230 (Backend ExamType CRUD — independent of monorepo)

**Week 2**:
- Dev A: T215-T220 (App wrapper migration, verify zero regression)
- Dev B (optional): T231-T238 (Admin portal frontend)

**Week 3**:
- Dev A: T221-T224 (Template and scaffold script)
- Dev B: T231-T238 (Admin portal frontend, continued)

**Week 4**:
- Both: T239-T246 (Testing, EAS build, documentation)

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
