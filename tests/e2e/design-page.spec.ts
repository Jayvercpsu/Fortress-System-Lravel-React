import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

test('head_admin Design nav opens the monitoring board at /design', async ({ page }) => {
    await loginAs(page, 'head_admin');

    // loginAs restores the session without navigating, so open the
    // dashboard explicitly before using its sidebar links.
    await page.goto('/head-admin');

    // The sidebar "Design" link should point to the new /design URL.
    await page.getByRole('link', { name: /Design/i }).first().click();

    await expect(page).toHaveURL(/\/design$/);

    // The monitoring board index page loads with its toolbar and section headers.
    await expect(page.getByText('Monitoring Board').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Entry' })).toBeVisible();

    // Seeded departments render as board sections (from test-data.yml fixtures).
    await expect(page.getByText('Autocad', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Architecture', { exact: true }).first()).toBeVisible();
});

test('admin can reach the monitoring board directly at /design', async ({ page }) => {
    await loginAs(page, 'admin');

    await page.goto('/design');

    await expect(page).toHaveURL(/\/design$/);
    await expect(page.getByRole('button', { name: 'Add Entry' })).toBeVisible();
});