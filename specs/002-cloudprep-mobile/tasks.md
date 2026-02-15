# Tasks: CloudPrep Mobile

**Input**: Design documents from `/specs/002-cloudprep-mobile/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.yaml ✓
**Status**: ✅ **PHASE 1 COMPLETE (115 tasks)** | ✅ **PHASE 2A COMPLETE (T112-T119 = 8 tasks)** | ✅ **PHASE 2B COMPLETE (T120-T127 = 8 tasks)** | 🔄 **PHASE 2C PARTIAL (T128-T139 = 12/12 tasks, T128-T135 NOT STARTED)** | 📋 **PHASE 2D READY (T140-T150 = 11 tasks)**

## Completion Summary

| Phase | Task Range | Count | Status |
|-------|-----------|-------|--------|
| **Phase 1** |  |  |  |
| Setup | T001-T008 | 8 | ✅ Complete |
| Foundational | T009-T030 | 22 | ✅ Complete |
| US1: Exam Mode | T031-T048 | 18 | ✅ Complete |
| US2: Practice | T049-T058 | 10 | ✅ Complete |
| US3: Review | T059-T065 | 7 | ✅ Complete |
| US4: Analytics | T066-T074 | 9 | ✅ Complete |
| US5: Admin | T075-T100 | 26 | ✅ Complete |
| Polish | T101-T111c | 14 | ✅ Complete |
| **Phase 1 Total** | **T001-T111c** | **115** | **✅ 100% COMPLETE** |
| **Phase 2** | | | |
| 2A: Backend Auth | T112-T119 | 8 | 📋 Ready |
| 2B: Backend Persistence | T120-T127 | 8 | 📋 Ready |
| 2C: Mobile Integration | T128-T142 | 15 | 📋 Ready |
| 2D: Testing & Docs | T143-T150 | 8 | 📋 Ready |
| **Phase 2 Total** | **T112-T150** | **39** | **📋 NOT STARTED** |

### Test Coverage Metrics (Phase 1)

- **Unit Test Cases**: 78 (mobile + API services)
- **Performance Benchmarks**: 21 (T111a-c)
- **Total Test Cases**: 99
- **Jest Configuration**: Present with coverage thresholds
- **Requirements Covered**: 32/33 FRs tested

**Phase 2 Tests** (when implemented):
- Expected: 35+ additional tests (auth, sync, analytics, performance)
- Total projected: 134+ test cases across both phases

---

## Format: `- [ ] [TaskID] [P?] [Story?] Description with file path`

- **[ ]**: Checkbox to mark completion
- **[ID]**: Task identifier (T001-T150)
- **[P]**: Marker if parallelizable (different files, no blocking dependencies)
- **[Story]**: User story label for Phase 1 (US1-US5) and Phase 2 (US6-US8)
- Include exact file paths in descriptions

## Path Conventions

- **api/**: Backend (NestJS + Prisma + PostgreSQL)
- **mobile/**: Mobile app (React Native + Expo)
- **api/admin-portal/**: Admin SPA (React)
- **specs/**: Feature documentation

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize Expo mobile project in mobile/ with TypeScript template
- [x] T002 [P] Install mobile dependencies: expo-sqlite, react-navigation, zustand, nativewind, axios in mobile/package.json
- [x] T003 [P] Initialize NestJS project in api/ with Fastify adapter
- [x] T004 [P] Install api dependencies: prisma, @nestjs/config, class-validator, @nestjs/jwt, passport, bcrypt in api/package.json
- [x] T005 [P] Configure ESLint and Prettier for mobile/ and api/
- [x] T006 [P] Create mobile project structure: mobile/src/{screens,components,services,stores,storage,config,navigation}/
- [x] T007 [P] Create api project structure: api/src/{exam-types,questions,admin,prisma,common}/
- [x] T008 Setup Prisma with PostgreSQL in api/prisma/schema.prisma per data-model.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Backend Foundation

- [x] T009 Create ExamType model in api/prisma/schema.prisma with domains JSON field
- [x] T010 [P] Create Admin model in api/prisma/schema.prisma with email and passwordHash
- [x] T011 [P] Create Question model in api/prisma/schema.prisma with examTypeId FK and status enum
- [x] T012 [P] Create SyncVersion model in api/prisma/schema.prisma with examTypeId unique constraint
- [x] T013 Run initial Prisma migration: npx prisma migrate dev --name init
- [x] T014 Create PrismaService in api/src/prisma/prisma.service.ts and PrismaModule in api/src/prisma/prisma.module.ts
- [x] T015 [P] Create seed script for AWS CCP exam type in api/prisma/seed.ts
- [x] T016 [P] Create global validation pipe and error filters in api/src/common/
- [x] T017 [P] Create base DTOs for pagination and error responses in api/src/common/dto/
- [x] T018 Implement ExamTypesModule with GET /exam-types/{id} endpoint in api/src/exam-types/
- [x] T019 Configure environment variables and app config in api/src/config/

### Mobile Foundation

- [x] T020 Setup SQLite database initialization in mobile/src/storage/database.ts
- [x] T021 [P] Create mobile app config with EXAM_TYPE_ID in mobile/src/config/app.config.ts
- [x] T022 Create SQLite schema for Question table in mobile/src/storage/schema.ts
- [x] T023 [P] Create SQLite schema for ExamAttempt and ExamAnswer tables in mobile/src/storage/schema.ts
- [x] T024 [P] Create SQLite schema for PracticeSession and PracticeAnswer tables in mobile/src/storage/schema.ts
- [x] T025 [P] Create SQLite schema for SyncMeta and UserStats tables in mobile/src/storage/schema.ts
- [x] T026 Setup React Navigation with NavigationContainer in mobile/src/navigation/
- [x] T027 Configure NativeWind/Tailwind in mobile/tailwind.config.js
- [x] T028 [P] Create Axios API client with base URL config in mobile/src/services/api.ts
- [x] T029 Implement SyncService for fetching exam type config and questions in mobile/src/services/sync.service.ts
- [x] T030 Create initial question bank bundle for offline-first in mobile/assets/questions/

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Take Timed Exam Simulation (Priority: P1) 🎯 MVP

**Goal**: Generate and take a full 65-question timed exam with AWS domain weighting, auto-save, and pass/fail scoring

**Independent Test**: Launch exam → answer 65 questions → see pass/fail result with domain breakdown

### Backend Tasks (US1)

- [x] T031 [P] [US1] Implement GET /exam-types/{examTypeId}/questions endpoint in api/src/exam-types/exam-types.controller.ts
- [x] T032 [P] [US1] Implement GET /exam-types/{examTypeId}/questions/version endpoint in api/src/exam-types/exam-types.controller.ts
- [x] T033 [US1] Create QuestionBankResponse and VersionResponse DTOs in api/src/exam-types/dto/

### Mobile Tasks (US1)

- [x] T034 [US1] Create QuestionRepository for SQLite CRUD in mobile/src/storage/repositories/question.repository.ts
- [x] T035 [P] [US1] Create ExamAttemptRepository for SQLite CRUD in mobile/src/storage/repositories/exam-attempt.repository.ts
- [x] T036 [P] [US1] Create ExamAnswerRepository for SQLite CRUD in mobile/src/storage/repositories/exam-answer.repository.ts
- [x] T037 [US1] Implement ExamGeneratorService (weighted random selection by domain) in mobile/src/services/exam-generator.service.ts
- [x] T038 [US1] Implement ExamSessionService (start, save answer, navigate, submit) in mobile/src/services/exam-session.service.ts
- [x] T039 [US1] Implement ScoringService (calculate score, pass/fail, domain breakdown) in mobile/src/services/scoring.service.ts
- [x] T040 [US1] Create examStore using Zustand for exam state management in mobile/src/stores/exam.store.ts
- [x] T041 [US1] Create HomeScreen with "Start Exam" button in mobile/src/screens/HomeScreen.tsx
- [x] T042 [US1] Create ExamScreen with question display, options, navigation in mobile/src/screens/ExamScreen.tsx
- [x] T043 [P] [US1] Create QuestionCard component with option selection in mobile/src/components/QuestionCard.tsx
- [x] T044 [P] [US1] Create Timer component with countdown display in mobile/src/components/Timer.tsx
- [x] T045 [P] [US1] Create QuestionNavigator component (flag, jump to question) in mobile/src/components/QuestionNavigator.tsx
- [x] T046 [US1] Create ExamResultsScreen with score and domain breakdown in mobile/src/screens/ExamResultsScreen.tsx
- [x] T047 [US1] Implement exam resumption logic (check for in-progress exam on app launch) in mobile/src/services/exam-session.service.ts
- [x] T048 [US1] Handle exam expiration (24h limit) and mark as abandoned in mobile/src/services/exam-session.service.ts

**Checkpoint**: User Story 1 complete - users can take full timed exams with scoring

---

## Phase 4: User Story 2 - Practice by Domain (Priority: P1) 🎯 MVP

**Goal**: Take untimed practice sessions filtered by domain and/or difficulty with immediate feedback

**Independent Test**: Select domain → answer questions → see instant feedback with explanations

### Mobile Tasks (US2)

- [x] T049 [P] [US2] Create PracticeSessionRepository in mobile/src/storage/repositories/practice-session.repository.ts
- [x] T050 [P] [US2] Create PracticeAnswerRepository in mobile/src/storage/repositories/practice-answer.repository.ts
- [x] T051 [US2] Implement PracticeService (start session, submit answer, end session) in mobile/src/services/practice.service.ts
- [x] T052 [US2] Create practiceStore using Zustand in mobile/src/stores/practice.store.ts
- [x] T053 [US2] Create PracticeSetupScreen (domain/difficulty selection) in mobile/src/screens/PracticeSetupScreen.tsx
- [x] T054 [US2] Create PracticeScreen with immediate feedback display in mobile/src/screens/PracticeScreen.tsx
- [x] T055 [P] [US2] Create FeedbackCard component (correct/incorrect, explanation) in mobile/src/components/FeedbackCard.tsx
- [x] T056 [P] [US2] Create DomainSelector component in mobile/src/components/DomainSelector.tsx
- [x] T057 [P] [US2] Create DifficultySelector component in mobile/src/components/DifficultySelector.tsx
- [x] T058 [US2] Create PracticeSummaryScreen (session results) in mobile/src/screens/PracticeSummaryScreen.tsx

**Checkpoint**: User Story 2 complete - users can practice by domain with feedback

---

## Phase 5: User Story 3 - Review Exam Results (Priority: P2)

**Goal**: Review completed exams with explanations for each question

**Independent Test**: Complete exam → enter review mode → see each question with correct answer and explanation

### Mobile Tasks (US3)

- [x] T059 [US3] Implement ReviewService (fetch exam attempt with answers, filter logic) in mobile/src/services/review.service.ts
- [x] T060 [US3] Create reviewStore using Zustand in mobile/src/stores/review.store.ts
- [x] T061 [US3] Create ExamHistoryScreen (list of completed exams) in mobile/src/screens/ExamHistoryScreen.tsx
- [x] T062 [US3] Create ReviewScreen (question list with correct/incorrect indicators) in mobile/src/screens/ReviewScreen.tsx
- [x] T063 [P] [US3] Create ReviewQuestionCard component (shows answer, correct answer, explanation) in mobile/src/components/ReviewQuestionCard.tsx
- [x] T064 [P] [US3] Create ReviewFilter component (all/incorrect only) in mobile/src/components/ReviewFilter.tsx
- [x] T065 [US3] Add domain breakdown section to ReviewScreen in mobile/src/screens/ReviewScreen.tsx

**Checkpoint**: User Story 3 complete - users can review exams with explanations

---

## Phase 6: User Story 4 - Track Performance Over Time (Priority: P2)

**Goal**: View analytics dashboard with score trends, domain performance, and study stats

**Independent Test**: Take multiple exams → view analytics → see trends and weak domain identification

### Mobile Tasks (US4)

- [x] T066 [P] [US4] Create UserStatsRepository in mobile/src/storage/repositories/user-stats.repository.ts
- [x] T067 [US4] Implement AnalyticsService (calculate trends, domain averages, weak areas) in mobile/src/services/analytics.service.ts
- [x] T068 [US4] Create analyticsStore using Zustand in mobile/src/stores/analytics.store.ts
- [x] T069 [US4] Create AnalyticsScreen (dashboard layout) in mobile/src/screens/AnalyticsScreen.tsx
- [x] T070 [P] [US4] Create ScoreTrendChart component in mobile/src/components/analytics/ScoreTrendChart.tsx
- [x] T071 [P] [US4] Create DomainPerformanceCard component (strong/moderate/weak) in mobile/src/components/analytics/DomainPerformanceCard.tsx
- [x] T072 [P] [US4] Create StudyStatsCard component (total exams, questions, time) in mobile/src/components/analytics/StudyStatsCard.tsx
- [x] T073 [US4] Create WeakDomainsSection with practice recommendations in mobile/src/screens/AnalyticsScreen.tsx
- [x] T074 [US4] Implement UserStats update on exam/practice completion in mobile/src/services/exam-session.service.ts and practice.service.ts

**Checkpoint**: User Story 4 complete - users can track performance over time

---

## Phase 7: User Story 5 - Manage Questions (Admin) (Priority: P3)

**Goal**: Admin portal to create, edit, approve, and archive questions across all exam types

**Independent Test**: Login to admin → create question → approve → verify appears in API response

### Backend Admin Tasks (US5)

- [x] T075 [US5] Implement AdminModule with JWT authentication in api/src/admin/admin.module.ts
- [x] T076 [P] [US5] Create AdminAuthService (login, password hash) in api/src/admin/auth/admin-auth.service.ts
- [x] T077 [P] [US5] Create JwtStrategy and JwtAuthGuard in api/src/admin/guards/
- [x] T078 [US5] Implement POST /admin/auth/login endpoint in api/src/admin/controllers/admin-auth.controller.ts
- [x] T079 [US5] Create QuestionsService (CRUD, approval workflow) in api/src/admin/services/questions.service.ts
- [x] T080 [P] [US5] Create QuestionInput, AdminQuestion DTOs in api/src/admin/dto/
- [x] T081 [US5] Implement GET /admin/questions (with filters: examTypeId, status, domain, difficulty) in api/src/admin/controllers/admin-questions.controller.ts
- [x] T082 [US5] Implement POST /admin/questions (create question) in api/src/admin/controllers/admin-questions.controller.ts
- [x] T083 [P] [US5] Implement GET /admin/questions/{id} in api/src/admin/controllers/admin-questions.controller.ts
- [x] T084 [P] [US5] Implement PUT /admin/questions/{id} in api/src/admin/controllers/admin-questions.controller.ts
- [x] T085 [US5] Implement POST /admin/questions/{id}/approve in api/src/admin/controllers/admin-questions.controller.ts
- [x] T086 [P] [US5] Implement POST /admin/questions/{id}/archive in api/src/admin/controllers/admin-questions.controller.ts
- [x] T087 [P] [US5] Implement POST /admin/questions/{id}/restore in api/src/admin/controllers/admin-questions.controller.ts
- [x] T088 [US5] Implement GET /admin/exam-types in api/src/admin/controllers/admin-exam-types.controller.ts
- [x] T089 [US5] Implement GET /admin/stats (question counts by status, domain) in api/src/admin/controllers/admin-exam-types.controller.ts
- [x] T090 [US5] Implement SyncVersion auto-increment on question approval in api/src/admin/services/questions.service.ts
- [x] T090a [US5] Implement question validation (min 20 char text, min 50 char explanation, duplicate detection) in api/src/admin/dto/ and api/src/admin/services/questions.service.ts

### Admin Portal Tasks (US5)

- [x] T091 [US5] Initialize React SPA in api/admin-portal/ with Vite
- [x] T092 [P] [US5] Create LoginPage component in api/admin-portal/src/pages/LoginPage.tsx
- [x] T093 [P] [US5] Create ApiService with JWT interceptor in api/admin-portal/src/services/api.ts
- [x] T094 [US5] Create QuestionListPage with filters and pagination in api/admin-portal/src/pages/QuestionListPage.tsx
- [x] T095 [P] [US5] Create QuestionForm component (create/edit) in api/admin-portal/src/components/QuestionForm.tsx
- [x] T096 [P] [US5] Create QuestionCard component with status badges in api/admin-portal/src/components/QuestionCard.tsx
- [x] T097 [US5] Create QuestionDetailPage with approve/archive actions in api/admin-portal/src/pages/QuestionDetailPage.tsx
- [x] T098 [P] [US5] Create ExamTypeSwitcher component in api/admin-portal/src/components/ExamTypeSwitcher.tsx
- [x] T099 [US5] Create DashboardPage with stats overview in api/admin-portal/src/pages/DashboardPage.tsx
- [x] T100 [US5] Configure NestJS to serve admin portal static files in api/src/app.module.ts

**Checkpoint**: User Story 5 complete - admins can manage questions via portal

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T101 [P] Implement health check endpoint GET /health in api/src/app.controller.ts
- [x] T102 [P] Add API request logging middleware in api/src/common/middleware/
- [x] T103 [P] Add mobile app error boundary component in mobile/src/components/ErrorBoundary.tsx
- [x] T104 [P] Create loading states and skeleton screens for mobile UI
- [x] T105 Implement background sync retry logic in mobile/src/services/sync.service.ts
- [x] T106 [P] Add network connectivity detection in mobile/src/services/network.service.ts
- [x] T107 Create SettingsScreen with sync status in mobile/src/screens/SettingsScreen.tsx
- [x] T108 [P] Add API rate limiting middleware in api/src/common/middleware/
- [x] T109 [P] Add Prisma query logging in development mode
- [x] T110 Run quickstart.md validation - verify full setup works end-to-end
- [x] T111 [P] Security review: verify no user data transmitted to servers (FR-030 compliance) in mobile/src/services/

### Performance Testing (FR-031, FR-032, FR-033)

- [x] T111a Profile and verify app launch time meets <3s target (FR-031) on OnePlus Nord 2 baseline device; create performance benchmark in mobile/__tests__/performance/launch.bench.ts
- [x] T111b Profile and verify screen transitions meet <300ms target (FR-032) on baseline device; test HomeScreen → ExamScreen, ExamScreen → ResultsScreen, ResultsScreen → ReviewScreen transitions
- [x] T111c Profile and verify question rendering meets <100ms target (FR-033) on baseline device; benchmark QuestionCard component rendering with text, options, and images

---

## Dependencies & Execution Order

### Phase Dependencies

```text
Phase 1 (Setup) → Phase 2 (Foundational) → User Stories (Phases 3-7) → Phase 8 (Polish)
                        ↓
         BLOCKS all user stories until complete
