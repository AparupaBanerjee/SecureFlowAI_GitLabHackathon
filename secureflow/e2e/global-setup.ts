import { request } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const EMAIL = process.env.E2E_USER_EMAIL || 'e2e@secureflow.local';
const PASSWORD = process.env.E2E_USER_PASSWORD || 'E2eTest1!';

/**
 * Ensures the E2E test user exists, then verifies login works before any tests run.
 * Fails loudly if the app is unreachable or credentials are broken — prevents
 * cryptic test failures downstream.
 */
export default async function globalSetup() {
  const ctx = await request.newContext({ baseURL: BASE_URL });

  // Register (idempotent — 409 just means the user already exists)
  const reg = await ctx.post('/api/auth/register', {
    data: { email: EMAIL, password: PASSWORD },
    failOnStatusCode: false,
  });

  if (!reg.ok() && reg.status() !== 409) {
    const body = await reg.text();
    await ctx.dispose();
    throw new Error(
      `[e2e setup] registration failed (${reg.status()}): ${body}\n` +
      `Make sure the app is running at ${BASE_URL}`,
    );
  }
  console.log(`[e2e setup] user ready (${reg.status() === 409 ? 'pre-existing' : 'newly registered'})`);

  // Verify login actually works — fail fast before any test runs
  const login = await ctx.post('/api/auth/login', {
    data: { email: EMAIL, password: PASSWORD },
    failOnStatusCode: false,
  });
  if (!login.ok()) {
    const body = await login.text();
    await ctx.dispose();
    throw new Error(`[e2e setup] login verification failed (${login.status()}): ${body}`);
  }
  console.log('[e2e setup] login verified ✓');

  await ctx.dispose();
}
