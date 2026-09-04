import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

test.setTimeout(120_000);

test('expenses table shows Created At next to Amount', async ({ page }) => {
    const expenseNote = `E2E created-at ${Date.now()}`;

    await loginAs(page, 'head_admin');
    await page.goto(`/projects/${DEMO_PROJECT_ID}/build?tab=expenses`);

    await test.step('Created At column header is visible next to Amount', async () => {
        const header = page.locator('thead tr').first();
        await expect(header).toContainText('Amount');
        await expect(header).toContainText('Created At');
    });

    await test.step('New expense row displays its creation timestamp', async () => {
        await page.locator('label').filter({ hasText: 'Amount' }).locator('input').fill('777.00');
        await page.locator('label').filter({ hasText: 'Note' }).locator('input').fill(expenseNote);
        await page.getByRole('button', { name: 'Add Expense' }).click();

        const expenseRow = page.locator('tr').filter({ hasText: expenseNote }).first();
        await expect(expenseRow).toBeVisible();
        await expect(expenseRow).toContainText(/\d{4}-\d{2}-\d{2} \d{1,2}:\d{2}(AM|PM)/);
    });

    await test.step('Cleanup removes the created expense', async () => {
        const expenseRow = page.locator('tr').filter({ hasText: expenseNote }).first();
        await expenseRow.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete' }).last().click();
        await expect(page.locator('body')).not.toContainText(expenseNote);
    });
});
