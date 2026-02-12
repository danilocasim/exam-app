# Feature Specification: CloudPrep Mobile

**Feature Branch**: `002-cloudprep-mobile`  
**Created**: February 12, 2026  
**Status**: Draft  
**Input**: CloudPrep Mobile - AWS Cloud Practitioner exam preparation mobile app

## Overview

CloudPrep Mobile is a paid mobile application designed to help users prepare for the AWS Cloud Practitioner certification exam. The app provides realistic exam simulations, targeted practice sessions, comprehensive review capabilities, and performance analytics—all optimized for mobile learning.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Take Timed Exam Simulation (Priority: P1)

As an exam candidate, I want to take a full-length timed exam that mimics real AWS exam conditions so that I can assess my readiness and experience the pressure of the actual exam.

**Why this priority**: This is the core value proposition—users purchase the app primarily to simulate real exam conditions. Without this, the app provides no differentiated value over free flashcard apps.

**Independent Test**: Can be fully tested by launching an exam, answering 65 questions within the time limit, and receiving a pass/fail result with score breakdown by domain.

**Acceptance Scenarios**:

1. **Given** a user starts a timed exam, **When** the exam begins, **Then** a 90-minute countdown timer starts and 65 questions are presented following AWS domain weighting.
2. **Given** an exam is in progress, **When** the user navigates between questions, **Then** their answers are auto-saved and they can flag questions for review.
3. **Given** the timer expires or user submits early, **When** the exam ends, **Then** a score is calculated and displayed with pass/fail status (passing threshold: 70%).
4. **Given** an exam is interrupted (app closed, phone call), **When** the user returns within 24 hours, **Then** they can resume from where they left off with remaining time preserved.

---

### User Story 2 - Practice by Domain (Priority: P1)

As an exam candidate, I want to practice questions filtered by specific AWS domains so that I can focus on my weak areas and improve targeted knowledge.

**Why this priority**: Domain-focused practice is essential for effective study—users need to address weak areas identified in their exam results. This directly supports learning outcomes.

**Independent Test**: Can be fully tested by selecting a domain (e.g., "Cloud Concepts"), completing a practice session, and seeing immediate feedback on each question.

**Acceptance Scenarios**:

1. **Given** a user selects a domain to practice, **When** the session starts, **Then** only questions from that domain are presented.
2. **Given** a user answers a practice question, **When** they submit their answer, **Then** immediate feedback shows if they were correct and displays the explanation.
3. **Given** a user is in practice mode, **When** they want to stop, **Then** they can end the session at any time and see their session summary.
4. **Given** a user selects difficulty filter, **When** the session starts, **Then** only questions matching both domain and difficulty are presented.

---

### User Story 3 - Review Exam Results (Priority: P2)

As an exam candidate, I want to review my completed exams with explanations so that I can understand my mistakes and learn from them.

**Why this priority**: Review mode transforms a testing tool into a learning tool. Users retain more when they understand why answers are correct or incorrect.

**Independent Test**: Can be fully tested by completing an exam, entering review mode, and viewing explanations for each question with correct/incorrect indicators.

**Acceptance Scenarios**:

1. **Given** a user has completed an exam, **When** they enter review mode, **Then** all questions are displayed with their answers marked correct or incorrect.
2. **Given** a user is reviewing a question, **When** they view the explanation, **Then** the correct answer is highlighted with a detailed explanation of why it is correct.
3. **Given** a user is reviewing results, **When** they filter by "incorrect only", **Then** only questions they answered wrong are displayed.
4. **Given** a user is reviewing, **When** they view domain breakdown, **Then** they see their score per domain with identification of weakest areas.

---

### User Story 4 - Track Performance Over Time (Priority: P2)

As an exam candidate, I want to see my performance history and progress so that I can gauge improvement and identify persistent weak areas.

**Why this priority**: Progress visualization motivates continued study and helps users make informed decisions about when they are ready to take the real exam.

