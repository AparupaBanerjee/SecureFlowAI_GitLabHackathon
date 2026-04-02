# AGENTS.md — Instructions for AI Agents Contributing to SecureFlow Vault

## Project Overview

SecureFlow Vault is a password manager demo built for the **GitLab DevSecOps Hackathon**. The codebase contains **intentional security vulnerabilities** for demonstrating GitLab security scanning (SAST, DAST, Secret Detection, Dependency Scanning). Do not "fix" these unless explicitly asked.

## Design Philosophy

**KISS — Keep It Simple, Stupid.** Every change should be the simplest correct solution. Do not over-engineer, add unnecessary abstractions, or introduce patterns the codebase doesn't already use.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js 20, Express 4, TypeScript, Sequelize 6 |
| Database | PostgreSQL 15 |
| Frontend | React 18, TypeScript, Vite 5, Axios |
| Auth | JWT (jsonwebtoken), bcrypt |
| Backend Tests | Jest + Supertest |
| Frontend Tests | Vitest + Testing Library |
| E2E Tests | Playwright |
| CI/CD | GitLab CI (SAST, DAST, Secret Detection, Dep Scanning) |

## Project Structure

```
backend/src/
├── app.ts              # Express app setup (CORS, middleware, routes)
├── server.ts           # Server entrypoint (listen)
├── seed.ts             # Demo data seeder
├── config/database.ts  # Sequelize + PostgreSQL connection
├── middleware/auth.ts   # JWT authentication middleware
├── models/             # Sequelize models (User, VaultEntry, AuditLog)
├── routes/
│   ├── auth.ts         # Login, register endpoints
│   ├── entries.ts      # CRUD for vault entries
│   └── search.ts       # Search endpoint (has intentional SQL injection)

frontend/src/
├── main.tsx            # React entrypoint
├── App.tsx             # Router setup
├── api/client.ts       # Axios instance with auth interceptor
├── context/AuthContext.tsx  # Auth state management
├── pages/
│   ├── Login.tsx
│   ├── Dashboard.tsx
│   ├── AddEntry.tsx
│   └── Admin.tsx

e2e/tests/              # Playwright end-to-end tests
```

## Critical Safety Rules

1. **Do NOT remove `// VULNERABILITY:` comments.** These mark intentional demo vulnerabilities for security scanner demonstrations. Preserve them unless the user explicitly asks to fix the vulnerability.

2. **Do NOT hardcode secrets.** JWT secrets, database credentials, API keys must come from environment variables (`process.env.*`).

3. **Do NOT use raw SQL with string interpolation.** Use Sequelize ORM methods or parameterized queries with `replacements`.

4. **Do NOT weaken authentication.** Never reduce bcrypt cost factor, remove JWT verification, or bypass auth middleware.

5. **Do NOT modify `.gitlab-ci.yml`** without explicit user approval. Pipeline changes can break security scanning.

6. **Run tests before proposing changes:**
   - Backend: `cd backend && npm test`
   - Frontend: `cd frontend && npm test`
   - E2E: `cd e2e && npx playwright test`

## Coding Conventions

### TypeScript
- Strict mode enabled. Avoid `any` type.
- Use `async/await` over callbacks or `.then()` chains.
- Use explicit return types on exported functions.

### Backend (Express)
- All route handlers must return a response on every code path.
- User-owned resources must be filtered by `userId` in the query:
  ```ts
  Entry.findOne({ where: { id: req.params.id, userId: req.user.id } })
  ```
- Admin routes must check `req.user.role === 'admin'` server-side.
- Error responses: `res.status(4xx).json({ error: 'Human-readable message' })` — never expose stack traces or DB internals.

### Frontend (React)
- Functional components with hooks only. No class components.
- Auth state via `AuthContext`. Access with `useAuth()` hook.
- API calls go through `frontend/src/api/client.ts` (Axios instance).
- No inline styles. Keep styling minimal (this is a demo app).

### Tests
- Test files mirror source structure under `__tests__/`.
- Backend tests use Supertest for HTTP assertions.
- Frontend tests use Testing Library (`render`, `screen`, `userEvent`).
- Write focused tests — one assertion per test when practical.

## Commits & MRs

- One logical change per commit.
- Commit messages: `type: short description` (e.g., `fix: add ownership check to entries endpoint`).
- MR descriptions should reference the issue number and summarize what changed and why.

## Demo Accounts (after seeding)

| Email | Password | Role |
|-------|----------|------|
| `admin@securevault.dev` | `Admin1234!` | admin |
| `alice@example.com` | `Alice1234!` | user |
| `bob@example.com` | `Bob1234!` | user |

## Related Configuration

- **Duo Chat Rules:** `.gitlab/duo/chat-rules.md`
- **MR Review Instructions:** `.gitlab/duo/mr-review-instructions.yaml`
- **Agent Config:** `agent-config.yml`
- **Issue Templates:** `.gitlab/issue_templates/`
- **CI Pipeline:** `.gitlab-ci.yml`
