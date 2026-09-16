import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

const SCOPE_NAME = 'Foundation and Footings';

test('project manager compares a scope against the foreman submission', async ({ page }) => {
    await loginAs(page, 'project_manager');

    await page.goto('/project-manager/accomplishments');
    await expect(page.getByText('Weekly Accomplishment %')).toBeVisible();

    // Every grid row offers a read-only foreman comparison.
    const scopeRow = page.getByRole('row', { name: new RegExp(SCOPE_NAME) });
    await expect(scopeRow).toBeVisible();
    await scopeRow.getByRole('button', { name: new RegExp(`Compare.*${SCOPE_NAME}`, 'i') }).click();

    const modal = page.getByTestId('compare-modal');
    await expect(modal).toBeVisible();
    await expect(modal.getByText('Scope Comparison')).toBeVisible();
    await expect(modal.getByText(SCOPE_NAME).first()).toBeVisible();

    // Both sides render: the PM value plus either the foreman percent or
    // the empty state when nobody submitted for the selected week.
    const sidePercents = modal.getByTestId('compare-side-percent');
    await expect(sidePercents.first()).toBeVisible();
    const foremanEmpty = modal.getByText('No foreman submission for this scope this week.');
    if ((await foremanEmpty.count()) === 0) {
        await expect(sidePercents.nth(1)).not.toHaveText('—');
    }

    await expect(modal.getByTestId('compare-difference')).toBeVisible();

    await modal.getByRole('button', { name: 'Close' }).click();
    await expect(modal).toHaveCount(0);
});
