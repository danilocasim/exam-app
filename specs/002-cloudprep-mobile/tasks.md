# Tasks: CloudPrep Mobile

**Input**: Design documents from `/specs/002-cloudprep-mobile/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.yaml ✓

**Tests**: Not explicitly requested - test tasks omitted. Add TDD tasks if needed.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)
- Include exact file paths in descriptions

## Path Conventions

- **api/**: Backend (NestJS + Prisma + PostgreSQL)
- **mobile/**: Mobile app (React Native + Expo)
- **api/admin-portal/**: Admin SPA (React)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Initialize Expo mobile project in mobile/ with TypeScript template
- [x] T002 [P] Install mobile dependencies: expo-sqlite, react-navigation, zustand, nativewind, axios in mobile/package.json
- [x] T003 [P] Initialize NestJS project in api/ with Fastify adapter
- [x] T004 [P] Install api dependencies: prisma, @nestjs/config, class-validator, @nestjs/jwt, passport, bcrypt in api/package.json
- [ ] T005 [P] Configure ESLint and Prettier for mobile/ and api/
- [ ] T006 [P] Create mobile project structure: mobile/src/{screens,components,services,stores,storage,config,navigation}/
- [ ] T007 [P] Create api project structure: api/src/{exam-types,questions,admin,prisma,common}/
- [ ] T008 Setup Prisma with PostgreSQL in api/prisma/schema.prisma per data-model.md

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Backend Foundation

- [ ] T009 Create ExamType model in api/prisma/schema.prisma with domains JSON field
- [ ] T010 [P] Create Admin model in api/prisma/schema.prisma with email and passwordHash
- [ ] T011 [P] Create Question model in api/prisma/schema.prisma with examTypeId FK and status enum
- [ ] T012 [P] Create SyncVersion model in api/prisma/schema.prisma with examTypeId unique constraint
- [ ] T013 Run initial Prisma migration: npx prisma migrate dev --name init
- [ ] T014 Create PrismaService in api/src/prisma/prisma.service.ts and PrismaModule in api/src/prisma/prisma.module.ts
- [ ] T015 [P] Create seed script for AWS CCP exam type in api/prisma/seed.ts
- [ ] T016 [P] Create global validation pipe and error filters in api/src/common/
- [ ] T017 [P] Create base DTOs for pagination and error responses in api/src/common/dto/
- [ ] T018 Implement ExamTypesModule with GET /exam-types/{id} endpoint in api/src/exam-types/
- [ ] T019 Configure environment variables and app config in api/src/config/

### Mobile Foundation

- [ ] T020 Setup SQLite database initialization in mobile/src/storage/database.ts
- [ ] T021 [P] Create mobile app config with EXAM_TYPE_ID in mobile/src/config/app.config.ts
- [ ] T022 Create SQLite schema for Question table in mobile/src/storage/schema.ts
- [ ] T023 [P] Create SQLite schema for ExamAttempt and ExamAnswer tables in mobile/src/storage/schema.ts
- [ ] T024 [P] Create SQLite schema for PracticeSession and PracticeAnswer tables in mobile/src/storage/schema.ts
- [ ] T025 [P] Create SQLite schema for SyncMeta and UserStats tables in mobile/src/storage/schema.ts
- [ ] T026 Setup React Navigation with NavigationContainer in mobile/src/navigation/
- [ ] T027 Configure NativeWind/Tailwind in mobile/tailwind.config.js
- [ ] T028 [P] Create Axios API client with base URL config in mobile/src/services/api.ts
- [ ] T029 Implement SyncService for fetching exam type config and questions in mobile/src/services/sync.service.ts
- [ ] T030 Create initial question bank bundle for offline-first in mobile/assets/questions/

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - Take Timed Exam Simulation (Priority: P1) 🎯 MVP

**Goal**: Generate and take a full 65-question timed exam with AWS domain weighting, auto-save, and pass/fail scoring

**Independent Test**: Launch exam → answer 65 questions → see pass/fail result with domain breakdown

### Backend Tasks (US1)

- [ ] T031 [P] [US1] Implement GET /exam-types/{examTypeId}/questions endpoint in api/src/exam-types/exam-types.controller.ts
- [ ] T032 [P] [US1] Implement GET /exam-types/{examTypeId}/questions/version endpoint in api/src/exam-types/exam-types.controller.ts
- [ ] T033 [US1] Create QuestionBankResponse and VersionResponse DTOs in api/src/exam-types/dto/

### Mobile Tasks (US1)

- [ ] T034 [US1] Create QuestionRepository for SQLite CRUD in mobile/src/storage/repositories/question.repository.ts
- [ ] T035 [P] [US1] Create ExamAttemptRepository for SQLite CRUD in mobile/src/storage/repositories/exam-attempt.repository.ts
- [ ] T036 [P] [US1] Create ExamAnswerRepository for SQLite CRUD in mobile/src/storage/repositories/exam-answer.repository.ts
- [ ] T037 [US1] Implement ExamGeneratorService (weighted random selection by domain) in mobile/src/services/exam-generator.service.ts
- [ ] T038 [US1] Implement ExamSessionService (start, save answer, navigate, submit) in mobile/src/services/exam-session.service.ts
- [ ] T039 [US1] Implement ScoringService (calculate score, pass/fail, domain breakdown) in mobile/src/services/scoring.service.ts
- [ ] T040 [US1] Create examStore using Zustand for exam state management in mobile/src/stores/exam.store.ts
- [ ] T041 [US1] Create HomeScreen with "Start Exam" button in mobile/src/screens/HomeScreen.tsx
- [ ] T042 [US1] Create ExamScreen with question display, options, navigation in mobile/src/screens/ExamScreen.tsx
- [ ] T043 [P] [US1] Create QuestionCard component with option selection in mobile/src/components/QuestionCard.tsx
- [ ] T044 [P] [US1] Create Timer component with countdown display in mobile/src/components/Timer.tsx
- [ ] T045 [P] [US1] Create QuestionNavigator component (flag, jump to question) in mobile/src/components/QuestionNavigator.tsx
- [ ] T046 [US1] Create ExamResultsScreen with score and domain breakdown in mobile/src/screens/ExamResultsScreen.tsx
- [ ] T047 [US1] Implement exam resumption logic (check for in-progress exam on app launch) in mobile/src/services/exam-session.service.ts
- [ ] T048 [US1] Handle exam expiration (24h limit) and mark as abandoned in mobile/src/services/exam-session.service.ts

**Checkpoint**: User Story 1 complete - users can take full timed exams with scoring

---

## Phase 4: User Story 2 - Practice by Domain (Priority: P1) 🎯 MVP

**Goal**: Take untimed practice sessions filtered by domain and/or difficulty with immediate feedback

**Independent Test**: Select domain → answer questions → see instant feedback with explanations

### Mobile Tasks (US2)

- [ ] T049 [P] [US2] Create PracticeSessionRepository in mobile/src/storage/repositories/practice-session.repository.ts
- [ ] T050 [P] [US2] Create PracticeAnswerRepository in mobile/src/storage/repositories/practice-answer.repository.ts
- [ ] T051 [US2] Implement PracticeService (start session, submit answer, end session) in mobile/src/services/practice.service.ts
- [ ] T052 [US2] Create practiceStore using Zustand in mobile/src/stores/practice.store.ts
- [ ] T053 [US2] Create PracticeSetupScreen (domain/difficulty selection) in mobile/src/screens/PracticeSetupScreen.tsx
- [ ] T054 [US2] Create PracticeScreen with immediate feedback display in mobile/src/screens/PracticeScreen.tsx
- [ ] T055 [P] [US2] Create FeedbackCard component (correct/incorrect, explanation) in mobile/src/components/FeedbackCard.tsx
- [ ] T056 [P] [US2] Create DomainSelector component in mobile/src/components/DomainSelector.tsx
- [ ] T057 [P] [US2] Create DifficultySelector component in mobile/src/components/DifficultySelector.tsx
- [ ] T058 [US2] Create PracticeSummaryScreen (session results) in mobile/src/screens/PracticeSummaryScreen.tsx

**Checkpoint**: User Story 2 complete - users can practice by domain with feedback

---

## Phase 5: User Story 3 - Review Exam Results (Priority: P2)

**Goal**: Review completed exams with explanations for each question

**Independent Test**: Complete exam → enter review mode → see each question with correct answer and explanation

### Mobile Tasks (US3)

- [ ] T059 [US3] Implement ReviewService (fetch exam attempt with answers, filter logic) in mobile/src/services/review.service.ts
- [ ] T060 [US3] Create reviewStore using Zustand in mobile/src/stores/review.store.ts
- [ ] T061 [US3] Create ExamHistoryScreen (list of completed exams) in mobile/src/screens/ExamHistoryScreen.tsx
- [ ] T062 [US3] Create ReviewScreen (question list with correct/incorrect indicators) in mobile/src/screens/ReviewScreen.tsx
- [ ] T063 [P] [US3] Create ReviewQuestionCard component (shows answer, correct answer, explanation) in mobile/src/components/ReviewQuestionCard.tsx
- [ ] T064 [P] [US3] Create ReviewFilter component (all/incorrect only) in mobile/src/components/ReviewFilter.tsx
- [ ] T065 [US3] Add domain breakdown section to ReviewScreen in mobile/src/screens/ReviewScreen.tsx

**Checkpoint**: User Story 3 complete - users can review exams with explanations

---

## Phase 6: User Story 4 - Track Performance Over Time (Priority: P2)

**Goal**: View analytics dashboard with score trends, domain performance, and study stats

**Independent Test**: Take multiple exams → view analytics → see trends and weak domain identification

### Mobile Tasks (US4)

- [ ] T066 [P] [US4] Create UserStatsRepository in mobile/src/storage/repositories/user-stats.repository.ts
- [ ] T067 [US4] Implement AnalyticsService (calculate trends, domain averages, weak areas) in mobile/src/services/analytics.service.ts
- [ ] T068 [US4] Create analyticsStore using Zustand in mobile/src/stores/analytics.store.ts
- [ ] T069 [US4] Create AnalyticsScreen (dashboard layout) in mobile/src/screens/AnalyticsScreen.tsx
- [ ] T070 [P] [US4] Create ScoreTrendChart component in mobile/src/components/analytics/ScoreTrendChart.tsx
- [ ] T071 [P] [US4] Create DomainPerformanceCard component (strong/moderate/weak) in mobile/src/components/analytics/DomainPerformanceCard.tsx
- [ ] T072 [P] [US4] Create StudyStatsCard component (total exams, questions, time) in mobile/src/components/analytics/StudyStatsCard.tsx
- [ ] T073 [US4] Create WeakDomainsSection with practice recommendations in mobile/src/screens/AnalyticsScreen.tsx
- [ ] T074 [US4] Implement UserStats update on exam/practice completion in mobile/src/services/exam-session.service.ts and practice.service.ts

**Checkpoint**: User Story 4 complete - users can track performance over time

---

## Phase 7: User Story 5 - Manage Questions (Admin) (Priority: P3)

**Goal**: Admin portal to create, edit, approve, and archive questions across all exam types

**Independent Test**: Login to admin → create question → approve → verify appears in API response

### Backend Admin Tasks (US5)

- [ ] T075 [US5] Implement AdminModule with JWT authentication in api/src/admin/admin.module.ts
- [ ] T076 [P] [US5] Create AdminAuthService (login, password hash) in api/src/admin/admin-auth.service.ts
- [ ] T077 [P] [US5] Create JwtStrategy and JwtAuthGuard in api/src/admin/guards/
- [ ] T078 [US5] Implement POST /admin/auth/login endpoint in api/src/admin/admin.controller.ts
- [ ] T079 [US5] Create QuestionsService (CRUD, approval workflow) in api/src/admin/questions.service.ts
- [ ] T080 [P] [US5] Create QuestionInput, AdminQuestion DTOs in api/src/admin/dto/
- [ ] T081 [US5] Implement GET /admin/questions (with filters: examTypeId, status, domain, difficulty) in api/src/admin/admin.controller.ts
- [ ] T082 [US5] Implement POST /admin/questions (create question) in api/src/admin/admin.controller.ts
- [ ] T083 [P] [US5] Implement GET /admin/questions/{id} in api/src/admin/admin.controller.ts
- [ ] T084 [P] [US5] Implement PUT /admin/questions/{id} in api/src/admin/admin.controller.ts
- [ ] T085 [US5] Implement POST /admin/questions/{id}/approve in api/src/admin/admin.controller.ts
- [ ] T086 [P] [US5] Implement POST /admin/questions/{id}/archive in api/src/admin/admin.controller.ts
- [ ] T087 [P] [US5] Implement POST /admin/questions/{id}/restore in api/src/admin/admin.controller.ts
- [ ] T088 [US5] Implement GET /admin/exam-types in api/src/admin/admin.controller.ts
- [ ] T089 [US5] Implement GET /admin/stats (question counts by status, domain) in api/src/admin/admin.controller.ts
- [ ] T090 [US5] Implement SyncVersion auto-increment on question approval in api/src/admin/questions.service.ts
- [ ] T090a [US5] Implement question validation (min 20 char text, min 50 char explanation, duplicate detection) in api/src/admin/questions.service.ts

### Admin Portal Tasks (US5)

- [ ] T091 [US5] Initialize React SPA in api/admin-portal/ with Vite
- [ ] T092 [P] [US5] Create LoginPage component in api/admin-portal/src/pages/LoginPage.tsx
- [ ] T093 [P] [US5] Create ApiService with JWT interceptor in api/admin-portal/src/services/api.ts
- [ ] T094 [US5] Create QuestionListPage with filters and pagination in api/admin-portal/src/pages/QuestionListPage.tsx
- [ ] T095 [P] [US5] Create QuestionForm component (create/edit) in api/admin-portal/src/components/QuestionForm.tsx
- [ ] T096 [P] [US5] Create QuestionCard component with status badges in api/admin-portal/src/components/QuestionCard.tsx
- [ ] T097 [US5] Create QuestionDetailPage with approve/archive actions in api/admin-portal/src/pages/QuestionDetailPage.tsx
- [ ] T098 [P] [US5] Create ExamTypeSwitcher component in api/admin-portal/src/components/ExamTypeSwitcher.tsx
- [ ] T099 [US5] Create DashboardPage with stats overview in api/admin-portal/src/pages/DashboardPage.tsx
- [ ] T100 [US5] Configure NestJS to serve admin portal static files in api/src/main.ts

**Checkpoint**: User Story 5 complete - admins can manage questions via portal

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T101 [P] Implement health check endpoint GET /health in api/src/app.controller.ts
- [ ] T102 [P] Add API request logging middleware in api/src/common/middleware/
- [ ] T103 [P] Add mobile app error boundary component in mobile/src/components/ErrorBoundary.tsx
- [ ] T104 [P] Create loading states and skeleton screens for mobile UI
- [ ] T105 Implement background sync retry logic in mobile/src/services/sync.service.ts
- [ ] T106 [P] Add network connectivity detection in mobile/src/services/network.service.ts
- [ ] T107 Create SettingsScreen with sync status in mobile/src/screens/SettingsScreen.tsx
- [ ] T108 [P] Add API rate limiting middleware in api/src/common/middleware/
- [ ] T109 [P] Add Prisma query logging in development mode
- [ ] T110 Run quickstart.md validation - verify full setup works end-to-end
- [ ] T111 [P] Security review: verify no user data transmitted to servers (FR-030 compliance) in mobile/src/services/

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
| v1.4      | T101-T110  | Polish and production readiness        |

### Parallel Team Strategy

With 2+ developers after Phase 2:

- **Developer A**: Mobile (US1 → US2 → US3 → US4)
- **Developer B**: Backend + Admin Portal (US5 → API polish)

---

## Summary

| Category        | Count |
| --------------- | ----- |
| Total Tasks     | 112   |
| Setup Phase     | 8     |
| Foundational    | 22    |
| US1 (Exam)      | 18    |
| US2 (Practice)  | 10    |
| US3 (Review)    | 7     |
| US4 (Analytics) | 9     |
| US5 (Admin)     | 27    |
| Polish          | 11    |
| Parallelizable  | 56    |

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Admin portal (US5) can be developed in parallel with mobile features
