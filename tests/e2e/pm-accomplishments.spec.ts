import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

test('project create form offers an optional assigned PM', async ({ page }) => {
    await loginAs(page, 'head_admin');
    await page.goto('/projects/create');

    await expect(page.getByText('Assigned PM', { exact: true })).toBeVisible();
    await expect(page.getByText(/only one assigned PM/i)).toBeVisible();
});

test('pm accomplishments page shows the independent PM grid', async ({ page }) => {
    await loginAs(page, 'project_manager');
    await page.goto('/project-manager/accomplishments');

    await expect(page.getByText('Weekly Accomplishment %', { exact: true })).toBeVisible();
    // No foreman selector on the independent PM grid.
    await expect(page.getByText('Select a foreman')).toHaveCount(0);
    // Scope photo uploads are available per row.
    await expect(page.getByText('Scope Photos', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Save Accomplishment' })).toBeVisible();

    // Saving a percent surfaces the PM Progress summary label.
    const firstInput = page.locator('table tbody input[type="number"]').first();
    const originalValue = await firstInput.inputValue();
    await firstInput.fill('33');
    await page.getByRole('button', { name: 'Save Accomplishment' }).click();
    await expect(page.getByText('Accomplishment updated successfully.')).toBeVisible();
    await expect(page.getByText(/PM Progress/i).first()).toBeVisible();

    // Restore the original value so later specs see a clean grid.
    await page.locator('table tbody input[type="number"]').first().fill(originalValue);
    await page.getByRole('button', { name: 'Save Accomplishment' }).click();
    await expect(page.getByText('Accomplishment updated successfully.')).toBeVisible();
});
