import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

test.describe.configure({ mode: 'serial' });

test('Foreman can add a worker from the workers page', async ({ page }) => {
    const workerName = `Browser Worker ${Date.now()}`;

    await test.step('Go to the login page and login as foreman', async () => {
        await loginAs(page, 'foreman');
    });

    await test.step('Open the workers page and add a new worker', async () => {
        await page.goto('/foreman/workers');
        await page.locator('label', { hasText: 'Worker Name' }).locator('input').fill(workerName);
        await page.getByRole('button', { name: 'Add Worker' }).click();
    });

    await test.step('Verify the new worker appears in the worker table', async () => {
        await expect(page.locator('body')).toContainText(workerName);
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

    await test.step('Open the payroll cutoff dropdown and load more cutoff options', async () => {
        await page.goto('/payroll/run');
        await page.getByText('View Cutoff').locator('xpath=following-sibling::div//button[1]').click();
        await expect(page.getByRole('button', { name: 'Load more' })).toBeVisible();
        await expect(page.locator('body')).not.toContainText('2026-01-19 to 2026-01-25 (generated)');
        await page.getByRole('button', { name: 'Load more' }).click();
        await expect(page.locator('body')).toContainText('2026-01-19 to 2026-01-25 (generated)');
    });
});
