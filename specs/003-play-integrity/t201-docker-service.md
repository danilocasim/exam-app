# T201: Add Docker Service to Railway

**Purpose:**
- Ensure the API service is deployed in a consistent, production-ready environment on Railway.
- Use Railway's Node.js auto-detection or a custom Dockerfile if needed.

---

## Node.js (Default) Service
- Railway auto-detects Node.js projects in `api/`.
- No Dockerfile required unless you need custom build steps or OS packages.
- **Root Directory:** `api/`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run start:prod`

## Custom Dockerfile (Optional)
- Only needed for custom OS dependencies or non-standard builds.
- Place `Dockerfile` in `api/` if required.
- Example minimal Dockerfile:
  ```Dockerfile
  FROM node:20-alpine
  WORKDIR /app
  COPY . .
  RUN npm install && npm run build
  CMD ["npm", "run", "start:prod"]
  ```
- Set **Root Directory:** `api/`
- Set **Dockerfile Path:** `api/Dockerfile`

## Enable Automatic Deployments
- In Railway dashboard, enable **Auto Deploy on Push** for `003-play-integrity` branch.

---

## References
- [Railway Node.js Guide](https://docs.railway.app/deploy/deploy-node)
- [Railway Docker Guide](https://docs.railway.app/deploy/deploy-docker)

---

**Status:**
- [x] Guide created
- [ ] Service deployed (manual step)
- [ ] Automatic deployments enabled
