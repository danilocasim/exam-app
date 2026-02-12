# Data Model: CloudPrep Mobile

**Feature**: 002-cloudprep-mobile  
**Date**: February 12, 2026  
**Storage**: SQLite (mobile), PostgreSQL (backend)

## Overview

This document defines data models for both:

1. **Mobile Local Storage (SQLite)**: User data, exam attempts, cached questions
2. **Backend Database (PostgreSQL/Prisma)**: Question bank, admin management

---

## Backend Database (PostgreSQL + Prisma)

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND (PostgreSQL)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐                                                       │
│  │    ExamType      │                                                       │
│  ├──────────────────┤                                                       │
│  │ id (PK, TEXT)    │ ◀─────────────────┐                                   │
│  │ name             │                   │                                   │
│  │ displayName      │                   │                                   │
│  │ description      │                   │                                   │
│  │ domains (JSON)   │                   │                                   │
│  │ passingScore     │                   │                                   │
│  │ timeLimit        │                   │                                   │
│  │ questionCount    │                   │                                   │
│  │ isActive         │                   │                                   │
│  │ createdAt        │                   │                                   │
│  │ updatedAt        │                   │                                   │
│  └──────────────────┘                   │                                   │
│                                         │                                   │
│  ┌──────────────────┐       ┌──────────────────┐                           │
│  │     Question     │       │      Admin       │                           │
│  ├──────────────────┤       ├──────────────────┤                           │
│  │ id (PK, UUID)    │       │ id (PK, UUID)    │                           │
│  │ examTypeId (FK)  │───────┤ email            │                           │
│  │ text             │       │ passwordHash     │                           │
│  │ type             │       │ name             │                           │
│  │ domain           │       │ createdAt        │                           │
│  │ difficulty       │       └──────────────────┘                           │
│  │ options (JSON)   │                │                                      │
│  │ correctAnswers   │                │ createdBy/approvedBy                 │
│  │ explanation      │◀───────────────┘                                      │
│  │ status           │                                                       │
│  │ version          │                                                       │
│  │ createdAt        │                                                       │
│  │ updatedAt        │                                                       │
│  │ archivedAt       │                                                       │
│  │ createdById (FK) │                                                       │
│  │ approvedById(FK) │                                                       │
│  │ approvedAt       │                                                       │
│  └──────────────────┘                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Prisma Schema

```prisma
// api/prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum QuestionType {
  SINGLE_CHOICE
  MULTIPLE_CHOICE
  TRUE_FALSE
}

enum Difficulty {
  EASY
  MEDIUM
  HARD
}

enum QuestionStatus {
  DRAFT
  PENDING
  APPROVED
  ARCHIVED
}

// Multi-tenant exam type (e.g., AWS CCP, Solutions Architect)
model ExamType {
  id            String     @id                    // e.g., "aws-ccp", "aws-saa"
  name          String                            // e.g., "AWS Cloud Practitioner"
  displayName   String                            // e.g., "AWS CCP"
  description   String?
  domains       Json                              // [{id, name, weight, questionCount}]
  passingScore  Int        @default(70)           // Percentage (0-100)
  timeLimit     Int        @default(90)           // Minutes
  questionCount Int        @default(65)           // Questions per exam
  isActive      Boolean    @default(true)
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt

  questions     Question[]
  syncVersions  SyncVersion[]
}

model Admin {
  id           String     @id @default(uuid())
  email        String     @unique
  passwordHash String
  name         String
  createdAt    DateTime   @default(now())

  createdQuestions  Question[] @relation("CreatedBy")
  approvedQuestions Question[] @relation("ApprovedBy")
}

model Question {
  id             String         @id @default(uuid())
  examTypeId     String                              // FK to ExamType
  text           String
  type           QuestionType
  domain         String                              // Domain ID from ExamType.domains
  difficulty     Difficulty
  options        Json           // [{id: string, text: string}]
  correctAnswers String[]       // Array of option IDs
  explanation    String
  status         QuestionStatus @default(DRAFT)
  version        Int            @default(1)

  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
  archivedAt     DateTime?
  approvedAt     DateTime?

  examType       ExamType       @relation(fields: [examTypeId], references: [id])
  createdBy      Admin?         @relation("CreatedBy", fields: [createdById], references: [id])
  createdById    String?
  approvedBy     Admin?         @relation("ApprovedBy", fields: [approvedById], references: [id])
  approvedById   String?

  @@index([examTypeId])
  @@index([domain])
  @@index([status])
  @@index([version])
  @@index([examTypeId, status])
}

// Tracks sync version per exam type (multi-tenant)
model SyncVersion {
  id         Int      @id @default(autoincrement())
  examTypeId String   @unique
  version    Int      @default(1)
  updatedAt  DateTime @updatedAt

  examType   ExamType @relation(fields: [examTypeId], references: [id])
}
```

