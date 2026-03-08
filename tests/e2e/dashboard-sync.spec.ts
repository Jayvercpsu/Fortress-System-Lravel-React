import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';
import { readLabeledMoney, readStatMoney, selectDateInput } from './support/ui';

test.describe.configure({ mode: 'serial' });

test('dashboard and report computations stay synced after payment and expense changes', async ({ page, browser }) => {
    const paymentAmount = 12345.67;
    const expenseAmount = 4321.0;
    const paymentReference = `E2E-PAY-${Date.now()}`;
    const expenseNote = `E2E expense ${Date.now()}`;

    const adminContext = await browser.newContext();
    const hrContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    const hrPage = await hrContext.newPage();

    try {
        await loginAs(page, 'head_admin');
        await loginAs(adminPage, 'admin');
        await loginAs(hrPage, 'hr');

        const initialHeadAdmin = await readDashboardSnapshot(page, '/head-admin');
        const initialAdmin = await readDashboardSnapshot(adminPage, '/admin');
        const initialHr = await readDashboardSnapshot(hrPage, '/hr');
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

            const paymentHeadAdmin = await readDashboardSnapshot(page, '/head-admin');
            const paymentAdmin = await readDashboardSnapshot(adminPage, '/admin');
            const paymentHr = await readDashboardSnapshot(hrPage, '/hr');
            const paymentReports = await readReportSnapshot(page);

            expect(paymentHeadAdmin.collected).toBeCloseTo(initialHeadAdmin.collected + paymentAmount, 2);
            expect(paymentHeadAdmin.uncollected).toBeCloseTo(initialHeadAdmin.uncollected - paymentAmount, 2);
            expect(paymentAdmin.collected).toBeCloseTo(initialAdmin.collected + paymentAmount, 2);
            expect(paymentAdmin.uncollected).toBeCloseTo(initialAdmin.uncollected - paymentAmount, 2);
            expect(paymentHr.collected).toBeCloseTo(initialHr.collected + paymentAmount, 2);
            expect(paymentHr.uncollected).toBeCloseTo(initialHr.uncollected - paymentAmount, 2);
            expect(paymentReports.collected).toBeCloseTo(initialReports.collected + paymentAmount, 2);

            await page.goto(`/projects/${DEMO_PROJECT_ID}/payments`);
            const paymentRow = page.locator('tr').filter({ hasText: paymentReference }).first();
            await paymentRow.getByRole('button', { name: 'Delete' }).click();
            await page.getByRole('button', { name: 'Delete' }).last().click();
            await expect(page.locator('body')).not.toContainText(paymentReference);

            const revertedHeadAdmin = await readDashboardSnapshot(page, '/head-admin');
            const revertedAdmin = await readDashboardSnapshot(adminPage, '/admin');
            const revertedHr = await readDashboardSnapshot(hrPage, '/hr');
            const revertedReports = await readReportSnapshot(page);

            expect(revertedHeadAdmin.collected).toBeCloseTo(initialHeadAdmin.collected, 2);
            expect(revertedHeadAdmin.uncollected).toBeCloseTo(initialHeadAdmin.uncollected, 2);
            expect(revertedAdmin.collected).toBeCloseTo(initialAdmin.collected, 2);
            expect(revertedAdmin.uncollected).toBeCloseTo(initialAdmin.uncollected, 2);
            expect(revertedHr.collected).toBeCloseTo(initialHr.collected, 2);
            expect(revertedHr.uncollected).toBeCloseTo(initialHr.uncollected, 2);
            expect(revertedReports.collected).toBeCloseTo(initialReports.collected, 2);
        });

        await test.step('Add a project expense and verify synced expense totals', async () => {
            await page.goto(`/projects/${DEMO_PROJECT_ID}/build?tab=expenses`);
            await page.locator('label').filter({ hasText: 'Amount' }).locator('input').fill(expenseAmount.toFixed(2));
            await page.locator('label').filter({ hasText: 'Note' }).locator('input').fill(expenseNote);
            await page.getByRole('button', { name: 'Add Expense' }).click();

            await expect(page.locator('body')).toContainText(expenseNote);

            const expenseHeadAdmin = await readDashboardSnapshot(page, '/head-admin');
            const expenseAdmin = await readDashboardSnapshot(adminPage, '/admin');
            const expenseHr = await readDashboardSnapshot(hrPage, '/hr');
            const expenseReports = await readReportSnapshot(page);

            expect(expenseHeadAdmin.expenses).toBeCloseTo(initialHeadAdmin.expenses + expenseAmount, 2);
            expect(expenseAdmin.expenses).toBeCloseTo(initialAdmin.expenses + expenseAmount, 2);
            expect(expenseHr.expenses).toBeCloseTo(initialHr.expenses + expenseAmount, 2);
            expect(expenseReports.expenses).toBeCloseTo(initialReports.expenses + expenseAmount, 2);

            await page.goto(`/projects/${DEMO_PROJECT_ID}/build?tab=expenses`);
            const expenseRow = page.locator('tr').filter({ hasText: expenseNote }).first();
            await expenseRow.getByRole('button', { name: 'Delete' }).click();
            await page.getByRole('button', { name: 'Delete' }).last().click();
            await expect(page.locator('body')).not.toContainText(expenseNote);

            const revertedHeadAdmin = await readDashboardSnapshot(page, '/head-admin');
            const revertedAdmin = await readDashboardSnapshot(adminPage, '/admin');
            const revertedHr = await readDashboardSnapshot(hrPage, '/hr');
            const revertedReports = await readReportSnapshot(page);

            expect(revertedHeadAdmin.expenses).toBeCloseTo(initialHeadAdmin.expenses, 2);
            expect(revertedAdmin.expenses).toBeCloseTo(initialAdmin.expenses, 2);
            expect(revertedHr.expenses).toBeCloseTo(initialHr.expenses, 2);
            expect(revertedReports.expenses).toBeCloseTo(initialReports.expenses, 2);
        });
    } finally {
        await adminContext.close();
        await hrContext.close();
    }
});

async function readDashboardSnapshot(page: import('@playwright/test').Page, path: string) {
    await page.goto(path);

    return {
        collected: await readStatMoney(page, 'Collected Contract Value'),
        uncollected: await readStatMoney(page, 'Uncollected Contract Value'),
        expenses: await readLabeledMoney(page, 'Total Expenses'),
    };
}

async function readReportSnapshot(page: import('@playwright/test').Page) {
    await page.goto('/reports');

    return {
        collected: await readStatMoney(page, 'Collected Contract Value'),
        expenses: await readStatMoney(page, 'Total Expenses'),
    };
}
