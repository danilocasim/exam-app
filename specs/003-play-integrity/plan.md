# Implementation Plan: Play Integrity Guard

**Branch**: `003-play-integrity` | **Date**: February 15, 2026 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `/specs/003-play-integrity/spec.md`  
**Prerequisites**: Phase 2 (002-cloudprep-mobile) ✅ Complete - Google OAuth authentication, cloud sync infrastructure, JWT token management

## Summary

Play Integrity Guard adds one-time device verification on first app launch using Google's Play Integrity API. Verification runs concurrently with app initialization, caches result locally for 30 days, and blocks sideloaded/tampered builds on Android. Development builds bypass verification automatically. Backend provides stateless token decryption proxy only; enforcement is entirely client-side. Production deployment uses AWS App Runner for backend hosting and AWS Aurora PostgreSQL Serverless v2 for the database.

**Building on Phase 2**: This feature leverages the authentication infrastructure from Phase 2 (JWT tokens, API endpoints, mobile services architecture) and extends it with Play Integrity verification. The offline-first design from Phase 1-2 is preserved—after initial verification, the app runs fully offline.

**Implementation Scope**: 55 tasks (T151-T205) covering mobile + backend implementation, integration testing, and AWS production deployment infrastructure.

## Technical Context

**Language/Version**: TypeScript 5.x (all components)  
**Primary Dependencies**: @react-native-google-signin/google-signin ^10.0.0 (existing from Phase 2, supports Play Integrity token requests), expo-sqlite (existing), Google Play Console API credentials  
**Storage**: SQLite via expo-sqlite (mobile local verification cache), AWS Aurora PostgreSQL Serverless v2 (production backend database)  
**Production Infrastructure**: AWS App Runner (backend hosting), AWS Secrets Manager (credentials), AWS Systems Manager Parameter Store (configuration), VPC with private subnets (database security)  
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

**Sprint 4: AWS Production Deployment** (T191–T205, ~8 dev-hours)
- T191-T195: AWS infrastructure setup (Aurora PostgreSQL Serverless v2, Secrets Manager, VPC Connector)
- T196-T199: Database migration and seed scripts for production
- T200-T203: AWS App Runner service configuration and deployment
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

### Phase 3b: AWS Production Deployment (Sprint 4)
1. **Infrastructure Setup** (T191-T195):
   - Create AWS Aurora PostgreSQL Serverless v2 cluster in VPC
   - Configure security groups for Aurora (inbound from App Runner VPC Connector)
   - Store database credentials in AWS Secrets Manager
   - Store non-sensitive config in AWS Systems Manager Parameter Store
   - Create VPC Connector for App Runner to access private Aurora

2. **Database Migration** (T196-T199):
   - Update Prisma schema to use DATABASE_URL from Secrets Manager
   - Create production migration script (scripts/migrate-production.sh)
   - Create production seed script (scripts/seed-production.sh)
   - Test database connection from local using temporary public access

3. **App Runner Deployment** (T200-T203):
   - Create apprunner.yaml configuration (Node.js 20, build + start commands)
   - Deploy App Runner service from GitHub 003-play-integrity branch
   - Configure environment variables (DATABASE_URL, JWT_SECRET, Google OAuth, Play Integrity credentials)
   - Set up health checks (GET /health endpoint)

4. **Mobile Configuration** (T204):
   - Update mobile API config with App Runner service URL
   - Environment-based URL selection (__DEV__ → localhost, production → App Runner)

5. **Documentation & Monitoring** (T205):
   - Create deployment-guide.md with infrastructure setup, migration steps, rollback procedures
   - Monitor CloudWatch logs and Aurora metrics
   - Monitor Play Store metrics: crash rates, user feedback

### Rollback Plan
- **Backend**: App Runner supports instant rollback to previous revision (zero downtime)
- **Database**: Aurora automated backups (1-day retention); manual snapshots before migrations
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