**Independent Test**: Can be fully tested by taking multiple exams/practice sessions and viewing aggregated performance charts showing trends over time.

**Acceptance Scenarios**:

1. **Given** a user has completed multiple exams, **When** they view analytics, **Then** they see a score trend chart showing improvement over time.
2. **Given** a user views domain analytics, **When** data is displayed, **Then** each domain shows average performance with visual indicators (strong/moderate/weak).
3. **Given** a user has practice session history, **When** they view their dashboard, **Then** they see total questions answered, average accuracy, and time spent studying.
4. **Given** a user has weak domains identified, **When** they view recommendations, **Then** suggested practice areas are highlighted based on performance data.

---

### User Story 5 - Manage Questions (Admin) (Priority: P3)

As an admin, I want to create, edit, and manage exam questions so that the question bank stays accurate, current, and high-quality.

**Why this priority**: Content management is essential for long-term app value but does not directly impact the initial user experience. Can be handled via a separate admin interface or web portal.

**Independent Test**: Can be fully tested by logging into admin panel, creating a question with all attributes, submitting for approval, and verifying it appears in the exam pool.

**Acceptance Scenarios**:

1. **Given** an admin accesses the question management system, **When** they create a new question, **Then** they can specify text, type, domain, difficulty, correct answer(s), distractors, and explanation.
2. **Given** a question is created, **When** it is saved, **Then** it is marked as "pending" until explicitly approved.
3. **Given** an approved question exists, **When** an admin edits it, **Then** changes are saved and the question remains in the active pool.
4. **Given** a question needs removal, **When** an admin archives it, **Then** it no longer appears in new exams but historical data is preserved.

---

### Edge Cases

- What happens when a user answers a question but loses network connectivity during exam mode?
  - Answer: Exams run fully offline; answers are stored locally and synced when connectivity resumes.
- How does the system handle a user attempting to resume an exam after 24 hours?
  - Answer: The exam attempt is marked as abandoned and scored based on answers submitted; user can start a new exam.
- What happens if a user completes an exam but there is a sync failure?
  - Answer: Results are stored locally and displayed immediately; background sync retries automatically.
- How does the system handle questions with multiple correct answers when user selects partial answers?
  - Answer: For multiple-choice questions, all correct options must be selected for full credit; partial credit is not awarded.

- What happens when the question bank has fewer than 65 approved questions?
  - Answer: The app notifies admin; exams cannot be generated until minimum question threshold is met per domain.

## Requirements _(mandatory)_

### Functional Requirements

#### Exam Mode

- **FR-001**: System MUST generate timed exams with exactly 65 questions following AWS domain weighting:
  - Cloud Concepts: 24% (15-16 questions)
  - Security and Compliance: 30% (19-20 questions)
  - Technology: 34% (22-23 questions)
  - Billing and Pricing: 12% (7-8 questions)
- **FR-002**: System MUST enforce a 90-minute time limit with visible countdown timer.
- **FR-003**: System MUST auto-save answers as users navigate between questions.
- **FR-004**: System MUST allow users to flag questions for later review within the exam.
- **FR-005**: System MUST support question navigation (next, previous, jump to specific question).
- **FR-006**: System MUST persist exam state to allow resumption within 24 hours if interrupted.
- **FR-007**: System MUST calculate and display score upon exam completion with pass/fail status (70% threshold).

#### Practice Mode

- **FR-008**: System MUST allow filtering questions by domain.
- **FR-009**: System MUST allow filtering questions by difficulty level (easy, medium, hard).
- **FR-010**: System MUST provide immediate feedback after each answer submission.
- **FR-011**: System MUST display explanations for both correct and incorrect answers.
- **FR-012**: System MUST track practice session performance separately from exam scores.

#### Review Mode

