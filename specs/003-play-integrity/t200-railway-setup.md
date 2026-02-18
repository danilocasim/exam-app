# T200: Create Railway Project for Production Deployment

**Purpose:**
- Deploy the backend API to Railway using the Neon pooled connection for PostgreSQL.
- Enable auto-deploy from GitHub branch `003-play-integrity`.

---

## Step-by-Step Guide

### 1. Create Railway Account (if needed)
- Go to https://railway.app
- Sign up with GitHub (recommended)

### 2. Create New Project
- Click **New Project**
- Select **Deploy from GitHub repo**
- Find and select your repository: `danilocasim/exam-app`
- Choose branch: `003-play-integrity`
- Set project name: `exam-app-prod`

### 3. Configure Service
- Railway will auto-detect the Node.js project in `api/`
- Set **Root Directory**: `api/`
- Set **Build Command**: `npm install && npm run build`
- Set **Start Command**: `npm run start:prod`
- Set **Install Command**: `npm install`

### 4. Enable Automatic Deployments
- Enable **Auto Deploy on Push** for branch `003-play-integrity`

### 5. Add Environment Variables (see T202)
- `NODE_ENV=production`
- `DATABASE_URL` (Neon pooled connection string)
- `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `PLAY_INTEGRITY_CREDENTIALS`

### 6. Deploy
- Click **Deploy**
- Wait for build and deployment to complete
- View logs for status

---

## References
- [Railway Docs: Deploy from GitHub](https://docs.railway.app/deploy/deploy-from-github)
- [Railway Node.js Guide](https://docs.railway.app/deploy/deploy-node)

---

**Status:**
- [x] Guide created
- [ ] Project created in Railway dashboard (manual step)
- [ ] Service deployed and running
