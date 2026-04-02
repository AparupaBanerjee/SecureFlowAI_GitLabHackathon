````md
# SecureFlow Vault

A password manager demo app built for the **GitLab DevSecOps Hackathon**.

This repo is intentionally vulnerable so GitLab security tooling (SAST, Secret Detection, DAST) and GitLab Duo Code Review have meaningful findings to surface.
**Note:** the exact set of demo vulnerabilities can vary by branch/commit. If something listed below doesn’t reproduce in your current build, treat it as **planned/optional** and verify against the code.

---

## Architecture

```
┌──────────────────┐        ┌────────────────────────┐
│  React + Vite    │ axios  │  Express + TypeScript   │
│  (frontend)      │───────▶│  (backend)              │
│  port 5173       │        │  port 3001              │
└──────────────────┘        └────────────┬───────────┘
                                         │ Sequelize
                                         ▼
                                  ┌─────────────┐
                                  │ PostgreSQL   │
                                  └─────────────┘
```

---

## Security demo focus

### Vulnerabilities typically present (verify in your current commit)

| Vuln | Typical location | CWE | Scanner |
|------|-------------------|-----|---------|
| Hardcoded JWT secret (example: `secret123`) | `backend/src/middleware/auth.ts` | CWE-798 | SAST, Secret Detection |
| Weak password hashing config (low bcrypt work factor) | `backend/src/routes/auth.ts` | CWE-916 | SAST |
| SQL injection via raw query | `backend/src/routes/search.ts` | CWE-89 | SAST, DAST |
| Missing common security headers (`helmet`) | `backend/src/app.ts` | OWASP A05 | DAST |
| No rate limiting on `/login` | `backend/src/routes/auth.ts` | OWASP A07 | DAST |

### Planned / optional demo scenarios (may not be implemented in your current build)

| Vuln | Intended area | Why it might not reproduce |
|------|---------------|----------------------------|
| IDOR (missing ownership check on “reveal”/read by ID) | entries “reveal” endpoint | endpoint/feature may differ or not exist yet |
| Broken access control (admin role check missing/disabled) | admin routes | route may be stubbed or guarded differently |

---

## Quick start (local)

### Prerequisites
- Node.js 20+
- PostgreSQL 15+ running locally

### Backend

```bash
cd backend
cp .env.example .env          # edit DATABASE_URL if needed
npm install
npm run dev                   # starts on http://localhost:3001

# Seed demo data (in a separate terminal):
npm run seed
```

### Frontend

```bash
cd frontend
npm install
npm run dev                   # starts on http://localhost:5173
```

The Vite dev server proxies `/api` → `http://localhost:3001`, so no CORS config needed locally.

---

## Demo accounts (after seeding)

| Email | Password | Role |
|------|----------|------|
| `admin@securevault.dev` | `Admin1234!` | admin |
| `alice@example.com` | `Alice1234!` | user |
| `bob@example.com` | `Bob1234!` | user |

---

## Verify what’s actually enabled in this commit

Run these from the repo root:

```bash
# Does a hardcoded JWT secret exist?
rg -n "secret123|JWT_SECRET|jwt.*secret" backend/src

# Is helmet used?
rg -n "helmet\\(" backend/src/app.ts backend/src

# Is there raw SQL usage that could be injectable?
rg -n "sequelize\\.query\\(" backend/src

# Is there any rate limiting middleware on auth routes?
rg -n "rateLimit|express-rate-limit" backend/src/routes
```

---

## Demonstrating SQL injection (search) — if `/api/search` exists

```bash
# Log in first, copy the JWT token, then:
curl "http://localhost:3001/api/search?q=' OR '1'='1" \
  -H "Authorization: Bearer <token>"
```

Expected behavior in a vulnerable implementation: the query returns more data than intended due to tautology injection.

---

## Demonstrating IDOR (optional) — if an entry “reveal by ID” endpoint exists

If your current build exposes something like `GET /api/entries/:id/reveal`:

1. Log in as **alice**.
2. Use DevTools → Network to find Alice’s entry IDs.
3. Request an entry ID that belongs to **bob** using Alice’s JWT.
4. Vulnerable behavior: returns Bob’s secret without a 403.

If this endpoint does not exist (or correctly checks ownership), treat the IDOR scenario as *not present in this commit*.

---

## Deploy to Render

1. Fork this repo and push to GitLab / GitHub.
2. In the Render dashboard click **New Blueprint** and point it at your repo.
3. Render reads `render.yaml` and provisions:
   - `securevault-backend` — Node web service (free)
   - `securevault-frontend` — Static site (free)
   - `securevault-db` — Managed PostgreSQL (free)
4. After deploy, run the seed via the Render shell: `npm run seed`

---

## GitLab CI pipeline

The pipeline runs across 10 stages — see **Automated Actions** below for the full breakdown.

