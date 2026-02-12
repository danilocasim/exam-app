# Quickstart: CloudPrep Mobile

**Feature**: 002-cloudprep-mobile  
**Date**: February 12, 2026

## Prerequisites

- Node.js 18+ and npm 9+
- Android Studio with SDK 24+ (Android 7.0+)
- Expo CLI: `npm install -g expo-cli`
- Android emulator or physical device

## Project Setup

### 1. Initialize Mobile App

```bash
# Create Expo project with TypeScript template
npx create-expo-app@latest mobile --template expo-template-blank-typescript

cd mobile

# Install core dependencies
npx expo install expo-sqlite expo-crypto react-native-async-storage
npm install @react-navigation/native @react-navigation/native-stack
npm install zustand axios
npm install nativewind tailwindcss

# Install dev dependencies
npm install -D @types/react jest @testing-library/react-native
npm install -D detox jest-circus
```

### 2. Initialize API Server (NestJS + Prisma)

```bash
cd ../
npx @nestjs/cli new api --package-manager npm --strict
cd api

# Install Prisma and database dependencies
npm install @prisma/client
npm install -D prisma

# Install additional NestJS modules
npm install @nestjs/config class-validator class-transformer
npm install @nestjs/jwt @nestjs/passport passport passport-jwt
npm install bcrypt
npm install -D @types/bcrypt @types/passport-jwt

# Initialize Prisma with PostgreSQL
npx prisma init

# Install testing utilities
npm install -D @nestjs/testing supertest @types/supertest
```

### 3. Configure Prisma Schema

Edit `api/prisma/schema.prisma`:

```prisma
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
  passingScore  Int        @default(70)
  timeLimit     Int        @default(90)
  questionCount Int        @default(65)
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
  examTypeId     String
  text           String
  type           QuestionType
  domain         String                           // Domain ID from ExamType.domains
  difficulty     Difficulty
  options        Json
  correctAnswers String[]
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

model SyncVersion {
  id         Int      @id @default(autoincrement())
  examTypeId String   @unique
  version    Int      @default(1)
  updatedAt  DateTime @updatedAt

  examType   ExamType @relation(fields: [examTypeId], references: [id])
}
```

### 4. Setup Database

```bash
# Create .env file (update with your PostgreSQL credentials)
echo 'DATABASE_URL="postgresql://user:password@localhost:5432/cloudprep?schema=public"' >> .env

# Run migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate

# Seed initial data (optional)
npx prisma db seed
```

Create `api/prisma/seed.ts` for initial exam type:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Seed AWS Cloud Practitioner exam type
  const awsCcp = await prisma.examType.upsert({
    where: { id: 'aws-ccp' },
    update: {},
    create: {
      id: 'aws-ccp',
      name: 'AWS Certified Cloud Practitioner',
      displayName: 'AWS CCP',
      description: 'Entry-level AWS certification covering cloud fundamentals',
      passingScore: 70,
      timeLimit: 90,
      questionCount: 65,
      domains: [
        {
          id: 'cloud-concepts',
          name: 'Cloud Concepts',
          weight: 24,
          questionCount: 16,
        },
        {
          id: 'security',
          name: 'Security and Compliance',
          weight: 30,
          questionCount: 20,
        },
        { id: 'technology', name: 'Technology', weight: 34, questionCount: 22 },
        {
          id: 'billing',
          name: 'Billing and Pricing',
          weight: 12,
          questionCount: 7,
        },
      ],
    },
  });

  // Create initial sync version
  await prisma.syncVersion.upsert({
    where: { examTypeId: 'aws-ccp' },
    update: {},
    create: { examTypeId: 'aws-ccp', version: 1 },
  });

  console.log('Seeded exam type:', awsCcp.id);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 5. Configure NativeWind (Mobile Styling)

```bash
cd ../mobile

# Create tailwind.config.js
npx tailwindcss init
```

Edit `tailwind.config.js`:

```javascript
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
};
```

### 6. Create Directory Structure

```bash
# Mobile app structure
cd ../mobile

mkdir -p src/{components,screens,services,stores,models,utils,navigation,config}
mkdir -p src/components/{questions,navigation,analytics}
mkdir -p src/services/{exam,practice,storage,sync}
mkdir -p __tests__/{unit,integration}
```

### 7. Configure Mobile App for Exam Type

Create `mobile/src/config/appConfig.ts`:

```typescript
// Each mobile app is configured for a specific exam type
// This is hardcoded per app build (e.g., aws-ccp, aws-saa)
export const APP_CONFIG = {
  EXAM_TYPE_ID: 'aws-ccp', // Change this for different apps
  API_BASE_URL: __DEV__
    ? 'http://localhost:3000/v1'
    : 'https://api.cloudprep.app/v1',
} as const;
```

## Database Schema

Create `src/services/storage/schema.ts`:

