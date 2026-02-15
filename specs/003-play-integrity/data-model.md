# Data Model: Play Integrity Guard

**Feature**: 003-play-integrity  
**Date**: February 15, 2026  
**Storage**: SQLite (mobile), stateless backend (no database changes)

## Overview

This document defines data models for:

1. **Mobile Local Storage (SQLite)**: IntegrityStatus cache with 30-day TTL
2. **Backend Decryption Service**: Stateless proxy (no persistent models)
3. **API Contracts**: Request/response schemas for integrity verification

---

## Mobile Local Storage (SQLite)

### IntegrityStatus Table

Stores cached result of Play Integrity verification on device.

```sql
CREATE TABLE IF NOT EXISTS IntegrityStatus (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  integrity_verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TEXT NOT NULL, -- ISO 8601 timestamp
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Rationale**:
- Single row per device (singleton pattern) simplifies queries: `SELECT * FROM IntegrityStatus LIMIT 1`
- `integrity_verified`: True if all Play Integrity verdicts passed (PLAY_RECOGNIZED, LICENSED, MEETS_DEVICE_INTEGRITY)
- `verified_at`: Timestamp of last successful verification; used to check 30-day TTL expiry
- Automatic cleanup on app uninstall (Android default behavior for app-private storage)

**Constraints**:
- Single row design: ID is always 'singleton'; no multi-row queries needed
- No foreign key relationships (isolated verification data)
- Timestamps in UTC ISO 8601 format for consistency with backend

**Lifecycle**:
- **Created**: On first successful verification
- **Updated**: On re-verification (every 30 days max)
- **Deleted**: Automatic on app uninstall (OS clears app-private storage)
- **Cleared**: Manually via app reset or diagnosis tools (outside scope)

---

## Mobile TypeScript Types for Integrity

```typescript
// Mobile app types (src/services/play-integrity.service.ts)

export interface IntegrityStatusRecord {
  id: string; // 'singleton'
  integrity_verified: boolean;
  verified_at: string; // ISO 8601 timestamp
  created_at: string;
  updated_at: string;
}

export interface PlayIntegrityVerdict {
  // Response from Google Play Integrity API (encrypted)
  // Decrypted server-side, used by client to determine pass/fail
  appRecognitionVerdict: 'PLAY_RECOGNIZED' | 'UNRECOGNIZED_VERSION' | 'UNKNOWN';
  appLicensingVerdict: 'LICENSED' | 'UNLICENSED' | 'UNKNOWN';
  deviceRecognitionVerdict: 'MEETS_DEVICE_INTEGRITY' | 'MEETS_STRONG_INTEGRITY' | 'UNKNOWN';
  [key: string]: any; // Other fields from Google (not used for verification)
}

export interface IntegrityCheckResult {
  verified: boolean; // true if all verdicts PASS
  verdict?: PlayIntegrityVerdict; // Full verdict from server (for debugging)
  error?: {
    type: 'TRANSIENT' | 'DEFINITIVE' | 'NETWORK'; // Error category
    message: string; // User-facing message
    code?: string; // Google API error code
  };
  cachedResult?: boolean; // true if result was from local storage
}

export interface PlayIntegrityTokenRequest {
  // Sent from mobile client to backend
  token: string; // Encrypted token from Google Play Integrity API
}

