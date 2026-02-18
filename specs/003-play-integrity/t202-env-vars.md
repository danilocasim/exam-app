# T202: Configure Railway Environment Variables

**Purpose:**
- Set all required environment variables for production deployment on Railway.

---

## Required Environment Variables

| Variable                  | Description                                 | Example/Source                                 |
|---------------------------|---------------------------------------------|------------------------------------------------|
| NODE_ENV                  | Set to `production`                         | `production`                                   |
| DATABASE_URL              | Neon pooled connection string                | From `.env.production.example`                 |
| JWT_SECRET                | JWT signing secret (Phase 2)                 | Generate a strong random string                |
| GOOGLE_CLIENT_ID          | Google OAuth client ID (Phase 2)             | From Google Cloud Console                      |
| GOOGLE_CLIENT_SECRET      | Google OAuth client secret (Phase 2)         | From Google Cloud Console                      |
| PLAY_INTEGRITY_CREDENTIALS| Google Play Integrity API credentials (JSON) | From Google Play Console, as JSON string       |

---

## How to Set Environment Variables in Railway

1. Go to your Railway project dashboard (`exam-app-prod`)
2. Click **Variables** in the sidebar
3. Add each variable above (copy from `.env.production.example`)
4. For `PLAY_INTEGRITY_CREDENTIALS`, paste the full JSON (escape as needed)
5. Click **Save**
6. Redeploy service if needed

---

## Example `.env.production.example`
```
NODE_ENV=production
DATABASE_URL=postgresql://neondb_owner:...@ep-raspy-rice-aibav3t1-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET=your-strong-secret
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
PLAY_INTEGRITY_CREDENTIALS={...}
```

---

**Status:**
- [x] Guide created
- [ ] Variables set in Railway dashboard (manual step)