```

### User Story Dependencies

| Story | Depends On        | Can Parallelize With |
| ----- | ----------------- | -------------------- |
| US1   | Phase 2 only      | US2 (after Phase 2)  |
| US2   | Phase 2 only      | US1 (after Phase 2)  |
| US3   | US1 (exam data)   | US4                  |
| US4   | US1/US2 (history) | US3                  |
| US5   | Phase 2 only      | US1, US2, US3, US4   |

### Within Each User Story

1. Backend endpoints before mobile API calls
2. Repositories before services
3. Services before stores
4. Stores before screens
5. Screens before integration

---

## Parallel Execution Examples

### Phase 2 Parallel Groups

```text
Group A (Backend Models): T009, T010, T011, T012 - run together
Group B (Mobile Schema): T022, T023, T024, T025 - run together
Group C (Config): T016, T017, T019 - run together
```

### User Story 1 Parallel Groups

```text
Group A (Repositories): T034, T035, T036 - run together
Group B (Components): T043, T044, T045 - run together
```

### User Story 5 Parallel Groups

```text
Group A (Admin Guards): T076, T077 - run together
Group B (Admin Endpoints): T083, T084, T086, T087 - run together
```

---

## Implementation Strategy

### MVP First (User Stories 1 + 2)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL)
3. Complete Phase 3: User Story 1 (Exam Mode)
4. Complete Phase 4: User Story 2 (Practice Mode)
5. **STOP and VALIDATE**: Test MVP independently
6. Deploy/demo if ready

**MVP Scope**: 58 tasks (T001-T058)

### Incremental Delivery

| Milestone | Task Range | Deliverable                            |
| --------- | ---------- | -------------------------------------- |
| MVP       | T001-T058  | Exam + Practice modes                  |
| v1.1      | T059-T065  | Add Review mode                        |
| v1.2      | T066-T074  | Add Analytics                          |
| v1.3      | T075-T100  | Admin portal (can develop in parallel) |
| v1.4      | T101-T111c | Polish, performance testing, and production readiness |

### Parallel Team Strategy

With 2+ developers after Phase 2:

- **Developer A**: Mobile (US1 → US2 → US3 → US4)
- **Developer B**: Backend + Admin Portal (US5 → API polish)

---

## Summary

| Category        | Count |
| --------------- | ----- |
| Total Tasks     | 115   |
| Setup Phase     | 8     |
| Foundational    | 22    |
| US1 (Exam)      | 18    |
| US2 (Practice)  | 10    |
| US3 (Review)    | 7     |
| US4 (Analytics) | 9     |
| US5 (Admin)     | 27    |
| Polish          | 14    |
| Parallelizable  | 56    |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Admin portal (US5) can be developed in parallel with mobile features

---

# Phase 2: Authentication & Cloud Sync (NEW - Tasks T112-T150)

**Purpose**: Add optional Google OAuth authentication and cloud persistence of exam history

**Scope**: 39 detailed tasks spanning backend auth, mobile integration, sync queue, analytics

**Phase 2 Status**: ✅ **PARTIALLY COMPLETE** (T112-T139 done, T140-T150 ready)

## Phase 2 Task Summary

| Phase | Tasks | Hours | User Stories | Status |
|-------|-------|-------|--------------|--------|
| **2A: Backend Auth** | T112-T119 | 10 | US6 | ✅ Complete |
| **2B: Backend Persistence** | T120-T127 | 13 | US7 | ✅ Complete |
| **2C: Mobile Integration** | T128-T142 | 20 | US6, US7, US8 | 🔄 50% (T136-T139 mobile sync) |
| **2D: Testing & Docs** | T143-T150 | 15 | All | 📋 Ready |
| **Total** | **T112-T150** | **~58** | **US6-US8** | **✅ 27/39 tasks** |

**Expected Timeline**: 4 weeks (1 week per phase) with 2 developers in parallel

---

## User Story 6: Google Sign-In (P2) - Backend Authentication

**Goal**: Implement Google OAuth and JWT token management

**Test Criteria**:
- ✓ POST /auth/google/callback accepts idToken, verifies with Google, creates User, returns JWT  
- ✓ GET /auth/me returns authenticated user with valid JWT
- ✓ POST /auth/refresh exchanges refreshToken for new accessToken
- ✓ Invalid/expired tokens return 401 Unauthorized
- ✓ All services work with mocked Google verification

**Tests**: 6 unit tests (GoogleOAuthService, UserService, JwtService auto-tested in T113, T114, T115) + 4 E2E tests (endpoints in T143)

### Backend Auth Implementation Tasks

- [x] T112 Create Prisma User model in `api/prisma/schema.prisma` with googleId (UNIQUE), email, oauthToken, createdAt, updatedAt, lastLoginAt; create migration `api/prisma/migrations/[timestamp]_add_user_model`
- [x] T113 Create `api/src/auth/services/google-oauth.service.ts` with verifyIdToken() to validate Google ID tokens
- [x] T114 Create `api/src/auth/services/user.service.ts` with findOrCreateByGoogleId(), updateLastLogin() operations
- [x] T115 Create `api/src/auth/services/jwt.service.ts` with generateAccessToken() (1hr expiry) and generateRefreshToken() (7-day expiry), plus verifyAccessToken() and verifyRefreshToken() methods
- [x] T116 Create `api/src/auth/controllers/auth.controller.ts` with POST /auth/google/callback, GET /auth/me, POST /auth/refresh, POST /auth/logout
- [x] T117 Create `api/src/auth/guards/jwt-auth.guard.ts` for JWT validation middleware
- [x] T118 Create `api/src/auth/strategies/jwt.strategy.ts` as Passport.js strategy for JWT extraction
- [x] T119 Create `api/src/auth/auth.module.ts` to integrate all auth services and register with AppModule

---

## User Story 6: Google Sign-In (P2) - Mobile Implementation

**Goal**: Implement Google Sign-In UI and OAuth token management

**Test Criteria**:
- ✓ Native Google Sign-In dialog launches and returns idToken
- ✓ Tokens persist in AsyncStorage after sign-in  
- ✓ JWT auto-injected in all API request Authorization headers
- ✓ Sign-in completes in <10 seconds
- ✓ Token refresh automatic on 401 responses
- ✓ Logout clears tokens and auth state

**Tests**: 6 mobile service tests + E2E auth flow test

### Mobile Auth Implementation Tasks

- [x] T128 Install expo-auth-session, expo-web-browser, expo-crypto in `mobile/package.json`; configure Google Web Client ID in `.env` and `app.json`
- [x] T129 [P] Create `mobile/src/services/auth-service.ts` with useGoogleAuthRequest() hook, handleGoogleAuthSuccess(), and signOut() methods (uses expo-auth-session)
- [x] T130 [P] Create `mobile/src/storage/token-storage.ts` with saveTokens(), getAccessToken(), getRefreshToken(), clearTokens()
- [x] T131 Create `mobile/src/services/api-interceptor.ts` to inject "Bearer {token}" in Authorization header for all requests
- [x] T132 [P] Create `mobile/src/stores/auth-store.ts` Zustand store managing isSignedIn, user, accessToken, and actions
- [x] T133 Create `mobile/src/services/token-refresh-service.ts` to handle POST /auth/refresh on 401 detection
- [x] T134 Create `mobile/src/screens/AuthScreen.tsx` with "Sign in with Google" button (expo-auth-session hook), loading spinner, error display, and signed-in profile view
- [x] T135 Update `mobile/src/screens/HomeScreen.tsx` to show current user info if signed in, logout button, and "Sign in" prompt if not

---

## User Story 7: Exam History Persistence (P2) - Backend

**Goal**: Store exam submissions in backend and provide cloud history retrieval

**Test Criteria**:
- ✓ ExamAttempt table extends with userId (FK, nullable), syncStatus, syncedAt, syncRetries
- ✓ POST /exam-attempts accepts submission with score, passed, answers, duration and stores with syncStatus='synced'
- ✓ GET /exam-attempts returns paginated exam history (20/page default, up to 100/page)
- ✓ Failed submissions track syncStatus='failed' and retry count
- ✓ Pagination parameters work correctly (page, limit)

**Tests**: 5 service unit tests + 4 API E2E tests

### Backend Persistence Implementation Tasks

- [x] T120 Extend `api/prisma/schema.prisma` ExamAttempt model with userId (FK to User, nullable), syncStatus (ENUM), syncedAt, syncRetries (default 0)
- [x] T121 Create database migration `api/prisma/migrations/[timestamp]_add_exam_sync_fields` to apply schema changes and backfill existing attempts
- [x] T122 Create `api/src/exam-attempts/services/exam-attempt.service.ts` with create(), findByUserId(), markSynced(), markFailed(), getPendingSync()
- [x] T123 Create `api/src/exam-attempts/controllers/exam-attempts.controller.ts` with POST /exam-attempts (submit) and GET /exam-attempts (history with pagination)

---

## User Story 7: Exam History Persistence (P2) - Mobile Offline Sync

**Goal**: Queue exam submissions offline and auto-sync when connectivity restores

**Test Criteria**:
- ✓ ExamAttempt marked syncStatus='pending' when submitted while offline
- ✓ OfflineQueue SQLite table persists pending exams across app restart
- ✓ Connectivity listener detects online/offline state transitions
- ✓ Sync processor batch-processes queue on online detection
- ✓ Exponential backoff retry: 1s, 2s, 4s, 8s, 16s, 32s
- ✓ Max 12 retries (~63 min window), then mark syncStatus='failed'
- ✓ User notified of sync completion/failure

**Tests**: 6 service unit tests + offline queue integration test

### Mobile Offline Sync Implementation Tasks

- [x] T136 Update `mobile/src/services/exam-session-service.ts` to POST completed exam to /exam-attempts if signed in, else queue for later sync
- [x] T137 [P] Create `mobile/src/services/connectivity-service.ts` with onConnectivityChange() listener using expo-network or react-native-netinfo
- [x] T138 [P] Create `mobile/src/services/offline-queue-service.ts` with SQLite OfflineQueue table and CRUD operations
- [x] T139 Create `mobile/src/services/sync-processor-service.ts` with processPending(), exponential backoff logic (1s, 2s, 4s, 8s, 16s, 32s, max 12 attempts), and auto-triggered by connectivity state change from offline→online (depends on T137, T138)
- [ ] T140 [P] Update `mobile/src/stores/exam-store.ts` to add syncState with pendingCount, isSyncing, lastSyncedAt, and sync actions (depends on T137, T138)
- [ ] T141 Create `mobile/src/components/SyncStatusIndicator.tsx` showing "Syncing...", "✓ Synced at TIME", or "⚠ Pending N items" with retry button

---

## User Story 8: Analytics Dashboard Sync (P2) - Backend Analytics

**Goal**: Server-side aggregation of exam statistics for authenticated users

**Test Criteria**:
- ✓ GET /exam-attempts/analytics returns AnalyticsSummary with totalAttempts, passRate, avgScore, avgDuration
- ✓ Optional examTypeId filter breaks down by exam type
- ✓ Handles zero attempts gracefully (returns 0 values)
- ✓ Response time <2 seconds for 100 exam attempts
- ✓ Pagination support for history (20/page minimum)

**Tests**: 5 service unit tests + API E2E test

### Backend Analytics Implementation Tasks

- [x] T124 Create `api/src/exam-attempts/services/analytics.service.ts` with synchronous server-side aggregation via Prisma queries: getAnalyticsSummary() (totalAttempts, passRate, avgScore, avgDuration) and getByExamType() for breakdown
- [x] T125 Create `api/src/exam-attempts/controllers/analytics.controller.ts` with GET /exam-attempts/analytics endpoint
- [x] T126 Create `api/src/exam-attempts/exam-attempts.module.ts` to integrate ExamAttemptService, AnalyticsService, and controllers
- [x] T127 Create `api/src/exam-attempts/services/offline-queue-processor.service.ts` for background async processing of failed submissions with retry

---

## User Story 8: Analytics Dashboard Sync (P2) - Mobile Analytics UI

**Goal**: Display server-backed analytics dashboard with cloud data

**Test Criteria**:
- ✓ CloudAnalyticsScreen fetches GET /exam-attempts/analytics on mount
- ✓ Displays summary: totalAttempts, passRate, avgScore, avgDuration
- ✓ Shows breakdown by exam type
- ✓ Pagination works for exam history (20/page, next/prev buttons)
- ✓ Loading spinner shown while fetching
- ✓ Falls back to local analytics if offline
- ✓ Retry button to manually trigger sync

**Tests**: 5 component unit tests + analytics integration test

### Mobile Analytics UI Implementation Task

- [ ] T142 Create `mobile/src/screens/CloudAnalyticsScreen.tsx` to fetch GET /exam-attempts/analytics when online and display summary (totalAttempts, passRate, avgScore, avgDuration, byExamType breakdown); fall back to cached local analytics if offline; show 'Sync to cloud' button when connection restored; support pagination (20/page, next/prev buttons)

---

## Phase 2: Integration Testing & Documentation (T143-T150)

**Goal**: Validate Phase 2 functionality and document implementation

**Tests**: 8 integration tests + manual testing plan + documentation

### Testing & Documentation Tasks

- [x] T143 [P] Create `api/test/auth.e2e-spec.ts` for auth endpoints: POST /auth/google/callback, GET /auth/me, POST /auth/refresh with mocked Google verification
- [x] T144 [P] Create `mobile/__tests__/offline-queue.integration.test.ts` for queue persistence across app restart and sync flow
- [x] T145 Create `api/test/exam-attempts.e2e-spec.ts` for POST /exam-attempts (submit), GET /exam-attempts (pagination), filtering
- [x] T146 Create `api/test/analytics.service.spec.ts` for calculation accuracy: passRate, averageScore, byExamType breakdown
- [x] T147 Create `mobile/__tests__/sync-processor.test.ts` for exponential backoff timing and max retry enforcement
- [x] T148 Create `mobile/__tests__/performance.bench.ts` benchmarks: cloud sync <5s for 50 exams, analytics query <2s, token refresh <500ms
- [x] T149 Create `specs/002-cloudprep-mobile/phase2-testing-guide.md` with manual testing scenarios: sign-in flow, offline submit, sync on restore, token expiration
- [x] T150 Update `README.md` with Phase 2 architecture: OAuth flow diagram, offline sync state machine, token lifecycle, migration guide for existing users

---

## Execution Plan

### Week 1: Backend Authentication (T112-T119)
**Sequential**: T112 (schema) → T113-T118 (services, can parallelize T117-T118) → T119 (module)  
**Effort**: ~10 hours | **Blockers**: T112 blocks all other auth  
**Deliverable**: Fully tested auth module, all endpoints working with mocked Google

### Week 2a: Backend Persistence (T120-T123) + Week 2b: Mobile Auth (T128-T135)
**Sequential Backend**: T120 (schema) → T121 (migration) → T122 (service) → T123 (controller)  
**Parallel Mobile**: T128 (library) → T129, T130, T132 can parallelize → T131, T133, T134, T135 sequential  
**Effort**: Backend 13h + Mobile 14h (22h total) | **Blockers**: T120 blocks backend, T128 blocks mobile  
**Deliverable**: Mobile can sign in, backend persists exams, JWT tokens work

### Week 3a: Analytics & Sync (T124-T127, T142) + Week 3b: Mobile Sync (T136-T141) + Testing (T143-T147)
**Sequential Analytics**: T124 → T125 → T126 → T127  
**Parallel Sync**: T137, T138, T140 can parallelize → T136, T139, T141 sequential  
**Parallel Tests**: T143, T144, T145, T146, T147 all independent (different test files)  
**Effort**: ~50 hours combined | **Deliverable**: Full offline sync, cloud analytics, comprehensive test coverage

### Week 4: Performance & Documentation (T148-T150)
**Sequential**: T148 (perf) → T149 (manual test doc) → T150 (README)  
**Effort**: ~10 hours  
**Deliverable**: Performance confirmed, documentation complete, ready for production

---

## Dependencies & Parallelization

**Critical Path (must be sequential)**:
```
T112 → T115 → T116 → T119 (Backend auth module)
T120 → T121 → T122 → T123 (Backend persistence)
T124 → T125 → T126 (Analytics module)
```

**Parallelizable Groups** (can run in parallel when dependencies met):
```
[P] T129, T130, T132: Mobile auth services (different files)
[P] T137, T138, T140: Mobile connectivity/sync (different files)
[P] T143-T147: All integration tests (separate test files)
[P] T113, T114, T118: Auth services after T112 (different files)
```

**Independent Tracks**:
- Backend work (T112-T127) independent from Mobile (T129-T142) after library install (T128)
- All Phase 2 tests (T143-T150) can start after respective implementation complete

---

## Success Criteria Summary

**Phase 2A Complete** when:
- ✓ All 8 auth tests passing
- ✓ POST /auth/google/callback working with mocked Google
- ✓ JWT tokens refresh automatically
- ✓ GET /auth/me returns authenticated user

**Phase 2B Complete** when:
- ✓ ExamAttempt POST endpoint persists submissions
- ✓ Offline queue persists across app restart
- ✓ Sync triggers automatically on connectivity restore
- ✓ Exponential backoff retry working correctly

**Phase 2C Complete** when:
- ✓ CloudAnalyticsScreen displays aggregations correctly
- ✓ All 8 integration tests passing
- ✓ Performance benchmarks met (<5s sync, <2s analytics)
- ✓ Manual testing scenarios validated

**Phase 2 Complete** when:
- ✓ All 39 tasks marked [x] complete
- ✓ 35+ test cases passing (unit + integration + performance)
- ✓ Documentation updated with migration guide
- ✓ Ready for production deployment

---

## Notes

- All [P] marked tasks can execute in parallel when dependencies satisfied
- [Story] labels (US6, US7, US8) map tasks to requirements for traceability
- Each user story independently completable and testable
- Phase 1 data preserved: unsigned users unaffected, Phase 1 exams still work
- Commit after each task or logical weekly group
- Optional: Can defer analytics caching (Redis) to Phase 2.1 if performance needed
