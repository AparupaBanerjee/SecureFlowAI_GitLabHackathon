import { test, expect } from '@playwright/test';

const USER_EMAIL = process.env.E2E_USER_EMAIL || 'e2e@secureflow.local';
const USER_PASSWORD = process.env.E2E_USER_PASSWORD || 'E2eTest1!';

// Helper: log in and wait for the dashboard to be visible.
// Asserts on content rather than URL because the app briefly redirects
// / → /login → / while React flushes auth state after login().
async function loginAndWaitForDashboard(page: import('@playwright/test').Page) {
  await page.goto('/login');
  await page.fill('#email', USER_EMAIL);
  await page.fill('#password', USER_PASSWORD);
  await page.click('#submit');
  await expect(page.getByText(/My Vault/)).toBeVisible();
}

test.describe('Authentication', () => {
  test('login with valid credentials shows dashboard', async ({ page }) => {
    await loginAndWaitForDashboard(page);
  });

  test('login with wrong password shows error', async ({ page }) => {
    await page.goto('/login');

    await page.fill('#email', USER_EMAIL);
    await page.fill('#password', 'wrong-password');
    await page.click('#submit');

    // Backend returns "Invalid credentials" for unknown user / wrong password
    await expect(page.getByText('Invalid credentials')).toBeVisible();
    // Must still be on the login page (no navigation)
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('logout returns to login page', async ({ page }) => {
    await loginAndWaitForDashboard(page);

    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL('/login');
  });

  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL('/login');
  });
});
