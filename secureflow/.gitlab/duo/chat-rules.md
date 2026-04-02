## .gitlab/duo/chat-rules.md
## Custom GitLab Duo Chat rules for SecureFlow Vault.
## These rules guide Duo Chat responses to follow project conventions.

# SecureFlow Vault — Duo Chat Rules

## Design Principles

1. **KISS (Keep It Simple, Stupid):** Prefer the simplest solution that works correctly. Avoid over-engineering, unnecessary abstractions, and premature optimization.
2. **Security First:** This is a password manager. Every suggestion must consider security implications. Never suggest storing secrets in plaintext, weakening auth, or bypassing access controls.
3. **Explicit over Implicit:** Prefer clear, readable code over clever one-liners. Name variables and functions descriptively.

## Tech Stack

- **Backend:** Node.js + Express + TypeScript + Sequelize ORM + PostgreSQL
- **Frontend:** React 18 + TypeScript + Vite + Axios
- **Testing:** Jest (backend), Vitest (frontend), Playwright (e2e)
- **CI/CD:** GitLab CI with SAST, DAST, Secret Detection, Dependency Scanning

## Code Style Rules

- Use TypeScript strict mode. Do not use `any` type unless absolutely unavoidable.
- Use `async/await` over raw Promises or callbacks.
- Use Sequelize ORM methods (`findOne`, `findAll`, `create`, `update`, `destroy`) — avoid raw SQL queries (`sequelize.query()`).
- Express route handlers must always return a response — never leave a code path without `res.json()` / `res.status()`.
- All API endpoints that access user-owned resources must include an ownership check (`userId === req.user.id`).

## Security Rules for Suggestions

- JWT secrets must come from `process.env.JWT_SECRET`, never hardcoded.
- bcrypt cost factor must be ≥ 12.
- Never suggest disabling CORS, helmet, or rate limiting in production code.
- Always parameterize database queries — no string interpolation in SQL.
- Never log sensitive data (passwords, tokens, secrets) to console or files.
- Error responses to clients must not include stack traces or internal error details.

## File Organization

- Backend routes go in `backend/src/routes/`.
- Backend middleware goes in `backend/src/middleware/`.
- Sequelize models go in `backend/src/models/`.
- Frontend pages go in `frontend/src/pages/`.
- Frontend API client lives in `frontend/src/api/client.ts`.
- Tests mirror source structure under `__tests__/`.

## When Suggesting Changes

- Keep changes minimal and focused. One concern per commit.
- Include error handling at system boundaries (route handlers, external calls) but not for impossible internal states.
- Do not add comments explaining obvious code. Add comments only for non-obvious security decisions or intentional vulnerabilities (demo purposes).
- When modifying existing vulnerable code (marked with `// VULNERABILITY:`), preserve those comments — they exist for DevSecOps demo purposes.
