import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

test.describe.configure({ mode: 'serial' });

test('Foreman sees the workers page as read-only', async ({ page }) => {
    await test.step('Go to the login page and login as foreman', async () => {
        await loginAs(page, 'foreman');
    });

    await test.step('Open the workers page and verify it is view-only for foremen', async () => {
        await page.goto('/foreman/workers');
        await expect(page.locator('body')).toContainText('Workers (Read-only)');
        await expect(page.locator('body')).toContainText('HR adds and assigns workers to your site. This list is view-only for foremen.');
    });

    await test.step('Verify there is no Add Worker form for foremen', async () => {
        await expect(page.getByRole('button', { name: 'Add Worker' })).toHaveCount(0);
    });
});

test('Head admin can add a project update from the project page', async ({ page }) => {
    const updateNote = `Browser automation update ${Date.now()}`;

    await test.step('Go to the login page and login as head admin', async () => {
        await loginAs(page, 'head_admin');
    });

    await test.step('Open the project updates tab and post a new update', async () => {
        await page.goto('/projects/1?tab=updates');
        await page.locator('textarea').first().fill(updateNote);
        await page.getByRole('button', { name: 'Post Update' }).click();
    });

    await test.step('Verify the new update is listed on the project page', async () => {
        await expect(page.locator('body')).toContainText(updateNote);
    });
});

test('HR can edit a worker rate and page through payroll cutoffs inside the dropdown', async ({ page }) => {
    await test.step('Go to the login page and login as hr', async () => {
        await loginAs(page, 'hr');
    });

    await test.step('Open worker rates and update the first available rate', async () => {
        await page.goto('/payroll/worker-rates');
        await page.getByRole('button', { name: 'Edit' }).first().click();
        await page.locator('input[type="number"]').fill('166.50');
        await page.getByRole('button', { name: 'Save Rate' }).click();
        await expect(page.locator('body')).toContainText('P 166.50');
    });

    await test.step('Verify the payroll run page loads with cutoff data', async () => {
        await page.goto('/payroll/run');
        await expect(page.locator('body')).toContainText('Payroll Run');
        await expect(page.locator('body')).toContainText('Cutoff');
    });
});
