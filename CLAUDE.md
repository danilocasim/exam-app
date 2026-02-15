# exam-app Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-12

## Active Technologies

- **Mobile**: TypeScript 5.x, React Native 0.73+, Expo SDK 50+, React Navigation 6.x, expo-sqlite, expo-auth-session, Zustand, NativeWind, Axios
- **Backend**: TypeScript 5.x, NestJS, Fastify, Prisma ORM, PostgreSQL 15+
- **Production Infrastructure**: AWS App Runner (backend hosting), AWS Aurora PostgreSQL Serverless v2 (database), AWS Secrets Manager (credentials), AWS Systems Manager Parameter Store (configuration)
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
- **Phase 2** (002-cloudprep-mobile): Google OAuth + Cloud Sync - ✅ Complete (39 tasks T112-T150)
  - User Stories: US6 (Google Sign-In), US7 (Exam History Persistence), US8 (Analytics Sync)
  - Functional Requirements: FR-034 to FR-041 (authentication, persistence, analytics)
  - Implementation: Backend Auth (8) + Persistence (8) + Mobile Integration (15) + Testing (8)
  - Deliverables: 5 test files, phase2-testing-guide.md, README.md with architecture diagrams
  - Testing: 3 integration tests (T144-T146), 2 unit tests (T147-T148), performance benchmarks, manual test guide
  - All tasks completed and merged into 003-play-integrity branch
- **Phase 3** (003-play-integrity): Play Integrity Guard - 📋 Ready for Implementation (55 tasks T151-T205)
  - User Stories: US1-4 (Play Store verification, sideload blocking, dev bypass, reinstall reset)
  - Functional Requirements: FR-001 to FR-025 (verification, caching, error handling, AWS production deployment)
  - Success Criteria: SC-001 to SC-013 (100% blocking, <5s first launch, offline post-verify, dev bypass, AWS deployment)
  - Scope: One-time app integrity check on first launch, 30-day cache TTL, full offline after verification, production deployment to AWS
  - Dependencies: Phase 2 complete (authentication, cloud sync infrastructure in place)
  - Blocks sideloaded/re-signed APKs while preserving offline functionality and dev iteration
  - **Phase 3.8: AWS Production Deployment** (T191-T205):
    - Infrastructure: Aurora PostgreSQL Serverless v2, AWS App Runner, VPC with private subnets
    - Secrets: AWS Secrets Manager (database credentials), Parameter Store (configuration)
    - Database: Migration scripts, seed scripts, production connection testing
    - Deployment: Health checks, environment-based API URLs, deployment documentation

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
