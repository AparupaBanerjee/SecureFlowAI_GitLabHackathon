import { test, expect } from '@playwright/test';

const USER_EMAIL = process.env.E2E_USER_EMAIL || 'e2e@secureflow.local';
const USER_PASSWORD = process.env.E2E_USER_PASSWORD || 'E2eTest1!';

test.describe('Vault entries', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('#email', USER_EMAIL);
    await page.fill('#password', USER_PASSWORD);
    await page.click('#submit');
    // Wait for dashboard content — more reliable than URL check because the app
    // briefly cycles / → /login → / while React flushes auth state after login().
    await expect(page.getByText(/My Vault/)).toBeVisible();
  });

  test('create a new secret and see it on the dashboard', async ({ page }) => {
    const entryName = `E2E Secret ${Date.now()}`;

    // Navigate to the add-entry form
    await page.getByRole('button', { name: '+ Add Entry' }).click();
    await expect(page).toHaveURL('/entries/new');

    // Fill in the form
    await page.getByPlaceholder('e.g. GitHub Work').fill(entryName);
    await page.getByPlaceholder('alice@example.com').fill('testuser@example.com');
    await page.getByPlaceholder('Enter password').fill('SuperSecret42!');
    await page.getByPlaceholder('https://github.com').fill('https://example.com');
    await page.getByPlaceholder('Any notes…').fill('Created by Playwright E2E');

    // Submit
    await page.getByRole('button', { name: 'Add Entry' }).click();

    // Should be back on the dashboard with the new entry visible
    await expect(page).toHaveURL('/');
    await expect(page.getByText(entryName)).toBeVisible();
  });

  test('edit an existing secret', async ({ page }) => {
    const originalName = `Edit Target ${Date.now()}`;
    const updatedName = `Edited ${Date.now()}`;

    // Create an entry to edit
    await page.getByRole('button', { name: '+ Add Entry' }).click();
    await page.getByPlaceholder('e.g. GitHub Work').fill(originalName);
    await page.getByPlaceholder('Enter password').fill('OriginalPass1!');
    await page.getByRole('button', { name: 'Add Entry' }).click();
    await expect(page).toHaveURL('/');

    // Walk up from the entry name text to the closest ancestor div that owns
    // an Edit button — avoids matching outer wrapper divs that also "contain"
    // the text and multiple buttons.
    const editCard = page
      .getByText(originalName, { exact: true })
      .locator('xpath=ancestor::div[.//button[normalize-space()="Edit"]][1]');

    await editCard.getByRole('button', { name: 'Edit' }).click();
    await expect(page).toHaveURL(/\/entries\/\d+\/edit/);

    // Wait for the edit form's useEffect to finish loading the entry data
    // before touching the input — otherwise the async fill overwrites our changes.
    const nameInput = page.getByPlaceholder('e.g. GitHub Work');
    await expect(nameInput).toHaveValue(originalName);

    await nameInput.clear();
    await nameInput.fill(updatedName);
    await page.getByRole('button', { name: 'Save Changes' }).click();

    // Wait for dashboard to reappear with the updated entry name
    await expect(page.getByText(updatedName)).toBeVisible();
    await expect(page.getByText(originalName)).not.toBeVisible();
  });

  test('delete a secret removes it from the dashboard', async ({ page }) => {
    const entryName = `Delete Me ${Date.now()}`;

    // Create the entry first
    await page.getByRole('button', { name: '+ Add Entry' }).click();
    await page.getByPlaceholder('e.g. GitHub Work').fill(entryName);
    await page.getByPlaceholder('Enter password').fill('TempPass1!');
    await page.getByRole('button', { name: 'Add Entry' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.getByText(entryName)).toBeVisible();

    // Register dialog handler BEFORE the click that triggers confirm()
    page.once('dialog', (dialog) => dialog.accept());

    // Walk up from the entry name text to the closest ancestor div that owns
    // the Delete button — avoids matching outer wrapper divs.
    const deleteCard = page
      .getByText(entryName, { exact: true })
      .locator('xpath=ancestor::div[.//button[normalize-space()="Delete"]][1]');

    await deleteCard.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(entryName)).not.toBeVisible();
  });

  test('search filters entries by name', async ({ page }) => {
    const uniqueTerm = `SearchMe${Date.now()}`;

    // Create an entry with a unique name
    await page.getByRole('button', { name: '+ Add Entry' }).click();
    await page.getByPlaceholder('e.g. GitHub Work').fill(`${uniqueTerm} Entry`);
    await page.getByPlaceholder('Enter password').fill('SearchPass1!');
    await page.getByRole('button', { name: 'Add Entry' }).click();
    await expect(page).toHaveURL('/');

    // Type in the search box
    await page.getByPlaceholder('Search entries…').fill(uniqueTerm);

    // Only the matching entry should be visible
    await expect(page.getByText(`${uniqueTerm} Entry`)).toBeVisible();
  });
});
