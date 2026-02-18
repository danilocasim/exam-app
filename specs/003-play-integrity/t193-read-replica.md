# T193: Create Neon Read Replica Branch (Optional)

**Purpose:**
- Enable a read-only branch in Neon for analytics, backup, or safe experimentation without impacting production writes.
- Provides instant, zero-cost branching for point-in-time recovery or reporting.

---

## What is a Neon Branch?
- Neon allows you to create a branch (like a git branch) of your production database instantly.
- Each branch is a full, isolated copy at the time of creation (copy-on-write, no extra storage until changes are made).
- **Use cases:**
  - Analytics/reporting (run heavy queries without affecting prod)
  - Safe schema experiments
  - Point-in-time recovery (rollback)
  - Backup before risky migrations

---

## How to Create a Read Replica Branch in Neon

1. **Go to your Neon project:**
   - https://console.neon.tech
   - Select your project (e.g., `exam-app-prod`)

2. **Create a new branch:**
   - Click "Branches" in the left sidebar
   - Click "New Branch"
   - Name: `read-replica` (or any descriptive name)
   - Source: `main` (or your current production branch)
   - Click "Create"

3. **Get the connection string:**
   - Select the new `read-replica` branch
   - Click "Connection Details"
   - Copy the pooled connection string (with `-pooler` in the host)
   - Example:
     ```
     postgresql://neondb_owner:password@ep-raspy-rice-aibav3t1-pooler.c-4.us-east-1.aws.neon.tech/neondb?branch=read-replica&sslmode=require&channel_binding=require
     ```

4. **Usage:**
   - Use this connection string for read-only workloads (analytics, reporting, backup scripts)
   - **Do not use for writes** (writes will not affect production)
   - Safe for experimentation: can be deleted or reset at any time

---

## Best Practices
- **Never run migrations or seed scripts on a read replica branch.**
- Use for SELECT queries, analytics, or backup exports only.
- Document the branch purpose in Neon console for team clarity.
- Delete unused branches to save on storage (copy-on-write, but still best to clean up).

---

## Rollback/Recovery Example
- If a migration or data change goes wrong in production:
  1. Create a branch from the last known good state (or use an existing read replica)
  2. Promote the branch to production (in Neon console)
  3. Update your `DATABASE_URL` to point to the promoted branch

---

## Documentation Reference
- [Neon Branches Guide](https://neon.tech/docs/branches/)
- [Branching FAQ](https://neon.tech/docs/branches/faq/)
- [Connection Strings](https://neon.tech/docs/guides/connection-strings/)

---

**Status:**
- [x] Guide created
- [ ] Branch created in Neon console (manual step)
- [ ] Connection string documented in `.env.read-replica.example` (optional)

---

**Next Steps:**
- Create the branch in Neon console as needed
- Add `.env.read-replica.example` if you want to document the connection string for team use
- Use for analytics, reporting, or safe experiments
