# Exam-App Constitution

## Core Principles

### I. Mobile-First Offline Architecture

Every feature must preserve the app's offline-first capability. Network dependencies are only acceptable during initial setup or explicit sync operations. Local storage (SQLite, AsyncStorage) is the source of truth for all user-facing data.

### II. Test Coverage for User Stories

Every user story with an "Independent Test" section in spec.md MUST have corresponding automated or documented manual test tasks. Integration tests are required for:

- New API endpoints (backend unit + contract tests)
- Native module integrations (manual E2E on physical device)
- User flows crossing mobile-backend boundary

### III. API Contract Documentation

All backend endpoints must be documented in OpenAPI format before implementation. Mobile apps consume these contracts as the single source of truth for request/response schemas.

### IV. Simplicity & Minimal Dependencies

Prefer existing dependencies over adding new ones. New native modules require explicit justification in plan.md with alternatives considered. Backend endpoints should be stateless pass-throughs when possible.

### V. Multi-Tenant by Design

The backend serves multiple exam types (AWS CCP, SAA, etc.) through a single codebase. Any new backend feature must consider multi-tenant architecture — avoid hardcoding exam-specific logic.

## Development Workflow

- Spec → Plan → Tasks → Implement → Test cycle is mandatory
- Constitution compliance checked in plan.md before Phase 0
- Breaking changes to core architecture (offline-first, multi-tenant) require explicit amendment documentation

## Governance

This constitution supersedes ad-hoc decisions. Amendments require:

1. Documentation of rationale in `.specify/memory/amendments/`
2. Update to affected feature specs
3. Version bump below

**Version**: 1.0.0 | **Ratified**: February 15, 2026 | **Last Amended**: February 15, 2026
