# Research: CloudPrep Mobile

**Feature**: 002-cloudprep-mobile  
**Date**: February 12, 2026  
**Status**: Complete

## Research Tasks

### 1. React Native Offline-First Architecture

**Context**: App must function fully offline for exam and practice modes with local SQLite storage.

**Decision**: Use Expo managed workflow with expo-sqlite for local persistence.

**Rationale**:

- Expo provides stable SQLite integration via `expo-sqlite`
- Managed workflow simplifies Android builds for Play Store
- No native module complexity; all dependencies are Expo-compatible
- SQLite handles relational data (questions, attempts, answers) efficiently

**Alternatives Considered**:

- WatermelonDB: More powerful but adds complexity; overkill for single-user local storage
- Realm: Good but requires native modules; complicates Expo managed workflow
- AsyncStorage: Insufficient for structured relational queries

### 2. Question Bank Sync Strategy

**Context**: App must download question bank updates when online without syncing user data.

**Decision**: Versioned JSON snapshots via simple REST API.

**Rationale**:

- App stores `lastSyncVersion` locally
- On app launch (if online), GET `/questions?since={version}` returns delta
- Full question bank bundled in app for offline-first cold start
- No complex sync protocol needed; questions are append-mostly

**Alternatives Considered**:

- GraphQL subscriptions: Overkill for one-way content delivery
- Firebase Firestore: Adds Google dependency; may sync user data inadvertently
- Manual APK updates: Too slow for content updates

### 3. Timer and Exam State Persistence

**Context**: Exam state must persist across app interruptions with remaining time preserved.

**Decision**: Store exam state in SQLite with periodic auto-save; calculate remaining time from timestamps.

**Rationale**:

- Store `examStartTime` and `totalDuration` (90 min)
- On resume: `remainingTime = totalDuration - (now - examStartTime)`
- Auto-save answers on every navigation event
- Expire exams older than 24 hours on app launch

**Alternatives Considered**:

- Background timer service: Complex, battery-draining, unnecessary
- Store remaining time directly: Fails if device clock changes

### 4. Exam Generation Algorithm

**Context**: Generate 65 questions following AWS domain weighting from local question bank.

**Decision**: Weighted random selection with domain quotas.

**Rationale**:

- Define quotas: Cloud Concepts (16), Security (20), Technology (22), Billing (7)
- For each domain: SELECT random questions up to quota
- Shuffle final question set
- Track previously-seen questions to avoid repetition across recent exams

**Alternatives Considered**:

- Pure random: Doesn't guarantee domain weighting
- Predefined exam sets: Less variety, requires admin to create sets

### 5. Analytics Calculation Strategy

**Context**: Display score trends, domain averages, and weak domain identification.

**Decision**: Calculate analytics on-demand from stored exam/practice records.

**Rationale**:

- SQLite aggregation queries are fast for expected data volume (<1000 attempts)
- No need for pre-computed analytics tables
- Weak domains: WHERE domain_score < 70 GROUP BY domain

**Alternatives Considered**:

- Pre-computed analytics table: Adds write complexity; premature optimization
- In-memory calculation: Loses data on app restart

### 6. UI Framework and Styling

**Context**: Mobile-optimized UI with performance targets (<300ms transitions).

**Decision**: React Native with NativeWind (Tailwind CSS) for styling.

**Rationale**:

- NativeWind provides utility-first styling familiar to web developers
- Consistent styling across components
- React Navigation for screen transitions (optimized for mobile)
- Minimal custom animations to meet performance targets

**Alternatives Considered**:

- Styled Components: More verbose, slower at scale
- React Native Paper: Material Design may not match desired aesthetic
- Custom StyleSheet: More boilerplate, less maintainable

### 7. State Management

**Context**: Manage exam state, practice sessions, and UI state across screens.

**Decision**: Zustand for global state with SQLite as source of truth.

**Rationale**:

- Zustand is lightweight (~1KB), simple API
- Persisted data lives in SQLite; Zustand manages in-memory state
- No Redux boilerplate; actions are plain functions
- Easy to test with Zustand's `create` function

**Alternatives Considered**:

- Redux Toolkit: More powerful but more boilerplate than needed
- React Context: Sufficient but Zustand provides better devtools and patterns
- MobX: Learning curve; overkill for this scope

### 8. Testing Strategy

**Context**: Ensure reliability for exam-critical features.

