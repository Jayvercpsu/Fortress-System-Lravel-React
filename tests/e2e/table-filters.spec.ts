import { expect, Page, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

test('head admin server-side data tables honor per-page controls and page params', async ({ page }) => {
    await loginAs(page, 'head_admin');

    const cases = [
        { name: 'Attendance logs', path: '/attendance', perPageParam: 'per_page', pageParam: 'page', perPageValue: '5', paginate: true },
        { name: 'Attendance summary', path: '/attendance/summary', perPageParam: 'per_page', pageParam: 'page', perPageValue: '5', paginate: true },
        { name: 'Users', path: '/users', perPageParam: 'per_page', pageParam: 'page', perPageValue: '25', paginate: false },
        { name: 'Project payments', path: `/projects/${DEMO_PROJECT_ID}/payments`, perPageParam: 'per_page', pageParam: 'page', perPageValue: '5', paginate: false },
        { name: 'Project expenses', path: `/projects/${DEMO_PROJECT_ID}/build?tab=expenses`, perPageParam: 'expense_per_page', pageParam: 'expense_page', perPageValue: '10', paginate: false },
        { name: 'Project team', path: `/projects/${DEMO_PROJECT_ID}?tab=overview`, perPageParam: 'team_per_page', pageParam: 'team_page', perPageValue: '10', paginate: false },
        { name: 'Project files', path: `/projects/${DEMO_PROJECT_ID}?tab=files`, perPageParam: 'files_per_page', pageParam: 'files_page', perPageValue: '10', paginate: false },
        { name: 'Project updates', path: `/projects/${DEMO_PROJECT_ID}?tab=updates`, perPageParam: 'updates_per_page', pageParam: 'updates_page', perPageValue: '10', paginate: false },
    ] as const;

    for (const tableCase of cases) {
        await test.step(tableCase.name, async () => {
            await page.goto(tableCase.path);
            await selectPerPage(page, tableCase.perPageValue);
            await expect(page).toHaveURL(new RegExp(`[?&]${tableCase.perPageParam}=${tableCase.perPageValue}(?:&|$)`));

            if (tableCase.paginate) {
                await page.getByRole('button', { name: 'Next' }).last().click();
                await expect(page).toHaveURL(new RegExp(`[?&]${tableCase.pageParam}=2(?:&|$)`));
            }
        });
    }
});

test('head admin grouped tables honor per-page controls and status filters', async ({ page }) => {
    await loginAs(page, 'head_admin');

    const cases = [
        {
            name: 'Materials',
            path: '/materials',
            statusValue: 'approved',
            includeText: 'Rebar',
            excludeText: 'Cement',
        },
        {
            name: 'Delivery',
            path: '/delivery',
            statusValue: 'incomplete',
            includeText: 'PVC Pipe',
            excludeText: 'Cement',
        },
        {
            name: 'Issues',
            path: '/issues',
            statusValue: 'resolved',
            includeText: 'Rainwater ponding near stockpile',
            excludeText: 'Formwork alignment at stair core',
        },
        {
            name: 'Progress photos',
            path: '/progress-photos',
            statusValue: '',
            includeText: 'Fortress Building',
            excludeText: '',
        },
        {
            name: 'Weekly accomplishments',
            path: '/weekly-accomplishments',
            statusValue: '',
            includeText: 'Structural Columns and Beams',
            excludeText: '',
        },
    ] as const;

    for (const tableCase of cases) {
        await test.step(tableCase.name, async () => {
            await page.goto(tableCase.path);
            await selectPerPage(page, '5');
            await expect(page).toHaveURL(/(?:\?|&)per_page=5(?:&|$)/);

            if (tableCase.statusValue) {
                await selectStatus(page, tableCase.statusValue);
                await expect(page).toHaveURL(new RegExp(`[?&]status=${tableCase.statusValue}(?:&|$)`));
                await expect(page.locator('body')).toContainText(tableCase.includeText);
                await expect(page.locator('body')).not.toContainText(tableCase.excludeText);
            } else {
                await expect(page.locator('body')).toContainText(tableCase.includeText);
            }
        });
    }
});

test('hr tables update server-side filters and local payroll pagination', async ({ page }) => {
    await loginAs(page, 'hr');

    const serverCases = [
        { name: 'Worker rates', path: '/payroll/worker-rates', perPageValue: '5', paginate: true },
        { name: 'Payroll run', path: '/payroll/run', perPageValue: '5', paginate: true },
    ] as const;

    for (const tableCase of serverCases) {
        await test.step(tableCase.name, async () => {
            await page.goto(tableCase.path);
            await selectPerPage(page, tableCase.perPageValue);
            await expect(page).toHaveURL(new RegExp(`[?&]per_page=${tableCase.perPageValue}(?:&|$)`));

            if (tableCase.paginate) {
                await page.getByRole('button', { name: 'Next' }).last().click();
                await expect(page).toHaveURL(/(?:\?|&)page=2(?:&|$)/);
            }
        });
    }

    await test.step('Manual payroll uses local pagination controls', async () => {
        await page.goto('/payroll');
        await selectPerPage(page, '5');
        await expect(page.locator('body')).toContainText('Page 1 of 2');
        await page.getByRole('button', { name: 'Next' }).last().click();
        await expect(page.locator('body')).toContainText('Page 2 of 2');
    });
});

test('foreman tables honor per-page controls and pagination', async ({ page }) => {
    await loginAs(page, 'foreman');

    const cases = [
        { name: 'Workers', path: '/foreman/workers', perPageValue: '5', paginate: false },
        { name: 'Attendance logs', path: '/foreman/attendance?date=2026-03-07', perPageValue: '5', paginate: true },
    ] as const;

    for (const tableCase of cases) {
        await test.step(tableCase.name, async () => {
            await page.goto(tableCase.path);
            await selectPerPage(page, tableCase.perPageValue);
            await expect(page).toHaveURL(new RegExp(`[?&]per_page=${tableCase.perPageValue}(?:&|$)`));

            if (tableCase.paginate) {
                await page.getByRole('button', { name: 'Next' }).last().click();
                await expect(page).toHaveURL(/(?:\?|&)page=2(?:&|$)/);
            }
        });
    }
});

async function selectPerPage(page: Page, value: string) {
    const label = page.locator('span').filter({ hasText: /^Per page$/ }).last();
    await label.locator('xpath=following-sibling::select[1]').selectOption(value);
}

async function selectStatus(page: Page, value: string) {
    const label = page.locator('span').filter({ hasText: /^Status$/ }).last();
    await label.locator('xpath=following-sibling::select[1]').selectOption(value);
}
