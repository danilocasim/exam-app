# Research: Play Integrity Guard

**Feature**: 003-play-integrity  
**Date**: February 15, 2026  
**Status**: Complete

## Research Tasks

### 1. Play Integrity API Integration Library

**Context**: App must verify installation via Google's Play Integrity API without adding native module complexity to Expo managed workflow.

**Decision**: Use `@react-native-google-signin/google-signin` (existing integration from Phase 2) with Play Integrity verify endpoint, OR use custom native module bridge if library unavailable; defer to `expo-play-integrity` if available.

**Rationale**:

- `@react-native-google-signin/google-signin`: Already integrated in Phase 2 (Google Sign-In). Can extend to request Play Integrity token via same Google API surface.
- Expo managed workflow maintained; no additional native module setup beyond existing.
- Token generation happens on client; decryption happens server-side (stateless).
- Avoids adding React Native Firebase or Google Play Services wrapper—we only need token request and verification.

**Alternatives Considered**:

- `react-native-device-integrity`: Too broad; includes root detection beyond Play Integrity.
- Manual JNI bridge: Overkill complexity; Play Integrity available via existing Google libraries.
- WatermelonDB integrity module: Doesn't exist; would require custom native code.

### 2. Local Integrity Status Storage

**Context**: App must cache verification result locally with 30-day TTL, survive app restarts, and clear on uninstall (Android default behavior).

**Decision**: Store `IntegrityStatus` table in existing SQLite database (expo-sqlite) using same Drizzle/raw SQL patterns as questions cache.

**Rationale**:

- SQLite already integrated for questions, exam attempts, practice sessions (Phase 2).
- Structured persistence for `integrity_verified` (boolean) and `verified_at` (ISO timestamp).
- Automatic cleanup on uninstall (Android sandboxed storage behavior).
- Matches existing mobile storage architecture; no AsyncStorage dependency needed.
- Query: `SELECT * FROM IntegrityStatus LIMIT 1` on app init to decide verification path.

**Alternatives Considered**:

- AsyncStorage: No TTL support; would require manual expiry logic.
- Device.native storage: Overkill; SQLite sufficient and already integrated.
- App state persistence: Lost on process kill; unreliable for first-launch verification.

### 3. Verification Flow Architecture

**Context**: Integrity check must run concurrent with Database/Questions init without blocking UI initialization screen or adding noticeable delay.

**Decision**: Parallel initialization tasks in App.tsx: database setup and integrity check run concurrently; app render waits for both to complete before showing RootNavigator.

**Rationale**:

- Current App.tsx: `initializeDatabase()` blocks until questions table exists and sync completes.
- Add: `checkIntegrity()` as sibling Promise in `Promise.all()` to run in parallel.
- IntegrityCheck logic: If `verified` flag exists and `verified_at` < 30 days → skip API call. If missing or stale → request token → server verify → store result.
- If verification fails decisively → set `integrityBlocked = true` → render `<IntegrityBlockedScreen />` instead of `<RootNavigator />`.
- **No added latency** if cache hit. **+1–2 sec max** on first launch (API timeout/retry included).

**Alternatives Considered**:

- Background verification: Would require permission check and background task framework; complicates error recovery.
- Splash screen modal: Could work but less clean UX; user sees app briefly then blocked.
- Deferred verification: Defeats purpose; allows pirated users to use app before verify failure.

### 4. Error Handling & Retry Strategy

**Context**: Network failures, transient API errors, and device edge cases must be recoverable without permanent blocking.

**Decision**: Distinguish transient (retry-able) vs. definitive (block) failures. Transient: UNEVALUATED verdict, timeout, network timeout, 5xx. Definitive: UNLICENSED, UNRECOGNIZED_VERSION, device integrity fail.

**Rationale**:

