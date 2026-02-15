# exam-app Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-12

## Active Technologies

- **Mobile**: TypeScript 5.x, React Native 0.73+, Expo SDK 50+, React Navigation 6.x, expo-sqlite, expo-auth-session, Zustand, NativeWind, Axios
- **Backend**: TypeScript 5.x, NestJS, Fastify, Prisma ORM, PostgreSQL 15+
- **Admin Portal**: React SPA (served by NestJS)
- **Testing**: Jest, React Native Testing Library, Detox (mobile), Supertest (API)

## Project Structure

```text
api/                          # NestJS Backend API + Admin Portal
├── prisma/                   # Database schema and migrations
├── src/
│   ├── exam-types/           # ExamType module (multi-tenant config)
│   ├── questions/            # Public questions API
│   ├── admin/                # Admin authentication and CRUD
│   ├── prisma/               # Prisma service
│   └── common/               # Shared DTOs, guards
├── admin-portal/             # React SPA
└── test/

mobile/                       # React Native + Expo Mobile App
├── src/
│   ├── screens/              # UI screens
│   ├── components/           # Reusable components
│   ├── services/             # Business logic
│   ├── stores/               # Zustand stores
│   ├── storage/              # SQLite database
│   ├── config/               # App config (EXAM_TYPE_ID)
│   └── navigation/           # React Navigation
└── __tests__/

specs/002-cloudprep-mobile/   # Feature documentation
├── spec.md                   # Feature specification
├── plan.md                   # Implementation plan
├── research.md               # Technical research
├── data-model.md             # Data model documentation
├── quickstart.md             # Setup guide
└── contracts/api.yaml        # OpenAPI spec
```

## Commands

```bash
# Mobile
cd mobile && npm test          # Unit tests
cd mobile && npm run test:e2e  # E2E tests (Detox)
cd mobile && npx expo start    # Start dev server

# API
cd api && npm test             # Unit + integration tests
cd api && npm run start:dev    # Start dev server
cd api && npx prisma studio    # Database GUI
```

## Code Style

- TypeScript strict mode enabled
- Prefer functional components with hooks (React Native)
- Use Zustand for global state (mobile)
- Use NestJS modules and decorators (API)
- Follow Prisma conventions for database access

## Architecture Notes

- **Offline-first**: Mobile app works fully offline; questions cached in SQLite
- **Content-only sync**: API delivers question bank updates; no user data leaves device
- **Multi-tenant backend**: One shared API + admin portal serves all exam types (AWS CCP, SAA, etc.)
- **ExamType entity**: Stores exam-specific config (domains, weights, passing score, time limit)
- **App-specific config**: Each mobile app has hardcoded EXAM_TYPE_ID in config
- **Domain-per-ExamType**: Domains defined in ExamType.domains JSON; dynamic per exam type
- **One-time purchase**: Play Store paid app model; no subscriptions

## API Endpoints

```
# Public (mobile app)
GET /exam-types/{examTypeId}              # Get exam config (domains, passing score)
GET /exam-types/{examTypeId}/questions    # Get questions filtered by exam type
GET /exam-types/{examTypeId}/questions/version  # Check for updates

# Integrity Verification (mobile app)
POST /api/integrity/verify                # Decrypt Play Integrity token (client-side enforcement)

# Admin (portal)
GET /admin/exam-types                     # List all exam types
GET /admin/questions?examTypeId=...       # List questions filtered by exam type
POST /admin/questions                     # Create question (requires examTypeId)
```

## Recent Changes

- **Phase 1** (002-cloudprep-mobile): AWS Cloud Practitioner exam app - ✅ Complete (115 tasks, 99 tests)
- **Phase 2** (002-cloudprep-mobile --append): Google OAuth + Cloud Sync - 📋 Ready (39 tasks T112-T150)
  - User Stories: US6 (Google Sign-In), US7 (Exam History Persistence), US8 (Analytics Sync)
  - Functional Requirements: FR-034 to FR-041 (authentication, persistence, analytics)
  - Task breakdown: Backend Auth (8) + Persistence (8) + Mobile Integration (15) + Testing (8)
  - Timeline: 4 weeks with 2 developers in parallel, ~58 dev-hours
  - All design documents updated: research.md, data-model.md, contracts/api.yaml, plan.md, tasks.md
- **Phase 3** (003-play-integrity): Play Integrity Guard - 📋 Draft Spec (TBD tasks)
  - User Stories: US1-4 (Play Store verification, sideload blocking, dev bypass, reinstall reset)
  - Functional Requirements: FR-001 to FR-016 (verification, caching, error handling)
  - Success Criteria: SC-001 to SC-008 (100% blocking, <5s first launch, offline post-verify, dev bypass)
  - Scope: One-time app integrity check on first launch, 30-day cache TTL, full offline after verification
  - Blocks sideloaded/re-signed APKs while preserving offline functionality and dev iteration

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
