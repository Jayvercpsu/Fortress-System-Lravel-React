import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

test.describe.configure({ mode: 'serial' });

test('build scope modals accept leading-zero progress like 060 as 60', async ({ page }) => {
    const scopeName = `E2E leading-zero scope ${Date.now()}`;

    await loginAs(page, 'admin');
    await page.goto(`/projects/${DEMO_PROJECT_ID}/build`);

    // Add Scope modal with 060 for both progress fields must not show integer errors.
    await page.getByRole('button', { name: 'Add Scope' }).click();
    await page.locator('label').filter({ hasText: 'Scope Name' }).locator('input').fill(scopeName);
    await page.locator('label').filter({ hasText: 'Contract Amount' }).locator('input').fill('1000');
    await page.locator('label').filter({ hasText: 'Weight %' }).locator('input').fill('0');
    await page.locator('label').filter({ hasText: 'Progress (%) — PM' }).locator('input').fill('060');
    await page.locator('label').filter({ hasText: 'Progress (%) — Foreman' }).locator('input').fill('060');
    await page.getByRole('button', { name: 'Add Scope' }).last().click();

    await expect(page).toHaveURL(new RegExp(`/projects/${DEMO_PROJECT_ID}/build`));
    await expect(page.locator('body')).toContainText(scopeName);
    await expect(page.locator('body')).not.toContainText('must be an integer');

    // Edit Scope modal with 060 must also pass validation.
    await page.goto(`/projects/${DEMO_PROJECT_ID}/build`);
    const row = page.locator('tr').filter({ hasText: scopeName }).first();
    await row.locator('input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Edit Selected' }).click();
    await page.locator('label').filter({ hasText: 'Progress (%) — PM' }).locator('input').fill('060');
    await page.locator('label').filter({ hasText: 'Progress (%) — Foreman' }).locator('input').fill('060');
    await page.getByRole('button', { name: 'Save Changes' }).click();

    await expect(page.locator('body')).not.toContainText('must be an integer');
    await expect(page.locator('body')).toContainText(scopeName);
});
