# Exam App - AWS Cloud Certification Practice Platform

**Multi-tenant exam preparation platform with offline-first mobile apps and centralized admin portal**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![React Native](https://img.shields.io/badge/React%20Native-0.73-61DAFB)](https://reactnative.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-E0234E)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15%2B-4169E1)](https://www.postgresql.org/)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
  - [System Overview](#system-overview)
  - [Phase 2: Authentication & Cloud Sync](#phase-2-authentication--cloud-sync)
  - [OAuth Flow](#oauth-flow)
  - [Offline Sync State Machine](#offline-sync-state-machine)
  - [Token Lifecycle](#token-lifecycle)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Running the Apps](#running-the-apps)
- [Adding a New Exam App](#adding-a-new-exam-app)
- [Development](#development)
  - [Database Migrations](#database-migrations)
  - [Authentication Setup](#authentication-setup)
  - [Testing](#testing)
- [Migration Guide](#migration-guide)
  - [Upgrading from Phase 1 (Local-Only) to Phase 2 (Cloud Sync)](#upgrading-from-phase-1-local-only-to-phase-2-cloud-sync)
- [API Documentation](#api-documentation)
- [Contributing](#contributing)
- [License](#license)

---

## 🎯 Overview

**Exam App** is an AWS Cloud certification practice platform designed for:

- **Students**: Practice exams for AWS certifications (Cloud Practitioner, Solutions Architect, etc.)
- **Content Creators**: Centralized admin portal for managing question banks across multiple exam types
- **Educational Institutions**: Multi-tenant architecture supporting different certification tracks

### Key Features

- ✅ **Offline-First Mobile App**: Complete exams without internet connection
- ✅ **Cloud Sync**: Automatic exam history synchronization across devices (Phase 2)
- ✅ **Google OAuth Authentication**: Secure sign-in with Google accounts (Phase 2)
- ✅ **Analytics Dashboard**: Track performance across domains and exam attempts
- ✅ **Multi-Tenant Backend**: One API serves multiple exam types (AWS CCP, SAA, SOA, etc.)
- ✅ **Admin Portal**: Manage questions, domains, and exam configurations
- ✅ **Timed Practice Exams**: Realistic exam simulation with domain-weighted question selection

---

## 🏗 Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         MOBILE APPS                              │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐       │
│  │  AWS CCP App  │  │  AWS SAA App  │  │  AWS SOA App  │       │
│  │ (examTypeId:  │  │ (examTypeId:  │  │ (examTypeId:  │       │
│  │   "aws-ccp")  │  │   "aws-saa")  │  │   "aws-soa")  │       │
│  │               │  │               │  │               │       │
│  │ Offline-First │  │ Offline-First │  │ Offline-First │       │
│  │ SQLite DB     │  │ SQLite DB     │  │ SQLite DB     │       │
│  └───────┬───────┘  └───────┬───────┘  └───────┬───────┘       │
│          │                  │                  │                │
│          └──────────────────┴──────────────────┘                │
│                             │                                   │
│                    Cloud Sync (Phase 2)                         │
│                 Google OAuth + JWT Tokens                       │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      BACKEND API (NestJS)                        │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  Auth Module     │  │  ExamTypes       │  │  Questions    │ │
│  │  - Google OAuth  │  │  - Multi-tenant  │  │  - Filtering  │ │
│  │  - JWT Tokens    │  │  - Domain Config │  │  - Versioning │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
│                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │  ExamAttempts    │  │  Analytics       │  │  Sync Service │ │
│  │  - Persistence   │  │  - Aggregation   │  │  - Queue Mgmt │ │
│  │  - History       │  │  - Breakdown     │  │  - Retry Logic│ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
│                                                                  │
│                    PostgreSQL Database                           │
│         (Users, ExamAttempts, Questions, ExamTypes)              │
└─────────────────────────────────────────────────────────────────┘

All mobile apps are thin wrappers in `apps/*` that import shared logic from
`packages/shared/` (screens, services, stores, and SQLite repositories).
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN PORTAL (React SPA)                      │
│                                                                  │
│  - Manage Questions (CRUD)                                       │
│  - Configure ExamTypes (domains, weights, passing scores)       │
│  - View Analytics (global statistics)                           │
│  - Admin Authentication (separate from user OAuth)              │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Authentication & Cloud Sync

**Phase 2** introduces user authentication and cloud synchronization:

1. **Google OAuth Sign-In**: Users authenticate with Google accounts
2. **JWT Token Management**: Access tokens (1 hour) + Refresh tokens (30 days)
3. **Offline Queue**: Exam submissions stored locally when offline
4. **Automatic Sync**: Pending exams sync to cloud when network restores
5. **Exponential Backoff**: Failed syncs retry with increasing delays (max 12 attempts)
6. **Token Refresh**: Expired tokens automatically renewed without user intervention

### OAuth Flow

**Google OAuth Authentication Sequence**:

```mermaid
sequenceDiagram
    participant User
    participant Mobile as Mobile App
    participant Google as Google OAuth
    participant Backend as Backend API
    participant DB as PostgreSQL

    User->>Mobile: Tap "Sign In with Google"
    Mobile->>Google: Initiate OAuth (expo-auth-session)
    Google->>User: Show consent screen
    User->>Google: Grant permissions
    Google->>Mobile: Return authorization code
    Mobile->>Backend: POST /auth/google/callback<br/>{code}
    Backend->>Google: Verify code & get user info
    Google->>Backend: Return user profile
    Backend->>DB: Create or update User record
    DB->>Backend: User saved
    Backend->>Mobile: Return JWT tokens<br/>{accessToken, refreshToken}
    Mobile->>Mobile: Store tokens (AsyncStorage)
    Mobile->>User: Show user profile
```

**Key Components**:
- **Authorization Code**: One-time code from Google (expires in 10 minutes)
- **Access Token**: JWT token for API requests (expires in 1 hour)
- **Refresh Token**: Long-lived token for renewing access tokens (expires in 30 days)

### Offline Sync State Machine

**Exam Submission Sync Status Transitions**:

```mermaid
stateDiagram-v2
    [*] --> PENDING: User completes exam offline
    
    PENDING --> SYNCED: POST /exam-attempts/submit-authenticated<br/>✅ Success (200 OK)
    PENDING --> FAILED: POST fails (network error, 500, etc.)
    
    FAILED --> SYNCED: Retry successful after backoff
    FAILED --> FAILED: Retry fails (increment syncRetries)
    FAILED --> FAILED: syncRetries ≥ 12 (max retries)<br/>⚠️ Permanent failure
    
    SYNCED --> [*]: Exam persisted in cloud
```

**Sync Retry Logic**:
- **Exponential Backoff**: `delayMs = 5000 * Math.pow(2, syncRetries)`
  - Retry 1: 5 seconds
  - Retry 2: 10 seconds
  - Retry 3: 20 seconds
  - Retry 4: 40 seconds
  - ...
  - Retry 12: ~5.7 hours (max delay)
- **Max Retries**: 12 attempts (cumulative ~63 minutes window)
- **FIFO Queue**: Exams sync in submission order

### Token Lifecycle

**JWT Token Management**:

```mermaid
sequenceDiagram
    participant Mobile
    participant API
    participant Auth as AuthService

    Note over Mobile,Auth: Initial Authentication
    Mobile->>API: POST /auth/google/callback
    API->>Mobile: Access Token (exp: 1h)<br/>Refresh Token (exp: 30d)
    
    Note over Mobile,Auth: Making Protected Requests
    Mobile->>API: GET /exam-attempts/my-history<br/>Authorization: Bearer {accessToken}
    API->>Mobile: 200 OK (exam data)
    
    Note over Mobile,Auth: Access Token Expires After 1 Hour
    Mobile->>API: GET /exam-attempts/analytics<br/>Authorization: Bearer {expiredToken}
    API->>Mobile: 401 Unauthorized (token expired)
    
    Mobile->>Auth: POST /auth/refresh<br/>{refreshToken}
    Auth->>Mobile: New Access Token (exp: 1h)<br/>New Refresh Token (exp: 30d)
    
    Mobile->>API: Retry: GET /exam-attempts/analytics<br/>Authorization: Bearer {newAccessToken}
    API->>Mobile: 200 OK (analytics data)
    
    Note over Mobile,Auth: Refresh Token Also Expires (After 30 Days)
    Mobile->>Auth: POST /auth/refresh<br/>{expiredRefreshToken}
    Auth->>Mobile: 403 Forbidden (refresh token expired)
    Mobile->>Mobile: Clear stored tokens
    Mobile->>Mobile: Show "Session expired, please sign in"
```

**Token Rotation**:
- Access tokens renewed every 1 hour (automatic)
- Refresh tokens rotated on each refresh (security best practice)
- Expired refresh tokens require user to re-authenticate

---

## 🛠 Tech Stack

### Mobile App

- **Framework**: React Native 0.81 + Expo SDK 54
- **Language**: TypeScript 5.x
- **Navigation**: React Navigation 6.x
- **State Management**: Zustand
- **Data Storage**: expo-sqlite (offline-first)
- **Networking**: Axios with retry interceptors
- **Authentication**: expo-auth-session (Google OAuth)
- **Styling**: NativeWind (Tailwind CSS for React Native)
- **Testing**: Jest, React Native Testing Library, Detox (E2E)

### Backend API

- **Framework**: NestJS 11.x + Fastify
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL 15+ with Prisma ORM
- **Authentication**: @nestjs/jwt + passport-jwt (JWT strategy)
- **OAuth**: Google OAuth 2.0 with googleapis
- **Validation**: class-validator + class-transformer
- **Testing**: Jest, Supertest (E2E)

### Admin Portal

- **Framework**: React 18 (SPA served by NestJS)
- **Build Tool**: Vite 5.x
- **UI Library**: Material-UI (MUI)
- **State Management**: React Context API
- **HTTP Client**: Axios

### DevOps & Tools

- **Package Manager**: npm
- **Linting**: ESLint 9.x
- **Database GUI**: Prisma Studio
- **API Testing**: Postman (collections in `specs/002-cloudprep-mobile/contracts/`)

---

## 📂 Project Structure

```
exam-app/
├── api/                          # Backend NestJS API + Admin Portal
│   ├── src/
│   │   ├── auth/                 # Authentication module (Google OAuth, JWT)
│   │   ├── exam-types/           # ExamType CRUD + multi-tenant config
│   │   ├── questions/            # Questions API (public, filtered by examTypeId)
│   │   ├── exam-attempts/        # Exam submission persistence + history
│   │   ├── sync/                 # Sync service (queue processing, retry logic)
│   │   ├── admin/                # Admin portal authentication + CRUD
│   │   ├── prisma/               # Prisma service module
│   │   └── common/               # Shared DTOs, guards, pipes
│   ├── prisma/
│   │   ├── schema.prisma         # Database schema (User, ExamAttempt, Question, ExamType)
│   │   ├── migrations/           # Database migrations
│   │   └── seed.ts               # Seed data (questions, exam types)
│   ├── test/                     # E2E tests (auth, exam-attempts, analytics)
│   └── admin-portal/             # React SPA for admin interface
│       ├── src/
│       │   ├── pages/            # Admin pages (Questions, ExamTypes, Analytics)
│       │   ├── components/       # Reusable UI components
│       │   └── services/         # API client services
│       └── index.html
│
├── packages/
│   └── shared/                   # @exam-app/shared (screens, services, stores, storage)
│       ├── src/
│       │   ├── screens/          # App screens (Home, Exam, Results, Analytics, Profile)
│       │   ├── components/       # Reusable components (QuestionCard, Timer, etc.)
│       │   ├── services/         # Business logic (ExamAttemptService, AuthService)
│       │   ├── storage/          # SQLite database layer + repositories
│       │   ├── stores/           # Zustand stores (auth, exam state)
│       │   └── navigation/       # React Navigation (stack, tab navigators)
│       └── __tests__/            # Shared unit/integration tests
│
├── apps/                         # Per-exam thin wrappers
│   ├── aws-clp/                  # AWS Cloud Practitioner app (CLF-C02)
│   ├── saa-c03/                  # AWS SAA app (SAA-C03)
│   └── template/                 # App template used by scripts/create-app.sh
│
├── specs/                        # Feature specifications
│   ├── 002-cloudprep-mobile/
│   └── 003-play-integrity/
│
└── README.md                     # This file
```

### Monorepo Migration (Before vs After)

| Area | Before (Single App) | After (Monorepo) |
|------|----------------------|-----------------|
| Mobile code | `mobile/` | `packages/shared/` + `apps/*/` wrappers |
| App-specific config | `mobile/src/config` | `apps/*/src/config/app.config.ts` |
| Expo entry point | `mobile/App.tsx` | `apps/*/App.tsx` (thin wrapper) |
| Build commands | `cd mobile && npx expo start` | `cd apps/aws-clp && npx expo start` |
| New app creation | Manual copy | `./scripts/create-app.sh` |

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: 18+ and npm 9+
- **PostgreSQL**: 15+ (running on localhost:5432 or remote)
- **Android Studio**: SDK 24+ (Android 7.0+) with emulator
- **Expo CLI**: `npm install -g expo-cli`
- **Google Cloud Console**: OAuth 2.0 credentials (for authentication)

### Installation

#### 1. Clone Repository

```bash
git clone https://github.com/your-org/exam-app.git
cd exam-app
```

#### 2. Setup Backend API

```bash
cd api
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and set:
#   DATABASE_URL="postgresql://user:password@localhost:5432/exam_app"
#   GOOGLE_CLIENT_ID="your-google-oauth-client-id"
#   GOOGLE_CLIENT_SECRET="your-google-oauth-secret"
#   JWT_SECRET="your-random-jwt-secret"
#   JWT_REFRESH_SECRET="your-random-refresh-secret"

# Run Prisma migrations
npx prisma migrate dev

# Seed database with questions and exam types
npx prisma db seed
```

#### 3. Setup Mobile App

```bash
cd ..
npm install

# Configure app environment variables
cp apps/aws-clp/.env.example apps/aws-clp/.env
# Edit apps/aws-clp/.env and set EXPO_PUBLIC_API_URL + Google OAuth client IDs
```

### Running the Apps

#### Backend API

```bash
cd api
npm run start:dev
# API running on http://localhost:3000
# Admin portal: http://localhost:3000 (served by NestJS)
```

#### Mobile App

```bash
cd apps/aws-clp
npx expo start
# Choose platform:
#   - Press 'a' for Android emulator
#   - Press 'i' for iOS simulator (macOS only)
#   - Scan QR code with Expo Go app (physical device)
```

#### Prisma Studio (Database GUI)

```bash
cd api
npx prisma studio
# Opens at http://localhost:5555
```

---

## ➕ Adding a New Exam App

1. Create the exam type in the admin portal (ID must match your app examTypeId).
2. Scaffold the app:

```bash
./scripts/create-app.sh --exam-type SAA-C03 --name "Dojo Exam SAA" --package com.danilocasim.dojoexam.saac03
```

3. Configure app environment variables:

```bash
cp apps/saa-c03/.env.example apps/saa-c03/.env
# Edit EXPO_PUBLIC_API_URL + Google OAuth IDs
```

4. Run the app:

```bash
cd apps/saa-c03
npx expo start
```

---

## 🔧 Development

### Database Migrations

**Create a new migration**:
```bash
cd api
npx prisma migrate dev --name add_user_model
```

**Reset database** (development only):
```bash
npx prisma migrate reset
```

**Generate Prisma Client**:
```bash
npx prisma generate
```

### Authentication Setup

#### Google Cloud Console Configuration

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services** → **Credentials**
4. Create **OAuth 2.0 Client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: `http://localhost:3000/auth/google/callback`
5. Copy **Client ID** and **Client Secret** to `api/.env`

#### OAuth Testing (Local Development)

```bash
# Test OAuth endpoint
curl -X POST http://localhost:3000/auth/google/callback \
  -H "Content-Type: application/json" \
  -d '{"code": "GOOGLE_AUTHORIZATION_CODE"}'

# Expected response:
# {
#   "accessToken": "eyJhbGciOiJIUzI1NiIs...",
#   "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
#   "expiresIn": 3600
# }
```

### Testing

#### Backend Tests

```bash
cd api

# Unit tests
npm test

# E2E tests
npm run test:e2e

# Specific test file
npm test -- auth.e2e-spec.ts

# Test coverage
npm run test:cov
```

#### Mobile Tests

```bash
cd packages/shared

# Unit tests
npm test

# Integration tests
npm test -- offline-queue.integration.test.ts

# Performance benchmarks
npm test -- performance.bench.ts

# E2E tests (Detox)
npm run test:e2e
```

---

## 🔄 Migration Guide

### Upgrading from Phase 1 (Local-Only) to Phase 2 (Cloud Sync)

**Phase 1** (Complete): Offline-first mobile app with local SQLite storage  
**Phase 2** (Complete): Adds Google OAuth authentication and cloud synchronization

#### Changes in Phase 2

1. **User Authentication**: 
   - Google OAuth sign-in added to Profile screen
   - JWT tokens stored in AsyncStorage
   - Authentication is **optional** (users can continue using app locally)

2. **Exam Submission Flow**:
   - **Phase 1**: Exams saved locally only
   - **Phase 2**: Exams saved locally + synced to cloud (if signed in)
   - Offline submissions queued with `syncStatus: PENDING`

3. **Analytics**:
   - **Phase 1**: Local analytics from SQLite database
   - **Phase 2**: Cloud analytics from backend API (all devices)

4. **Database Schema Changes**:
   - Added `User` table (googleId, email, name)
   - Added `ExamAttempt` table (persisted exam submissions)
   - Added `syncStatus` field to local SQLite schema (`PENDING`, `SYNCED`, `FAILED`)

#### Migration Steps for Existing Users

**No user action required!** The app handles migration automatically:

1. **First Launch (Phase 2)**:
   - Existing local exams remain accessible
   - "Sign In" button appears in Profile screen
   - App continues to work offline (no changes to core functionality)

2. **Optional: Sign In**:
   - User taps "Sign In with Google"
   - Authenticates with Google account
   - On first sign-in, all existing local exams automatically uploaded to cloud
   - Future exams sync across all devices

3. **Continued Offline Use**:
   - Users can choose **not to sign in**
   - App continues to work exactly as in Phase 1 (local-only)
   - No data leaves the device

#### Database Migration

**Backend**: Run Prisma migrations automatically applies new schema:
```bash
cd api
npx prisma migrate deploy
```

Phase 2 migrations:
- `20260214184204_add_user_model_and_exam_attempts`: Adds User and ExamAttempt tables
- `20260214184614_add_sync_status_enum_and_sync_retries`: Adds SyncStatus enum

**Mobile**: SQLite schema updated automatically on app launch:
- `src/storage/db.ts` runs schema migrations on `openDatabase()`

#### Rollback (If Needed)

**Revert to Phase 1** (local-only):
```bash
# Backend: Rollback migrations
cd api
npx prisma migrate resolve --rolled-back 20260214184204_add_user_model_and_exam_attempts
npx prisma migrate resolve --rolled-back 20260214184614_add_sync_status_enum_and_sync_retries

# Mobile: Checkout Phase 1 branch
git checkout phase-1-local-only
cd apps/aws-clp
npm install
npx expo start
```

---

## 📖 API Documentation

### Public Endpoints (Mobile App)

#### Authentication

```http
POST /auth/google/callback
Content-Type: application/json

{
  "code": "GOOGLE_AUTHORIZATION_CODE"
}

Response (200 OK):
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}

Response (200 OK):
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600
}
```

```http
GET /auth/me
Authorization: Bearer {accessToken}

Response (200 OK):
{
  "id": "user-uuid-123",
  "googleId": "1234567890",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://lh3.googleusercontent.com/..."
}
```

#### Exam Types

```http
GET /exam-types/aws-ccp

Response (200 OK):
{
  "id": "aws-ccp",
  "name": "AWS Certified Cloud Practitioner",
  "passingScore": 70,
  "timeLimit": 90,
  "questionCount": 65,
  "domains": [
    {"id": "d1", "name": "Cloud Concepts", "weight": 26, "questionCount": 17},
    {"id": "d2", "name": "Security", "weight": 25, "questionCount": 16},
    ...
  ]
}
```

#### Questions

```http
GET /exam-types/aws-ccp/questions

Response (200 OK):
{
  "questions": [
    {
      "id": "q1",
      "text": "What is Amazon S3?",
      "type": "SINGLE_CHOICE",
      "options": [...],
      "correctAnswers": ["option-2"],
      "domainId": "d3"
    },
    ...
  ],
  "version": "1.0.5"
}
```

#### Exam Attempts

```http
POST /exam-attempts/submit-authenticated
Authorization: Bearer {accessToken}
Content-Type: application/json

{
  "examTypeId": "aws-ccp",
  "score": 85,
  "passed": true,
  "duration": 3600,
  "submittedAt": "2026-02-14T10:00:00Z"
}

Response (201 Created):
{
  "id": "attempt-uuid-123",
  "userId": "user-uuid-456",
  "examTypeId": "aws-ccp",
  "score": 85,
  "passed": true,
  "duration": 3600,
  "submittedAt": "2026-02-14T10:00:00Z",
  "syncStatus": "SYNCED"
}
```

```http
GET /exam-attempts/my-history?page=1&limit=20&examTypeId=aws-ccp
Authorization: Bearer {accessToken}

Response (200 OK):
{
  "attempts": [
    {
      "id": "attempt-uuid-123",
      "examTypeId": "aws-ccp",
      "score": 85,
      "passed": true,
      "duration": 3600,
      "submittedAt": "2026-02-14T10:00:00Z"
    },
    ...
  ],
  "total": 45,
  "page": 1,
  "limit": 20
}
```

```http
GET /exam-attempts/analytics/my-analytics?examTypeId=aws-ccp
Authorization: Bearer {accessToken}

Response (200 OK):
{
  "totalAttempts": 12,
  "totalPassed": 9,
  "passRate": 0.75,
  "averageScore": 78.5,
  "averageDuration": 2400
}
```

### Admin Endpoints

See [contracts/api.yaml](specs/002-cloudprep-mobile/contracts/api.yaml) for full OpenAPI specification.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Follow the [development workflow](specs/002-cloudprep-mobile/plan.md)
4. Run tests: `npm test`
5. Commit changes: `git commit -m "feat: add your feature"`
6. Push to branch: `git push origin feature/your-feature`
7. Open a Pull Request

### Code Style

- **TypeScript**: Strict mode enabled
- **Linting**: ESLint 9.x (run `npm run lint`)
- **Formatting**: Prettier (run `npm run format`)
- **Commits**: Conventional Commits format

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **NestJS Framework**: [nestjs.com](https://nestjs.com/)
- **React Native + Expo**: [expo.dev](https://expo.dev/)
- **Prisma ORM**: [prisma.io](https://prisma.io/)
- **AWS Certification Program**: [aws.amazon.com/certification](https://aws.amazon.com/certification/)

---

## 📞 Support

- **Documentation**: [specs/002-cloudprep-mobile/](/specs/002-cloudprep-mobile/)
- **Issues**: [GitHub Issues](https://github.com/your-org/exam-app/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/exam-app/discussions)

---

**Last Updated**: February 14, 2026  
**Version**: Phase 2 (Authentication & Cloud Sync) - Complete