**Decision**: Three-tier testing approach.

**Rationale**:

- **Unit tests (Jest)**: Services (scoring, exam generation, analytics)
- **Component tests (React Native Testing Library)**: UI components with mocked services
- **E2E tests (Detox)**: Critical flows (complete exam, resume exam, review results)
- Focus E2E on P1 user stories; unit tests for edge cases

**Alternatives Considered**:

- Maestro: Newer, but Detox is more established for React Native
- Manual testing only: Insufficient for exam-critical features

### 9. Backend API Framework

**Context**: API serves question bank content; admin portal manages questions. PostgreSQL + Prisma ORM already decided.

**Decision**: NestJS with Fastify adapter.

**Rationale**:

- **Module structure**: Clean separation for questions API, admin portal, and content delivery
- **Prisma integration**: First-class support via `@prisma/client` with NestJS patterns
- **TypeScript native**: Full type safety with decorators for validation
- **Fastify performance**: Better throughput than Express for content delivery
- **Unified deployment**: API + admin portal in single service

**Alternatives Considered**:

- Express: Less structure; would need manual organization for admin + API
- Fastify standalone: Fewer conventions; more setup required
- Hono: Lightweight but smaller ecosystem for admin features

### 10. Admin Portal Implementation

**Context**: Web-based admin portal for question management (create, edit, approve, archive).

**Decision**: React SPA served by NestJS static module.

**Rationale**:

- **TypeScript alignment**: Shares types with API and potentially mobile
- **Single deployment**: NestJS serves both API and static React build
- **Simple auth**: Basic authentication or API key (no complex user system)
- **Familiar stack**: React components for forms, tables, workflows

**Alternatives Considered**:

- Next.js separate app: Adds deployment complexity for small admin team
- Server-rendered views (Handlebars): Less interactive for form-heavy workflows
- No-code admin (Retool, AdminJS): External dependency; less customization

### 11. Multi-Tenant Backend Architecture

**Context**: Support multiple certification exams (AWS CCP, Solutions Architect, etc.) from a single backend codebase.

**Decision**: Multi-tenant backend with ExamType entity; one shared REST API; one admin portal managing all exam types.

**Rationale**:

- **Single codebase**: One API and admin portal for all exams reduces maintenance
- **Exam-specific config**: ExamType entity stores domains, weights, passing scores, time limits
- **App isolation**: Each mobile app is configured with hardcoded EXAM_TYPE ID
- **Scalable**: Adding new exam types requires only seed data, not code changes
- **Consistent admin experience**: Manage all question banks from one portal

**Implementation Details**:

- ExamType.domains is JSON array: `[{id, name, weight, questionCount}]`
- Question.domain is string (validated against ExamType.domains)
- SyncVersion is per ExamType (tracks versions independently)
- Mobile app calls `/exam-types/{id}` on first launch to get domain config
- Mobile app calls `/exam-types/{id}/questions` filtered by its exam type

**Alternatives Considered**:

- Separate backends per exam: More isolation but more infrastructure overhead
- Microservices: Overkill for question delivery; adds latency
- Single exam hardcoded: Doesn't scale; would need fork per exam

## Technology Stack Summary

| Layer       | Technology                | Justification                    |
| ----------- | ------------------------- | -------------------------------- |
| **Mobile**  |                           |                                  |
| Framework   | React Native 0.73+ / Expo | Cross-platform, managed workflow |
| Language    | TypeScript 5.x            | Type safety, IDE support         |
| Navigation  | React Navigation 6.x      | Standard for RN, performant      |
| State       | Zustand                   | Lightweight, simple API          |
| Storage     | expo-sqlite               | Relational local storage         |
| Styling     | NativeWind                | Utility-first, fast              |
| HTTP        | Axios                     | Reliable, well-tested            |
| Testing     | Jest, RNTL, Detox         | Comprehensive coverage           |
| **Backend** |                           |                                  |
| Framework   | NestJS + Fastify          | Structured, performant           |
| Language    | TypeScript 5.x            | Type safety, shared types        |
| ORM         | Prisma                    | Type-safe DB access              |
| Database    | PostgreSQL 15+            | Relational, reliable             |
| Admin       | React SPA                 | Interactive forms                |
| Testing     | Jest, Supertest           | Unit + integration               |

## Open Questions Resolved

All technical questions resolved. Ready for Phase 1 design.