- **FR-013**: System MUST store all completed exam attempts for later review.
- **FR-014**: System MUST display each question with user answer, correct answer, and explanation.
- **FR-015**: System MUST allow filtering review by correct/incorrect answers.
- **FR-016**: System MUST show domain-level performance breakdown for each exam.

#### Performance Analytics

- **FR-017**: System MUST track and display overall score trends across all exams.
- **FR-018**: System MUST calculate and display per-domain performance averages.
- **FR-019**: System MUST identify and highlight weak domains (below 70% average).
- **FR-020**: System MUST display total study statistics (questions answered, time spent, exams completed).

#### Question Management

- **FR-021**: System MUST support three question types: single-choice, multiple-choice, and true/false.
- **FR-022**: System MUST require all questions to have: text, type, domain, difficulty, correct answer(s), at least 3 distractors (for choice questions), and explanation.
- **FR-023**: System MUST enforce an approval workflow—only approved questions appear in exams.
- **FR-024**: System MUST allow admins to edit, archive, and restore questions.
- **FR-025**: System MUST validate question quality (minimum character counts, no duplicate questions).

#### Data and Offline Support

- **FR-026**: System MUST function fully offline for exam and practice modes.
- **FR-027**: System MUST check for question bank updates when device is online and download new content.
- **FR-028**: System MUST securely store user answers and progress locally on device only.
- **FR-029**: System MUST download and cache approved question bank for offline access.
- **FR-030**: System MUST NOT transmit user progress, answers, or analytics to remote servers.

#### Performance

- **FR-031**: App MUST launch and display home screen within 3 seconds on supported devices.
- **FR-032**: Screen transitions MUST complete within 300 milliseconds.
- **FR-033**: Question rendering (text, options, images) MUST complete within 100 milliseconds.

### Key Entities

- **User**: Device-local identity representing the app user; owns exam attempts, practice sessions, and analytics data; not synced to cloud.
- **Question**: Individual exam question with text, type, domain, difficulty, answer options, correct answer(s), explanation, and approval status; delivered via cloud API.
- **Exam Attempt**: A user's complete exam session including questions presented, answers given, time spent, score, and completion timestamp; stored locally.
- **Practice Session**: A focused practice activity including domain/difficulty filters, questions answered, and performance metrics; stored locally.
- **Domain**: One of four AWS Cloud Practitioner exam domains used for categorization and analytics.
- **Analytics Record**: Aggregated performance data per user including scores over time, domain breakdowns, and study statistics; stored locally.
- **ExamType**: Backend entity representing a certification exam (e.g., AWS CCP, Solutions Architect); contains exam metadata (name, passing score, time limit, domain weights); questions are associated with an ExamType; mobile apps filter by their exam type.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Users can complete a full 65-question timed exam within the app in under 90 minutes.
- **SC-002**: Users can start a practice session filtered by domain within 3 taps from the home screen.
- **SC-003**: 95% of exams auto-save successfully when interrupted, allowing resumption.
- **SC-004**: Review mode loads completed exam with all explanations within 2 seconds.
- **SC-005**: Performance analytics accurately reflect all completed exams and practice sessions (100% data consistency).
- **SC-006**: Users with 5+ completed exams can identify their weakest domain through analytics.
- **SC-007**: App functions fully offline for exam and practice modes (no network dependency during active use).
- **SC-008**: Question bank updates download within 5 minutes of app detecting new content when device is online.
- **SC-009**: 90% of users can navigate the exam (flag, jump, submit) without external guidance.
- **SC-010**: Admin can create and approve a new question in under 3 minutes.
- **SC-011**: App launches and displays home screen within 3 seconds.
- **SC-012**: All screen transitions complete within 300 milliseconds.

## Clarifications

### Session 2026-02-12