```typescript
export const SCHEMA_VERSION = 1;

export const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    text TEXT NOT NULL,
    type TEXT NOT NULL,
    domain TEXT NOT NULL,
    difficulty TEXT NOT NULL,
    options TEXT NOT NULL,
    correctAnswers TEXT NOT NULL,
    explanation TEXT NOT NULL,
    version INTEGER NOT NULL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exam_attempts (
    id TEXT PRIMARY KEY,
    startedAt TEXT NOT NULL,
    completedAt TEXT,
    status TEXT NOT NULL DEFAULT 'in-progress',
    score REAL,
    passed INTEGER,
    totalQuestions INTEGER NOT NULL DEFAULT 65,
    remainingTimeMs INTEGER NOT NULL,
    expiresAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS exam_answers (
    id TEXT PRIMARY KEY,
    examAttemptId TEXT NOT NULL,
    questionId TEXT NOT NULL,
    selectedAnswers TEXT NOT NULL DEFAULT '[]',
    isCorrect INTEGER,
    isFlagged INTEGER NOT NULL DEFAULT 0,
    orderIndex INTEGER NOT NULL,
    answeredAt TEXT,
    FOREIGN KEY (examAttemptId) REFERENCES exam_attempts(id),
    FOREIGN KEY (questionId) REFERENCES questions(id),
    UNIQUE (examAttemptId, questionId)
  );

  CREATE TABLE IF NOT EXISTS practice_sessions (
    id TEXT PRIMARY KEY,
    startedAt TEXT NOT NULL,
    completedAt TEXT,
    domain TEXT,
    difficulty TEXT,
    questionsCount INTEGER NOT NULL DEFAULT 0,
    correctCount INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS practice_answers (
    id TEXT PRIMARY KEY,
    sessionId TEXT NOT NULL,
    questionId TEXT NOT NULL,
    selectedAnswers TEXT NOT NULL,
    isCorrect INTEGER NOT NULL,
    answeredAt TEXT NOT NULL,
    FOREIGN KEY (sessionId) REFERENCES practice_sessions(id),
    FOREIGN KEY (questionId) REFERENCES questions(id)
  );

  CREATE TABLE IF NOT EXISTS sync_meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS user_stats (
    id INTEGER PRIMARY KEY DEFAULT 1,
    totalExams INTEGER NOT NULL DEFAULT 0,
    totalPractice INTEGER NOT NULL DEFAULT 0,
    totalQuestions INTEGER NOT NULL DEFAULT 0,
    totalTimeSpentMs INTEGER NOT NULL DEFAULT 0,
    lastActivityAt TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_questions_domain ON questions(domain);
  CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
  CREATE INDEX IF NOT EXISTS idx_questions_version ON questions(version);
  CREATE INDEX IF NOT EXISTS idx_exam_attempts_status ON exam_attempts(status);
  CREATE INDEX IF NOT EXISTS idx_exam_answers_attempt ON exam_answers(examAttemptId);
  CREATE INDEX IF NOT EXISTS idx_practice_answers_session ON practice_answers(sessionId);
`;
```

## Key Type Definitions

Create `src/models/types.ts`:

```typescript
export type QuestionType = 'single-choice' | 'multiple-choice' | 'true-false';
export type Domain = 'cloud-concepts' | 'security' | 'technology' | 'billing';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type ExamStatus = 'in-progress' | 'completed' | 'abandoned';

export interface Question {
  id: string;
  text: string;
  type: QuestionType;
  domain: Domain;
  difficulty: Difficulty;
  options: { id: string; text: string }[];
  correctAnswers: string[];
  explanation: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExamAttempt {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: ExamStatus;
  score: number | null;
  passed: boolean | null;
  totalQuestions: number;
  remainingTimeMs: number;
  expiresAt: string;
}

export interface ExamAnswer {
  id: string;
  examAttemptId: string;
  questionId: string;
  selectedAnswers: string[];
  isCorrect: boolean | null;
  isFlagged: boolean;
  orderIndex: number;
  answeredAt: string | null;
}

export const DOMAIN_LABELS: Record<Domain, string> = {
  'cloud-concepts': 'Cloud Concepts',
  security: 'Security and Compliance',
  technology: 'Technology',
  billing: 'Billing and Pricing',
};

export const EXAM_CONFIG = {
  totalQuestions: 65,
  durationMs: 90 * 60 * 1000, // 90 minutes
  passingScore: 70,
  expiryHours: 24,
  domainQuotas: {
    'cloud-concepts': 16,
    security: 20,
    technology: 22,
    billing: 7,
  },
} as const;
```

## Running the App

### Development

```bash
# Terminal 1: Start PostgreSQL (if using Docker)
docker run --name cloudprep-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=cloudprep -p 5432:5432 -d postgres:15

# Terminal 2: Start the API server
cd api
npm run start:dev

# Terminal 3: Start the mobile app
cd mobile
npx expo start
```

### Android Build

```bash
cd mobile
npx expo run:android
```

### Testing

```bash
# API tests
cd api
npm test

# Mobile unit tests
cd mobile
npm test

# Mobile E2E tests (requires running emulator)
npm run test:e2e
```

## Environment Configuration

Create `mobile/.env`:

```
API_URL=http://localhost:3000/v1
```

Create `mobile/.env.production`:

```
API_URL=https://api.cloudprep.app/v1
```

Create `api/.env`:

```
DATABASE_URL="postgresql://postgres:password@localhost:5432/cloudprep?schema=public"
JWT_SECRET="your-secret-key-change-in-production"
```

## Next Steps

1. Implement Prisma service in NestJS (`api/src/prisma/prisma.service.ts`)
2. Create questions module (`api/src/questions/`) with CRUD operations
3. Build admin module with authentication (`api/src/admin/`)
4. Implement mobile database service (`mobile/src/services/storage/database.ts`)
5. Create exam generation service (`mobile/src/services/exam/generator.ts`)
6. Build core screens (Home, Exam, Practice, Review, Analytics)
7. Add question bank sync service
8. Write tests for scoring and exam generation logic