export interface IntegrityVerifyResponse {
  // Received from backend after decryption
  success: boolean;
  verdict?: PlayIntegrityVerdict;
  error?: string;
}
```

---

## Backend API Contract (Stateless)

### Endpoint: POST /api/integrity/verify

**Purpose**: Decrypt Play Integrity token using Google's verification API. No user state stored.

**Request**:
```json
{
  "token": "string (encrypted JWT from Google Play Integrity API)"
}
```

**Success Response (200)**:
```json
{
  "success": true,
  "verdict": {
    "appRecognitionVerdict": "PLAY_RECOGNIZED",
    "appLicensingVerdict": "LICENSED",
    "deviceRecognitionVerdict": "MEETS_DEVICE_INTEGRITY"
  }
}
```

**Error Response (400/500)**:
```json
{
  "success": false,
  "error": "string (e.g., 'Token verification failed', 'Google API unavailable')"
}
```

**Implementation Notes**:
- Endpoint is **stateless**: No database writes, no user lookup, no session creation
- No authentication required (token is encrypted; only possessor of signing key can decrypt)
- Timeout: 10 seconds (includes Google API call)
- Retry logic: Handled by mobile client (backend treats each call independently)
- Errors: 5xx returned for transient failures (timeout, Google API 5xx); 400 for invalid token

**No Prisma/Database Changes**: Verdicts not persisted on backend. Enforcement is client-side only.

---

## Verification Decision Tree

### First Launch (No IntegrityStatus Record)

```
App Start
  ├─ If __DEV__ == true
  │  └─ Skip verification → Grant Access
  │
  └─ If __DEV__ == false (Release Build)
     └─ Request Play Integrity token from Google
        ├─ Success: Token obtained
        │  └─ Send token to POST /api/integrity/verify
        │     ├─ Success: Verdict received
        │     │  ├─ All verdicts PASS (PLAY_RECOGNIZED, LICENSED, MEETS_DEVICE_INTEGRITY)
        │     │  │  └─ Store: IntegrityStatus { verified: true, verified_at: now }
        │     │  │     └─ Grant Access → Show App
        │     │  │
        │     │  └─ Any verdict FAIL (e.g., UNLICENSED)
        │     │     └─ Verdict Type:
        │     │        ├─ DEFINITIVE (UNLICENSED, UNRECOGNIZED_VERSION)
        │     │        │  └─ Show Blocking Screen (No Retry) → Block Access
        │     │        │
        │     │        └─ TRANSIENT (UNKNOWN/UNEVALUATED)
        │     │           └─ Show Retry Screen → User can retry or (if no cache) show error
        │     └─ Error (5xx, timeout)
        │        └─ TRANSIENT Error (treat like UNEVALUATED)
        │           └─ Show Retry: "Unable to verify, please check internet"
        │
        └─ Error: No network on first launch
           └─ NETWORK Error
              └─ Show Retry: "Please connect to internet for first-time setup"
