import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

test.describe.configure({ mode: 'serial' });

test('admin can bulk-select scopes and edit only a single selection', async ({ page }) => {
    const firstScope = `E2E bulk scope A ${Date.now()}`;
    const secondScope = `E2E bulk scope B ${Date.now()}`;

    await loginAs(page, 'admin');
    await page.goto(`/projects/${DEMO_PROJECT_ID}/build`);

    for (const name of [firstScope, secondScope]) {
        await page.getByRole('button', { name: 'Add Scope' }).click();
        await page.locator('label').filter({ hasText: 'Scope Name' }).locator('input').fill(name);
        await page.locator('label').filter({ hasText: 'Assigned Personnel' }).getByRole('button').first().click();
        await page.getByPlaceholder('Search foreman...').fill('Fortress Demo Foreman');
        await page.getByRole('button', { name: 'Fortress Demo Foreman' }).first().click();
        await page.locator('label').filter({ hasText: 'Contract Amount' }).locator('input').fill('1000');
        await page.locator('label').filter({ hasText: 'Weight %' }).locator('input').fill('5');
        await page.getByRole('button', { name: 'Add Scope' }).last().click();
        // Scope creation redirects to the monitoring page; wait for it, then return to the build page.
        await expect(page).toHaveURL(new RegExp(`/projects/${DEMO_PROJECT_ID}/monitoring`));
        await expect(page.locator('body')).toContainText(name);
        await page.goto(`/projects/${DEMO_PROJECT_ID}/build`);
        await expect(page.locator('body')).toContainText(name);
    }

    const firstRow = page.locator('tr').filter({ hasText: firstScope }).first();
    const secondRow = page.locator('tr').filter({ hasText: secondScope }).first();

    await expect(page.getByRole('button', { name: 'Edit Selected' })).toBeHidden();
    await expect(page.getByRole('button', { name: /Delete Selected/ })).toBeHidden();

    await firstRow.locator('input[type="checkbox"]').check();
    await expect(page.locator('body')).toContainText('1 selected');
    await expect(page.getByRole('button', { name: 'Edit Selected' })).toBeEnabled();
    await expect(page.getByRole('button', { name: /Delete Selected/ })).toBeEnabled();

    await page.getByRole('button', { name: 'Edit Selected' }).click();
    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).last().click();

    await secondRow.locator('input[type="checkbox"]').check();
    await expect(page.locator('body')).toContainText('2 selected');
    await expect(page.getByRole('button', { name: 'Edit Selected' })).toBeDisabled();

    await page.getByRole('button', { name: /Delete Selected/ }).click();
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await expect(page.locator('body')).not.toContainText(firstScope);
    await expect(page.locator('body')).not.toContainText(secondScope);
    await expect(page.locator('body')).toContainText('No scopes selected.');
    await expect(page.getByRole('button', { name: 'Edit Selected' })).toBeHidden();
    await expect(page.getByRole('button', { name: /Delete Selected/ })).toBeHidden();
});