### ExamType.domains JSON Structure

```json
[
  {
    "id": "cloud-concepts",
    "name": "Cloud Concepts",
    "weight": 24,
    "questionCount": 16
  },
  {
    "id": "security",
    "name": "Security and Compliance",
    "weight": 30,
    "questionCount": 20
  },
  {
    "id": "technology",
    "name": "Technology",
    "weight": 34,
    "questionCount": 22
  },
  {
    "id": "billing",
    "name": "Billing and Pricing",
    "weight": 12,
    "questionCount": 7
  }
]
```

### Backend Validation Rules

| Field          | Rule                                       |
| -------------- | ------------------------------------------ |
| text           | Min 20 characters                          |
| explanation    | Min 50 characters                          |
| options        | Min 4 options (for choice types)           |
| correctAnswers | Single-choice: exactly 1; Multiple: 2+     |
| status         | Only APPROVED questions served to mobile   |
| domain         | Must match a domain ID in ExamType.domains |

---

## Mobile Local Storage (SQLite)

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              LOCAL STORAGE (SQLite)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐       ┌──────────────────┐       ┌──────────────────┐    │
│  │   Question   │       │   ExamAttempt    │       │ PracticeSession  │    │
│  ├──────────────┤       ├──────────────────┤       ├──────────────────┤    │
│  │ id (PK)      │       │ id (PK)          │       │ id (PK)          │    │
│  │ text         │       │ startedAt        │       │ startedAt        │    │
│  │ type         │       │ completedAt      │       │ completedAt      │    │
│  │ domain       │       │ status           │       │ domain           │    │
│  │ difficulty   │       │ score            │       │ difficulty       │    │
│  │ options      │       │ passed           │       │ questionsCount   │    │
│  │ correctAnsw  │       │ remainingTime    │       │ correctCount     │    │
│  │ explanation  │───┐   └────────┬─────────┘       └────────┬─────────┘    │
│  │ version      │   │            │                          │              │
│  └──────────────┘   │            │ 1:N                      │ 1:N          │
│                     │            ▼                          ▼              │
│                     │   ┌──────────────────┐       ┌──────────────────┐    │
│                     │   │   ExamAnswer     │       │ PracticeAnswer   │    │
│                     │   ├──────────────────┤       ├──────────────────┤    │
│                     └──▶│ id (PK)          │◀──────│ id (PK)          │    │
│                         │ examAttemptId(FK)│       │ sessionId (FK)   │    │
│                         │ questionId (FK)  │       │ questionId (FK)  │    │
│                         │ selectedAnswers  │       │ selectedAnswers  │    │
│                         │ isCorrect        │       │ isCorrect        │    │
│                         │ isFlagged        │       │ answeredAt       │    │
│                         │ orderIndex       │       └──────────────────┘    │
│                         └──────────────────┘                               │
│                                                                             │
│  ┌──────────────────┐       ┌──────────────────┐                           │
│  │    SyncMeta      │       │   UserStats      │                           │
│  ├──────────────────┤       ├──────────────────┤                           │
│  │ key (PK)         │       │ id (PK)          │                           │
│  │ value            │       │ totalExams       │                           │
│  │ updatedAt        │       │ totalPractice    │                           │
│  └──────────────────┘       │ totalQuestions   │                           │
│                             │ totalTimeSpent   │                           │
│                             │ lastActivityAt   │                           │
│                             └──────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Entities

### Question

Represents an individual exam question. Synced from cloud API.

