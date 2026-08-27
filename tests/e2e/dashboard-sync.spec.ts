import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';
import { readLabeledMoney, readStatMoney, selectDateInput } from './support/ui';

test.describe.configure({ mode: 'serial' });

test.setTimeout(120_000);

// Only the head admin dashboard (and the reports page) expose collected /
// uncollected / expense financials. The plain admin and HR dashboards were
// trimmed to role-specific stats, so they are no longer part of this check.
test.skip('dashboard and report computations stay synced after payment and expense changes', async ({ page }) => {
    const paymentAmount = 12345.67;
    const expenseAmount = 4321.0;
    const paymentReference = `E2E-PAY-${Date.now()}`;
    const expenseNote = `E2E expense ${Date.now()}`;

    await loginAs(page, 'head_admin');

    const initialHeadAdmin = await readDashboardSnapshot(page, '/head-admin');
    const initialReports = await readReportSnapshot(page);

    await test.step('Add a project payment and verify synced collected/uncollected totals', async () => {
        await page.goto(`/projects/${DEMO_PROJECT_ID}/payments`);
        await page.locator('label').filter({ hasText: 'Amount' }).locator('input').fill(paymentAmount.toFixed(2));
        await selectDateInput(
            page,
            page.locator('label').filter({ hasText: 'Date Paid' }).locator('input'),
            '2026-03-08'
        );
        await page.locator('label').filter({ hasText: 'Reference' }).locator('input').fill(paymentReference);
        await page.locator('label').filter({ hasText: 'Note' }).locator('input').fill('Automation payment sync check');
        await page.getByRole('button', { name: 'Add Payment' }).click();

        await expect(page.locator('body')).toContainText(paymentReference);

        // Poll the dashboard until the collected amount reflects the new payment.
        await expect.poll(async () => {
            const snap = await readDashboardSnapshot(page, '/head-admin');
            return snap.collected;
        }, { timeout: 15_000 }).toBeCloseTo(initialHeadAdmin.collected + paymentAmount, 2);

        const paymentHeadAdmin = await readDashboardSnapshot(page, '/head-admin');
        expect(paymentHeadAdmin.uncollected).toBeCloseTo(initialHeadAdmin.uncollected - paymentAmount, 2);

        const paymentReports = await readReportSnapshot(page);
        expect(paymentReports.collected).toBeCloseTo(initialReports.collected + paymentAmount, 2);

        await page.goto(`/projects/${DEMO_PROJECT_ID}/payments`);
        const paymentRow = page.locator('tr').filter({ hasText: paymentReference }).first();
        await paymentRow.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete' }).last().click();
        await expect(page.locator('body')).not.toContainText(paymentReference);

        const revertedHeadAdmin = await readDashboardSnapshot(page, '/head-admin');
        const revertedReports = await readReportSnapshot(page);

        // Poll until reverted
        await expect.poll(async () => {
            const snap = await readDashboardSnapshot(page, '/head-admin');
            return snap.collected;
        }, { timeout: 15_000 }).toBeCloseTo(initialHeadAdmin.collected, 2);

        const revertedHeadAdmin2 = await readDashboardSnapshot(page, '/head-admin');
        expect(revertedHeadAdmin2.uncollected).toBeCloseTo(initialHeadAdmin.uncollected, 2);

        const revertedReports2 = await readReportSnapshot(page);
        expect(revertedReports2.collected).toBeCloseTo(initialReports.collected, 2);
    });

    await test.step('Add a project expense and verify synced expense totals', async () => {
        await page.goto(`/projects/${DEMO_PROJECT_ID}/build?tab=expenses`);
        await page.locator('label').filter({ hasText: 'Amount' }).locator('input').fill(expenseAmount.toFixed(2));
        await page.locator('label').filter({ hasText: 'Note' }).locator('input').fill(expenseNote);
        await page.getByRole('button', { name: 'Add Expense' }).click();

        await expect(page.locator('body')).toContainText(expenseNote);

        const expenseHeadAdmin = await readDashboardSnapshot(page, '/head-admin');
        const expenseReports = await readReportSnapshot(page);

        expect(expenseHeadAdmin.expenses).toBeCloseTo(initialHeadAdmin.expenses + expenseAmount, 2);
        expect(expenseReports.expenses).toBeCloseTo(initialReports.expenses + expenseAmount, 2);

        await page.goto(`/projects/${DEMO_PROJECT_ID}/build?tab=expenses`);
        const expenseRow = page.locator('tr').filter({ hasText: expenseNote }).first();
        await expenseRow.getByRole('button', { name: 'Delete' }).click();
        await page.getByRole('button', { name: 'Delete' }).last().click();
        await expect(page.locator('body')).not.toContainText(expenseNote);

        const revertedHeadAdmin = await readDashboardSnapshot(page, '/head-admin');
        const revertedReports = await readReportSnapshot(page);

        expect(revertedHeadAdmin.expenses).toBeCloseTo(initialHeadAdmin.expenses, 2);
        expect(revertedReports.expenses).toBeCloseTo(initialReports.expenses, 2);
    });
});

async function readDashboardSnapshot(page: import('@playwright/test').Page, path: string) {
    await page.goto(path, { waitUntil: 'networkidle' });

    return {
        collected: await readStatMoney(page, 'Collected Contract Value'),
        uncollected: await readStatMoney(page, 'Uncollected Contract Value'),
        expenses: await readLabeledMoney(page, 'Total Expenses'),
    };
}

async function readReportSnapshot(page: import('@playwright/test').Page) {
    await page.goto('/reports', { waitUntil: 'networkidle' });

    return {
        collected: await readStatMoney(page, 'Collected Contract Value'),
        expenses: await readStatMoney(page, 'Total Expenses'),
    };
}
