import { expect, test } from '@playwright/test';
import { loginAs } from './support/auth';
import { DEMO_ACTIVE_PROJECT_LABEL } from './support/constants';
import { selectDateInput, selectSearchableDropdownOption, selectTimeInput } from './support/ui';

test.describe.configure({ mode: 'serial' });

test('reports receipt links open, download, and print correctly', async ({ page }) => {
    await loginAs(page, 'head_admin');

    await page.goto('/reports');

    const receiptPagePromise = page.context().waitForEvent('page');
    await page.getByRole('link', { name: 'View Receipt' }).first().click();
    const receiptPage = await receiptPagePromise;
    await receiptPage.waitForLoadState('domcontentloaded');

    await expect(receiptPage).toHaveURL(/\/progress-receipt\//);
    await expect(receiptPage.locator('body')).toContainText('Fortress Building');

    const downloadPromise = receiptPage.waitForEvent('download');
    await receiptPage.getByRole('link', { name: 'Download Excel' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename().toLowerCase()).toMatch(/receipt\.csv$/);

    await receiptPage.evaluate(() => {
        window.__printCalled = false;
        window.print = () => {
            window.__printCalled = true;
        };
    });
    await receiptPage.getByRole('button', { name: 'Print Receipt' }).click();
    expect(await receiptPage.evaluate(() => window.__printCalled)).toBe(true);

    await receiptPage.close();
});

test('settings updates persist for profile fields and profile photo uploads', async ({ page }) => {
    const replacementPhoto = 'C:\\Users\\algad\\Projects\\Fortress-System-Lravel-React\\public\\images\\logo.jpg';
    const uniqueSuffix = Date.now();
    const updatedValues = {
        fullname: `Fortress Demo Foreman ${uniqueSuffix}`,
        email: `fortress.foreman+${uniqueSuffix}@buildbooks.com`,
        birth_date: '1991-07-19',
        place_of_birth: 'Minglanilla',
        sex: 'other',
        civil_status: 'Separated',
        phone: '09171112222',
        address: 'Automation test address, Cebu City',
    };

    await loginAs(page, 'foreman');
    await page.goto('/settings');

    const originalValues = {
        fullname: await page.locator('input[name="fullname"]').inputValue(),
        email: await page.locator('input[name="email"]').inputValue(),
        birth_date: await page.locator('input[name="birth_date"]').inputValue(),
        place_of_birth: await page.locator('input[name="place_of_birth"]').inputValue(),
        sex: await page.locator('select[name="sex"]').inputValue(),
        civil_status: await page.locator('select[name="civil_status"]').inputValue(),
        phone: await page.locator('input[name="phone"]').inputValue(),
        address: await page.locator('textarea[name="address"]').inputValue(),
    };

    try {
        await page.locator('input[name="fullname"]').fill(updatedValues.fullname);
        await page.locator('input[name="email"]').fill(updatedValues.email);
        await selectDateInput(page, page.locator('input[name="birth_date"]'), updatedValues.birth_date);
        await page.locator('input[name="place_of_birth"]').fill(updatedValues.place_of_birth);
        await page.locator('select[name="sex"]').selectOption(updatedValues.sex);
        await page.locator('select[name="civil_status"]').selectOption(updatedValues.civil_status);
        await page.locator('input[name="phone"]').fill(updatedValues.phone);
        await page.locator('textarea[name="address"]').fill(updatedValues.address);
        await page.locator('input[name="profile_photo"]').setInputFiles(replacementPhoto);
        await page.getByRole('button', { name: 'Save Settings' }).click();

        await expect(page.locator('input[name="fullname"]')).toHaveValue(updatedValues.fullname);
        await expect(page.locator('input[name="email"]')).toHaveValue(updatedValues.email);
        await expect(page.locator('input[name="birth_date"]')).toHaveValue(updatedValues.birth_date);
        await expect(page.locator('input[name="place_of_birth"]')).toHaveValue(updatedValues.place_of_birth);
        await expect(page.locator('select[name="sex"]')).toHaveValue(updatedValues.sex);
        await expect(page.locator('select[name="civil_status"]')).toHaveValue(updatedValues.civil_status);
        await expect(page.locator('input[name="phone"]')).toHaveValue(updatedValues.phone);
        await expect(page.locator('textarea[name="address"]')).toHaveValue(updatedValues.address);

        await page.reload();

        await expect(page.locator('input[name="fullname"]')).toHaveValue(updatedValues.fullname);
        await expect(page.locator('input[name="email"]')).toHaveValue(updatedValues.email);
        await expect(page.locator('input[name="birth_date"]')).toHaveValue(updatedValues.birth_date);
        await expect(page.locator('input[name="place_of_birth"]')).toHaveValue(updatedValues.place_of_birth);
        await expect(page.locator('select[name="sex"]')).toHaveValue(updatedValues.sex);
        await expect(page.locator('select[name="civil_status"]')).toHaveValue(updatedValues.civil_status);
        await expect(page.locator('input[name="phone"]')).toHaveValue(updatedValues.phone);
        await expect(page.locator('textarea[name="address"]')).toHaveValue(updatedValues.address);
        await expect(page.locator('form img[alt="Profile"]')).toHaveAttribute('src', /\/storage\/profile-photos\//);
    } finally {
        await page.goto('/settings');
        await page.locator('input[name="fullname"]').fill(originalValues.fullname);
        await page.locator('input[name="email"]').fill(originalValues.email);
        await selectDateInput(page, page.locator('input[name="birth_date"]'), originalValues.birth_date);
        await page.locator('input[name="place_of_birth"]').fill(originalValues.place_of_birth);
        await page.locator('select[name="sex"]').selectOption(originalValues.sex || '');
        await page.locator('select[name="civil_status"]').selectOption(originalValues.civil_status || '');
        await page.locator('input[name="phone"]').fill(originalValues.phone);
        await page.locator('textarea[name="address"]').fill(originalValues.address);
        await page.getByRole('button', { name: 'Save Settings' }).click();

        await page.reload();
        await expect(page.locator('input[name="fullname"]')).toHaveValue(originalValues.fullname);
        await expect(page.locator('input[name="email"]')).toHaveValue(originalValues.email);
        await expect(page.locator('input[name="birth_date"]')).toHaveValue(originalValues.birth_date);
        await expect(page.locator('input[name="place_of_birth"]')).toHaveValue(originalValues.place_of_birth);
        await expect(page.locator('select[name="sex"]')).toHaveValue(originalValues.sex);
        await expect(page.locator('select[name="civil_status"]')).toHaveValue(originalValues.civil_status);
        await expect(page.locator('input[name="phone"]')).toHaveValue(originalValues.phone);
        await expect(page.locator('textarea[name="address"]')).toHaveValue(originalValues.address);
    }
});

test('foreman self attendance, add-row attendance submission, and attendance editing work', async ({ page }) => {
    await loginAs(page, 'foreman');

    await page.goto('/foreman');
    await selectSearchableDropdownOption(
        page,
        page.getByRole('button', { name: /Select project/i }).first(),
        DEMO_ACTIVE_PROJECT_LABEL,
        'Fortress Building'
    );
    await page.getByRole('button', { name: 'Time In' }).click();
    await expect(page.locator('body')).toContainText('Timed In');

    await page.getByRole('button', { name: 'Time Out' }).click();
    await expect(page.locator('body')).toContainText('Timed Out');
    await expect(page.getByRole('button', { name: 'Time Out' })).toBeDisabled();

    await page.goto('/foreman/attendance');
    await page.getByRole('button', { name: '+ Add Row' }).click();
    await expect(page.locator('form table tbody tr')).toHaveCount(2);

    const entryRow = page.locator('form table tbody tr').nth(1);
    await selectSearchableDropdownOption(
        page,
        entryRow.locator('button').nth(0),
        DEMO_ACTIVE_PROJECT_LABEL,
        'Fortress Building'
    );
    await selectSearchableDropdownOption(page, entryRow.locator('button').nth(1), 'Ramon Castillo');
    await selectSearchableDropdownOption(page, entryRow.locator('button').nth(2), 'Skilled');
    await selectTimeInput(page, entryRow.locator('input.bb-date-input').nth(0), '08:00');
    await selectTimeInput(page, entryRow.locator('input.bb-date-input').nth(1), '17:00');
    await page.getByRole('button', { name: 'Submit Attendance' }).click();

    await expect(page.locator('body')).toContainText('Ramon Castillo');

    let attendanceRow = page.locator('tr').filter({ hasText: 'Ramon Castillo' }).first();
    await attendanceRow.getByRole('button', { name: 'Edit' }).click();
    await selectTimeInput(page, page.locator('input.bb-date-input').last(), '16:30');
    await page.getByRole('button', { name: 'Save' }).click();

    attendanceRow = page.locator('tr').filter({ hasText: 'Ramon Castillo' }).first();
    await expect(attendanceRow).toContainText('04:30 PM');
    await expect(attendanceRow).toContainText('8.5');
});