| Field          | Type    | Constraints            | Description                                           |
| -------------- | ------- | ---------------------- | ----------------------------------------------------- |
| id             | TEXT    | PK                     | UUID from server                                      |
| text           | TEXT    | NOT NULL, MIN 20 chars | Question text                                         |
| type           | TEXT    | NOT NULL, ENUM         | 'single-choice', 'multiple-choice', 'true-false'      |
| domain         | TEXT    | NOT NULL, ENUM         | 'cloud-concepts', 'security', 'technology', 'billing' |
| difficulty     | TEXT    | NOT NULL, ENUM         | 'easy', 'medium', 'hard'                              |
| options        | TEXT    | NOT NULL, JSON         | Array of {id, text} objects                           |
| correctAnswers | TEXT    | NOT NULL, JSON         | Array of option IDs                                   |
| explanation    | TEXT    | NOT NULL, MIN 50 chars | Explanation of correct answer                         |
| version        | INTEGER | NOT NULL               | Sync version number                                   |
| createdAt      | TEXT    | NOT NULL               | ISO timestamp                                         |
| updatedAt      | TEXT    | NOT NULL               | ISO timestamp                                         |

**Indexes**: domain, difficulty, version

**Validation Rules**:

- Single-choice: exactly 1 correct answer
- Multiple-choice: 2+ correct answers
- True-false: exactly 2 options
- All types: minimum 3 distractors (wrong options)

---

### ExamAttempt

Represents a complete timed exam session.

| Field           | Type    | Constraints          | Description                                         |
| --------------- | ------- | -------------------- | --------------------------------------------------- |
| id              | TEXT    | PK                   | UUID generated locally                              |
| startedAt       | TEXT    | NOT NULL             | ISO timestamp when exam started                     |
| completedAt     | TEXT    | NULL                 | ISO timestamp when exam ended (null if in-progress) |
| status          | TEXT    | NOT NULL, ENUM       | 'in-progress', 'completed', 'abandoned'             |
| score           | REAL    | NULL                 | Percentage score (0-100), null if not completed     |
| passed          | INTEGER | NULL                 | 1 = passed, 0 = failed, null if not completed       |
| totalQuestions  | INTEGER | NOT NULL, DEFAULT 65 | Number of questions in exam                         |
| remainingTimeMs | INTEGER | NOT NULL             | Remaining time in milliseconds                      |
| expiresAt       | TEXT    | NOT NULL             | ISO timestamp (startedAt + 24 hours)                |

**Indexes**: status, startedAt

**State Transitions**:

- in-progress → completed (user submits or time expires)
- in-progress → abandoned (expiry time passed)

---

### ExamAnswer

Represents a user's answer to a question within an exam.

| Field           | Type    | Constraints                   | Description                                        |
| --------------- | ------- | ----------------------------- | -------------------------------------------------- |
| id              | TEXT    | PK                            | UUID generated locally                             |
| examAttemptId   | TEXT    | FK → ExamAttempt.id, NOT NULL | Parent exam                                        |
| questionId      | TEXT    | FK → Question.id, NOT NULL    | Question answered                                  |
| selectedAnswers | TEXT    | JSON                          | Array of selected option IDs (empty if unanswered) |
| isCorrect       | INTEGER | NULL                          | 1 = correct, 0 = incorrect, null if unanswered     |
| isFlagged       | INTEGER | NOT NULL, DEFAULT 0           | 1 = flagged for review                             |
| orderIndex      | INTEGER | NOT NULL                      | Position in exam (0-64)                            |
| answeredAt      | TEXT    | NULL                          | ISO timestamp when answered                        |

**Indexes**: examAttemptId, questionId
**Unique**: (examAttemptId, questionId)

---

### PracticeSession

Represents a practice study session.

| Field          | Type    | Constraints         | Description                                  |
| -------------- | ------- | ------------------- | -------------------------------------------- |
| id             | TEXT    | PK                  | UUID generated locally                       |
| startedAt      | TEXT    | NOT NULL            | ISO timestamp                                |
| completedAt    | TEXT    | NULL                | ISO timestamp (null if abandoned)            |
| domain         | TEXT    | NULL                | Filter: domain (null = all domains)          |
| difficulty     | TEXT    | NULL                | Filter: difficulty (null = all difficulties) |
| questionsCount | INTEGER | NOT NULL, DEFAULT 0 | Total questions answered                     |
| correctCount   | INTEGER | NOT NULL, DEFAULT 0 | Correct answers                              |

**Indexes**: startedAt, domain

---

### PracticeAnswer

Represents a user's answer within a practice session.

