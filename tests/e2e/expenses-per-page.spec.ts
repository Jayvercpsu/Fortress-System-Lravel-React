import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

test.setTimeout(120_000);

test('expenses table defaults to 10 per page', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto(`/projects/${DEMO_PROJECT_ID}/build?tab=expenses`);

    await expect(page.locator('thead tr').first()).toContainText('Created At');

    const perPageSelect = page.locator('span', { hasText: 'Per page' }).first()
        .locator('xpath=following-sibling::select[1]');
    await expect(perPageSelect).toHaveValue('10');
});
