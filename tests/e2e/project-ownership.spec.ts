import { expect, test } from '@playwright/test';
import { DEMO_PROJECT_ID } from './support/constants';

test('a second head admin only sees their own projects', async ({ page }) => {
    await test.step('Log in as a second head admin', async () => {
        await page.goto('/login');
        await page.locator('input[name="email"]').fill('headadmin2@buildbooks.com');
        await page.locator('input[type="password"]').fill('password');
        await page.getByRole('button', { name: /sign in/i }).click();
        await expect(page).toHaveURL(/\/head-admin(?:\?|$)/);
    });

    await test.step('Legacy projects (no owner) are not shown on the board', async () => {
        await page.goto('/projects');
        await expect(
            page.locator(`[data-testid="kanban-card"][data-project-id="${DEMO_PROJECT_ID}"]`)
        ).toHaveCount(0);
    });

    await test.step('Direct URL to a legacy project returns 404', async () => {
        const response = await page.goto(`/projects/${DEMO_PROJECT_ID}`);
        expect(response?.status()).toBe(404);
    });
});