| Field           | Type    | Constraints                       | Description                  |
| --------------- | ------- | --------------------------------- | ---------------------------- |
| id              | TEXT    | PK                                | UUID generated locally       |
| sessionId       | TEXT    | FK → PracticeSession.id, NOT NULL | Parent session               |
| questionId      | TEXT    | FK → Question.id, NOT NULL        | Question answered            |
| selectedAnswers | TEXT    | JSON                              | Array of selected option IDs |
| isCorrect       | INTEGER | NOT NULL                          | 1 = correct, 0 = incorrect   |
| answeredAt      | TEXT    | NOT NULL                          | ISO timestamp                |

**Indexes**: sessionId, questionId

---

### SyncMeta

Key-value store for sync state.

| Field     | Type | Constraints | Description    |
| --------- | ---- | ----------- | -------------- |
| key       | TEXT | PK          | Metadata key   |
| value     | TEXT | NOT NULL    | Metadata value |
| updatedAt | TEXT | NOT NULL    | ISO timestamp  |

**Reserved Keys**:

- `lastSyncVersion`: Last synced question bank version
- `lastSyncAt`: ISO timestamp of last successful sync
- `bundledVersion`: Version of bundled question bank

---

### UserStats

Aggregated user statistics (single row, updated on activity).

| Field            | Type    | Constraints         | Description              |
| ---------------- | ------- | ------------------- | ------------------------ |
| id               | INTEGER | PK, DEFAULT 1       | Always 1 (single row)    |
| totalExams       | INTEGER | NOT NULL, DEFAULT 0 | Completed exams count    |
| totalPractice    | INTEGER | NOT NULL, DEFAULT 0 | Practice sessions count  |
| totalQuestions   | INTEGER | NOT NULL, DEFAULT 0 | Total questions answered |
| totalTimeSpentMs | INTEGER | NOT NULL, DEFAULT 0 | Total study time in ms   |
| lastActivityAt   | TEXT    | NULL                | Last activity timestamp  |

---

## Domain Enums

### QuestionType

```typescript
type QuestionType = 'single-choice' | 'multiple-choice' | 'true-false';
```

### Domain

```typescript
type Domain = 'cloud-concepts' | 'security' | 'technology' | 'billing';

const DOMAIN_LABELS: Record<Domain, string> = {
  'cloud-concepts': 'Cloud Concepts',
  security: 'Security and Compliance',
  technology: 'Technology',
  billing: 'Billing and Pricing',
};

const DOMAIN_WEIGHTS: Record<Domain, number> = {
  'cloud-concepts': 0.24, // 15-16 questions
  security: 0.3, // 19-20 questions
  technology: 0.34, // 22-23 questions
  billing: 0.12, // 7-8 questions
};
```

### Difficulty

```typescript
type Difficulty = 'easy' | 'medium' | 'hard';
```

### ExamStatus

```typescript
type ExamStatus = 'in-progress' | 'completed' | 'abandoned';
```

## Computed Values

### Exam Score Calculation

```typescript
const calculateScore = (answers: ExamAnswer[]): number => {
  const answered = answers.filter((a) => a.selectedAnswers.length > 0);
  const correct = answered.filter((a) => a.isCorrect).length;
  return (correct / 65) * 100; // Always out of 65 total
};
```

### Domain Performance

```typescript
interface DomainPerformance {
  domain: Domain;
  totalQuestions: number;
  correctAnswers: number;
  percentage: number;
  strength: 'strong' | 'moderate' | 'weak';
}

const getStrength = (pct: number): 'strong' | 'moderate' | 'weak' => {
  if (pct >= 80) return 'strong';
  if (pct >= 70) return 'moderate';
  return 'weak';
};
```

## Migration Strategy

1. **v1 (Initial)**: Create all tables as defined above
2. **Future migrations**: Add version column to schema, apply migrations on app launch

## Data Lifecycle

| Data            | Retention       | Deletion Trigger          |
| --------------- | --------------- | ------------------------- |
| Questions       | Until next sync | Replaced by newer version |
| ExamAttempt     | Forever         | App uninstall only        |
| PracticeSession | Forever         | App uninstall only        |
| SyncMeta        | Forever         | App uninstall only        |
| UserStats       | Forever         | App uninstall only        |

## Offline Behavior

- All entities stored in SQLite; no network required for CRUD
- Questions pre-bundled in app; sync adds/updates only
- ExamAttempt.expiresAt checked on app launch; expired → abandoned
