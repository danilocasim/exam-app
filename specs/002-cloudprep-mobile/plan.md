# Implementation Plan: CloudPrep Mobile

**Branch**: `002-cloudprep-mobile` | **Date**: 2026-02-12 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-cloudprep-mobile/spec.md`

## Summary

AWS Cloud Practitioner exam preparation mobile app with offline-first architecture. Mobile app (React Native + Expo) handles exam simulation, practice sessions, review, and analytics with local SQLite storage. Backend API (NestJS + Prisma + PostgreSQL) serves question bank content with multi-tenant ExamType support for multiple certification exams. Admin portal (React SPA) manages questions via approval workflow across all exam types.

## Technical Context

**Language/Version**: TypeScript 5.x (all components)  
**Primary Dependencies**: React Native (Expo SDK 50+), NestJS, Fastify, Prisma ORM, PostgreSQL 15+, expo-sqlite, Zustand, React Navigation  
**Storage**: PostgreSQL (backend question bank with ExamType), SQLite via expo-sqlite (mobile local)  
**Testing**: Jest, React Native Testing Library, Detox (mobile), Supertest (API)  
**Target Platform**: Android 10+ (primary), iOS 15+ (deferred, same codebase)  
**Project Type**: mobile + api (Mobile app + Backend API + Admin Portal)  
**Performance Goals**: App launch <3s, screen transitions <300ms, question render <100ms  
**Constraints**: Offline-capable, <50MB storage for question bank, no user data transmitted to servers  
**Scale/Scope**: 200+ questions per exam type, single-user per device, ~8 screens (home, exam, practice, review, analytics, settings, question list, results)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

Constitution is currently a template (not customized for this project). No specific gates to evaluate. Proceeding with standard best practices:

- Test-first approach for critical paths
- Simple architecture preferred
- Documentation required for all public APIs

## Project Structure

### Documentation (this feature)

```text
specs/002-cloudprep-mobile/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (OpenAPI specs)
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
api/                          # Backend API + Admin Portal (NestJS)
├── prisma/
│   ├── schema.prisma         # Database schema (ExamType, Question, Admin)
│   ├── migrations/           # Database migrations
│   └── seed.ts               # Seed data for exam types and questions
├── src/
│   ├── exam-types/           # ExamTypes module (multi-tenant support)
│   ├── questions/            # Questions module (public API)
│   ├── admin/                # Admin module (auth, CRUD)
│   ├── prisma/               # Prisma service
│   ├── common/               # Shared DTOs, guards, filters
│   ├── app.module.ts         # Root module
│   └── main.ts               # Entry point
├── admin-portal/             # React SPA for admin (served by NestJS)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── package.json
└── test/
    ├── unit/
    └── e2e/

mobile/                       # Mobile app (React Native + Expo)
├── src/
│   ├── screens/              # UI screens
│   ├── components/           # Reusable components
│   ├── services/             # Business logic
│   ├── stores/               # Zustand stores
│   ├── storage/              # SQLite database
│   ├── config/               # App config (EXAM_TYPE)
│   └── navigation/           # React Navigation
└── __tests__/
```

**Structure Decision**: Mobile + API architecture with multi-tenant backend. API serves question bank content filtered by exam type; admin portal manages all exam types in one place; each mobile app has hardcoded EXAM_TYPE config.

## Complexity Tracking

> No constitution violations identified. Standard architecture with clear separation of concerns.
