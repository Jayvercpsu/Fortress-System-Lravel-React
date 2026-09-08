import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

test('scope of works rows highlight on hover', async ({ page }) => {
    await loginAs(page, 'admin');
    await page.goto(`/projects/${DEMO_PROJECT_ID}/build`);

    const row = page.locator('tr.bb-scope-row').first();
    await expect(row).toBeVisible();

    const before = await row.evaluate((el) => getComputedStyle(el).backgroundColor);
    await row.hover();
    await expect
        .poll(async () => row.evaluate((el) => getComputedStyle(el).backgroundColor), { timeout: 5000 })
        .not.toBe(before);
});
