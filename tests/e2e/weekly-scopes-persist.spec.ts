import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';

/**
 * Regression: unedited weekly scopes must never disappear from the grid.
 * Editing one scope and saving must leave every other scope (null/0)
 * visible after reload — on both the PM accomplishments page and the
 * foreman jotform.
 */
test('unedited weekly scopes stay visible after a partial save', async ({ page }) => {
    await loginAs(page, 'project_manager');
    await page.goto('/project-manager');
    await page.getByRole('link', { name: 'Accomplishment' }).click();
    await expect(page).toHaveURL(/\/project-manager\/accomplishments(?:\?|$)/);
    await expect(page.getByText('Weekly Accomplishment %')).toBeVisible();

    const gridInputs = page.locator('table tbody input[type="number"]');
    const initialCount = await gridInputs.count();
    expect(initialCount).toBeGreaterThan(1);

    const secondRowName = (
        (await page.locator('table tbody tr').nth(1).innerText()).split('\n')[0] ?? ''
    ).trim();
    expect(secondRowName).not.toBe('');

    // Edit ONLY the first scope, then save.
    const firstInput = gridInputs.first();
    const originalValue = await firstInput.inputValue();
    const editedValue = originalValue.trim() === '42' ? '43' : '42';
    await firstInput.fill(editedValue);
    await page.getByRole('button', { name: 'Save Accomplishment' }).click();
    await expect(page.getByText('Accomplishment updated successfully.')).toBeVisible();

    // Reload: the grid must still show every scope, including unedited ones.
    await page.reload();
    await expect(page.getByText('Weekly Accomplishment %')).toBeVisible();
    await expect(page.locator('table tbody input[type="number"]')).toHaveCount(initialCount);
    await expect(page.getByRole('row', { name: new RegExp(secondRowName) })).toBeVisible();
    await expect(gridInputs.first()).toHaveValue(editedValue);

    // Restore the original value so later specs see a clean grid.
    await gridInputs.first().fill(originalValue);
    await page.getByRole('button', { name: 'Save Accomplishment' }).click();
    await expect(page.getByText('Accomplishment updated successfully.')).toBeVisible();
});
