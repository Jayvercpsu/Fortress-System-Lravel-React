import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { CO_FOREMAN_PUBLIC_TOKEN } from './support/constants';

const SCOPE_NAME = 'Foundation and Footings';
const SAVED_PERCENT = '77';

test('project manager saves independent accomplishment percents that never touch the foreman jotform', async ({ page }) => {
    await loginAs(page, 'project_manager');

    // loginAs restores the session without navigating, so open the
    // dashboard explicitly before using its sidebar links.
    await page.goto('/project-manager');

    // Open the new Accomplishment page from the left sidebar.
    await page.getByRole('link', { name: 'Accomplishment' }).click();
    await expect(page).toHaveURL(/\/project-manager\/accomplishments(?:\?|$)/);
    await expect(page.getByText('Weekly Accomplishment %')).toBeVisible();

    // The PM grid shows the assigned project's scope plan (no foreman picker).
    await expect(page.getByText('Select a foreman')).toHaveCount(0);
    const scopeRow = page.getByRole('row', { name: new RegExp(SCOPE_NAME) });
    await expect(scopeRow).toBeVisible();

    const percentInput = scopeRow.locator('input[type="number"]');
    await percentInput.fill(SAVED_PERCENT);

    await page.getByRole('button', { name: 'Save Accomplishment' }).click();
    await expect(page.getByText('Accomplishment updated successfully.')).toBeVisible();

    // The saved percent persists on the PM page.
    await page.reload();
    await expect(page.getByRole('row', { name: new RegExp(SCOPE_NAME) }).locator('input[type="number"]')).toHaveValue(SAVED_PERCENT);

    // The same value never leaks into the foreman's jotform (independent data).
    await page.goto(`/progress-submit/${CO_FOREMAN_PUBLIC_TOKEN}`);
    await page.getByRole('button', { name: /Weekly Progress \(Accomplishment %\)/i }).click();
    const jotformRow = page.getByRole('row', { name: new RegExp(SCOPE_NAME) });
    await expect(jotformRow).toBeVisible();
    await expect(jotformRow.locator('input[type="number"]')).not.toHaveValue(SAVED_PERCENT);
});
