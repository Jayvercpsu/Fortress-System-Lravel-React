import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

test.setTimeout(120_000);

test('expenses table amount does not wrap', async ({ page }) => {
    const expenseNote = `E2E nowrap amount ${Date.now()}`;

    await loginAs(page, 'head_admin');
    await page.goto(`/projects/${DEMO_PROJECT_ID}/build?tab=expenses`);

    await page.locator('label').filter({ hasText: 'Amount' }).locator('input').fill('1234567.89');
    await page.locator('label').filter({ hasText: 'Note' }).locator('input').fill(expenseNote);
    await page.getByRole('button', { name: 'Add Expense' }).click();

    const expenseRow = page.locator('tr').filter({ hasText: expenseNote }).first();
    await expect(expenseRow).toBeVisible();
    await expect(expenseRow.getByText('P 1,234,567.89')).toHaveCSS('white-space', 'nowrap');

    const expenseRowForCleanup = page.locator('tr').filter({ hasText: expenseNote }).first();
    await expenseRowForCleanup.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).last().click();
    await expect(page.locator('body')).not.toContainText(expenseNote);
});