```
installDeps → test → staticValidations → buildImage → securityScans → mrReviewDeploy → runtimeValidations → runtimeSecurityScans → summary → releaseNotes
```

### Required CI variables

| Variable | Description |
|----------|-------------|
| `RENDER_API_KEY` | Render API key (for deploy triggers) |
| `RENDER_OWNER_ID` | Render workspace ID (format: `tea-...`) |
| `RENDER_PREVIEW_DATABASE_URL` | Shared Postgres connection string for preview backends |
| `DAST_AUTH_USERNAME` | Username for DAST authenticated scan (default: `alice@example.com`) |
| `DAST_AUTH_PASSWORD` | Password for DAST authenticated scan (default: `Alice1234!`) |
| `GITLAB_TOKEN` | Project/personal access token with `api` scope (for releases) |

---

## GitLab Duo Code Review

Custom review instructions live in `.gitlab/duo/mr-review-instructions.yaml`.

They focus on common training themes (access control, IDOR-style checks, raw SQL taint flows, missing hardening middleware, and auth configuration). If a specific feature isn't present in your commit, Duo findings may differ.

---

## GitLab Duo Agent Platform Integration

This project is optimized for AI-assisted development using GitLab Duo Agent Platform:

- **GitLab Duo Chat:** Custom chat rules in `.gitlab/duo/chat-rules.md` enforce KISS (Keep It Simple, Stupid) principles
- **Agent Platform Ready:** Configured with `agent-config.yml` for flow execution
- **MR Review Instructions:** Enhanced review guidelines in `.gitlab/duo/mr-review-instructions.yaml`
- **AGENTS.md:** Comprehensive instructions for AI agents contributing to the codebase
- **Design Philosophy:** All code follows KISS principle — simplicity over cleverness

> **For AI Agents:** Review `AGENTS.md` before making changes to understand project conventions, tech stack, and critical safety rules.

---

## Automated Actions

The GitLab CI pipeline (`.gitlab-ci.yml`) automates the following across 10 stages:

| | Action | Stage | Details |
|---|--------|-------|---------|
| 📥 | **Dependency Install & Audit** | `installDeps` | `npm ci` + `npm audit` for backend & frontend |
| 🔒 | **Security Scanning (Policy-Injected)** | `test` | SAST, Secret Detection, Dependency Scanning — injected via pipeline execution policy |
| 🧪 | **Lint & Type-Check** | `staticValidations` | TypeScript `tsc --noEmit` for backend & frontend |
| ✅ | **Unit Tests + Coverage** | `staticValidations` | Jest (backend) + Vitest (frontend) with Cobertura & JUnit reports |
| 🐳 | **Container Build** | `buildImage` | Docker images pushed to GitLab Container Registry (manual trigger) |
| 🛡️ | **Container Scanning** | `securityScans` | Trivy vulnerability scan + Dockle CIS Docker Benchmark for both images |
| 🌐 | **Review Environment Deploy** | `mrReviewDeploy` | Per-MR preview environments on Render (backend + frontend) |
| 🎭 | **E2E Testing** | `runtimeValidations` | Playwright tests against deployed review environment |
| 🔍 | **DAST & API Security** | `runtimeSecurityScans` | ZAP browser scan (frontend) + OpenAPI-driven API security testing (backend) |
| 📊 | **Security Summary** | `summary` | Aggregated findings from all scanners posted as MR note |
| 🚀 | **Release Creation** | `releaseNotes` | GitLab Release with changelog (default branch only) |

---

## File structure

```
.
├── backend/
│   ├── src/
│   │   ├── app.ts
│   │   ├── server.ts
│   │   ├── seed.ts
│   │   ├── config/database.ts
│   │   ├── middleware/auth.ts
│   │   ├── models/
│   │   └── routes/
│   │       ├── auth.ts
│   │       ├── entries.ts
│   │       └── search.ts
│   ├── openapi.dast.yaml
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── context/AuthContext.tsx
│   │   ├── api/client.ts
│   │   └── pages/
│   │       ├── Login.tsx
│   │       ├── Dashboard.tsx
│   │       ├── AddEntry.tsx
│   │       └── Admin.tsx
│   ├── index.html
│   ├── vite.config.ts
│   ├── package.json
│   └── Dockerfile
├── e2e/
│   ├── tests/
│   │   ├── auth.spec.ts
│   │   └── vault.spec.ts
│   └── playwright.config.ts
├── .ci/
│   ├── deploy-review.sh
│   ├── stop-review.sh
│   ├── dast-api-auth.py
│   ├── security-summary.py
│   ├── release-notes.py
│   └── pipeline-execution-policy.yml
├── .gitlab/
│   ├── duo/
│   │   ├── chat-rules.md
│   │   └── mr-review-instructions.yaml
│   └── issue_templates/
│       └── feature_request.md
├── AGENTS.md
├── agent-config.yml
├── render.yaml
├── .gitlab-ci.yml
└── README.md
```
````
