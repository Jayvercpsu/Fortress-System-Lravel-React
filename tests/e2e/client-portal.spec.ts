import { expect, test } from '@playwright/test';

const CLIENT_USERNAME = 'portal_client';
const CLIENT_PASSWORD = 'password';

test('client portal logout shows success toast', async ({ page }) => {
    await page.goto('/client/login');
    await page.locator('input[name="username"]').fill(CLIENT_USERNAME);
    await page.locator('input[type="password"]').fill(CLIENT_PASSWORD);
    await page.getByRole('button', { name: /sign in/i }).click();

    // Every successful client login lands on /client/portal with the portal bar.
    await expect(page).toHaveURL(/\/client\/portal/);
    await expect(page.locator('body')).toContainText('Client Portal');

    // Click Logout in the client portal bar.
    await page.getByRole('button', { name: /logout/i }).click();

    // The client is redirected back to the client login page and sees a success toast.
    await expect(page).toHaveURL(/\/client\/login/);
    await expect(page.getByText('Signed out successfully.')).toBeVisible();
});