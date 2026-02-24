# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Active Technologies

- **Mobile**: TypeScript 5.9, React Native 0.81, Expo SDK 54, React Navigation 6.x, expo-sqlite 16, expo-auth-session, Zustand 5, NativeWind 4, Axios
- **Backend**: TypeScript 5.7, NestJS 11, Fastify adapter, Prisma ORM 7, PostgreSQL 15+
- **Production Infrastructure**: Railway (backend), Neon PostgreSQL Serverless (database)
- **Admin Portal**: React 18 SPA built with Vite, served by NestJS at `/portal`
- **Testing**: Jest 30 + Supertest (API), Jest 29 + React Native Testing Library (mobile), Detox (mobile E2E)

## Project Structure

```text
api/                          # NestJS Backend API + Admin Portal
├── prisma/                   # Schema, migrations, seed.ts, seed-questions.json
├── src/
│   ├── auth/                 # Google OAuth, JWT strategies (access + refresh)
│   ├── exam-types/           # ExamType module (multi-tenant config)
│   ├── questions/            # Public questions API
│   ├── exam-attempts/        # Exam history persistence
│   ├── sync/                 # Question bank version tracking
│   ├── integrity/            # Play Integrity token verification
│   ├── admin/                # Admin authentication and CRUD
│   ├── prisma/               # Prisma service wrapper
│   ├── config/               # Configuration per domain (app, db, jwt, cors, auth, playIntegrity)
│   └── common/               # DTOs, filters, guards, middleware (RequestLogger, RateLimit)
├── admin-portal/             # React SPA (Vite)
└── test/                     # E2E specs and unit specs

packages/
└── shared/                   # @exam-app/shared — all shared mobile code
    ├── src/
    │   ├── screens/          # 14 UI screens (Home, Exam, Practice, Review, Upgrade, etc.)
    │   ├── components/       # 14+ reusable components (QuestionCard, Timer, etc.)
    │   ├── services/         # 18 service files (exam, sync, auth, analytics, etc.)
    │   ├── stores/           # 7 Zustand stores (auth, exam, exam-attempt, play-integrity, etc.)
    │   ├── storage/          # 8 SQLite repositories (offline-first)
    │   ├── config/           # Shared defaults (API_CONFIG, SYNC_CONFIG)
    │   ├── navigation/       # React Navigation root and stacks
    │   └── AppRoot.tsx       # Shared entry point, accepts AppRootProps (examTypeId, etc.)
    └── __tests__/            # Unit and integration tests

apps/
└── aws-clp/                  # Thin app wrapper for AWS Cloud Practitioner (CLF-C02)
    ├── App.tsx               # Imports AppRoot from @exam-app/shared
    ├── src/config/           # app.config.ts: EXAM_TYPE_ID = 'CLF-C02'
    ├── app.json              # Expo config (unique bundle ID, EAS project ID)
    └── assets/               # App-specific icons and splash screen

specs/                        # Feature documentation per phase
├── 002-cloudprep-mobile/     # Phase 1+2: Core app + Google OAuth + Cloud Sync (complete)
└── 003-play-integrity/       # Phase 3-5: Play Integrity, Monorepo, Monetization
```

## Commands

```bash
# Mobile (monorepo)
cd apps/aws-clp && npx expo start      # Start dev server for AWS CLP app
cd packages/shared && npm test         # Shared package unit tests
cd packages/shared && npm test -- --testPathPattern=play-integrity  # Single test file
cd packages/shared && npm run test:coverage  # Coverage report

# API
cd api && npm run start:dev            # Start dev server (hot reload)
cd api && npm test                     # Unit tests (src/**/*.spec.ts)
cd api && npm test -- --testPathPattern=integrity  # Single test file
cd api && npm run test:e2e             # E2E tests (test/**/*.e2e-spec.ts)
cd api && npm run test:cov             # Coverage report

# Database
cd api && npx prisma migrate dev       # Apply migrations (dev)
cd api && npx prisma db seed           # Seed question bank
cd api && npx prisma studio            # Database GUI

# Admin Portal (standalone dev)
cd api/admin-portal && npm run dev     # Vite dev server
cd api/admin-portal && npm run build   # Build into api/dist/admin-portal
```

## Environment Setup

Copy `.env.example` to `.env` in `api/` and each app under `apps/` before running locally.

**API key variables** (`api/.env`):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- `GOOGLE_CLOUD_PROJECT_NUMBER`, `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` — Play Integrity