- Transient failures: Let user proceed with cached result if available; show "Retry" button if cache expired.
- Definitive failures: Block app permanently; no retry option; only workaround is fresh install from Play Store.
- Matches Play Integrity API verdict semantics: UNLICENSED is intentional (user didn't buy); UNEVALUATED is temporary.
- Exception: First launch, no cache, transient failure → show retry button; user can recover by connecting to internet.

**Alternatives Considered**:

- Retry all failures: Risks giving pirated users access if API recovers.
- No distinction: Either blocks everything (UX harm) or allows everything (security harm).

### 5. Development Mode Bypass Mechanism

**Context**: Developers must bypass integrity check locally (Expo, debug builds) without custom build variants or environment configs.

**Decision**: Check `__DEV__` global at entry point (App.tsx). If true, set `integrityBlocked = false` and skip all API calls. Log message to console.

**Rationale**:

- `__DEV__` is reliable React Native global; true in Expo development, false in release builds.
- No additional config needed; automatically handled by Metro bundler.
- Release builds from Google Play have `__DEV__ = false` due to production bundle optimization.
- matches existing patterns in codebase (auth-service.ts, token-refresh-service.ts use `__DEV__` checks).

**Alternatives Considered**:

- Environment variable: Requires .env setup per developer; fragile.
- Magic server check: Adds offline dependency; complicates cold-start.
- Build variant: Requires separate dev/prod Gradle configurations; breaks Expo managed workflow.

### 6. Backend Integrity Verification Endpoint

**Context**: Mobile client requests Play Integrity token decryption via backend stateless proxy. Backend must NOT block API access based on verdict—only decrypt.

**Decision**: Create `POST /api/integrity/verify` endpoint that accepts Play Integrity token (encrypted), calls Google's `PlayIntegrity.decrypt()`, returns decrypted verdict. Client enforces blocking.

**Rationale**:

- Play Integrity tokens are encrypted; only Google's API and your app's signing key can decrypt.
- Backend acts as stateless proxy; no database writes, no user state changes.
- Client remains authoritative on whether to block. Backend simply decrypts.
- Keeps security logic on the client where it can be tested and reset on reinstall.
- Matches No-enforcement assumption from spec.

**Alternatives Considered**:

- Backend enforcement: Complicates user management; requires storing integrity verdicts in User table.
- Direct client-to-Google: Requires embedding API key on device; vulnerable to extraction.
- No backend endpoint at all: Token encrypted; client cannot decrypt without server.

## Summary: Technology Stack for 003

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Mobile Library** | @react-native-google-signin/google-signin extension (or expo-play-integrity) | Already integrated; extends existing Google auth surface |
| **Mobile Storage** | SQLite (expo-sqlite) | Existing pattern; structured persistence with TTL support |
| **Mobile Init** | Parallel Promise.all() in App.tsx | Non-blocking; leverages existing architecture |
| **Mobile UI** | New IntegrityBlockedScreen component | Simple blocking-only UI; no navigation access |
| **Backend Endpoint** | NestJS POST /api/integrity/verify | Stateless proxy; minimal code; no business logic |
| **Verdict Handling** | Client-side enforcement | Security on device; survives reinstall via cache clear |
| **Error Recovery** | Transient vs. definitive distinction | User-friendly retry UX without security compromise |
| **Testing** | Jest (mobile), Supertest (API), Detox (E2E) | Existing test suite; new tests follow same patterns |

---

## Open Questions Resolved

1. **Q: Will integrity check add noticeable launch delay?**  
   A: No. With cached verification (common case), check is <10ms SQLite query. First launch: +1–2sec for API call, which overlaps database initialization, resulting in minimal user-perceived latency.

2. **Q: What about devices without Google Play Services?**  
   A: Integrity check will fail (as expected per spec). Blocking screen shown. These devices cannot install from Play Store anyway, so this is acceptable.

3. **Q: Can user bypass by copying app data?**  
   A: Android sandboxes app-private storage; cannot be copied without root access. For rooted devices, Play Integrity device integrity check will catch most. Accepted risk per spec assumptions.

4. **Q: Where is API key stored for backend verification?**  
   A: Google Play Console service account credential stored in backend environment. Spec assumes this is already configured; 003 does not add credential storage guidance (Out of Scope).

5. **Q: Do we need to modify Prisma schema for Play Integrity?**  
   A: No. Play Integrity data is device-specific, not shared/synced. Stored in mobile local SQLite only. Backend does not persist verdicts. No Prisma changes needed.

---

## AWS Production Deployment Research

### 4. Database: AWS Aurora PostgreSQL Serverless v2

**Context**: Production backend requires a managed PostgreSQL database that can scale automatically, doesn't require constant provisioning, and aligns with existing Prisma ORM setup.

**Decision**: Use AWS Aurora PostgreSQL Serverless v2 with 0.5-2 ACU capacity range.

**Rationale**:

- **Compatibility**: Aurora PostgreSQL is fully compatible with Prisma ORM (uses standard PostgreSQL wire protocol).
- **Serverless v2 Scaling**: Automatic scaling from 0.5 ACU (minimal cost during low traffic) to 2 ACU (handles moderate load). Scales in seconds, not minutes.
- **Cost-Effective**: Pay only for capacity used; no need to provision large instances for a small-scale production deployment.
- **High Availability**: Aurora automatically replicates data across multiple AZs without additional configuration.
- **Backups**: Automated backups with point-in-time recovery (1-day retention minimum).
- **Security**: VPC-only deployment (private subnets); no public internet access; accessed via App Runner VPC Connector.

**Alternatives Considered**:

- **RDS PostgreSQL (Standard Instance)**: Requires constant provisioning; more expensive for sporadic traffic; less auto-scaling flexibility.
- **RDS Proxy**: Adds complexity and cost; Aurora Serverless v2 already handles connection pooling internally.
- **External PostgreSQL (Heroku, Supabase)**: Vendor lock-in; less control over networking and security; doesn't integrate as seamlessly with AWS App Runner.

---

### 5. Backend Hosting: AWS App Runner

**Context**: Production backend API needs a managed container platform that deploys from GitHub, auto-scales, and doesn't require manual server management.

**Decision**: Use AWS App Runner with automatic deployments from GitHub `003-play-integrity` branch.

**Rationale**:

- **Simplicity**: No Kubernetes, ECS, or EC2 management; App Runner handles container orchestration, load balancing, and scaling automatically.
- **GitHub Integration**: Automatic deployments on push; no CI/CD pipeline setup needed (GitHub Actions optional for testing, not required for deployment).
- **Auto-Scaling**: Scales from min 1 instance to max 10 instances based on CPU/memory utilization; handles traffic spikes without manual intervention.
- **VPC Integration**: VPC Connector allows secure access to Aurora in private subnets without exposing database to public internet.
- **Cost**: Pay per vCPU-second and memory-GiB-second; affordable for small-scale production workloads (1 vCPU, 2 GB instance configuration).
- **Health Checks**: Built-in health check support (HTTP GET `/health`); automatic rollback on failed deployments.
- **Zero Downtime**: Rolling deployments with instant rollback capability.

**Alternatives Considered**:

- **AWS Elastic Beanstalk**: More complex configuration; requires managing environment tiers; slower deployments.
- **AWS ECS Fargate**: Requires VPC, ALB, ECS cluster setup; more control but higher operational complexity for small workloads.
- **AWS Lambda + API Gateway**: Serverless but requires refactoring NestJS to Lambda-compatible architecture; cold starts impact latency.
- **Heroku/Render**: Third-party PaaS; less AWS ecosystem integration; doesn't support VPC Connector for private Aurora access.

---

### 6. Secrets Management: AWS Secrets Manager + Parameter Store

**Context**: Production environment requires secure storage for database credentials, JWT secrets, Google OAuth credentials, and Play Integrity API keys.

**Decision**: Use AWS Secrets Manager for database credentials; AWS Systems Manager Parameter Store for other configuration.

**Rationale**:

- **Secrets Manager (Database Credentials)**: Automatic secret rotation; encrypted at rest; IAM-based access control; structured JSON secrets for `host`, `port`, `username`, `password`, `database`.
- **Parameter Store (Non-DB Config)**: Cost-effective for non-rotating secrets (JWT secret, Google OAuth IDs, Play Integrity credentials); free tier available; environment-based hierarchy (`/exam-app/prod/...`).
- **App Runner Integration**: Environment variables automatically load from Secrets Manager (via ARN references) and Parameter Store (via ARN references).
- **No Hardcoded Secrets**: Zero secrets in source code, `.env` files, or Docker images; all pulled at runtime from AWS services.
- **Audit Trail**: CloudTrail logs all secret access; enables security monitoring and compliance.

**Alternatives Considered**:

- **Environment Variables Only**: Secrets exposed in App Runner console; no rotation; harder to audit.
- **HashiCorp Vault**: Overkill for small deployment; requires separate infrastructure and management.
- **AWS KMS Direct**: Requires manual encryption/decryption in application code; Secrets Manager abstracts this complexity.

---

### 7. Database Connection Architecture

**Context**: App Runner needs secure, low-latency access to Aurora in private VPC subnets without exposing database to public internet.

**Decision**: Use AWS App Runner VPC Connector to connect App Runner instances to VPC private subnets where Aurora resides.

**Rationale**:

- **Security**: Aurora remains in private subnets (no public IP); only accessible from App Runner via VPC Connector.
- **Low Latency**: VPC Connector provides direct networking path (no NAT gateway overhead); <100ms database query latency (P95 target).
- **Managed Networking**: No need to configure NAT gateways, VPC peering, or custom routing tables; VPC Connector handles networking automatically.
- **Database Security Groups**: Aurora security group allows inbound PostgreSQL (port 5432) only from App Runner VPC Connector security group.

**Alternatives Considered**:

- **Public Aurora Endpoint**: Security risk; requires IP whitelist management; violates best practices for production databases.
- **AWS PrivateLink**: Overkill complexity for single-VPC deployment; VPC Connector sufficient for small deployments.
- **RDS Proxy in Public Subnet**: Still exposes connection endpoint; doesn't solve private database access requirement.

---

### 8. API Configuration: Environment-Based URLs

**Context**: Mobile app needs to connect to different API endpoints based on environment (localhost for `__DEV__`, AWS App Runner URL for production).

**Decision**: Use environment-based URL selection in `mobile/src/services/api.config.ts`.

**Rationale**:

- **Development Mode**: `__DEV__ === true` → connect to `http://localhost:3000` (local backend).
- **Production Mode**: `__DEV__ === false` → connect to `https://xyz.us-east-1.awsapprunner.com` (App Runner service URL).
- **No Rebuild Required**: Environment detection happens at runtime via `__DEV__` global (set by Metro bundler).
- **Play Store AAB**: Production builds (release configuration) automatically have `__DEV__ === false`; no manual configuration needed.

**Alternatives Considered**:

- **Hardcoded URL with Build Configs**: Requires multiple AAB builds for dev/staging/prod; prone to deployment mistakes.
- **Environment Variable in Mobile App**: Expo doesn't support runtime environment variable switching in production builds; requires rebuild for URL changes.
- **DNS CNAME with Static Domain**: Requires custom domain setup, SSL certificate management, Route 53 configuration; adds deployment complexity beyond current scope.

---

## Updated Technology Stack (with AWS Deployment)

| Layer | Technology | Reason |
|-------|-----------|--------|
| **Production Database** | AWS Aurora PostgreSQL Serverless v2 (0.5-2 ACU) | Auto-scaling, Prisma-compatible, VPC-private, automated backups |
| **Backend Hosting** | AWS App Runner (1 vCPU, 2 GB, min 1 / max 10 instances) | Managed containers, GitHub auto-deploy, VPC Connector, health checks |
| **Secrets Management** | AWS Secrets Manager (DB credentials) + Parameter Store (config) | Secure credential storage, IAM access control, automatic rotation |
| **Networking** | VPC Connector (App Runner → Aurora) | Private database access, low latency, managed networking |
| **Mobile API Config** | Environment-based URL (`__DEV__` → localhost / production → App Runner) | No rebuild required, automatic environment detection |
| **Database Migrations** | Prisma CLI (`migrate deploy`) via shell script | Applies all pending migrations before deployment, safe schema updates |
| **Monitoring** | AWS CloudWatch (logs + metrics) | App Runner auto-logs to CloudWatch, Aurora metrics dashboard |

---

## Resolved Questions (AWS Deployment)

1. **Q: How do we avoid hardcoding database credentials in the codebase?**  
   A: AWS Secrets Manager stores credentials; App Runner loads them as environment variables at runtime via secret ARN references. Zero credentials in source code or Docker images.

2. **Q: How does the mobile app know which API URL to use?**  
   A: `__DEV__` global (set by Metro bundler) determines environment at runtime. Development builds auto-connect to localhost; production AAB builds auto-connect to App Runner URL.

3. **Q: How do we ensure database migrations run before new code deploys?**  
   A: Create `api/scripts/migrate-production.sh` script that pulls credentials from Secrets Manager and runs `npx prisma migrate deploy`. Run manually before deploying new App Runner revisions. Future enhancement: automate via GitHub Actions pre-deployment hook.

4. **Q: How does App Runner access Aurora if the database is in a private subnet?**  
   A: VPC Connector provides secure networking bridge. App Runner instances attach to VPC Connector, which routes traffic to private subnets where Aurora resides. No public internet access needed.

5. **Q: What happens if App Runner deployment fails?**  
   A: App Runner health checks detect failed deployments (HTTP GET `/health` returning non-200 status). Automatic rollback to previous working revision with zero downtime. CloudWatch logs capture error details for debugging.
