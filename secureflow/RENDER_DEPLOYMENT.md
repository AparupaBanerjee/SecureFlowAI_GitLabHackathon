# Render Deployment & GitLab CI Setup Guide

## Overview

This guide walks you through deploying **SecureFlow Vault** (React + Express + PostgreSQL) to **Render**, with automatic review environment creation for each GitLab MR.

---

## Prerequisites

1. **Render Account** — Free tier at [render.com](https://render.com)
2. **GitLab Repository** — This repo pushed to GitLab (not GitHub)
3. **Render API Key** — For programmatic deployments
4. **GitLab CI Runner** — Default shared runners work fine

---

## Step 1: Get Render API Key

1. Log into [Render Dashboard](https://dashboard.render.com)
2. **Account Settings** → **API Keys** tab
3. Create a new API key and copy it
4. Store securely (you'll add it to GitLab next)

---

## Step 2: Add Render Variables to GitLab CI

1. Go to your GitLab repo
2. **Settings** → **CI/CD** → **Variables** (or **Protected variables**)
3. Add the following CI variables:
   - `RENDER_API_KEY` — Set to your API key (mark as **Protected** and **Masked**)
   - `RENDER_DEPLOY_HOOK_URL` — (Optional) Deploy hook URL from Render service
   - `DAST_AUTH_USERNAME` — Default: `alice@example.com` (for DAST authenticated scan)
   - `DAST_AUTH_PASSWORD` — Default: `Alice1234!` (for DAST authenticated scan)

---

## Step 3: Deploy to Render (Main App)

### Option A: Render Blueprint (Recommended)

This is the easiest method. Render reads `render.yaml` and auto-provisions everything.

1. Push this repo to GitLab
2. Go to [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**
3. Select your GitLab repo (or connect GitLab if first time)
4. Select branch (default: `main`)
5. Review the plan:
   - `securevault-db` — PostgreSQL (free tier, 256 MB)
   - `securevault-backend` — Node/Express API (free tier)
   - `securevault-frontend` — React static site (free tier)
6. Click **Create Blueprint** and wait ~5 minutes
7. After deploy, seed the database:
   ```bash
   # Via Render Shell (or SSH):
   cd securevault-backend
   npm run seed
   ```

### Option B: Manual Setup (if Blueprint fails)

1. Create each service manually:
   - **Database** → PostgreSQL (remember connection string)
   - **Backend** → Node service, root: `backend/`, build: `npm install && npm run build`, start: `npm start`
   - **Frontend** → Static site, root: `frontend/`, build: `npm install && npm run build`, publish: `dist/`

2. Add environment variables to each service matching `render.yaml`

3. After deploy, run seed via Render Shell:
   ```
   npm run seed
   ```

---

## Step 4: Verify Main Deployment

- **Frontend**: `https://securevault-frontend.onrender.com`
- **Backend**: `https://securevault-backend.onrender.com`
- **Health check**: `curl https://securevault-backend.onrender.com/health`

Log in with:
- Email: `admin@securevault.dev`
- Password: `Admin1234!`

---

## Step 5: Enable Review Environments (per-MR deployments)

The `.gitlab-ci.yml` now has a `deploy-review` job that creates preview deployments for each MR.

### How it works:

1. Developer creates MR → GitLab runs pipeline
2. `deploy-review` job triggers (runs only on MR pipelines)
3. A preview URL is generated and exported as `DAST_WEBSITE`
4. DAST runs against the preview environment
5. On MR close, `stop-review` cleans up (manual trigger)

### Manual Cleanup:

Since Render doesn't have a native "auto-delete service" API yet, preview services must be cleaned up manually:

```bash
# Via scripts/render-deploy.sh (requires RENDER_API_KEY):
./scripts/render-deploy.sh delete-service <service-id>

# Or manually in Render Dashboard:
# 1. Settings → Services
# 2. Find preview service (e.g., securevault-backend-pr-42)
# 3. Delete it
```

---

## Step 6: Set Up Deploy Hook (Optional, for auto-branch-deploy)

If you want auto-deploy on every push to a specific branch:

1. Go to Render service settings
2. **Settings** → **Deploy Hook** → Copy URL
3. Add to GitLab CI: `RENDER_DEPLOY_HOOK_URL` variable
4. The `deploy-review` job will POST to this hook to trigger deploys

---

## File Locations

| File | Purpose |
|------|---------|
| `render.yaml` | Blueprint spec for Render (databases, services, env vars) |
| `.gitlab-ci.yml` | GitLab CI pipeline (SAST, DAST, review deploy jobs) |
| `scripts/render-deploy.sh` | Helper script for Render API operations (optional) |
| `backend/src/server.ts` | Listens on `process.env.PORT` (Render injects this) ✓ |
| `frontend/src/api/client.ts` | Uses `import.meta.env.VITE_API_URL` (set at build time) ✓ |

---

## Troubleshooting

### Preview deployment not triggering

- Check GitLab CI logs → `deploy-review` job
- Ensure `RENDER_DEPLOY_HOOK_URL` is set (if using hook), OR
- Ensure `RENDER_API_KEY` is set and correct

### DAST fails with "connection refused"

- Preview service may still be starting (takes 1-2 min)
- Check Render service status in dashboard
- In `.gitlab-ci.yml`, add delays if needed:
  ```yaml
  before_script:
    - sleep 30  # wait for service to be ready
  ```

### Frontend can't reach backend API

- Check `VITE_API_URL` is set correctly in render.yaml (from service URL)
- Verify CORS is enabled on backend (check `app.ts`)
- Check browser DevTools console for actual request URLs

### Database seed doesn't populate

- Run manually via Render Shell: `npm run seed`
- Or SSH into the backend service and run it directly

---

## Next Steps

1. ✅ Deploy main app to Render (Blueprint)
2. ✅ Seed demo accounts
3. ✅ Verify frontend + backend + DB work together
4. ✅ Add Render CI variables to GitLab
5. Test MR workflow:
   - Create a test MR
   - Observe `deploy-review` job
   - Verify DAST runs against preview URL
   - Check for security findings

---

## Additional Resources

- [Render Docs: Blueprint Spec](https://render.com/docs/blueprint-spec)
- [Render Docs: Environment Variables](https://render.com/docs/environment-variables)
- [Render API Docs](https://api-docs.render.com/)
- [GitLab CI/CD Reference](https://docs.gitlab.com/ee/ci/)
- [DAST Configuration](https://docs.gitlab.com/ee/user/application_security/dast/)
