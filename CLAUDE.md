# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Active Technologies

- **Mobile**: TypeScript 5.9, React Native 0.81, Expo SDK 54, React Navigation 6.x, expo-sqlite 16, expo-auth-session, Zustand 5, NativeWind 4, Axios
- **Backend**: TypeScript 5.7, NestJS 11, Fastify adapter, Prisma ORM 7, PostgreSQL 15+
- **Production Infrastructure**: AWS App Runner (backend), AWS Aurora PostgreSQL Serverless v2 (database), AWS Secrets Manager, AWS Systems Manager Parameter Store
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

mobile/                       # React Native + Expo Mobile App
├── src/
│   ├── screens/              # UI screens
│   ├── components/           # Reusable components
│   ├── services/             # Business logic (18 service files)
│   ├── stores/               # Zustand stores (auth, exam, exam-attempt, play-integrity, analytics, etc.)
│   ├── storage/              # SQLite repositories (offline-first)
│   ├── config/               # app.config.ts: EXAM_TYPE_ID, API_CONFIG, SYNC_CONFIG
│   └── navigation/           # React Navigation root and stacks
├── __tests__/                # Unit and integration tests
├── App.tsx                   # Entry point — initialization sequence
└── app.json                  # Expo config (bundle ID, EAS project ID)

specs/                        # Feature documentation per phase
├── 002-cloudprep-mobile/     # Phase 1+2: Core app + Google OAuth + Cloud Sync (complete)
└── 003-play-integrity/       # Phase 3: Play Integrity + AWS deployment; Phase 4: Monorepo
```

## Commands

```bash
# Mobile
cd mobile && npx expo start            # Start dev server
cd mobile && npm test                  # Unit tests
cd mobile && npm test -- --testPathPattern=play-integrity  # Single test file
cd mobile && npm run test:coverage     # Coverage report
cd mobile && npm run lint
cd mobile && npm run format

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

Copy `.env.example` to `.env` in both `api/` and `mobile/` before running locally.

**API key variables** (`api/.env`):
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
- `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- `GOOGLE_CLOUD_PROJECT_NUMBER`, `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` — Play Integrity

**Mobile key variables** (`mobile/.env`): must use `EXPO_PUBLIC_` prefix to be accessible in app code.
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
- **App-specific config**: Each mobile app has `EXPO_PUBLIC_EXAM_TYPE_ID` hardcoded in `.env`; `mobile/src/config/app.config.ts` exposes it.
- **Admin portal**: Built by Vite, served statically by NestJS at `/portal`. For local dev, use `npm run dev` inside `api/admin-portal/`.
- **App.tsx initialization sequence** (order matters): Google Sign-In init → periodic token refresh → SQLite DB init → Play Integrity check (blocks on definitive failure) → full question sync → persistence init → render `<RootNavigator />`.
- **Play Integrity**: One-time check on first launch, cached for 30 days in SQLite. Dev bypass available. Sideloaded/re-signed APKs are blocked.
- **Monorepo (Phase 4, planned)**: npm workspaces, shared mobile code in `packages/shared/`, thin app wrappers in `apps/{exam-id}/`.

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
- **Phase 3** (`specs/003-play-integrity/`): Play Integrity Guard + AWS production deployment — 📋 In progress (tasks T151–T205)
- **Phase 4** (`specs/003-play-integrity/`): Multi-App Monorepo Architecture — 📋 Planned (tasks T207–T246)

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