```

### Subsequent Launches (IntegrityStatus Exists)

```
App Start
  ├─ If __DEV__ == true
  │  └─ Skip verification → Grant Access
  │
  └─ If __DEV__ == false (Release Build)
     └─ Query: SELECT * FROM IntegrityStatus LIMIT 1
        ├─ Record found
        │  ├─ If verified_at >= 30 days old
        │  │  └─ Re-verify (same flow as First Launch)
        │  │
        │  └─ If verified_at < 30 days old
        │     └─ Use cached result: verified = true
        │        └─ Grant Access → Show App
        │
        └─ Record NOT found (shouldn't happen if first launch worked)
           └─ Treat as First Launch: Request verification
```

---

## Relationship to Existing Models

**No Breaking Changes**:

- `ExamType`: Unchanged. Play Integrity is per-device, not per-exam-type.
- `Question`: Unchanged. Verification happens before question access.
- `ExamAttempt`: Unchanged. Verified users can create attempts normally.
- `User` (Phase 2): Unchanged. No integrity verdicts stored in user profile.
- `Admin`: Unchanged. Admin portal unaffected by mobile integrity.

**Architecture Preserved**:

- **Multi-tenant backend**: Still serves all exam types; no exam-type-specific integrity logic.
- **Offline-first mobile**: Integrity check is one-time broadcast permission; doesn't affect question caching or exam simulation.
- **Content-only sync**: User exam data still not synced; only verification permission granted.

---

## Error States & User Messages

| Error Type | Verdict | User Message | Retry Option |
|-----------|---------|--------------|--------------|
| **Definitive Fail** | UNLICENSED | "For security reasons, this app must be downloaded from Google Play." | ❌ No—only option: uninstall & reinstall from Play Store |
| **Definitive Fail** | UNRECOGNIZED_VERSION | "For security reasons, this app must be downloaded from Google Play." | ❌ No—app signature mismatch |
| **Definitive Fail** | Device Integrity Fail | "For security reasons, this app must be downloaded from Google Play." | ❌ No—device integrity issue |
| **Transient Fail** | UNEVALUATED | "Unable to verify your installation. Please check your internet connection and try again." | ✅ Yes—retry button available |
| **Transient Fail** | API Timeout / 5xx | "Unable to verify your installation. Please check your internet connection and try again." | ✅ Yes—retry button available |
| **Network Error** | No Internet | "Please connect to the internet for first-time setup. A one-time connection is required." | ✅ Yes—retry button available (if cache exists, user can proceed) |

---

## Data Integrity & Consistency

**Offline Consistency**:
- Verification result cached locally; survives offline state indefinitely until 30-day TTL expires
- No sync needed for verification; it's device-specific

**Reinstall Reset**:
- Android automatically clears app-private SQLite storage on uninstall
- IntegrityStatus table cleared → next install requires fresh verification
- No user action required; OS handles cleanup

**Multi-Install Prevention** (Rooted Devices):
- Play Integrity API includes device integrity check (MEETS_DEVICE_INTEGRITY)
- Rooted devices likely fail this check (app has lower confidence)
- Sideload + root combination caught by Play Integrity's device evaluation
- Accepted risk per spec assumptions

**No Backend State**:
- Verdicts never stored server-side
- Backend endpoint stateless; no race conditions or consistency issues
- User could theoretically reinstall, get new verdict, no server-side tracking
- Acceptable because app is single-user per device; no multi-device sync

---

## Database Diagram

### Mobile SQLite (Device-Private)

```
┌────────────────────┐
│  IntegrityStatus   │
├────────────────────┤
│ id: 'singleton'    │ ← Always one row
│ verified: bool     │ ← Verification passed
│ verified_at: ISO   │ ← For 30-day TTL check
│ created_at: ISO    │
│ updated_at: ISO    │
└────────────────────┘
        ▲
        │ (One-to-one with device storage)
        │ No FK relationships
        │ Cleared on uninstall
        │
    ┌───┴──────────────────────────────────────┐
    │     Question (existing)                   │
    │     ExamAttempt (existing)                │
    │     PracticeSession (existing)            │
    │ Unaffected by Play Integrity             │
    └───────────────────────────────────────────┘
```

### Backend PostgreSQL (via Prisma)

```
┌──────────────────────┐
│   [NO NEW CHANGES]   │
├──────────────────────┤
│  ExamType            │ Unchanged
│  Question            │ Unchanged
│  Admin               │ Unchanged
│  User (Phase 2)      │ Unchanged
│  ExamAttempt        │ Unchanged
│  PracticeSession    │ Unchanged
└──────────────────────┘
        ▲
        │ Integrity verification is client-side enforcement only
        │ No backend database writes
        │ Backend endpoint: Stateless decrypt → return verdict → done
```

---

## Summary: Zero Backend Schema Changes

**Key Decision**: Play Integrity verdicts are **not persisted** on the backend.

- **Why**: Verdicts are device-specific, transient, and client-side enforced.
- **Result**: No changes to `prisma/schema.prisma`. No migrations needed.
- **Backend Role**: Stateless token decryption only. No user lookup, no verdict storage, no enforcement.
- **Mobile Role**: Client fetches verdict, verifies locally, stores cache in SQLite, blocks/allows access.

This keeps integrity logic isolated from the multi-tenant exam management system and preserves offline-first architecture.

---

## Production Database Configuration (AWS Aurora)

### Environment-Based Connection

The backend API uses environment variables for database connection configuration:

```typescript
// api/prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// DATABASE_URL format (loaded from AWS Secrets Manager):
// postgresql://username:password@aurora-cluster-endpoint:5432/exam_app_prod?schema=public
```

### AWS Secrets Manager Structure

**Secret Name**: `exam-app/prod/database`

```json
{
  "host": "exam-app-aurora-cluster.cluster-xyz123.us-east-1.rds.amazonaws.com",
  "port": "5432",
  "username": "exam_app_admin",
  "password": "randomly-generated-password",
  "database": "exam_app_prod"
}
```

### AWS Systems Manager Parameter Store (Non-Sensitive Configuration)

- `/exam-app/prod/jwt-secret`: JWT signing secret for authentication tokens
- `/exam-app/prod/google-client-id`: Google OAuth client ID
- `/exam-app/prod/google-client-secret`: Google OAuth client secret
- `/exam-app/prod/play-integrity-credentials`: Google Play Integrity API credentials (JSON)

### Database Initialization for Production

1. **Migration Deployment**: `npx prisma migrate deploy` (applies all pending migrations)
2. **Seed Data**: `npx prisma db seed` (populates initial exam types and questions)
3. **Connection Validation**: Health check queries `SELECT 1` to verify connectivity

### Aurora Serverless v2 Configuration

- **Min Capacity**: 0.5 ACU (Aurora Capacity Units)
- **Max Capacity**: 2 ACU
- **Scaling**: Automatic based on database load
- **VPC**: Private subnets only (no public internet access)
- **Access**: App Runner VPC Connector provides secure connection
- **Backups**: Automated backups with 1-day retention (configurable)