**App key variables** (`apps/aws-clp/.env`): must use `EXPO_PUBLIC_` prefix to be accessible in app code.
- `EXPO_PUBLIC_API_URL` — Backend URL
- `EXPO_PUBLIC_EXAM_TYPE_ID` — e.g. `CLF-C02`
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID`

## Code Style

- TypeScript strict mode in all packages
- Prettier: `singleQuote: true`, `trailingComma: 'all'`, `semi: true`, `printWidth: 100`
- Prefer functional components with hooks (React Native)
- Use Zustand for global state (mobile); NestJS modules and decorators (API)
- Follow Prisma conventions for database access

## Architecture Notes

- **Offline-first**: Mobile app works fully offline; questions cached in SQLite. Sync checks a version endpoint before downloading updates.
- **Content-only sync**: API delivers question bank updates; no user data leaves device (only Google-authenticated exam attempts sync to backend).
- **Multi-tenant backend**: One API + admin portal serves multiple exam types (AWS CCP, SAA, etc.) via `ExamType` entity.
- **ExamType entity**: Stores exam-specific config (domains JSON, weights, passing score, time limit). Domains are dynamic per exam type.
- **App-specific config**: Each app in `apps/` has `EXPO_PUBLIC_EXAM_TYPE_ID` in `.env`; `src/config/app.config.ts` exposes it and passes to shared `AppRoot`.
- **Admin portal**: Built by Vite, served statically by NestJS at `/portal`. For local dev, use `npm run dev` inside `api/admin-portal/`.
- **AppRoot initialization sequence** (order matters): Google Sign-In init → periodic token refresh → SQLite DB init → Play Integrity check (blocks on definitive failure) → full question sync → persistence init → render `<RootNavigator />`.
- **Play Integrity**: One-time check on first launch, cached for 30 days in SQLite. Dev bypass available. Sideloaded/re-signed APKs are blocked.
- **Monorepo (Phase 4, active)**: npm workspaces with `packages/*`, `apps/*`, `api` workspaces. All shared mobile code in `packages/shared/` (`@exam-app/shared`). Each app in `apps/{exam-id}/` is a thin wrapper (~4 lines in App.tsx) that imports `AppRoot` and passes exam-specific config. The old `mobile/` directory has been fully migrated and removed.
- **Bundle service**: `packages/shared/src/services/bundle.service.ts` loads initial question bank from bundled JSON assets (per-app `assets/questions/` directory).

## API Endpoints

```
# Public (mobile app)
GET /exam-types/{examTypeId}                    # Exam config (domains, passing score)
GET /exam-types/{examTypeId}/questions          # Questions filtered by exam type
GET /exam-types/{examTypeId}/questions/version  # Version check for sync

# Integrity (mobile app)
POST /api/integrity/verify                      # Verify Play Integrity token

# Admin (portal)
GET    /admin/exam-types                        # List exam types
POST   /admin/exam-types                        # Create exam type
PUT    /admin/exam-types/{id}                   # Update exam type
PATCH  /admin/exam-types/{id}                   # Toggle active/inactive
GET    /admin/questions?examTypeId=...          # List questions
POST   /admin/questions                         # Create question (requires examTypeId)
```

## Testing Notes

- **API unit tests** live in `src/` as `*.spec.ts`; **E2E tests** live in `test/` as `*.e2e-spec.ts`.
- **Mobile tests** live in `__tests__/`. Native Expo modules (expo-sqlite, expo-auth-session, etc.) are all mocked in `jest.setup.js` — do not import unmocked native modules in unit tests.
- **Detox** is required for true E2E mobile tests (device/emulator). Jest-based mobile tests run in Node.js with full mocks.
- Coverage thresholds: 60% global for both packages; mobile services require 80%.

## Feature Phases (specs/)

- **Phase 1+2** (`specs/002-cloudprep-mobile/`): Core exam app + Google OAuth + Cloud Sync — ✅ Complete
- **Phase 3** (`specs/003-play-integrity/`): Play Integrity Guard + Production deployment (Railway + Neon) — ✅ Complete (tasks T151–T205)
- **Phase 4** (`specs/003-play-integrity/`): Multi-App Monorepo Architecture — 🔄 In progress
  - Phase 10 (Shared Package Extraction) — ✅ Complete (T207–T216)
  - Phase 11 (App Wrapper Migration) — ✅ Complete (T217–T220)
  - Phase 12 (Admin ExamType CRUD Backend) — 📋 Not started (T221–T228)
  - Phase 13 (Admin ExamType CRUD Frontend) — 📋 Not started (T229–T236)
  - Phase 14 (Template & Scaffold Script) — 📋 Not started (T237–T240)
  - Phase 15 (Final Validation) — 📋 Not started (T241–T246)
- **Phase 5** (`specs/003-play-integrity/`): Monetization — Login-Gated Free Tier + One-Time Purchase — 📋 Planned
  - Phase 16 (Login-Gated Free Tier, 15 questions) — 📋 Not started (T247–T258)
  - Phase 17 (Play Billing One-Time Purchase) — 📋 Blocked (T259–T270, requires Play Console access)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