- Q: How should user data and progress be identified and persisted across device changes or reinstalls? → A: Device-only storage; no cross-device sync; data lost on reinstall.
- Q: What backend architecture supports question bank updates while keeping user data local? → A: Simple cloud API serves question bank snapshots; no user data stored remotely; content delivery only.
- Q: What are the performance targets for app responsiveness? → A: App launch under 3 seconds; screen transitions under 300ms; question rendering under 100ms.
- Q: What database technology should power the backend question bank API and admin portal? → A: PostgreSQL with Prisma ORM.
- Q: What is the business model and monetization strategy? → A: One-time purchase on Play Store (₱149–₱299); no subscriptions; single exam per app; content quality is the competitive moat; replicable architecture for future certifications.
- Q: How should the backend support multiple exam types (e.g., AWS CCP, Solutions Architect)? → A: Multi-tenant backend with ExamType entity; one shared REST API serves all exams; one admin portal manages all question banks; each mobile app requests questions filtered by its exam type.
- Q: How should each mobile app identify its exam type when calling the API? → A: Hardcoded exam type ID in app config (e.g., `EXAM_TYPE=aws-ccp`); each app is published separately with its own config.
- Q: How should domain categories be handled across different exam types? → A: Domains defined per ExamType; each exam has its own domain list (names, weights, question quotas) stored in the ExamType entity; mobile app receives domain config during sync.
- Q: What are the minimum character counts for question quality validation (FR-025)? → A: Question text minimum 20 characters; explanation minimum 50 characters; at least 4 answer options for choice questions.
- Q: What happens on first app launch before question bank is cached? → A: App ships with bundled question bank for immediate offline use; background sync fetches updates when online.
- Q: What is the practice session question ordering and limit? → A: Questions presented in random order; sessions are unlimited (user ends manually).
- Q: How is "time spent studying" calculated? → A: Sum of active exam time (start to submit) plus practice session durations; tracked per session.
- Q: What does analytics show when user has zero completed exams? → A: Empty state message encouraging user to take first exam; no charts displayed.
- Q: Is the 24-hour exam resumption window from exam start or last activity? → A: From exam start time (expiresAt = startedAt + 24 hours).
- Q: What are the domain strength thresholds? → A: Strong = 80%+; Moderate = 70-79%; Weak = below 70%.
- Q: What happens if user tries to start new exam while one is in-progress? → A: App prompts to resume existing exam or abandon it; cannot have two concurrent exams.
- Q: How is duplicate question detection implemented? → A: Exact text match (case-insensitive) on question text field; admin is warned before saving.

## Assumptions

- Users have purchased the app through Google Play Store and have a valid license.
- The device has sufficient local storage for the question bank (estimated under 50MB).
- Admin access is handled through a separate web-based admin portal, not within the mobile app.
- Initial question bank is seeded before app launch with at least 200 approved questions.
- AWS Cloud Practitioner exam format (65 questions, 90 minutes, 70% passing) remains stable.
- Users accept offline-first architecture where data syncs opportunistically.
- User progress and exam history are stored locally on device only; reinstalling the app resets all user data.
- Question bank updates are delivered via a lightweight cloud API; the app polls for updates when online.
- No user-identifiable information is transmitted to or stored on remote servers.
- Backend API and admin portal use PostgreSQL as the database with Prisma ORM for data access.
- Backend is multi-tenant: one shared API and admin portal manages questions for all certification exams; each mobile app filters questions by its exam type.
- Future exam apps (e.g., AWS Solutions Architect) will share the same backend infrastructure.

## Out of Scope

- Multiple exam types within a single mobile app (each app is dedicated to one certification)
- Subscription or in-app purchase monetization models
- Social features (leaderboards, sharing, multiplayer)
- User account creation or authentication (app purchase = full access)
- Web or desktop versions of the application
- Integration with external learning management systems
- Flashcard or study note features
- Audio or video content
- Accessibility features (screen readers, high contrast) - future enhancement
- Internationalization/localization - English only for v1
- Adaptive question ordering based on user performance
- Encryption of local SQLite database (device security is sufficient)
