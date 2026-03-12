import { expect, Page, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { RoleKey } from './support/constants';
import { selectSearchableDropdownOption } from './support/ui';

const DATE_FROM = '2026-02-23';
const DATE_TO = '2026-03-07';
const KPI_ROLES: RoleKey[] = ['head_admin', 'admin', 'hr'];

for (const role of KPI_ROLES) {
    test(`${role} can use KPI filters, search, and exports`, async ({ page }) => {
        await loginAs(page, role);
        await page.goto('/kpi');

        await expect(page.getByTestId('kpi-top-workers')).toBeVisible();
        await expect(page.getByTestId('kpi-top-foremen')).toBeVisible();
        await expect(page.getByTestId('kpi-worker-table')).toBeVisible();
        await expect(page.getByTestId('kpi-foreman-table')).toBeVisible();

        await assertTopListMax(page, 'kpi-top-worker-row');
        await assertTopListMax(page, 'kpi-top-foreman-row');

        await setDateInput(page, 'kpi-date-from', DATE_FROM);
        await setDateInput(page, 'kpi-date-to', DATE_TO);

        await selectSearchableDropdownOption(
            page,
            page.getByTestId('kpi-filters').locator('div').filter({ hasText: /^Project$/ }).first().locator('xpath=following-sibling::div[1]//button[1]'),
            'Fortress Building',
            'Fortress Building'
        );
        await page.getByTestId('kpi-delivery-basis-select').selectOption('delivery_date');

        await page.getByTestId('kpi-promotion-ready').fill('90');
        await page.getByTestId('kpi-promotion-track').fill('80');

        await page.getByTestId('kpi-apply').click();

        await expect(page).toHaveURL(/date_from=2026-02-23/);
        await expect(page).toHaveURL(/date_to=2026-03-07/);
        await expect(page).toHaveURL(/project_id=\d+/);
        await expect(page).toHaveURL(/delivery_date_basis=delivery_date/);
        await expect(page).toHaveURL(/promotion_ready=90/);
        await expect(page).toHaveURL(/promotion_track=80/);

        const exportHref = await page.getByTestId('kpi-export').getAttribute('href');
        expect(exportHref || '').toContain('promotion_ready=90');
        expect(exportHref || '').toContain('promotion_track=80');
        expect(exportHref || '').toContain('delivery_date_basis=delivery_date');

        const printHref = await page.getByTestId('kpi-print').getAttribute('href');
        expect(printHref || '').toContain('promotion_ready=90');
        expect(printHref || '').toContain('promotion_track=80');
        expect(printHref || '').toContain('delivery_date_basis=delivery_date');

        await page.getByTestId('kpi-search-input').fill('Co-Foreman');

        const foremanRows = page.getByTestId('kpi-foreman-row');
        const foremanCount = await foremanRows.count();
        expect(foremanCount).toBeGreaterThan(0);

        for (let i = 0; i < foremanCount; i += 1) {
            await expect(foremanRows.nth(i)).toContainText(/Co-Foreman/i);
        }

        await expect(page.getByTestId('kpi-foreman-table')).toContainText('Issues');
        await expect(page.getByTestId('kpi-foreman-table')).toContainText('Uploads');
    });
}

async function assertTopListMax(page: Page, rowTestId: string) {
    const rows = page.getByTestId(rowTestId);
    const count = await rows.count();
    if (count > 0) {
        expect(count).toBeLessThanOrEqual(5);
    }
}

async function setDateInput(page: Page, testId: string, value: string) {
    const [year, month, day] = value.split('-').map((part) => Number(part));
    const monthIndex = month - 1;
    const dayLabel = String(day).padStart(2, '0');

    const input = page.getByTestId(testId).locator('input');
    await input.click();

    const picker = page.locator('.bb-datepicker');
    await expect(picker).toBeVisible();

    const monthSelect = picker.locator('.bb-datepicker-select').nth(0);
    const yearSelect = picker.locator('.bb-datepicker-select').nth(1);

    await monthSelect.selectOption(String(monthIndex));
    await yearSelect.selectOption(String(year));

    await picker
        .locator(`.react-datepicker__day--0${dayLabel}:not(.react-datepicker__day--outside-month)`)
        .first()
        .click();
}
