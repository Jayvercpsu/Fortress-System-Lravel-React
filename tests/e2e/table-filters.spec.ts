import { expect, Page, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_PROJECT_ID } from './support/constants';

test('head admin server-side data tables honor per-page controls and page params', async ({ page }) => {
    await loginAs(page, 'head_admin');

    const cases = [
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
            path: '/weekly-accomplishments?week_from=2026-02-23&week_to=2026-03-08',
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
        // Payroll run no longer renders a DataTable with a Per page control (cutoff buckets + history list now).
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
        const paginationText = page.getByText(/^Page \d+ of \d+$/).last();
        await expect(paginationText).toHaveText(/^Page 1 of \d+$/);

        const totalPagesMatch = (await paginationText.innerText()).match(/^Page 1 of (\d+)$/);
        const totalPages = Number(totalPagesMatch?.[1] || 1);

        if (totalPages > 1) {
            await page.getByRole('button', { name: 'Next' }).last().click();
            await expect(paginationText).toHaveText(new RegExp(`^Page 2 of ${totalPages}$`));
        }
    });
});

test('foreman tables honor per-page controls and pagination', async ({ page }) => {
    await loginAs(page, 'foreman');

    const cases = [
        { name: 'Workers', path: '/foreman/workers', perPageValue: '5', paginate: false },
        // Foreman attendance page hidden for now (stay-in policy — HR logs attendance). Kept for future re-enable.
        // { name: 'Attendance logs', path: '/foreman/attendance?date=2026-03-07', perPageValue: '5', paginate: true },
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

test('project manager payroll cutoff date range filter is aligned with the search box and filters server-side', async ({ page }) => {
    await loginAs(page, 'project_manager');
    await page.goto('/project-manager/payroll');

    const searchBox = page.locator('input[placeholder="Search payroll..."]');
    await expect(searchBox).toBeVisible({ timeout: 20_000 });

    const rangeInput = page.locator('input[placeholder="Select cutoff range…"]');
    await expect(rangeInput).toBeVisible();

    // The cutoff range picker is rendered inline with the search box (same toolbar row).
    const searchToolbar = searchBox.locator('xpath=..');
    await expect(searchToolbar.locator('xpath=.//input[@placeholder="Select cutoff range…"]')).toBeVisible();

    const beforeRowTotal = await readTableTotal(page);
    const beforePayableTotal = await readPayrollTotal(page);

    // Open the calendar and navigate to January 2026 via the custom header selects.
    await rangeInput.click();
    const calendar = page.locator('.bb-datepicker');
    await expect(calendar).toBeVisible();
    await calendar.locator('.bb-datepicker-select').nth(0).selectOption('0'); // January
    await calendar.locator('.bb-datepicker-select').nth(1).selectOption('2026');

    await calendar
        .locator('.react-datepicker__day:not(.react-datepicker__day--outside-month)')
        .filter({ hasText: /^5$/ })
        .first()
        .click();
    await calendar
        .locator('.react-datepicker__day:not(.react-datepicker__day--outside-month)')
        .filter({ hasText: /^25$/ })
        .first()
        .click();

    // Picking both dates navigates with the cutoff params (server-side filter).
    await expect(page).toHaveURL(/(?:\?|&)cutoff_start=2026-01-05(?:&|$)/);
    await expect(page).toHaveURL(/(?:\?|&)cutoff_end=2026-01-25(?:&|$)/);

    // The input reflects the committed range.
    await expect(rangeInput).toHaveValue(/2026-01-05 .* 2026-01-25/);

    // The filtered total is strictly smaller than the unfiltered total.
    await expect(async () => {
        expect(await readTableTotal(page)).toBeLessThan(beforeRowTotal);
    }).toPass({ timeout: 10_000 });

    // The filtered Total Payable header is strictly smaller than the unfiltered total.
    await expect(async () => {
        expect(await readPayrollTotal(page)).toBeLessThan(beforePayableTotal);
    }).toPass({ timeout: 10_000 });

    // The header label changes to "Filtered Total Payable" when filters are active.
    await expect(page.locator('text=Filtered Total Payable')).toBeVisible();

    // Clear filter removes the params and restores the full list.
    await page.getByRole('button', { name: 'Clear filter' }).click();
    await expect(page).not.toHaveURL(/cutoff_start=/);
    await expect(page.getByRole('button', { name: 'Clear filter' })).toBeVisible();

    // The header label reverts to "Total Payable" and amount restores.
    await expect(page.locator('text=Total Payable')).toBeVisible();
    await expect(async () => {
        expect(await readPayrollTotal(page)).toBe(beforePayableTotal);
    }).toPass({ timeout: 10_000 });
});

async function readTableTotal(page: Page): Promise<number> {
    const text = await page.getByText(/^Showing \d+-\d+ of \d+$/).last().innerText();
    const match = text.match(/ of (\d+)$/);
    return Number(match?.[1] || 0);
}

async function readPayrollTotal(page: Page): Promise<number> {
    const text = await page.locator('text=/Total Payable|Filtered Total Payable/').first().innerText();
    const match = text.match(/P\s*([\d,]+\.?\d*)/);
    return match ? Number(match[1].replace(/,/g, '')) : 0;
}

async function selectPerPage(page: Page, value: string) {
    const label = page.locator('span').filter({ hasText: /^Per page$/ }).last();
    await label.locator('xpath=following-sibling::select[1]').selectOption(value);
}

async function selectStatus(page: Page, value: string) {
    const label = page.locator('span').filter({ hasText: /^Status$/ }).last();
    await label.locator('xpath=following-sibling::select[1]').selectOption(value);
}
