import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

test('weekly accomplishments shows Submitted By with Name (Role) format', async ({ page }) => {
    await loginAs(page, 'head_admin');

    await page.goto('/weekly-accomplishments?week_from=2026-02-23&week_to=2026-03-08');

    // The Foreman column was replaced by Submitted By.
    await expect(page.getByText('Submitted By', { exact: true }).first()).toBeVisible();

    // Fixture rows have no recorded submitter, so they fall back to the foreman.
    // Two-line cell: name on line 1, muted role caption on line 2.
    const submittedCell = page.getByRole('cell', { name: /Fortress Demo Foreman.*Foreman/ }).first();
    await expect(submittedCell).toBeVisible();
    await expect(submittedCell.getByText('Fortress Demo Foreman', { exact: true })).toBeVisible();
    await expect(submittedCell.getByText('Foreman', { exact: true })).toBeVisible();
});
